const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// 加载环境变量
require('dotenv').config();

const config = require('./config/appConfig');

const app = express();
const server = http.createServer(app);
const PORT = config.server.port;

// WebSocket连接存储
const wsClients = new Map();

// 中间件
// 信任反向代理（Nginx），确保能正确识别 HTTPS
app.set('trust proxy', true);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 提供图片访问
app.use('/public', express.static(path.join(__dirname, 'public')));

// 获取服务器基础URL（用于构建图片URL）
function getServerBaseUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

// 图片上传配置
// 根据环境变量选择不同的上传目录
const uploadDir = process.env.IMAGE_UPLOAD_DIR || path.join(__dirname, 'public', 'images');

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`创建图片目录: ${uploadDir}`);
}

// 配置multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'bed-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // 只允许图片
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp)'));
  }
});

// 数据库相关
let db = null;
let orderDao = null;

// 内存存储（兼容模式，如果数据库不可用）
let orders = new Map();
let orderIdCounter = 1;

// ==================== 工具函数 ====================

// 生成订单号
function generateOrderId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
}

// 生成随机字符串
function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成MD5签名
function generateMD5Sign(params, apiKey) {
  // 排序参数
  const sortedKeys = Object.keys(params).sort();
  let stringA = '';
  
  sortedKeys.forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      stringA += `${key}=${params[key]}&`;
    }
  });
  
  stringA += `key=${apiKey}`;
  
  return crypto.createHash('md5').update(stringA, 'utf8').digest('hex').toUpperCase();
}

// 格式化日期
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// ==================== API路由 ====================

// 引入床位类型路由
const bedTypeRoutes = require('./routes/bedTypes');
// 引入订单路由
const orderRoutes = require('./routes/orders');

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// ==================== 认证相关接口 ====================

// 小程序登录接口（获取openid）
app.post('/api/auth/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.json({
        code: 400,
        message: '缺少code参数'
      });
    }

    // 获取小程序配置
    const { appId, appSecret } = config.wechat;

    // 调用微信API获取openid
    const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    const wxResponse = await fetch(wxApiUrl);
    const wxData = await wxResponse.json();

    if (wxData.errcode) {
      return res.json({
        code: 500,
        message: '微信登录失败: ' + wxData.errmsg,
        data: wxData
      });
    }

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        openid: wxData.openid,
        session_key: wxData.session_key
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// ==================== 床位类型相关接口 ====================

// 获取所有床位类型
app.get('/api/bedTypes', bedTypeRoutes.getBedTypes);

// 获取可用的床位类型（必须在 /:id 之前）
app.get('/api/bedTypes/available', bedTypeRoutes.getAvailableBedTypes);

// 获取床位库存信息（必须在 /:id 之前）
app.get('/api/bedTypes/inventory', bedTypeRoutes.getBedInventory);

// 根据ID获取床位类型
app.get('/api/bedTypes/:id', bedTypeRoutes.getBedTypeById);

// 添加床位类型
app.post('/api/bedTypes', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.addBedType(req, res);
});

// 更新床位类型
app.put('/api/bedTypes/:id', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.updateBedType(req, res);
});

// 删除床位类型
app.delete('/api/bedTypes/:id', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.deleteBedType(req, res);
});

// 上传床位图片
app.post('/api/upload/bedImage', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({
        code: 400,
        message: '请选择要上传的图片'
      });
    }

    // 返回图片URL
    const imageUrl = `/public/images/${req.file.filename}`;
    console.log('图片上传成功:', req.file.filename);

    res.json({
      code: 200,
      message: '上传成功',
      data: {
        filename: req.file.filename,
        url: imageUrl,
        fullUrl: `${req.protocol}://${req.get('host')}${imageUrl}`
      }
    });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.json({
      code: 500,
      message: '上传失败: ' + error.message
    });
  }
});

// 获取押金规则
app.get('/api/rules/deposit', bedTypeRoutes.getDepositRules);

// 获取租赁政策
app.get('/api/rules/rental', bedTypeRoutes.getRentalPolicy);

// 获取营业时间
app.get('/api/rules/businessHours', bedTypeRoutes.getBusinessHours);

// 保存系统设置
app.post('/api/settings', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.saveSystemSettings(req, res);
});

// 创建订单
app.post('/api/order/create', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.createOrder(req, res);
});

// 支付订单
app.post('/api/order/pay', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.payOrder(req, res);
});

// 获取微信支付参数
app.post('/api/payment/getParams', async (req, res) => {
  try {
    const { orderId, openid } = req.body;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    // 获取订单信息
    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order = orders.get(orderId);
    }
    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    // 检查是否为开发环境（使用模拟支付）
    const isMockPayment = !config.bed.payment.wechat.mchid || 
                          config.bed.payment.wechat.mchid === 'your_mchid' ||
                          !config.bed.payment.wechat.apiKey || 
                          config.bed.payment.wechat.apiKey === 'your_api_key';

    if (isMockPayment) {
      // 开发环境：返回模拟支付参数
      console.log('使用模拟支付模式');

      // 生成时间戳
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = generateNonceStr();
      const packageStr = `prepay_id=MOCK_PAY_${Date.now()}`;

      // 生成签名（模拟）
      const paySign = generateMD5Sign({
        appId: config.bed.payment.wechat.appid,
        timeStamp: timeStamp,
        nonceStr: nonceStr,
        package: packageStr,
        signType: 'MD5'
      }, 'mock_api_key_for_development');

      res.json({
        code: 200,
        message: '获取支付参数成功（模拟支付）',
        data: {
          timeStamp: timeStamp,
          nonceStr: nonceStr,
          package: packageStr,
          signType: 'MD5',
          paySign: paySign
        }
      });

      // 模拟支付成功回调（3秒后）
      setTimeout(() => {
        const mockReq = { body: { orderId }, broadcastToClients };
        const mockRes = {
          json: (data) => {
            console.log('模拟支付结果:', data);
          }
        };
        orderRoutes.payOrder(mockReq, mockRes);
      }, 3000);

      return;
    }

    // 生产环境：调用真实的微信支付API
    console.log('使用真实支付模式');

    // 生成时间戳
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = generateNonceStr();

    // TODO: 调用微信统一下单API
    // const unifiedOrderResult = await callWechatUnifiedOrder({...});
    // const prepayId = unifiedOrderResult.prepay_id;
    const packageStr = `prepay_id=${generateNonceStr()}`; // 实际使用时需调用微信支付API

    // 生成签名
    const signParams = {
      appId: config.bed.payment.wechat.appid,
      timeStamp: timeStamp,
      nonceStr: nonceStr,
      package: packageStr,
      signType: 'MD5'
    };
    const paySign = generateMD5Sign(signParams, config.bed.payment.wechat.apiKey);

    console.log('获取支付参数:', {
      orderId: orderId,
      openid: openid
    });

    // 返回支付参数
    res.json({
      code: 200,
      message: '获取支付参数成功',
      data: {
        timeStamp: timeStamp,
        nonceStr: nonceStr,
        package: packageStr,
        signType: 'MD5',
        paySign: paySign
      }
    });
  } catch (error) {
    console.error('获取支付参数失败:', error);
    res.json({
      code: 500,
      message: '获取支付参数失败'
    });
  }
});

// 微信支付回调
app.post('/api/payment/notify', async (req, res) => {
  try {
    console.log('收到微信支付回调:', req.body);

    // 解析回调数据
    const { out_trade_no, transaction_id, result_code } = req.body;

    if (!out_trade_no) {
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[参数错误]]></return_msg></xml>');
    }

    // 获取订单信息
    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(out_trade_no);
    } else {
      order = orders.get(out_trade_no);
    }

    if (order) {
      // 只有待支付的订单可以更新为已支付
      if (order.status === 'unpaid') {
        // 扣减库存
        try {
          const bedTypeRoutes = require('./routes/bedTypes');
          const configData = bedTypeRoutes.loadBedTypesConfig();

          for (const orderBed of order.beds) {
            const bedType = configData.bedTypes.find(bt => bt.id === orderBed.id);
            if (bedType) {
              const oldStock = bedType.stock;
              bedType.stock = Math.max(0, bedType.stock - orderBed.quantity);
              console.log(`床位 ${bedType.name} 库存更新: ${oldStock} -> ${bedType.stock}`);
            }
          }

          // 保存库存变更
          bedTypeRoutes.saveBedTypesConfig(configData);

          // 广播床位类型更新
          broadcastToClients({
            type: 'bed_types_update',
            data: configData.bedTypes
          });
        } catch (error) {
          console.error('更新库存失败:', error);
        }

        order.status = 'paid';
        order.transactionId = transaction_id;
        order.updateTime = formatDate(new Date());

        // 保存订单状态
        if (config.database.type === 'mysql' && orderDao) {
          await orderDao.updateOrderStatus(out_trade_no, {
            status: 'paid',
            transactionId: transaction_id,
            payTime: new Date()
          });
        } else {
          orders.set(out_trade_no, order);
        }

        console.log('订单支付成功:', order);

        // 广播订单支付通知
        broadcastToClients({
          type: 'order_paid',
          orderId: out_trade_no
        });
      } else {
        console.log('订单状态不是待支付，无需更新:', order.status);
      }
    } else {
      console.log('订单不存在:', out_trade_no);
    }

    // 返回成功响应给微信
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (error) {
    console.error('支付回调处理失败:', error);
    res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
  }
});

// 查询订单
app.get('/api/order/query/:orderId', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.queryOrder(req, res);
});

// 获取订单列表
app.get('/api/order/list', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.getOrderList(req, res);
});

// 退还押金
app.post('/api/order/refund', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.refundOrder(req, res);
});

// 删除订单
app.delete('/api/order/delete', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.deleteOrder(req, res);
});

// 取消订单
app.post('/api/order/cancel', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.cancelOrder(req, res);
});

// 获取系统统计信息
app.get('/api/stats', async (req, res) => {
  try {
    let stats;

    if (config.database.type === 'mysql' && orderDao) {
      stats = await orderDao.getOrderStats();
    } else {
      let paidCount = 0;
      let unpaidCount = 0;
      let refundedCount = 0;
      let totalDeposit = 0;

      orders.forEach((order) => {
        if (order.status === 'paid') {
          paidCount++;
          totalDeposit += order.totalDeposit;
        } else if (order.status === 'unpaid') {
          unpaidCount++;
        } else if (order.status === 'refunded') {
          refundedCount++;
        }
      });

      stats = {
        totalOrders: orders.size,
        paidOrders: paidCount,
        unpaidOrders: unpaidCount,
        refundedOrders: refundedCount,
        totalDeposit: totalDeposit
      };
    }

    res.json({
      code: 200,
      message: '查询成功',
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.json({
      code: 500,
      message: '获取统计信息失败'
    });
  }
});

// ==================== WebSocket实时通知 ====================

// 广播消息给所有连接的客户端
function broadcastToClients(message) {
  const messageStr = JSON.stringify(message);
  let successCount = 0;
  let failedCount = 0;

  console.log(`=== 广播消息开始 ===`);
  console.log(`消息类型: ${message.type}`);
  console.log(`当前连接客户端数: ${wsClients.size}`);
  console.log(`客户端列表: ${Array.from(wsClients.keys()).join(', ')}`);

  wsClients.forEach((ws, clientId) => {
    console.log(`检查客户端 ${clientId}, readyState: ${ws.readyState} (OPEN=${ws.OPEN})`);
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(messageStr);
        successCount++;
        console.log(`✓ 成功发送给客户端 ${clientId}`);
      } catch (error) {
        failedCount++;
        console.error(`✗ 发送给客户端 ${clientId} 失败:`, error);
      }
    } else {
      failedCount++;
      console.log(`✗ 客户端 ${clientId} 未就绪，readyState=${ws.readyState}`);
    }
  });

  console.log(`=== 广播消息结束 ===`);
  console.log(`总连接数=${wsClients.size}, 成功发送=${successCount}, 失败=${failedCount}`);
}

// HTTP接口：通知所有小程序刷新数据
app.post('/api/notify/refresh', (req, res) => {
  try {
    const { type, data } = req.body;

    // 广播刷新消息
    broadcastToClients({
      type: type || 'data_update',
      timestamp: Date.now(),
      data: data || {}
    });

    res.json({
      code: 200,
      message: '刷新通知发送成功',
      data: {
        clientCount: wsClients.size
      }
    });
  } catch (error) {
    console.error('发送刷新通知失败:', error);
    res.json({
      code: 500,
      message: '发送刷新通知失败'
    });
  }
});

// 优雅关闭接口
app.post('/api/shutdown', async (req, res) => {
  try {
    console.log('收到优雅关闭请求...');

    res.json({
      code: 200,
      message: '服务器正在优雅关闭...',
      data: {
        shutdownStarted: true
      }
    });

    // 延迟执行关闭操作，确保响应已发送
    setTimeout(async () => {
      console.log('开始优雅关闭流程...');

      // 1. 通知所有WebSocket客户端
      console.log(`正在通知 ${wsClients.size} 个WebSocket客户端...`);
      wsClients.forEach((ws, clientId) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'server_shutdown',
              message: '服务器正在关闭，请稍后重连',
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error(`通知客户端 ${clientId} 失败:`, error);
          }
        }
      });

      // 2. 关闭所有WebSocket连接
      wsClients.forEach((ws, clientId) => {
        try {
          ws.close();
        } catch (error) {
          console.error(`关闭客户端 ${clientId} 连接失败:`, error);
        }
      });
      wsClients.clear();
      console.log('所有WebSocket连接已关闭');

      // 3. 关闭数据库连接池
      if (config.database.type === 'mysql' && db) {
        try {
          await db.closePool();
          console.log('数据库连接池已关闭');
        } catch (error) {
          console.error('关闭数据库连接池失败:', error);
        }
      }

      // 4. 关闭HTTP服务器
      server.close(() => {
        console.log('HTTP服务器已关闭');
        console.log('优雅关闭完成');
        process.exit(0);
      });

      // 5秒后强制退出
      setTimeout(() => {
        console.log('等待超时，强制退出');
        process.exit(1);
      }, 5000);
    }, 100);
  } catch (error) {
    console.error('优雅关闭失败:', error);
    res.json({
      code: 500,
      message: '优雅关闭失败'
    });
  }
});

// ==================== 启动服务器 ====================

// WebSocket服务器
const wss = new (require('ws').Server)({
  server,
  path: '/ws'  // 指定WebSocket路径
});

wss.on('connection', (ws, request) => {
  console.log('=== 新的WebSocket连接建立 ===');

  // 获取客户端信息（如openid等）
  const urlParams = new URL(request.url, `http://${request.headers.host}`);
  const openid = urlParams.searchParams.get('openid');
  const client = urlParams.searchParams.get('client');

  // 确定客户端ID：优先使用openid，如果没有则使用client，如果都没有则使用'anonymous'
  const clientId = openid || client || 'anonymous';

  console.log(`客户端标识: ${clientId} (openid=${openid}, client=${client})`);
  console.log(`请求URL: ${request.url}`);
  console.log(`WebSocket readyState: ${ws.readyState}`);

  // 存储连接
  wsClients.set(clientId, ws);
  console.log(`当前连接客户端数: ${wsClients.size}`);
  console.log(`已连接客户端列表: ${Array.from(wsClients.keys()).join(', ')}`);

  // 发送连接成功消息
  const connectionMsg = JSON.stringify({
    type: 'connection_established',
    clientId: clientId,
    openid: openid,
    client: client,
    timestamp: Date.now()
  });
  try {
    ws.send(connectionMsg);
    console.log(`✓ 已发送连接确认消息给客户端 ${clientId}`);
  } catch (error) {
    console.error(`✗ 发送连接确认消息失败:`, error);
  }

  // 处理客户端消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`收到客户端 ${clientId} 消息:`, data);

      // 处理心跳
      if (data.type === 'ping') {
        const pongMsg = JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        });
        ws.send(pongMsg);
        console.log(`✓ 已回复pong给客户端 ${clientId}`);
      }
    } catch (error) {
      console.error(`解析客户端 ${clientId} 消息失败:`, error);
    }
  });

  // 连接关闭
  ws.on('close', (code, reason) => {
    wsClients.delete(clientId);
    console.log(`=== WebSocket连接关闭 ===`);
    console.log(`客户端 ${clientId} 已断开`);
    console.log(`关闭码: ${code}, 原因: ${reason || '无'}`);
    console.log(`剩余连接数: ${wsClients.size}`);
    console.log(`剩余客户端列表: ${Array.from(wsClients.keys()).join(', ')}`);
  });

  // 错误处理
  ws.on('error', (error) => {
    console.error(`=== WebSocket错误 ===`);
    console.error(`客户端 ${clientId} 发生错误:`, error);
    wsClients.delete(clientId);
    console.log(`已从客户端列表中移除 ${clientId}`);
  });
});

// ==================== 启动服务器 ====================

// 初始化数据库
async function initServer() {
  console.log('='.repeat(50));
  console.log('正在初始化服务器...');

  // 根据配置选择数据库类型
  if (config.database.type === 'mysql') {
    try {
      console.log('正在连接 MySQL 数据库...');
      db = require('./database/mysql');
      orderDao = require('./database/orderDao');

      // 测试数据库连接
      const connected = await db.testConnection();
      if (connected) {
        // 初始化数据库表
        await db.initDatabase();
        console.log('✅ MySQL 数据库连接成功');

        // 迁移内存中的订单数据到数据库（如果有）
        if (orders.size > 0) {
          console.log(`检测到内存中有 ${orders.size} 条订单数据，正在迁移...`);
          const memoryOrders = Array.from(orders.values());
          const migratedCount = await orderDao.migrateOrdersFromMemory(memoryOrders);
          console.log(`✅ 订单数据迁移完成: ${migratedCount} 条`);
          // 迁移完成后清空内存
          orders.clear();
        }

        // 使用数据库模式
        console.log('✅ 已切换到 MySQL 数据库模式');
      } else {
        console.log('⚠️  MySQL 连接失败，使用内存存储模式');
        console.log('⚠️  请检查 MySQL 配置和服务状态');
      }
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error.message);
      console.log('⚠️  使用内存存储模式');
    }
  } else {
    console.log('使用内存存储模式');
  }

  console.log('='.repeat(50));

  // 启动HTTP服务器
  server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`医院租床后端服务器已启动`);
    console.log(`HTTP地址: http://localhost:${PORT}`);
    console.log(`WebSocket地址: ws://localhost:${PORT}/ws`);
    console.log(`API文档: http://localhost:${PORT}/api/health`);
    console.log(`数据库模式: ${config.database.type}`);
    console.log('='.repeat(50));
  });
}

// 启动服务器
initServer().catch(error => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});

module.exports = { app, server, broadcastToClients };

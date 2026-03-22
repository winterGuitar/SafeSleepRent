const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const WebSocketLib = require('ws');

require('dotenv').config();

const config = require('./config/appConfig');
const bedTypeRoutes = require('./routes/bedTypes');
const orderRoutes = require('./routes/orders');
const wechatPay = require('./wechat-pay');
const { generateNonceStr, generateMD5Sign, generateUserToken } = require('./utils/crypto');

const app = express();
const server = http.createServer(app);
const PORT = config.server.port;
const allowedCorsOrigins = new Set(config.cors.allowedOrigins || []);

const wsAdminClients = new Map();
const wsMiniprogramClients = new Map();

// 用户会话存储：token → { openid, createdAt }
const userSessions = new Map();
const USER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7天

let db = null;

app.set('trust proxy', true);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.size === 0 || allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

app.use('/public', express.static(path.join(__dirname, 'public')));

const uploadDir = process.env.IMAGE_UPLOAD_DIR || path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `bed-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
      return;
    }

    cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp)'));
  }
});

function createAdminToken(username, expiresAt) {
  const payload = `${username}.${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', config.adminAuth.tokenSecret)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [username, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!username || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  const expectedSignature = createAdminToken(username, expiresAt).split('.').pop();
  if (signature !== expectedSignature) {
    return null;
  }

  return { username, expiresAt };
}

function getAdminTokenFromRequest(req) {
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return req.get('x-admin-token') || req.query.adminToken || (req.body && req.body.adminToken) || null;
}

function requireAdminAuth(req, res, next) {
  const auth = verifyAdminToken(getAdminTokenFromRequest(req));
  if (!auth) {
    return res.status(401).json({
      code: 401,
      message: '管理员未登录或登录已过期'
    });
  }

  req.adminUser = auth;
  next();
}

// 用户 session token 中间件——从 x-user-token 头或 body/query 中读取
function requireUserAuth(req, res, next) {
  const token = req.get('x-user-token') || req.query.userToken || (req.body && req.body.userToken) || null;
  if (!token) {
    return res.status(401).json({ code: 401, message: '请先登录' });
  }

  const session = userSessions.get(token);
  if (!session || Date.now() - session.createdAt > USER_SESSION_TTL_MS) {
    userSessions.delete(token);
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }

  req.userOpenid = session.openid;
  next();
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function closeSocketQuietly(ws) {
  if (!ws) {
    return;
  }

  try {
    ws.close();
  } catch (error) {
    console.error(`[${getTimestamp()}] 关闭 WebSocket 失败:`, error);
  }
}

function registerClient(clientMap, clientId, ws, clientType) {
  const previousWs = clientMap.get(clientId);
  if (previousWs && previousWs !== ws) {
    console.log(`[${getTimestamp()}] ${clientType}客户端 ${clientId} 已存在旧连接，准备替换`);
    closeSocketQuietly(previousWs);
  }

  clientMap.set(clientId, ws);
}

function unregisterClient(clientMap, clientId, ws, clientType) {
  const currentWs = clientMap.get(clientId);
  if (currentWs === ws) {
    clientMap.delete(clientId);
    console.log(`[${getTimestamp()}] 已移除${clientType}客户端 ${clientId}`);
  }
}

function broadcastToMiniprogramClients(message) {
  const messageStr = JSON.stringify(message);
  wsMiniprogramClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(messageStr);
    }
  });
}

function broadcastToAdminClients(message) {
  const messageStr = JSON.stringify(message);
  wsAdminClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(messageStr);
    }
  });
}

function broadcastToClients(message) {
  broadcastToAdminClients(message);
  broadcastToMiniprogramClients(message);
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 微信小程序登录：返回 session token，不返回 session_key
app.post('/api/auth/login', async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.json({ code: 400, message: '缺少code参数' });
    }

    const { appId, appSecret } = config.wechat;
    const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const wxResponse = await fetch(wxApiUrl);
    const wxData = await wxResponse.json();

    if (wxData.errcode) {
      return res.json({
        code: 500,
        message: `微信登录失败: ${wxData.errmsg}`,
        data: wxData
      });
    }

    const openid = wxData.openid;
    // session_key 仅在服务端保留，不下发客户端
    const token = generateUserToken();
    userSessions.set(token, { openid, createdAt: Date.now() });

    res.json({
      code: 200,
      message: '登录成功',
      data: { token, openid }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.json({ code: 500, message: '服务器错误', error: error.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== config.adminAuth.username || password !== config.adminAuth.password) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const expiresAt = Date.now() + config.adminAuth.tokenTtlMs;
  const token = createAdminToken(username, expiresAt);
  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      expiresAt,
      user: { username }
    }
  });
});

app.get('/api/bedTypes', bedTypeRoutes.getBedTypes);
app.get('/api/bedTypes/available', bedTypeRoutes.getAvailableBedTypes);
app.get('/api/bedTypes/inventory', bedTypeRoutes.getBedInventory);
app.get('/api/bedTypes/:id', bedTypeRoutes.getBedTypeById);
app.post('/api/bedTypes', requireAdminAuth, bedTypeRoutes.addBedType);
app.put('/api/bedTypes/:id', requireAdminAuth, bedTypeRoutes.updateBedType);
app.delete('/api/bedTypes/:id', requireAdminAuth, bedTypeRoutes.deleteBedType);
app.post('/api/upload/bedImage', requireAdminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ code: 400, message: '请选择要上传的图片' });
    }

    const imageUrl = `/public/images/${req.file.filename}`;
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
    res.json({ code: 500, message: `上传失败: ${error.message}` });
  }
});

app.get('/api/rules/deposit', bedTypeRoutes.getDepositRules);
app.get('/api/rules/rental', bedTypeRoutes.getRentalPolicy);
app.get('/api/rules/businessHours', bedTypeRoutes.getBusinessHours);
app.post('/api/settings', requireAdminAuth, bedTypeRoutes.saveSystemSettings);

app.post('/api/order/create', requireUserAuth, orderRoutes.createOrder);
app.post('/api/order/pay', requireUserAuth, orderRoutes.payOrder);

// 获取微信支付参数
app.post('/api/payment/getParams', requireUserAuth, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.json({ code: 400, message: '订单号不能为空' });
    }

    const order = await orderRoutes.getOrderById(orderId);
    if (!order) {
      return res.json({ code: 404, message: '订单不存在' });
    }

    const isMockPayment = !config.bed.payment.wechat.mchid ||
      config.bed.payment.wechat.mchid === 'your_mchid' ||
      !config.bed.payment.wechat.apiKey ||
      config.bed.payment.wechat.apiKey === 'your_api_key';

    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = generateNonceStr();

    if (isMockPayment) {
      const packageStr = `prepay_id=MOCK_PAY_${Date.now()}`;
      const paySign = generateMD5Sign({
        appId: config.bed.payment.wechat.appid,
        timeStamp,
        nonceStr,
        package: packageStr,
        signType: 'MD5'
      }, 'mock_api_key_for_development');

      res.json({
        code: 200,
        message: '获取支付参数成功（模拟支付）',
        data: { timeStamp, nonceStr, package: packageStr, signType: 'MD5', paySign }
      });

      setTimeout(async () => {
        try {
          const result = await orderRoutes.settlePaidOrder({
            orderId,
            transactionId: `MOCK_TXN_${Date.now()}`
          });
          console.log('模拟支付结果:', result);
        } catch (notifyError) {
          console.error('模拟支付回调失败:', notifyError);
        }
      }, 3000);
      return;
    }

    // 真实微信支付
    try {
      wechatPay.setConfig({
        appid: config.bed.payment.wechat.appid,
        mchid: config.bed.payment.wechat.mchid,
        apiKey: config.bed.payment.wechat.apiKey,
        notifyUrl: config.bed.payment.wechat.notifyUrl
      });

      const unifiedOrderResult = await wechatPay.unifiedOrder({
        orderId,
        totalFee: order.totalDeposit,
        body: '医院租床服务',
        openid: req.userOpenid || order.openid,
        tradeType: 'JSAPI'
      });

      if (unifiedOrderResult.code !== 200) {
        console.error('微信统一下单失败:', unifiedOrderResult);
        return res.json({
          code: unifiedOrderResult.code || 500,
          message: `微信支付下单失败: ${unifiedOrderResult.message}`
        });
      }

      const prepayId = unifiedOrderResult.data.prepayId;
      const minipayParams = wechatPay.generateMinipayParams(prepayId);

      res.json({
        code: 200,
        message: '获取支付参数成功',
        data: {
          timeStamp: minipayParams.timeStamp,
          nonceStr: minipayParams.nonceStr,
          package: minipayParams.package,
          signType: minipayParams.signType,
          paySign: minipayParams.paySign
        }
      });
    } catch (payError) {
      console.error('微信支付统一下单异常:', payError);
      res.json({ code: 500, message: `微信支付下单异常: ${payError.message}` });
    }
  } catch (error) {
    console.error('获取支付参数失败:', error);
    res.json({ code: 500, message: '获取支付参数失败' });
  }
});

// 微信支付回调——使用 text 解析器接收 XML，并验证签名
app.post('/api/payment/notify', express.text({ type: 'text/xml' }), async (req, res) => {
  try {
    const xmlBody = typeof req.body === 'string' ? req.body : '';
    const params = wechatPay.xmlToObject(xmlBody);

    // 验证回调签名（非模拟模式）
    const isMockPayment = !config.bed.payment.wechat.mchid ||
      config.bed.payment.wechat.mchid === 'your_mchid' ||
      !config.bed.payment.wechat.apiKey ||
      config.bed.payment.wechat.apiKey === 'your_api_key';

    if (!isMockPayment) {
      const receivedSign = params.sign;
      const paramsWithoutSign = { ...params };
      delete paramsWithoutSign.sign;
      const expectedSign = generateMD5Sign(paramsWithoutSign, config.bed.payment.wechat.apiKey);
      if (!receivedSign || receivedSign !== expectedSign) {
        console.error('微信支付回调签名验证失败');
        return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名验证失败]]></return_msg></xml>');
      }
    }

    const { out_trade_no, transaction_id } = params;

    if (!out_trade_no) {
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[参数错误]]></return_msg></xml>');
    }

    const order = await orderRoutes.getOrderById(out_trade_no);
    if (!order) {
      console.log('订单不存在:', out_trade_no);
    } else if (order.status === 'unpaid') {
      const result = await orderRoutes.settlePaidOrder({
        orderId: out_trade_no,
        transactionId: transaction_id
      });
      console.log('支付回调处理结果:', result);
    } else {
      console.log('订单状态不是待支付，无需更新:', order.status);
    }

    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (error) {
    console.error('支付回调处理失败:', error);
    res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
  }
});

app.get('/api/admin/order/query/:orderId', requireAdminAuth, orderRoutes.queryOrder);

app.get('/api/me/orders', requireUserAuth, orderRoutes.getOrderList);
app.get('/api/admin/order/list', requireAdminAuth, orderRoutes.getOrderList);

app.post('/api/me/order/refund', requireUserAuth, orderRoutes.refundOrder);
app.post('/api/admin/order/refund', requireAdminAuth, orderRoutes.refundOrder);

app.delete('/api/admin/order/delete', requireAdminAuth, orderRoutes.deleteOrder);

app.post('/api/me/order/cancel', requireUserAuth, orderRoutes.cancelOrder);

app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await orderRoutes.getOrderStats();
    res.json({ code: 200, message: '查询成功', data: stats });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.json({ code: 500, message: '获取统计信息失败' });
  }
});

app.post('/api/admin/notify/refresh', requireAdminAuth, (req, res) => {
  try {
    const { type, data } = req.body || {};
    broadcastToMiniprogramClients({
      type: type || 'data_update',
      timestamp: Date.now(),
      data: data || {}
    });
    res.json({ code: 200, message: '刷新通知发送成功', data: { miniprogramClientCount: wsMiniprogramClients.size } });
  } catch (error) {
    console.error('发送刷新通知失败:', error);
    res.json({ code: 500, message: '发送刷新通知失败' });
  }
});

app.post('/api/notify/admin/refresh', requireAdminAuth, (req, res) => {
  try {
    const { type, data } = req.body || {};
    broadcastToAdminClients({
      type: type || 'data_update',
      timestamp: Date.now(),
      data: data || {}
    });
    res.json({ code: 200, message: '刷新通知发送成功', data: { adminClientCount: wsAdminClients.size } });
  } catch (error) {
    console.error('发送刷新通知失败:', error);
    res.json({ code: 500, message: '发送刷新通知失败' });
  }
});

app.post('/api/shutdown', requireAdminAuth, async (req, res) => {
  try {
    res.json({ code: 200, message: '服务器正在优雅关闭...', data: { shutdownStarted: true } });

    setTimeout(async () => {
      wsAdminClients.forEach((ws) => closeSocketQuietly(ws));
      wsMiniprogramClients.forEach((ws) => closeSocketQuietly(ws));
      wsAdminClients.clear();
      wsMiniprogramClients.clear();

      if (config.database.type === 'mysql' && db) {
        await db.closePool();
      }

      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000);
    }, 100);
  } catch (error) {
    console.error('优雅关闭失败:', error);
    res.json({ code: 500, message: '优雅关闭失败' });
  }
});

const wssAdmin = new WebSocketLib.Server({ noServer: true });
const wssMiniprogram = new WebSocketLib.Server({ noServer: true });

wssAdmin.on('connection', (ws, request) => {
  const urlParams = new URL(request.url, `http://${request.headers.host}`);
  const adminToken = urlParams.searchParams.get('adminToken');

  const adminAuth = verifyAdminToken(adminToken);
  if (!adminAuth) {
    console.log('管理端WebSocket认证失败，关闭连接');
    ws.close(4001, 'unauthorized');
    return;
  }

  console.log(`[${getTimestamp()}] 管理端WebSocket认证成功: ${adminAuth.username}`);
  const clientId = `admin_${adminAuth.username}_${Date.now()}`;
  registerClient(wsAdminClients, clientId, ws, '管理端');

  ws.send(JSON.stringify({ type: 'connection_established', clientId, clientType: 'admin', timestamp: Date.now() }));
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('解析管理端消息失败:', error);
    }
  });
  ws.on('close', () => unregisterClient(wsAdminClients, clientId, ws, '管理端'));
  ws.on('error', () => unregisterClient(wsAdminClients, clientId, ws, '管理端'));
});

wssMiniprogram.on('connection', (ws, request) => {
  const urlParams = new URL(request.url, `http://${request.headers.host}`);
  const openid = urlParams.searchParams.get('openid');
  const clientId = openid || `miniprogram_anon_${Date.now()}`;
  registerClient(wsMiniprogramClients, clientId, ws, '小程序端');

  ws.send(JSON.stringify({ type: 'connection_established', clientId, clientType: 'miniprogram', openid, timestamp: Date.now() }));
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('解析小程序端消息失败:', error);
    }
  });
  ws.on('close', () => unregisterClient(wsMiniprogramClients, clientId, ws, '小程序端'));
  ws.on('error', () => unregisterClient(wsMiniprogramClients, clientId, ws, '小程序端'));
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/admin') {
    wssAdmin.handleUpgrade(request, socket, head, (ws) => wssAdmin.emit('connection', ws, request));
    return;
  }

  if (pathname === '/ws/miniprogram') {
    wssMiniprogram.handleUpgrade(request, socket, head, (ws) => wssMiniprogram.emit('connection', ws, request));
    return;
  }

  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

async function initServer() {
  console.log('='.repeat(50));
  console.log('正在初始化服务器...');

  // 向路由模块注入广播函数
  bedTypeRoutes.setBroadcast(broadcastToClients);
  orderRoutes.setBroadcast(broadcastToClients);

  if (config.database.type === 'mysql') {
    try {
      console.log('正在连接 MySQL 数据库...');
      db = require('./database/mysql');
      const connected = await db.testConnection();
      if (connected) {
        await db.initDatabase();
        console.log('已切换到 MySQL 数据库模式');
      } else {
        console.log('MySQL 连接失败，使用内存存储模式');
      }
    } catch (error) {
      console.error('数据库初始化失败:', error.message);
    }
  } else {
    console.log('使用内存存储模式');
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`HTTP地址: http://localhost:${PORT}`);
    console.log(`管理端WebSocket地址: ws://localhost:${PORT}/ws/admin`);
    console.log(`小程序端WebSocket地址: ws://localhost:${PORT}/ws/miniprogram`);
    console.log(`数据库模式: ${config.database.type}`);
    console.log('='.repeat(50));
  });
}

initServer().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});

module.exports = {
  app,
  server,
  broadcastToClients,
  broadcastToMiniprogramClients,
  broadcastToAdminClients
};

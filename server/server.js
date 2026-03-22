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

const app = express();
const server = http.createServer(app);
const PORT = config.server.port;
const allowedCorsOrigins = new Set(config.cors.allowedOrigins || []);

const wsAdminClients = new Map();
const wsMiniprogramClients = new Map();

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

function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMD5Sign(params, apiKey) {
  const sortedKeys = Object.keys(params).sort();
  let stringA = '';

  sortedKeys.forEach((key) => {
    if (params[key] !== undefined && params[key] !== '') {
      stringA += `${key}=${params[key]}&`;
    }
  });

  stringA += `key=${apiKey}`;
  return crypto.createHash('md5').update(stringA, 'utf8').digest('hex').toUpperCase();
}

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

function requireUserOpenid(req, res, next) {
  const openid = req.query.openid || (req.body && req.body.openid);
  if (!openid) {
    return res.status(400).json({
      code: 400,
      message: 'openid is required'
    });
  }

  req.userOpenid = openid;
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
app.post('/api/bedTypes', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.addBedType(req, res);
});
app.put('/api/bedTypes/:id', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.updateBedType(req, res);
});
app.delete('/api/bedTypes/:id', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.deleteBedType(req, res);
});
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
app.post('/api/settings', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  bedTypeRoutes.saveSystemSettings(req, res);
});

app.post('/api/order/create', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.createOrder(req, res);
});
app.post('/api/order/pay', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.payOrder(req, res);
});

app.post('/api/payment/getParams', async (req, res) => {
  try {
    const { orderId, openid } = req.body || {};
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
            transactionId: `MOCK_TXN_${Date.now()}`,
            broadcastToClients
          });
          console.log('模拟支付结果:', result);
        } catch (notifyError) {
          console.error('模拟支付回调失败:', notifyError);
        }
      }, 3000);
      return;
    }

    const packageStr = `prepay_id=${generateNonceStr()}`;
    const paySign = generateMD5Sign({
      appId: config.bed.payment.wechat.appid,
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'MD5'
    }, config.bed.payment.wechat.apiKey);

    console.log('获取支付参数:', { orderId, openid });
    res.json({
      code: 200,
      message: '获取支付参数成功',
      data: { timeStamp, nonceStr, package: packageStr, signType: 'MD5', paySign }
    });
  } catch (error) {
    console.error('获取支付参数失败:', error);
    res.json({ code: 500, message: '获取支付参数失败' });
  }
});

app.post('/api/payment/notify', async (req, res) => {
  try {
    console.log('收到微信支付回调:', req.body);
    const { out_trade_no, transaction_id } = req.body || {};

    if (!out_trade_no) {
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[参数错误]]></return_msg></xml>');
    }

    const order = await orderRoutes.getOrderById(out_trade_no);
    if (!order) {
      console.log('订单不存在:', out_trade_no);
    } else if (order.status === 'unpaid') {
      const result = await orderRoutes.settlePaidOrder({
        orderId: out_trade_no,
        transactionId: transaction_id,
        broadcastToClients
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

app.get('/api/order/query/:orderId', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.queryOrder(req, res);
});
app.get('/api/admin/order/query/:orderId', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.queryOrder(req, res);
});

app.get('/api/order/list', requireUserOpenid, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.getOrderList(req, res);
});
app.get('/api/me/orders', requireUserOpenid, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.getOrderList(req, res);
});
app.get('/api/admin/order/list', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.getOrderList(req, res);
});

app.post('/api/order/refund', requireUserOpenid, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.refundOrder(req, res);
});
app.post('/api/me/order/refund', requireUserOpenid, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.refundOrder(req, res);
});
app.post('/api/admin/order/refund', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.refundOrder(req, res);
});

app.delete('/api/order/delete', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.deleteOrder(req, res);
});
app.delete('/api/admin/order/delete', requireAdminAuth, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.deleteOrder(req, res);
});

app.post('/api/order/cancel', requireUserOpenid, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.cancelOrder(req, res);
});
app.post('/api/me/order/cancel', requireUserOpenid, (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.cancelOrder(req, res);
});

app.get('/api/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await orderRoutes.getOrderStats();
    res.json({ code: 200, message: '查询成功', data: stats });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.json({ code: 500, message: '获取统计信息失败' });
  }
});
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await orderRoutes.getOrderStats();
    res.json({ code: 200, message: '查询成功', data: stats });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.json({ code: 500, message: '获取统计信息失败' });
  }
});

app.post('/api/notify/refresh', requireAdminAuth, (req, res) => {
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
    ws.close(4001, 'unauthorized');
    return;
  }

  const clientId = urlParams.searchParams.get('openid') || `admin_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

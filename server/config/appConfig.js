const bedConfig = require('./bedTypes')

function readStringEnv(name, fallback) {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

function readNumberEnv(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBooleanEnv(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const env = readStringEnv('APP_ENV', readStringEnv('NODE_ENV', 'development'))
const isProduction = env === 'production'

const serverPort = readNumberEnv('PORT', 3000)
const serverHost = readStringEnv('SERVER_HOST', isProduction ? '0.0.0.0' : 'localhost')
const serverDomain = readStringEnv(
  'SERVER_DOMAIN',
  isProduction ? 'www.axxzc.cn' : `localhost:${serverPort}`
)
const baseUrl = readStringEnv(
  'BASE_URL',
  isProduction ? `https://${serverDomain}` : `http://${serverDomain}`
)
const wsBaseUrl = readStringEnv(
  'WS_BASE_URL',
  isProduction ? `wss://${serverDomain}` : `ws://${serverDomain}`
)
const adminBaseUrl = readStringEnv(
  'ADMIN_BASE_URL',
  isProduction ? `https://${serverDomain}` : 'http://localhost:8080'
)
const corsAllowedOrigins = readStringEnv(
  'CORS_ALLOWED_ORIGINS',
  [adminBaseUrl, baseUrl, 'http://localhost:8080', 'http://localhost:3000']
    .filter(Boolean)
    .join(',')
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

module.exports = {
  server: {
    port: serverPort,
    host: serverHost,
    domain: serverDomain,
    https: isProduction,
    baseUrl,
    wsBaseUrl,
    adminBaseUrl
  },

  database: {
    type: readStringEnv('DB_TYPE', 'mysql'),
    mysql: {
      host: readStringEnv('DB_HOST', 'localhost'),
      port: readNumberEnv('DB_PORT', 3306),
      database: readStringEnv('DB_NAME', 'hosp_bed'),
      username: readStringEnv('DB_USER', 'beduser'),
      password: readStringEnv('DB_PASSWORD', '123456'),
      connectionLimit: readNumberEnv('DB_CONNECTION_LIMIT', 10)
    },
    mongodb: {
      url: readStringEnv('MONGODB_URL', 'mongodb://localhost:27017/hosp_bed')
    }
  },

  logging: {
    level: readStringEnv('LOG_LEVEL', isProduction ? 'error' : 'debug'),
    filePath: readStringEnv('LOG_FILE_PATH', './logs/app.log'),
    console: readBooleanEnv('LOG_CONSOLE', true)
  },

  cors: {
    allowedOrigins: corsAllowedOrigins
  },

  wechat: {
    appId: readStringEnv('WECHAT_APP_ID', 'your_app_id'),
    appSecret: readStringEnv('WECHAT_APP_SECRET', 'your_app_secret'),
    loginUrl: 'https://api.weixin.qq.com/sns/jscode2session',
    tokenExpire: readNumberEnv('WECHAT_TOKEN_EXPIRE', 7200)
  },

  adminAuth: {
    username: readStringEnv('ADMIN_USERNAME', 'admin'),
    password: readStringEnv('ADMIN_PASSWORD', 'admin123'),
    tokenSecret: readStringEnv('ADMIN_TOKEN_SECRET', 'change_this_admin_token_secret'),
    tokenTtlMs: readNumberEnv('ADMIN_TOKEN_TTL_MS', 24 * 60 * 60 * 1000)
  },

  env,

  miniprogram: {
    loginUrl: 'https://api.weixin.qq.com/sns/jscode2session',
    sessionSecret: readStringEnv('MINIPROGRAM_SESSION_SECRET', 'your_session_secret'),
    tokenExpire: readNumberEnv('MINIPROGRAM_TOKEN_EXPIRE', 7200)
  },

  bed: {
    ...bedConfig,
    payment: {
      ...(bedConfig.payment || {}),
      wechat: {
        ...((bedConfig.payment && bedConfig.payment.wechat) || {}),
        appid: readStringEnv(
          'WECHAT_PAY_APP_ID',
          readStringEnv('WECHAT_APP_ID', (bedConfig.payment && bedConfig.payment.wechat && bedConfig.payment.wechat.appid) || 'your_wx_appid')
        ),
        mchid: readStringEnv(
          'WECHAT_PAY_MCH_ID',
          (bedConfig.payment && bedConfig.payment.wechat && bedConfig.payment.wechat.mchid) || 'your_mchid'
        ),
        apiKey: readStringEnv(
          'WECHAT_PAY_API_KEY',
          (bedConfig.payment && bedConfig.payment.wechat && bedConfig.payment.wechat.apiKey) || 'your_api_key'
        ),
        notifyUrl: readStringEnv(
          'WECHAT_PAY_NOTIFY_URL',
          `${baseUrl}/api/payment/notify`
        )
      },
      alipay: {
        ...((bedConfig.payment && bedConfig.payment.alipay) || {}),
        notifyUrl: readStringEnv(
          'ALIPAY_NOTIFY_URL',
          `${baseUrl}/api/alipay/notify`
        )
      }
    }
  },

  system: {
    name: '医院租床服务',
    version: '1.0.0',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    currency: 'CNY',
    currencySymbol: '¥'
  }
}

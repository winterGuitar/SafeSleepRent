/**
 * API 配置文件
 * 统一从环境配置读取接口地址，避免手动切换时遗漏。
 */

const defaultEnv = require('./env.default.js')

let localEnv = {}
try {
  localEnv = require('./env.local.js')
} catch (error) {
  localEnv = {}
}

const ENV = defaultEnv.ENV || {
  DEV: 'development',
  PROD: 'production'
}

const currentEnv = localEnv.currentEnv || defaultEnv.currentEnv || ENV.DEV

const mergedEnvConfig = {
  ...(defaultEnv.envConfig || {}),
  ...(localEnv.envConfig || {})
}

const apiConfig = {
  [ENV.DEV]: {
    baseURL: 'http://localhost:3000',
    wsURL: 'ws://localhost:3000',
    ...(mergedEnvConfig[ENV.DEV] || {})
  },
  [ENV.PROD]: {
    baseURL: 'https://www.axxzc.cn',
    wsURL: 'wss://www.axxzc.cn',
    ...(mergedEnvConfig[ENV.PROD] || {})
  }
}

const apiPaths = {
  bedTypes: '/api/bedTypes',
  bedTypesAvailable: '/api/bedTypes/available',
  bedTypesInventory: '/api/bedTypes/inventory',
  login: '/api/auth/login',
  createOrder: '/api/order/create',
  orderList: '/api/order/list',
  myOrderList: '/api/me/orders',
  refundOrder: '/api/order/refund',
  myRefundOrder: '/api/me/order/refund',
  cancelOrder: '/api/order/cancel',
  myCancelOrder: '/api/me/order/cancel',
  payOrder: '/api/order/pay',
  getPaymentParams: '/api/payment/getParams',
  depositRules: '/api/rules/deposit',
  rentalRules: '/api/rules/rental',
  businessHours: '/api/rules/businessHours'
}

function getConfig() {
  const selectedConfig = apiConfig[currentEnv] || apiConfig[ENV.DEV]

  return {
    ...selectedConfig,
    wsURL: selectedConfig.wsURL || selectedConfig.wsBaseURL,
    wsBaseURL: selectedConfig.wsBaseURL || selectedConfig.wsURL
  }
}

function getApiUrl(path) {
  const config = getConfig()
  return config.baseURL + path
}

function getWsUrl() {
  return getConfig().wsURL
}

function isDev() {
  return currentEnv === ENV.DEV
}

module.exports = {
  ENV,
  currentEnv,
  getConfig,
  getApiUrl,
  getWsUrl,
  isDev,
  apiPaths
}

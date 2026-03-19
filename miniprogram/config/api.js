/**
 * API 配置文件
 * 统一管理所有 API 接口地址
 */

// 环境配置
const ENV = {
  // 开发环境
  DEV: 'development',
  // 生产环境
  PROD: 'production'
}

// 当前环境（开发时改为 ENV.DEV，发布时改为 ENV.PROD）
const currentEnv = ENV.DEV

// API 基础配置
const apiConfig = {
  [ENV.DEV]: {
    // 开发环境：本地服务器
    baseURL: 'http://localhost:3000',
    wsURL: 'ws://localhost:3000/ws',
    // 说明：开发环境在微信开发者工具中需勾选"不校验合法域名..."选项
  },
  [ENV.PROD]: {
    // 生产环境：实际部署的域名
    // 注意：必须在小程序后台配置服务器域名
    baseURL: 'https://www.axxzc.cn',
    wsURL: 'wss://www.axxzc.cn/ws',
    // 注意：
    // 1. 域名必须通过 ICP 备案
    // 2. 必须配置 HTTPS 证书（TLS 1.2+）
    // 3. 必须在小程序后台配置合法域名
  }
}

// API 接口路径
const apiPaths = {
  // 床位相关
  bedTypes: '/api/bedTypes',
  bedTypesAvailable: '/api/bedTypes/available',
  bedTypesInventory: '/api/bedTypes/inventory',

  // 认证相关
  login: '/api/auth/login',

  // 订单相关
  createOrder: '/api/order/create',
  orderList: '/api/order/list',
  refundOrder: '/api/order/refund',
  cancelOrder: '/api/order/cancel',
  payOrder: '/api/order/pay',

  // 支付相关
  getPaymentParams: '/api/payment/getParams',

  // 规则相关
  depositRules: '/api/rules/deposit',
  rentalRules: '/api/rules/rental',
  businessHours: '/api/rules/businessHours'
}

// 获取当前环境配置
function getConfig() {
  return apiConfig[currentEnv]
}

// 获取完整 API 地址
function getApiUrl(path) {
  const config = getConfig()
  return config.baseURL + path
}

// 获取 WebSocket 地址
function getWsUrl() {
  return getConfig().wsURL
}

// 判断是否为开发环境
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

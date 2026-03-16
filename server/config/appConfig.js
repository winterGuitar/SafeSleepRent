// 应用配置文件
const bedConfig = require('./bedTypes');

module.exports = {
  // 服务器配置
  server: {
    port: 3000,
    host: 'localhost',
    // 生产环境需要修改为实际域名
    domain: process.env.NODE_ENV === 'production' ? 'your-domain.com' : 'localhost:3000',
    // 是否启用HTTPS
    https: process.env.NODE_ENV === 'production'
  },

  // 数据库配置
  database: {
    type: 'mysql', // 'memory' | 'mysql' | 'mongodb'
    mysql: {
      host: 'localhost',
      port: 3306,
      database: 'hosp_bed',
      username: 'root',
      password: '123456', // 请修改为你的MySQL密码
      connectionLimit: 10
    },
    mongodb: {
      url: 'mongodb://localhost:27017/hosp_bed'
    }
  },

  // 日志配置
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    // 日志文件路径
    filePath: './logs/app.log',
    // 是否在控制台输出
    console: true
  },

  // 小程序配置
  miniprogram: {
    // 获取openid的接口
    loginUrl: 'https://api.weixin.qq.com/sns/jscode2session',
    // 会话密钥（需要从微信服务器获取）
    sessionSecret: 'your_session_secret',
    // access_token有效期（秒）
    tokenExpire: 7200
  },

  // 引入床位配置
  bed: bedConfig,

  // 系统配置
  system: {
    // 系统名称
    name: '医院租床服务',
    // 系统版本
    version: '1.0.0',
    // 时区
    timezone: 'Asia/Shanghai',
    // 语言
    language: 'zh-CN',
    // 货币单位
    currency: 'CNY',
    // 货币符号
    currencySymbol: '¥'
  }
}

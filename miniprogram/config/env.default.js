const ENV = {
  DEV: 'development',
  PROD: 'production'
}

module.exports = {
  ENV,
  currentEnv: ENV.PROD,
  envConfig: {
    [ENV.DEV]: {
      baseURL: 'http://localhost:3000',
      wsBaseURL: 'ws://localhost:3000',
      adminBaseURL: 'http://localhost:8080'
    },
    [ENV.PROD]: {
      baseURL: 'https://www.axxzc.cn',
      wsBaseURL: 'wss://www.axxzc.cn',
      adminBaseURL: 'https://www.axxzc.cn'
    }
  }
}

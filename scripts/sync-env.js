const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const sharedConfigPath = path.join(rootDir, 'env.shared.json')

const sharedConfig = JSON.parse(fs.readFileSync(sharedConfigPath, 'utf8'))
const currentEnv = sharedConfig.currentEnv === 'production' ? 'production' : 'development'
const envConfig = sharedConfig.envConfig || {}
const selectedConfig = envConfig[currentEnv]

if (!selectedConfig) {
  throw new Error(`Missing env config for ${currentEnv}`)
}

function writeFile(targetPath, content) {
  fs.writeFileSync(targetPath, content, 'utf8')
  console.log(`updated ${path.relative(rootDir, targetPath)}`)
}

function ensureTrailingNewline(content) {
  return content.endsWith('\n') ? content : `${content}\n`
}

function buildServerEnv() {
  const lines = [
    `APP_ENV=${currentEnv}`,
    `NODE_ENV=${currentEnv}`,
    '',
    `PORT=${selectedConfig.serverPort || 3000}`,
    `SERVER_HOST=${selectedConfig.serverHost || 'localhost'}`,
    `SERVER_DOMAIN=${selectedConfig.serverDomain || 'localhost:3000'}`,
    `BASE_URL=${selectedConfig.baseURL || 'http://localhost:3000'}`,
    `WS_BASE_URL=${selectedConfig.wsBaseURL || 'ws://localhost:3000'}`,
    `ADMIN_BASE_URL=${selectedConfig.adminBaseURL || 'http://localhost:8080'}`
  ]

  return ensureTrailingNewline(lines.join('\n'))
}

function buildMiniprogramEnv() {
  const payload = {
    currentEnv,
    envConfig
  }

  return ensureTrailingNewline(`module.exports = ${JSON.stringify(payload, null, 2)}\n`)
}

function buildAdminEnv() {
  const payload = {
    currentEnv,
    envConfig
  }

  return ensureTrailingNewline(
    `window.__APP_ENV_CONFIG__ = ${JSON.stringify(payload, null, 2)}\n`
  )
}

writeFile(path.join(rootDir, 'server', '.env'), buildServerEnv())
writeFile(path.join(rootDir, 'miniprogram', 'config', 'env.local.js'), buildMiniprogramEnv())
writeFile(path.join(rootDir, 'admin', 'js', 'env.local.js'), buildAdminEnv())

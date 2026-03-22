const fs = require('fs')
const path = require('path')

const arg = (process.argv[2] || '').toLowerCase()

const envAlias = {
  dev: 'development',
  development: 'development',
  prod: 'production',
  production: 'production'
}

const nextEnv = envAlias[arg]

if (!nextEnv) {
  console.error('Usage: node scripts/set-miniprogram-env.js <development|production>')
  process.exit(1)
}

const targetPath = path.join(__dirname, '..', 'miniprogram', 'config', 'env.local.js')

let existingConfig = {}
if (fs.existsSync(targetPath)) {
  try {
    delete require.cache[require.resolve(targetPath)]
    existingConfig = require(targetPath)
  } catch (error) {
    console.warn('Failed to read existing miniprogram env.local.js, overwriting it.')
  }
}

const nextConfig = {
  ...existingConfig,
  currentEnv: nextEnv
}

const fileContent = `module.exports = ${JSON.stringify(nextConfig, null, 2)}\n`
fs.writeFileSync(targetPath, fileContent, 'utf8')

console.log(`Mini program environment set to: ${nextEnv}`)
console.log(`Config file updated: ${targetPath}`)

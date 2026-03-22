const fs = require('fs')
const path = require('path')

const nextEnv = process.argv[2] === 'production' ? 'production' : 'development'
const rootDir = path.resolve(__dirname, '..')
const sharedConfigPath = path.join(rootDir, 'env.shared.json')
const sharedConfig = JSON.parse(fs.readFileSync(sharedConfigPath, 'utf8'))

sharedConfig.currentEnv = nextEnv

fs.writeFileSync(sharedConfigPath, `${JSON.stringify(sharedConfig, null, 2)}\n`, 'utf8')
console.log(`set env.shared.json currentEnv=${nextEnv}`)

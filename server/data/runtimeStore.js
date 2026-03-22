const fs = require('fs')
const path = require('path')

const legacyConfig = require('../config/bedTypes')

const runtimeConfigPath = path.join(__dirname, 'runtime-config.json')

let runtimeConfigQueue = Promise.resolve()

function getDefaultRuntimeConfig() {
  return {
    bedTypes: legacyConfig.bedTypes || [],
    depositRules: legacyConfig.depositRules || {},
    inventory: legacyConfig.inventory || {},
    orderRules: legacyConfig.orderRules || {},
    businessHours: legacyConfig.businessHours || {},
    rentalPolicy: legacyConfig.rentalPolicy || {}
  }
}

function cloneRuntimeConfig(configData) {
  return JSON.parse(JSON.stringify(configData))
}

function normalizeRuntimeConfig(configData = {}) {
  const defaults = getDefaultRuntimeConfig()
  return {
    bedTypes: Array.isArray(configData.bedTypes) ? configData.bedTypes : defaults.bedTypes,
    depositRules: configData.depositRules && typeof configData.depositRules === 'object'
      ? configData.depositRules
      : defaults.depositRules,
    inventory: configData.inventory && typeof configData.inventory === 'object'
      ? configData.inventory
      : defaults.inventory,
    orderRules: configData.orderRules && typeof configData.orderRules === 'object'
      ? configData.orderRules
      : defaults.orderRules,
    businessHours: configData.businessHours && typeof configData.businessHours === 'object'
      ? configData.businessHours
      : defaults.businessHours,
    rentalPolicy: configData.rentalPolicy && typeof configData.rentalPolicy === 'object'
      ? configData.rentalPolicy
      : defaults.rentalPolicy
  }
}

function ensureRuntimeConfigFile() {
  if (fs.existsSync(runtimeConfigPath)) {
    return
  }

  fs.mkdirSync(path.dirname(runtimeConfigPath), { recursive: true })
  fs.writeFileSync(
    runtimeConfigPath,
    `${JSON.stringify(getDefaultRuntimeConfig(), null, 2)}\n`,
    'utf8'
  )
}

async function loadRuntimeConfig() {
  try {
    ensureRuntimeConfigFile()
    return normalizeRuntimeConfig(
      JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'))
    )
  } catch (error) {
    console.error('Failed to load runtime config:', error)
    return normalizeRuntimeConfig(getDefaultRuntimeConfig())
  }
}

async function saveRuntimeConfig(configData) {
  try {
    fs.mkdirSync(path.dirname(runtimeConfigPath), { recursive: true })
    fs.writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify(normalizeRuntimeConfig(configData), null, 2)}\n`,
      'utf8'
    )
    return true
  } catch (error) {
    console.error('Failed to save runtime config:', error)
    return false
  }
}

async function withRuntimeConfigLock(task) {
  const operation = runtimeConfigQueue.then(async () => task())
  runtimeConfigQueue = operation.catch(() => undefined)
  return operation
}

async function updateRuntimeConfig(mutator) {
  return withRuntimeConfigLock(async () => {
    const currentConfig = await loadRuntimeConfig()
    const workingCopy = cloneRuntimeConfig(currentConfig)
    const nextConfig = await mutator(workingCopy)
    const configToSave = normalizeRuntimeConfig(nextConfig || workingCopy)
    const saved = await saveRuntimeConfig(configToSave)

    if (!saved) {
      throw new Error('Failed to save runtime config')
    }

    return configToSave
  })
}

module.exports = {
  runtimeConfigPath,
  loadRuntimeConfig,
  saveRuntimeConfig,
  withRuntimeConfigLock,
  updateRuntimeConfig,
  getDefaultRuntimeConfig,
  normalizeRuntimeConfig,
  cloneRuntimeConfig
}

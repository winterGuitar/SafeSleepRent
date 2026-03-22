const {
  loadRuntimeConfig,
  saveRuntimeConfig,
  updateRuntimeConfig
} = require('../data/runtimeStore')

let _broadcast = null

function setBroadcast(fn) {
  _broadcast = fn
}

function buildImageUrl(imagePath, req) {
  if (!imagePath) return null

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  let relativePath = imagePath
  if (!imagePath.startsWith('/')) {
    relativePath = `/public/images/${imagePath}`
  }

  const protocol = req.get('x-forwarded-proto') === 'https'
    ? 'https:'
    : (req.secure ? 'https:' : 'http:')
  const host = req.get('host')

  return `${protocol}//${host}${relativePath}`
}

async function loadBedTypesConfig() {
  return loadRuntimeConfig()
}

async function saveBedTypesConfig(configData) {
  return saveRuntimeConfig(configData)
}

async function getBedTypes(req, res) {
  try {
    const configData = await loadBedTypesConfig()
    const bedTypes = (configData.bedTypes || []).map(bed => ({
      ...bed,
      imageUrl: buildImageUrl(bed.image, req)
    }))

    res.json({
      code: 200,
      message: '获取成功',
      data: bedTypes
    })
  } catch (error) {
    console.error('获取床位类型失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function getBedTypeById(req, res) {
  try {
    const { id } = req.params
    const configData = await loadBedTypesConfig()
    const bedType = (configData.bedTypes || []).find(bed => bed.id === parseInt(id, 10))

    if (!bedType) {
      return res.json({
        code: 404,
        message: '床位类型不存在'
      })
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: bedType
    })
  } catch (error) {
    console.error('获取床位类型失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function addBedType(req, res) {
  try {
    const newBedType = { ...req.body }

    if (!newBedType.name || !newBedType.code) {
      return res.json({
        code: 400,
        message: '床位名称和代码不能为空'
      })
    }

    const configData = await updateRuntimeConfig((runtimeConfig) => {
      const maxId = Math.max(...(runtimeConfig.bedTypes || []).map(bed => bed.id), 0)
      newBedType.id = maxId + 1
      runtimeConfig.bedTypes = runtimeConfig.bedTypes || []
      runtimeConfig.bedTypes.push(newBedType)
      return runtimeConfig
    })

    if (_broadcast) {
      _broadcast({
        type: 'bed_types_update',
        action: 'add',
        data: newBedType,
        timestamp: Date.now()
      })
    }

    res.json({
      code: 200,
      message: '添加成功',
      data: configData.bedTypes.find(bed => bed.id === newBedType.id) || newBedType
    })
  } catch (error) {
    console.error('添加床位类型失败:', error)
    res.json({
      code: 500,
      message: '添加失败'
    })
  }
}

async function updateBedType(req, res) {
  try {
    const { id } = req.params
    const targetId = parseInt(id, 10)
    const updateData = { ...req.body }

    if (updateData.stock !== undefined) {
      updateData.stock = parseInt(updateData.stock, 10)
    }

    const configData = await updateRuntimeConfig((runtimeConfig) => {
      const bedTypes = runtimeConfig.bedTypes || []
      const index = bedTypes.findIndex(bed => bed.id === targetId)

      if (index === -1) {
        return null
      }

      bedTypes[index] = { ...bedTypes[index], ...updateData, id: targetId }
      return runtimeConfig
    })

    const updatedBedType = (configData.bedTypes || []).find(bed => bed.id === targetId)
    if (!updatedBedType) {
      return res.json({
        code: 404,
        message: '床位类型不存在'
      })
    }

    if (_broadcast) {
      _broadcast({
        type: 'bed_types_update',
        action: 'update',
        data: updatedBedType,
        timestamp: Date.now()
      })
    }

    res.json({
      code: 200,
      message: '更新成功',
      data: updatedBedType
    })
  } catch (error) {
    console.error('更新床位类型失败:', error)
    res.json({
      code: 500,
      message: '更新失败'
    })
  }
}

async function deleteBedType(req, res) {
  try {
    const { id } = req.params
    const targetId = parseInt(id, 10)
    let deletedBed = null

    const configData = await updateRuntimeConfig((runtimeConfig) => {
      const bedTypes = runtimeConfig.bedTypes || []
      const index = bedTypes.findIndex(bed => bed.id === targetId)

      if (index === -1) {
        return null
      }

      deletedBed = bedTypes.splice(index, 1)[0]
      runtimeConfig.bedTypes = bedTypes
      return runtimeConfig
    })

    if (!deletedBed) {
      return res.json({
        code: 404,
        message: '床位类型不存在'
      })
    }

    if (_broadcast) {
      _broadcast({
        type: 'bed_types_update',
        action: 'delete',
        data: { id: deletedBed.id },
        timestamp: Date.now()
      })
    }

    res.json({
      code: 200,
      message: '删除成功',
      data: configData.bedTypes
    })
  } catch (error) {
    console.error('删除床位类型失败:', error)
    res.json({
      code: 500,
      message: '删除失败'
    })
  }
}

async function getAvailableBedTypes(req, res) {
  try {
    const configData = await loadBedTypesConfig()
    const availableBeds = (configData.bedTypes || [])
      .filter(bed => bed.available === true)
      .map(bed => ({
        ...bed,
        imageUrl: buildImageUrl(bed.image, req)
      }))

    res.json({
      code: 200,
      message: '获取成功',
      data: availableBeds
    })
  } catch (error) {
    console.error('获取可用床位类型失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function getBedInventory(req, res) {
  try {
    const configData = await loadBedTypesConfig()
    const inventory = (configData.bedTypes || []).map(bed => ({
      id: bed.id,
      name: bed.name,
      code: bed.code,
      stock: bed.stock || 0,
      available: bed.available || false,
      status: (bed.stock || 0) <= 10 ? 'low' : 'normal'
    }))

    res.json({
      code: 200,
      message: '获取成功',
      data: inventory
    })
  } catch (error) {
    console.error('获取库存信息失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function getDepositRules(req, res) {
  try {
    const configData = await loadBedTypesConfig()
    res.json({
      code: 200,
      message: '获取成功',
      data: configData.depositRules || {}
    })
  } catch (error) {
    console.error('获取押金规则失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function getRentalPolicy(req, res) {
  try {
    const configData = await loadBedTypesConfig()
    res.json({
      code: 200,
      message: '获取成功',
      data: configData.rentalPolicy || {}
    })
  } catch (error) {
    console.error('获取租赁政策失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function getBusinessHours(req, res) {
  try {
    const configData = await loadBedTypesConfig()
    res.json({
      code: 200,
      message: '获取成功',
      data: configData.businessHours || {}
    })
  } catch (error) {
    console.error('获取营业时间失败:', error)
    res.json({
      code: 500,
      message: '获取失败'
    })
  }
}

async function saveSystemSettings(req, res) {
  try {
    const settings = req.body
    const configData = await updateRuntimeConfig((runtimeConfig) => {
      if (settings.depositRules) {
        runtimeConfig.depositRules = {
          ...runtimeConfig.depositRules,
          ...settings.depositRules
        }
      }
      if (settings.businessHours) {
        runtimeConfig.businessHours = {
          ...runtimeConfig.businessHours,
          ...settings.businessHours
        }
      }
      if (settings.rentalPolicy) {
        runtimeConfig.rentalPolicy = {
          ...runtimeConfig.rentalPolicy,
          ...settings.rentalPolicy
        }
      }
      if (settings.inventory) {
        runtimeConfig.inventory = {
          ...runtimeConfig.inventory,
          ...settings.inventory
        }
      }

      return runtimeConfig
    })

    if (_broadcast) {
      _broadcast({
        type: 'settings_update',
        data: settings,
        runtimeConfig: configData,
        timestamp: Date.now()
      })
    }

    res.json({
      code: 200,
      message: '保存成功'
    })
  } catch (error) {
    console.error('保存系统设置失败:', error)
    res.json({
      code: 500,
      message: '保存失败'
    })
  }
}

module.exports = {
  setBroadcast,
  getBedTypes,
  getBedTypeById,
  getAvailableBedTypes,
  getBedInventory,
  addBedType,
  updateBedType,
  deleteBedType,
  getDepositRules,
  getRentalPolicy,
  getBusinessHours,
  saveSystemSettings,
  loadBedTypesConfig,
  saveBedTypesConfig
}

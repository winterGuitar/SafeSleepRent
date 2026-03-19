const config = require('../config/appConfig');

// 读取配置文件
const fs = require('fs');
const path = require('path');

// 构建完整的图片URL
function buildImageUrl(imagePath, req) {
  if (!imagePath) return null;

  // 如果已经是完整URL，直接返回
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 如果是相对路径，构建完整URL
  let relativePath = imagePath;
  if (!imagePath.startsWith('/')) {
    relativePath = `/public/images/${imagePath}`;
  }

  // 获取协议和主机
  const protocol = req.secure ? 'https:' : 'http:';
  const host = req.get('host');

  // 返回完整的URL
  return `${protocol}//${host}${relativePath}`;
}

let bedTypesData = null;

// 加载床位类型配置
function loadBedTypesConfig() {
  try {
    const configPath = path.join(__dirname, '../config/bedTypes.js');
    delete require.cache[require.resolve(configPath)];
    bedTypesData = require(configPath);
    return bedTypesData;
  } catch (error) {
    console.error('加载床位类型配置失败:', error);
    return { bedTypes: [] };
  }
}

// 保存床位类型配置
function saveBedTypesConfig(configData) {
  try {
    const configPath = path.join(__dirname, '../config/bedTypes.js');
    const content = `module.exports = ${JSON.stringify(configData, null, 2)}`;
    fs.writeFileSync(configPath, content, 'utf8');

    // 清除缓存
    delete require.cache[require.resolve(configPath)];
    bedTypesData = configData;

    return true;
  } catch (error) {
    console.error('保存床位类型配置失败:', error);
    return false;
  }
}

// 初始化加载
loadBedTypesConfig();

// ==================== 床位类型管理接口 ====================

// 获取所有床位类型
async function getBedTypes(req, res) {
  try {
    const configData = loadBedTypesConfig();
    const bedTypes = (configData.bedTypes || []).map(bed => ({
      ...bed,
      imageUrl: buildImageUrl(bed.image, req)
    }));
    res.json({
      code: 200,
      message: '获取成功',
      data: bedTypes
    });
  } catch (error) {
    console.error('获取床位类型失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// 根据ID获取床位类型
async function getBedTypeById(req, res) {
  try {
    const { id } = req.params;
    const configData = loadBedTypesConfig();
    const bedType = (configData.bedTypes || []).find(bed => bed.id === parseInt(id));

    if (!bedType) {
      return res.json({
        code: 404,
        message: '床位类型不存在'
      });
    }

    res.json({
      code: 200,
      message: '获取成功',
      data: bedType
    });
  } catch (error) {
    console.error('获取床位类型失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// 添加床位类型
async function addBedType(req, res) {
  try {
    const newBedType = req.body;
    
    if (!newBedType.name || !newBedType.code) {
      return res.json({
        code: 400,
        message: '床位名称和代码不能为空'
      });
    }

    const configData = loadBedTypesConfig();
    
    // 生成新ID
    const maxId = Math.max(...(configData.bedTypes || []).map(b => b.id), 0);
    newBedType.id = maxId + 1;

    // 添加到列表
    if (!configData.bedTypes) {
      configData.bedTypes = [];
    }
    configData.bedTypes.push(newBedType);

    // 保存配置
    const saved = saveBedTypesConfig(configData);
    
    if (!saved) {
      return res.json({
        code: 500,
        message: '保存失败'
      });
    }

    // 通知小程序刷新数据
    if (req.broadcastToClients) {
      req.broadcastToClients({
        type: 'bed_types_update',
        action: 'add',
        data: newBedType,
        timestamp: Date.now()
      });
    }

    res.json({
      code: 200,
      message: '添加成功',
      data: newBedType
    });
  } catch (error) {
    console.error('添加床位类型失败:', error);
    res.json({
      code: 500,
      message: '添加失败'
    });
  }
}

// 更新床位类型
async function updateBedType(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const configData = loadBedTypesConfig();
    const bedTypes = configData.bedTypes || [];
    const index = bedTypes.findIndex(bed => bed.id === parseInt(id));

    if (index === -1) {
      console.log('床位类型不存在, id:', id, 'existing ids:', bedTypes.map(b => b.id));
      return res.json({
        code: 404,
        message: '床位类型不存在'
      });
    }

    console.log('更新床位类型, id:', id, 'updateData:', updateData);

    // 更新数据 - 只更新提供的字段
    // 确保 stock 是数字
    if (updateData.stock !== undefined) {
      updateData.stock = parseInt(updateData.stock);
    }

    bedTypes[index] = { ...bedTypes[index], ...updateData, id: parseInt(id) };

    // 保存配置
    const saved = saveBedTypesConfig(configData);

    if (!saved) {
      console.error('保存配置失败');
      return res.json({
        code: 500,
        message: '保存失败'
      });
    }

    console.log('更新后的床位数据:', bedTypes[index]);

    // 通知小程序刷新数据
    if (req.broadcastToClients) {
      console.log('准备广播床位更新消息，数据:', bedTypes[index]);
      req.broadcastToClients({
        type: 'bed_types_update',
        action: 'update',
        data: bedTypes[index],
        timestamp: Date.now()
      });
      console.log('床位更新消息已发送到广播函数');
    } else {
      console.warn('警告: req.broadcastToClients 不存在，无法广播消息');
    }

    res.json({
      code: 200,
      message: '更新成功',
      data: bedTypes[index]
    });
  } catch (error) {
    console.error('更新床位类型失败:', error);
    res.json({
      code: 500,
      message: '更新失败'
    });
  }
}

// 删除床位类型
async function deleteBedType(req, res) {
  try {
    const { id } = req.params;

    const configData = loadBedTypesConfig();
    const bedTypes = configData.bedTypes || [];
    const index = bedTypes.findIndex(bed => bed.id === parseInt(id));

    if (index === -1) {
      return res.json({
        code: 404,
        message: '床位类型不存在'
      });
    }

    // 删除数据
    const deletedBed = bedTypes.splice(index, 1)[0];
    configData.bedTypes = bedTypes;

    // 保存配置
    const saved = saveBedTypesConfig(configData);
    
    if (!saved) {
      return res.json({
        code: 500,
        message: '保存失败'
      });
    }

    // 通知小程序刷新数据
    if (req.broadcastToClients) {
      req.broadcastToClients({
        type: 'bed_types_update',
        action: 'delete',
        data: { id: deletedBed.id },
        timestamp: Date.now()
      });
    }

    res.json({
      code: 200,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除床位类型失败:', error);
    res.json({
      code: 500,
      message: '删除失败'
    });
  }
}

// 获取可用的床位类型
async function getAvailableBedTypes(req, res) {
  try {
    const configData = loadBedTypesConfig();
    const availableBeds = (configData.bedTypes || [])
      .filter(bed => bed.available === true)
      .map(bed => ({
        ...bed,
        imageUrl: buildImageUrl(bed.image, req)
      }));

    res.json({
      code: 200,
      message: '获取成功',
      data: availableBeds
    });
  } catch (error) {
    console.error('获取可用床位类型失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// 获取库存信息
async function getBedInventory(req, res) {
  try {
    const configData = loadBedTypesConfig();
    const bedTypes = configData.bedTypes || [];

    const inventory = bedTypes.map(bed => ({
      id: bed.id,
      name: bed.name,
      code: bed.code,
      stock: bed.stock || 0,
      available: bed.available || false,
      status: bed.stock <= 10 ? 'low' : 'normal'
    }));

    res.json({
      code: 200,
      message: '获取成功',
      data: inventory
    });
  } catch (error) {
    console.error('获取库存信息失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// ==================== 系统设置接口 ====================

// 获取押金规则
async function getDepositRules(req, res) {
  try {
    const configData = loadBedTypesConfig();
    res.json({
      code: 200,
      message: '获取成功',
      data: configData.depositRules || {}
    });
  } catch (error) {
    console.error('获取押金规则失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// 获取租赁政策
async function getRentalPolicy(req, res) {
  try {
    const configData = loadBedTypesConfig();
    res.json({
      code: 200,
      message: '获取成功',
      data: configData.rentalPolicy || {}
    });
  } catch (error) {
    console.error('获取租赁政策失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// 获取营业时间
async function getBusinessHours(req, res) {
  try {
    const configData = loadBedTypesConfig();
    res.json({
      code: 200,
      message: '获取成功',
      data: configData.businessHours || {}
    });
  } catch (error) {
    console.error('获取营业时间失败:', error);
    res.json({
      code: 500,
      message: '获取失败'
    });
  }
}

// 保存系统设置
async function saveSystemSettings(req, res) {
  try {
    const settings = req.body;
    const configData = loadBedTypesConfig();

    // 更新各项设置
    if (settings.depositRules) {
      configData.depositRules = { ...configData.depositRules, ...settings.depositRules };
    }
    if (settings.businessHours) {
      configData.businessHours = { ...configData.businessHours, ...settings.businessHours };
    }
    if (settings.rentalPolicy) {
      configData.rentalPolicy = { ...configData.rentalPolicy, ...settings.rentalPolicy };
    }
    if (settings.inventory) {
      configData.inventory = { ...configData.inventory, ...settings.inventory };
    }

    // 保存配置
    const saved = saveBedTypesConfig(configData);
    
    if (!saved) {
      return res.json({
        code: 500,
        message: '保存失败'
      });
    }

    // 通知小程序刷新数据
    if (req.broadcastToClients) {
      req.broadcastToClients({
        type: 'settings_update',
        data: settings,
        timestamp: Date.now()
      });
    }

    res.json({
      code: 200,
      message: '保存成功'
    });
  } catch (error) {
    console.error('保存系统设置失败:', error);
    res.json({
      code: 500,
      message: '保存失败'
    });
  }
}

module.exports = {
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
};

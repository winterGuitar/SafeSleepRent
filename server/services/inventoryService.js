// 库存管理服务
// 根据数据库类型自动选择存储方式（MySQL数据库或文件存储）

const config = require('../config/appConfig');
const runtimeStore = require('../data/runtimeStore');

// 尝试导入MySQL相关的DAO，如果失败则设置为null
let systemConfigDao = null;
try {
  systemConfigDao = require('../database/systemConfigDao');
} catch (error) {
  console.log('MySQL systemConfigDao 加载失败，将使用文件存储模式:', error.message);
}

/**
 * 判断是否使用MySQL模式
 * @returns {boolean}
 */
function isMySQLMode() {
  return config.database.type === 'mysql' && systemConfigDao !== null;
}

/**
 * 获取床位类型配置
 * @returns {Promise<Array>} 床位类型数组
 */
async function getBedTypes() {
  if (isMySQLMode()) {
    try {
      const bedTypes = await systemConfigDao.getSystemConfig('bedTypes');
      if (bedTypes && Array.isArray(bedTypes) && bedTypes.length > 0) {
        return bedTypes;
      }
      
      // 数据库中没有配置或配置为空数组，尝试从文件加载并迁移到数据库
      console.log('数据库中没有找到床位类型配置，尝试从文件迁移...');
      const runtimeConfig = await runtimeStore.loadRuntimeConfig();
      const fileBedTypes = runtimeConfig.bedTypes || [];
      
      if (Array.isArray(fileBedTypes) && fileBedTypes.length > 0) {
        console.log(`从文件加载到 ${fileBedTypes.length} 个床位类型，正在迁移到数据库...`);
        try {
          await systemConfigDao.updateBedTypes(fileBedTypes);
          console.log('床位类型配置已成功迁移到数据库');
          return fileBedTypes;
        } catch (migrationError) {
          console.error('迁移床位类型配置到数据库失败:', migrationError.message);
          // 继续使用文件配置
        }
      } else {
        console.log('文件中也无床位类型配置，返回空数组');
      }
    } catch (error) {
      console.error('从数据库获取床位类型配置失败，回退到文件存储:', error.message);
    }
  }
  
  // 回退到文件存储
  const runtimeConfig = await runtimeStore.loadRuntimeConfig();
  return runtimeConfig.bedTypes || [];
}

/**
 * 保存床位类型配置
 * @param {Array} bedTypes 床位类型数组
 * @returns {Promise<boolean>} 是否成功
 */
async function saveBedTypes(bedTypes) {
  if (!Array.isArray(bedTypes)) {
    throw new Error('bedTypes 必须是一个数组');
  }
  
  if (isMySQLMode()) {
    try {
      return await systemConfigDao.updateBedTypes(bedTypes);
    } catch (error) {
      console.error('保存床位类型配置到数据库失败，回退到文件存储:', error.message);
    }
  }
  
  // 文件存储模式
  return runtimeStore.updateRuntimeConfig((configData) => {
    configData.bedTypes = bedTypes;
    return configData;
  }).then(() => true).catch(() => false);
}

/**
 * 扣减库存（单个床位类型）
 * @param {number} bedId 床位ID
 * @param {number} quantity 扣减数量
 * @returns {Promise<{success: boolean, newStock: number, message: string}>}
 */
async function deductStock(bedId, quantity) {
  if (quantity <= 0) {
    throw new Error('扣减数量必须大于0');
  }
  
  return updateStock(bedId, -quantity);
}

/**
 * 恢复库存（单个床位类型）
 * @param {number} bedId 床位ID
 * @param {number} quantity 恢复数量
 * @returns {Promise<{success: boolean, newStock: number, message: string}>}
 */
async function restoreStock(bedId, quantity) {
  if (quantity <= 0) {
    throw new Error('恢复数量必须大于0');
  }
  
  return updateStock(bedId, quantity);
}

/**
 * 更新库存（内部通用函数）
 * @param {number} bedId 床位ID
 * @param {number} delta 变化量（正数增加，负数扣减）
 * @returns {Promise<{success: boolean, newStock: number, message: string}>}
 */
async function updateStock(bedId, delta) {
  if (isMySQLMode()) {
    try {
      return await systemConfigDao.updateBedStock(bedId, delta);
    } catch (error) {
      console.error('数据库库存更新失败，回退到文件存储:', error.message);
    }
  }
  
  // 文件存储模式（使用现有的并发控制）
  return runtimeStore.updateRuntimeConfig((configData) => {
    const bedTypes = configData.bedTypes || [];
    const bedType = bedTypes.find(item => item.id === bedId);
    if (!bedType) {
      throw new Error(`床位类型ID ${bedId} 不存在`);
    }
    
    const currentStock = bedType.stock || 0;
    const newStock = currentStock + delta;
    
    if (newStock < 0) {
      throw new Error(`${bedType.name} 库存不足，当前库存：${currentStock}`);
    }
    
    bedType.stock = newStock;
    
    return configData;
  }).then(() => {
    // 获取更新后的库存
    return runtimeStore.loadRuntimeConfig().then(configData => {
      const bedTypes = configData.bedTypes || [];
      const bedType = bedTypes.find(item => item.id === bedId);
      return {
        success: true,
        newStock: bedType ? (bedType.stock || 0) : 0,
        message: '库存更新成功'
      };
    });
  }).catch(error => {
    return {
      success: false,
      newStock: null,
      message: error.message
    };
  });
}

/**
 * 批量更新库存（多个床位类型）
 * @param {Array<{bedId: number, delta: number}>} updates 更新数组
 * @returns {Promise<Array<{bedId: number, success: boolean, newStock: number, message: string}>>}
 */
async function batchUpdateStocks(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('更新数组不能为空');
  }
  
  if (isMySQLMode()) {
    try {
      return await systemConfigDao.batchUpdateBedStocks(updates);
    } catch (error) {
      console.error('数据库批量库存更新失败，回退到文件存储:', error.message);
    }
  }
  
  // 文件存储模式
  return runtimeStore.updateRuntimeConfig((configData) => {
    const bedTypes = configData.bedTypes || [];
    const results = [];
    
    // 首先验证所有更新
    for (const update of updates) {
      const { bedId, delta } = update;
      const bedType = bedTypes.find(item => item.id === bedId);
      if (!bedType) {
        throw new Error(`床位类型ID ${bedId} 不存在`);
      }
      
      const currentStock = bedType.stock || 0;
      const newStock = currentStock + delta;
      
      if (newStock < 0) {
        throw new Error(`${bedType.name} 库存不足，当前库存：${currentStock}`);
      }
    }
    
    // 执行更新
    for (const update of updates) {
      const { bedId, delta } = update;
      const bedType = bedTypes.find(item => item.id === bedId);
      const currentStock = bedType.stock || 0;
      const newStock = currentStock + delta;
      
      bedType.stock = newStock;
      
      results.push({
        bedId,
        success: true,
        newStock,
        message: '库存更新成功'
      });
    }
    
    return configData;
  }).then(() => {
    // 重新加载配置以获取准确的库存值
    return runtimeStore.loadRuntimeConfig().then(configData => {
      const bedTypes = configData.bedTypes || [];
      return updates.map(update => {
        const bedType = bedTypes.find(item => item.id === update.bedId);
        return {
          bedId: update.bedId,
          success: true,
          newStock: bedType ? (bedType.stock || 0) : 0,
          message: '库存更新成功'
        };
      });
    });
  }).catch(error => {
    // 返回失败结果
    return updates.map(update => ({
      bedId: update.bedId,
      success: false,
      newStock: null,
      message: error.message
    }));
  });
}

/**
 * 验证库存是否充足
 * @param {Array<{id: number, quantity: number}>} beds 床位列表
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function validateInventory(beds) {
  const bedTypes = await getBedTypes();
  
  for (const bed of beds) {
    const bedType = bedTypes.find(item => item.id === bed.id);
    if (!bedType) {
      return {
        ok: false,
        message: `床位类型ID ${bed.id} 不存在`
      };
    }
    
    if (!bedType.available) {
      return {
        ok: false,
        message: `${bedType.name} 暂时不可用`
      };
    }
    
    const currentStock = bedType.stock || 0;
    if (currentStock < bed.quantity) {
      return {
        ok: false,
        message: `${bedType.name} 库存不足，当前库存：${currentStock}`
      };
    }
  }
  
  return { ok: true };
}

/**
 * 扣减订单库存（原子操作）
 * @param {Array<{id: number, quantity: number, name: string}>} beds 订单床位列表
 * @returns {Promise<{success: boolean, message: string, results?: Array}>}
 */
async function deductOrderInventory(beds) {
  const updates = beds.map(bed => ({
    bedId: bed.id,
    delta: -bed.quantity
  }))

  const results = await batchUpdateStocks(updates)
  
  const allSuccess = results.every(result => result.success)
  if (allSuccess) {
    return {
      success: true,
      message: '库存扣减成功',
      results
    }
  } else {
    const failedResults = results.filter(result => !result.success)
    const errorMessages = failedResults.map(result => result.message).join('; ')
    console.error('库存扣减失败:', errorMessages)
    return {
      success: false,
      message: errorMessages || '库存扣减失败',
      results
    }
  }
}

/**
 * 恢复订单库存（原子操作）
 * @param {Array<{id: number, quantity: number, name: string}>} beds 订单床位列表
 * @returns {Promise<{success: boolean, message: string, results?: Array}>}
 */
async function restoreOrderInventory(beds) {
  const updates = beds.map(bed => ({
    bedId: bed.id,
    delta: bed.quantity
  }))

  const results = await batchUpdateStocks(updates)
  
  const allSuccess = results.every(result => result.success)
  if (allSuccess) {
    return {
      success: true,
      message: '库存恢复成功',
      results
    }
  } else {
    const failedResults = results.filter(result => !result.success)
    const errorMessages = failedResults.map(result => result.message).join('; ')
    console.error('库存恢复失败:', errorMessages)
    return {
      success: false,
      message: errorMessages || '库存恢复失败',
      results
    }
  }
}

module.exports = {
  isMySQLMode,
  getBedTypes,
  saveBedTypes,
  deductStock,
  restoreStock,
  updateStock,
  batchUpdateStocks,
  validateInventory,
  deductOrderInventory,
  restoreOrderInventory
};
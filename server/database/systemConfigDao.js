// 系统配置数据访问层
const db = require('./mysql');

/**
 * 获取系统配置值
 * @param {string} configKey 配置键
 * @returns {Promise<any>} 配置值（JSON解析后的对象）
 */
async function getSystemConfig(configKey) {
  try {
    const result = await db.query(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      [configKey]
    );
    
    if (result.length === 0) {
      return null;
    }
    
    const configValue = result[0].config_value;
    if (!configValue) {
      return null;
    }
    
    try {
      return JSON.parse(configValue);
    } catch (error) {
      console.error(`解析配置 ${configKey} 的JSON失败:`, error);
      return null;
    }
  } catch (error) {
    console.error(`获取系统配置 ${configKey} 失败:`, error);
    throw error;
  }
}

/**
 * 设置系统配置值
 * @param {string} configKey 配置键
 * @param {any} configValue 配置值（将被JSON序列化）
 * @param {string} description 配置描述（可选）
 * @returns {Promise<boolean>} 是否成功
 */
async function setSystemConfig(configKey, configValue, description = null) {
  try {
    const jsonValue = JSON.stringify(configValue);
    
    const result = await db.query(
      `INSERT INTO system_config (config_key, config_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         config_value = VALUES(config_value),
         description = COALESCE(VALUES(description), description)`,
      [configKey, jsonValue, description]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`设置系统配置 ${configKey} 失败:`, error);
    throw error;
  }
}

/**
 * 批量更新床位类型配置（带事务）
 * @param {Array} bedTypes 床位类型数组
 * @returns {Promise<boolean>} 是否成功
 */
async function updateBedTypes(bedTypes) {
  return db.transaction(async (connection) => {
    const jsonValue = JSON.stringify(bedTypes);
    
    await new Promise((resolve, reject) => {
      connection.query(
        `INSERT INTO system_config (config_key, config_value, description)
         VALUES ('bedTypes', ?, '床位类型配置')
         ON DUPLICATE KEY UPDATE
           config_value = VALUES(config_value)`,
        [jsonValue],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
    
    return true;
  });
}

/**
 * 原子更新库存（使用数据库事务保证一致性）
 * @param {number} bedId 床位ID
 * @param {number} delta 库存变化量（正数表示增加，负数表示扣减）
 * @returns {Promise<{success: boolean, newStock: number, message: string}>}
 */
async function updateBedStock(bedId, delta) {
  return db.transaction(async (connection) => {
    // 1. 获取当前bedTypes配置
    const configResult = await new Promise((resolve, reject) => {
      connection.query(
        'SELECT config_value FROM system_config WHERE config_key = ? FOR UPDATE',
        ['bedTypes'],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
    
    if (configResult.length === 0) {
      throw new Error('床位类型配置不存在');
    }
    
    let bedTypes;
    try {
      bedTypes = JSON.parse(configResult[0].config_value);
    } catch (error) {
      throw new Error('解析床位类型配置失败');
    }
    
    // 2. 找到对应的床位类型
    const bedIndex = bedTypes.findIndex(item => item.id === bedId);
    if (bedIndex === -1) {
      throw new Error(`床位类型ID ${bedId} 不存在`);
    }
    
    const bedType = bedTypes[bedIndex];
    const currentStock = bedType.stock || 0;
    const newStock = currentStock + delta;
    
    // 3. 检查库存是否充足（如果是扣减）
    if (newStock < 0) {
      throw new Error(`${bedType.name} 库存不足，当前库存：${currentStock}`);
    }
    
    // 4. 更新库存
    bedTypes[bedIndex].stock = newStock;
    
    // 5. 保存更新后的配置
    const jsonValue = JSON.stringify(bedTypes);
    await new Promise((resolve, reject) => {
      connection.query(
        `UPDATE system_config SET config_value = ? WHERE config_key = ?`,
        [jsonValue, 'bedTypes'],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
    
    return {
      success: true,
      newStock,
      message: '库存更新成功'
    };
  });
}

/**
 * 批量原子更新库存（一次事务中更新多个床位的库存）
 * @param {Array<{bedId: number, delta: number}>} updates 更新数组
 * @returns {Promise<Array<{bedId: number, success: boolean, newStock: number, message: string}>>}
 */
async function batchUpdateBedStocks(updates) {
  return db.transaction(async (connection) => {
    // 1. 获取当前bedTypes配置（加锁）
    const configResult = await new Promise((resolve, reject) => {
      connection.query(
        'SELECT config_value FROM system_config WHERE config_key = ? FOR UPDATE',
        ['bedTypes'],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
    
    if (configResult.length === 0) {
      throw new Error('床位类型配置不存在');
    }
    
    let bedTypes;
    try {
      bedTypes = JSON.parse(configResult[0].config_value);
    } catch (error) {
      throw new Error('解析床位类型配置失败');
    }
    
    // 2. 创建床位ID到索引的映射
    const bedIndexMap = {};
    bedTypes.forEach((item, index) => {
      bedIndexMap[item.id] = index;
    });
    
    const results = [];
    
    // 3. 验证所有更新并计算新库存
    for (const update of updates) {
      const { bedId, delta } = update;
      const bedIndex = bedIndexMap[bedId];
      
      if (bedIndex === undefined) {
        results.push({
          bedId,
          success: false,
          newStock: null,
          message: `床位类型ID ${bedId} 不存在`
        });
        continue;
      }
      
      const bedType = bedTypes[bedIndex];
      const currentStock = bedType.stock || 0;
      const newStock = currentStock + delta;
      
      if (newStock < 0) {
        results.push({
          bedId,
          success: false,
          newStock: currentStock,
          message: `${bedType.name} 库存不足，当前库存：${currentStock}`
        });
        continue;
      }
      
      // 临时更新内存中的对象
      bedTypes[bedIndex].stock = newStock;
      
      results.push({
        bedId,
        success: true,
        newStock,
        message: '库存更新成功'
      });
    }
    
    // 4. 检查是否有失败项，如果有则回滚
    const hasFailure = results.some(r => !r.success);
    if (hasFailure) {
      throw new Error('部分库存更新失败，事务回滚');
    }
    
    // 5. 保存更新后的配置
    const jsonValue = JSON.stringify(bedTypes);
    await new Promise((resolve, reject) => {
      connection.query(
        `UPDATE system_config SET config_value = ? WHERE config_key = ?`,
        [jsonValue, 'bedTypes'],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
    
    return results;
  });
}

/**
 * 获取所有系统配置
 * @returns {Promise<Object>} 配置对象
 */
async function getAllSystemConfigs() {
  try {
    const results = await db.query(
      'SELECT config_key, config_value, description FROM system_config'
    );
    
    const configs = {};
    results.forEach(row => {
      try {
        configs[row.config_key] = JSON.parse(row.config_value);
      } catch (error) {
        configs[row.config_key] = row.config_value;
      }
    });
    
    return configs;
  } catch (error) {
    console.error('获取所有系统配置失败:', error);
    throw error;
  }
}

module.exports = {
  getSystemConfig,
  setSystemConfig,
  updateBedTypes,
  updateBedStock,
  batchUpdateBedStocks,
  getAllSystemConfigs
};
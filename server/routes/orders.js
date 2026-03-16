// 订单路由 - 支持数据库和内存存储
const config = require('../config/appConfig');
let db = null;
let orderDao = null;

// 初始化数据库连接
try {
  if (config.database.type === 'mysql') {
    db = require('../database/mysql');
    orderDao = require('../database/orderDao');
    console.log('订单路由: 使用 MySQL 数据库模式');
  } else {
    console.log('订单路由: 使用内存存储模式');
  }
} catch (error) {
  console.log('订单路由: 数据库未配置，使用内存存储模式');
}

// 内存存储
let orders = new Map();

// 工具函数
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function generateOrderId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
}

function getBedTypeById(id) {
  const bedTypeRoutes = require('./bedTypes');
  const configData = bedTypeRoutes.loadBedTypesConfig();
  return configData.bedTypes.find(bt => bt.id === id);
}

// ==================== 订单接口 ====================

// 创建订单
async function createOrder(req, res) {
  try {
    const { beds, totalDeposit, openid } = req.body;

    console.log('=== 创建订单开始 ===');
    console.log('请求体:', JSON.stringify(req.body, null, 2));

    if (!beds || beds.length === 0) {
      return res.json({
        code: 400,
        message: '订单信息不能为空'
      });
    }

    // 检查库存
    try {
      const bedTypeRoutes = require('./bedTypes');
      const configData = bedTypeRoutes.loadBedTypesConfig();

      console.log('配置中所有床位类型:', JSON.stringify(configData.bedTypes.map(bt => ({
        id: bt.id,
        name: bt.name,
        stock: bt.stock,
        available: bt.available
      })), null, 2));

      for (const orderBed of beds) {
        console.log(`检查床位 ID=${orderBed.id}, 名称=${orderBed.name}, 数量=${orderBed.quantity}`);
        const bedType = configData.bedTypes.find(bt => bt.id === orderBed.id);
        console.log(`找到床位类型: ${bedType ? JSON.stringify({ id: bedType.id, name: bedType.name, stock: bedType.stock, available: bedType.available }) : '未找到'}`);

        if (!bedType) {
          return res.json({
            code: 400,
            message: `床位类型 ${orderBed.name} 不存在`
          });
        }

        // 检查床位是否可用
        if (!bedType.available) {
          return res.json({
            code: 400,
            message: `${bedType.name} 暂不可用`
          });
        }

        if (bedType.stock < orderBed.quantity) {
          return res.json({
            code: 400,
            message: `${bedType.name} 库存不足，当前库存：${bedType.stock}`
          });
        }
      }
    } catch (error) {
      console.error('检查库存失败:', error);
      return res.json({
        code: 500,
        message: '检查库存失败'
      });
    }

    // 生成订单号
    const orderId = generateOrderId();

    // 创建订单数据
    const order = {
      orderId: orderId,
      beds: beds,
      totalDeposit: totalDeposit,
      openid: openid || 'openid_' + Date.now(),
      status: 'unpaid',
      createTime: new Date(),
      updateTime: new Date()
    };

    // 根据数据库类型存储订单
    if (config.database.type === 'mysql' && orderDao) {
      await orderDao.createOrder(order);
      console.log('创建订单（数据库）:', order.orderId);
    } else {
      // 使用内存存储
      order.createTime = formatDate(order.createTime);
      order.updateTime = formatDate(order.updateTime);
      orders.set(orderId, order);
      console.log('创建订单（内存）:', order.orderId);
    }

    res.json({
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: orderId,
        order: order
      }
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.json({
      code: 500,
      message: '创建订单失败'
    });
  }
}

// 支付订单
async function payOrder(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    // 获取订单
    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order = orders.get(orderId);
    }

    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    // 只有待支付的订单可以支付
    if (order.status !== 'unpaid') {
      return res.json({
        code: 400,
        message: '订单状态不允许支付'
      });
    }

    // 检查并扣减库存
    try {
      const bedTypeRoutes = require('./bedTypes');
      const configData = bedTypeRoutes.loadBedTypesConfig();

      console.log('=== 支付库存检查开始 ===');
      console.log('订单床位:', JSON.stringify(order.beds, null, 2));
      console.log('配置中所有床位类型:', JSON.stringify(configData.bedTypes.map(bt => ({
        id: bt.id,
        name: bt.name,
        stock: bt.stock
      })), null, 2));

      for (const orderBed of order.beds) {
        const bedType = configData.bedTypes.find(bt => bt.id === orderBed.id);
        console.log(`检查床位 ID=${orderBed.id}, 数量=${orderBed.quantity}`);
        console.log(`找到床位类型: ${bedType ? bedType.name : '未找到'}`);
        if (bedType) {
          console.log(`当前库存: ${bedType.stock}, 需要数量: ${orderBed.quantity}`);
        }

        if (!bedType || bedType.stock < orderBed.quantity) {
          console.error(`库存检查失败! 床位ID=${orderBed.id}, 库存=${bedType ? bedType.stock : 0}, 需要=${orderBed.quantity}`);
          return res.json({
            code: 400,
            message: `${orderBed.name || '床位'} 库存不足，无法完成支付`
          });
        }
      }

      // 扣减库存
      console.log('开始扣减库存...');
      order.beds.forEach(orderBed => {
        const bedType = configData.bedTypes.find(bt => bt.id === orderBed.id);
        if (bedType) {
          const oldStock = bedType.stock;
          bedType.stock = Math.max(0, bedType.stock - orderBed.quantity);
          console.log(`床位 ${bedType.name} 库存更新: ${oldStock} -> ${bedType.stock}`);
        }
      });

      // 保存库存变更
      bedTypeRoutes.saveBedTypesConfig(configData);
      console.log('库存配置已保存');

      // 广播床位类型更新
      if (req.broadcastToClients) {
        req.broadcastToClients({
          type: 'bed_types_update',
          data: configData.bedTypes
        });
      }
      console.log('=== 支付库存检查完成 ===');
    } catch (error) {
      console.error('更新库存失败:', error);
      return res.json({
        code: 500,
        message: '更新库存失败'
      });
    }

    // 更新订单状态为已支付
    const updates = {
      status: 'paid',
      payTime: new Date()
    };

    if (config.database.type === 'mysql' && orderDao) {
      await orderDao.updateOrderStatus(orderId, updates);
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order.status = 'paid';
      order.payTime = formatDate(new Date());
      order.updateTime = formatDate(new Date());
      orders.set(orderId, order);
    }

    console.log('订单支付成功:', order.orderId);

    // 广播订单更新
    if (req.broadcastToClients) {
      req.broadcastToClients({
        type: 'order_paid',
        orderId: orderId
      });
    }

    res.json({
      code: 200,
      message: '支付成功',
      data: order
    });
  } catch (error) {
    console.error('支付失败:', error);
    res.json({
      code: 500,
      message: '支付失败'
    });
  }
}

// 查询订单
async function queryOrder(req, res) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order = orders.get(orderId);
    }

    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    res.json({
      code: 200,
      message: '查询成功',
      data: order
    });
  } catch (error) {
    console.error('查询订单失败:', error);
    res.json({
      code: 500,
      message: '查询订单失败'
    });
  }
}

// 获取订单列表
async function getOrderList(req, res) {
  try {
    const { openid } = req.query;

    let orderList;
    if (config.database.type === 'mysql' && orderDao) {
      if (openid) {
        orderList = await orderDao.getOrdersByOpenid(openid);
      } else {
        orderList = await orderDao.getAllOrders();
      }
    } else {
      // 内存模式
      orderList = Array.from(orders.values()).sort((a, b) =>
        new Date(b.createTime) - new Date(a.createTime)
      );

      if (openid) {
        orderList = orderList.filter(order => order.openid === openid);
      }
    }

    res.json({
      code: 200,
      message: '查询成功',
      data: orderList
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.json({
      code: 500,
      message: '获取订单列表失败'
    });
  }
}

// 退还押金
async function refundOrder(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    // 获取订单
    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order = orders.get(orderId);
    }

    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    if (order.status !== 'paid') {
      return res.json({
        code: 400,
        message: '订单未支付，无法退还押金'
      });
    }

    // 更新订单状态
    const updates = {
      status: 'refunded',
      refundTime: new Date()
    };

    if (config.database.type === 'mysql' && orderDao) {
      await orderDao.updateOrderStatus(orderId, updates);
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order.status = 'refunded';
      order.refundTime = formatDate(new Date());
      order.updateTime = formatDate(new Date());
      orders.set(orderId, order);
    }

    // 恢复库存
    try {
      const bedTypeRoutes = require('./bedTypes');
      const configData = bedTypeRoutes.loadBedTypesConfig();

      order.beds.forEach(orderBed => {
        const bedType = configData.bedTypes.find(bt => bt.id === orderBed.id);
        if (bedType) {
          const oldStock = bedType.stock;
          bedType.stock += orderBed.quantity;
          console.log(`床位 ${bedType.name} 库存恢复: ${oldStock} -> ${bedType.stock}`);
        }
      });

      // 保存库存变更
      bedTypeRoutes.saveBedTypesConfig(configData);

      // 广播床位类型更新
      if (req.broadcastToClients) {
        req.broadcastToClients({
          type: 'bed_types_update',
          data: configData.bedTypes
        });
      }
    } catch (error) {
      console.error('恢复库存失败:', error);
    }

    console.log('押金退还成功:', order.orderId);

    // 广播订单退款成功
    if (req.broadcastToClients) {
      req.broadcastToClients({
        type: 'order_refunded',
        orderId: orderId
      });
    }

    res.json({
      code: 200,
      message: '押金退还成功',
      data: order
    });
  } catch (error) {
    console.error('退还押金失败:', error);
    res.json({
      code: 500,
      message: '退还押金失败'
    });
  }
}

// 删除订单
async function deleteOrder(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    let deleted;
    if (config.database.type === 'mysql' && orderDao) {
      deleted = await orderDao.deleteOrder(orderId);
    } else {
      deleted = orders.delete(orderId);
    }

    if (!deleted) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    res.json({
      code: 200,
      message: '订单删除成功'
    });
  } catch (error) {
    console.error('删除订单失败:', error);
    res.json({
      code: 500,
      message: '删除订单失败'
    });
  }
}

// 取消订单
async function cancelOrder(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    // 获取订单
    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order = orders.get(orderId);
    }

    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    if (order.status !== 'unpaid') {
      return res.json({
        code: 400,
        message: '只有待支付订单可以取消'
      });
    }

    // 更新订单状态
    const updates = {
      status: 'cancelled',
      cancelTime: new Date()
    };

    if (config.database.type === 'mysql' && orderDao) {
      await orderDao.updateOrderStatus(orderId, updates);
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order.status = 'cancelled';
      order.cancelTime = formatDate(new Date());
      order.updateTime = formatDate(new Date());
      orders.set(orderId, order);
    }

    console.log('取消订单:', order.orderId);

    res.json({
      code: 200,
      message: '订单取消成功',
      data: order
    });
  } catch (error) {
    console.error('取消订单失败:', error);
    res.json({
      code: 500,
      message: '取消订单失败'
    });
  }
}

// 模拟支付成功回调
async function mockPayNotify(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      });
    }

    // 获取订单
    let order;
    if (config.database.type === 'mysql' && orderDao) {
      order = await orderDao.getOrderByOrderId(orderId);
    } else {
      order = orders.get(orderId);
    }

    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      });
    }

    // 模拟支付成功回调（3秒后）
    setTimeout(async () => {
      if (order.status === 'unpaid') {
        // 扣减库存
        try {
          const bedTypeRoutes = require('./bedTypes');
          const configData = bedTypeRoutes.loadBedTypesConfig();

          order.beds.forEach(orderBed => {
            const bedType = configData.bedTypes.find(bt => bt.id === orderBed.id);
            if (bedType) {
              const oldStock = bedType.stock;
              bedType.stock = Math.max(0, bedType.stock - orderBed.quantity);
              console.log(`床位 ${bedType.name} 库存更新: ${oldStock} -> ${bedType.stock}`);
            }
          });

          // 保存库存变更
          bedTypeRoutes.saveBedTypesConfig(configData);

          // 广播床位类型更新
          if (req.broadcastToClients) {
            req.broadcastToClients({
              type: 'bed_types_update',
              data: configData.bedTypes
            });
          }
        } catch (error) {
          console.error('扣减库存失败:', error);
        }

        // 更新订单状态
        const updates = {
          status: 'paid',
          payTime: new Date(),
          transactionId: `MOCK_TXN_${Date.now()}`
        };

        if (config.database.type === 'mysql' && orderDao) {
          await orderDao.updateOrderStatus(orderId, updates);
          order = await orderDao.getOrderByOrderId(orderId);
        } else {
          order.status = 'paid';
          order.transactionId = `MOCK_TXN_${Date.now()}`;
          order.payTime = formatDate(new Date());
          order.updateTime = formatDate(new Date());
          orders.set(orderId, order);
        }
        console.log('模拟支付成功:', order.orderId);

        // 广播订单支付通知
        if (req.broadcastToClients) {
          req.broadcastToClients({
            type: 'order_paid',
            orderId: orderId
          });
        }
      }
    }, 3000);

    res.json({
      code: 200,
      message: '模拟支付成功，3秒后更新订单状态',
      data: order
    });
  } catch (error) {
    console.error('模拟支付失败:', error);
    res.json({
      code: 500,
      message: '模拟支付失败'
    });
  }
}

// 导出路由函数
module.exports = {
  createOrder,
  payOrder,
  queryOrder,
  getOrderList,
  refundOrder,
  deleteOrder,
  cancelOrder,
  mockPayNotify
};

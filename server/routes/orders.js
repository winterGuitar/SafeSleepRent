const config = require('../config/appConfig')
const wechatPay = require('../wechat-pay')
const {
  cloneRuntimeConfig,
  loadRuntimeConfig,
  saveRuntimeConfig,
  withRuntimeConfigLock
} = require('../data/runtimeStore')

let orderDao = null
let inventoryService = null
let _broadcast = null

function setBroadcast(fn) {
  _broadcast = fn
}

try {
  if (config.database.type === 'mysql') {
    orderDao = require('../database/orderDao')
    console.log('订单路由: 使用 MySQL 数据库模式')
  } else {
    console.log('订单路由: 使用内存存储模式')
  }
} catch (error) {
  console.log('订单路由: 数据库未配置，使用内存存储模式')
}

// 加载库存服务
try {
  inventoryService = require('../services/inventoryService')
} catch (error) {
  console.log('库存服务加载失败，将使用旧的文件存储模式:', error.message)
  inventoryService = null
}

const orders = new Map()

function formatDate(date = new Date()) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function generateOrderId() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORD${timestamp}${random}`
}

function resolveRequestOpenid(req) {
  return req.userOpenid || null
}

function isOrderOwnedByRequester(order, req) {
  // 管理员可以访问任意订单
  if (req.adminUser) return true
  const openid = req.userOpenid
  if (!openid) return false
  return Boolean(order) && order.openid === openid
}

function getBroadcastFn() {
  return typeof _broadcast === 'function' ? _broadcast : null
}

async function getOrderById(orderId) {
  if (config.database.type === 'mysql' && orderDao) {
    return orderDao.getOrderByOrderId(orderId)
  }

  return orders.get(orderId) || null
}

async function getOrderStats() {
  if (config.database.type === 'mysql' && orderDao) {
    return orderDao.getOrderStats()
  }

  let paidOrders = 0
  let unpaidOrders = 0
  let refundedOrders = 0
  let totalDeposit = 0

  orders.forEach((order) => {
    if (order.status === 'paid') {
      paidOrders += 1
      totalDeposit += Number(order.totalDeposit || 0)
      return
    }

    if (order.status === 'unpaid') {
      unpaidOrders += 1
      return
    }

    if (order.status === 'refunded') {
      refundedOrders += 1
    }
  })

  return {
    totalOrders: orders.size,
    paidOrders,
    unpaidOrders,
    refundedOrders,
    totalDeposit
  }
}

async function updateStoredOrderStatus(orderId, updates) {
  if (config.database.type === 'mysql' && orderDao) {
    await orderDao.updateOrderStatus(orderId, updates)
    return getOrderById(orderId)
  }

  const order = orders.get(orderId)
  if (!order) {
    return null
  }

  if (updates.status !== undefined) {
    order.status = updates.status
  }
  if (updates.transactionId !== undefined) {
    order.transactionId = updates.transactionId
  }
  if (updates.payTime !== undefined) {
    order.payTime = formatDate(updates.payTime)
  }
  if (updates.refundTime !== undefined) {
    order.refundTime = formatDate(updates.refundTime)
  }
  if (updates.cancelTime !== undefined) {
    order.cancelTime = formatDate(updates.cancelTime)
  }

  order.updateTime = formatDate(new Date())
  orders.set(orderId, order)
  return order
}

function validateBeds(configData, beds) {
  for (const orderBed of beds || []) {
    const bedType = (configData.bedTypes || []).find(item => item.id === orderBed.id)

    if (!bedType) {
      return {
        ok: false,
        message: `床位类型 ${orderBed.name} 不存在`
      }
    }

    if (!bedType.available) {
      return {
        ok: false,
        message: `${bedType.name} 暂不可用`
      }
    }

    if ((bedType.stock || 0) < orderBed.quantity) {
      return {
        ok: false,
        message: `${bedType.name} 库存不足，当前库存：${bedType.stock || 0}`
      }
    }
  }

  return { ok: true }
}

function applyInventoryDelta(configData, beds, delta) {
  for (const orderBed of beds || []) {
    const bedType = (configData.bedTypes || []).find(item => item.id === orderBed.id)
    if (!bedType) {
      throw new Error(`Missing bed type: ${orderBed.id}`)
    }

    const nextStock = (bedType.stock || 0) + delta * orderBed.quantity
    if (nextStock < 0) {
      throw new Error(`${bedType.name} inventory would become negative`)
    }

    bedType.stock = nextStock
  }
}

function broadcastInventoryUpdate(configData) {
  const broadcast = getBroadcastFn()
  if (!broadcast) {
    return
  }

  broadcast({
    type: 'bed_types_update',
    data: configData.bedTypes || []
  })
}

function broadcastOrderEvent(type, orderId) {
  const broadcast = getBroadcastFn()
  if (!broadcast) {
    return
  }

  broadcast({
    type,
    orderId
  })
}

async function settlePaidOrder({ orderId, transactionId }) {
  // 如果库存服务可用，使用新的库存管理逻辑
  if (inventoryService) {
    try {
      const order = await getOrderById(orderId)
      if (!order) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      if (order.status !== 'unpaid') {
        return {
          code: 400,
          message: '订单状态不允许支付',
          data: order
        }
      }

      // 使用库存服务验证库存
      const validation = await inventoryService.validateInventory(order.beds)
      if (!validation.ok) {
        return {
          code: 400,
          message: validation.message
        }
      }

      // 扣减库存（原子操作）
      const deductResult = await inventoryService.deductOrderInventory(order.beds)
      if (!deductResult.success) {
        return {
          code: 500,
          message: `库存扣减失败: ${deductResult.message}`
        }
      }

      // 更新订单状态
      const updatedOrder = await updateStoredOrderStatus(orderId, {
        status: 'paid',
        payTime: new Date(),
        transactionId: transactionId || order.transactionId || `MOCK_TXN_${Date.now()}`
      })

      // 广播库存更新
      const bedTypes = await inventoryService.getBedTypes()
      broadcastInventoryUpdate({ bedTypes })
      broadcastOrderEvent('order_paid', orderId)

      return {
        code: 200,
        message: '支付成功',
        data: updatedOrder
      }
    } catch (error) {
      console.error('支付处理失败:', error)
      return {
        code: 500,
        message: `支付处理失败: ${error.message}`
      }
    }
  } else {
    // 回退到原来的文件锁逻辑
    return withRuntimeConfigLock(async () => {
      const order = await getOrderById(orderId)
      if (!order) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      if (order.status !== 'unpaid') {
        return {
          code: 400,
          message: '订单状态不允许支付',
          data: order
        }
      }

      const configData = await loadRuntimeConfig()
      const snapshot = cloneRuntimeConfig(configData)
      const validation = validateBeds(configData, order.beds)
      if (!validation.ok) {
        return {
          code: 400,
          message: validation.message
        }
      }

      applyInventoryDelta(configData, order.beds, -1)

      const saved = await saveRuntimeConfig(configData)
      if (!saved) {
        return {
          code: 500,
          message: '更新库存失败'
        }
      }

      try {
        const updatedOrder = await updateStoredOrderStatus(orderId, {
          status: 'paid',
          payTime: new Date(),
          transactionId: transactionId || order.transactionId || `MOCK_TXN_${Date.now()}`
        })

        broadcastInventoryUpdate(configData)
        broadcastOrderEvent('order_paid', orderId)

        return {
          code: 200,
          message: '支付成功',
          data: updatedOrder
        }
      } catch (error) {
        await saveRuntimeConfig(snapshot)
        throw error
      }
    })
  }
}

async function restoreOrderInventory(order) {
  // 如果库存服务可用，使用新的库存管理逻辑
  if (inventoryService) {
    try {
      // 恢复库存（原子操作）
      const restoreResult = await inventoryService.restoreOrderInventory(order.beds)
      if (!restoreResult.success) {
        console.error('库存恢复失败:', restoreResult.message)
        return false
      }

      // 广播库存更新
      const bedTypes = await inventoryService.getBedTypes()
      broadcastInventoryUpdate({ bedTypes })

      return true
    } catch (error) {
      console.error('库存恢复失败:', error)
      return false
    }
  } else {
    // 回退到原来的文件锁逻辑
    return withRuntimeConfigLock(async () => {
      const configData = await loadRuntimeConfig()
      applyInventoryDelta(configData, order.beds, 1)

      const saved = await saveRuntimeConfig(configData)
      if (!saved) {
        return false
      }

      broadcastInventoryUpdate(configData)
      return true
    })
  }
}

async function createOrder(req, res) {
  try {
    const { beds, totalDeposit, openid } = req.body

    if (!Array.isArray(beds) || beds.length === 0) {
      return res.json({
        code: 400,
        message: '订单信息不能为空'
      })
    }

    // 库存验证
    let validation
    if (inventoryService) {
      validation = await inventoryService.validateInventory(beds)
    } else {
      const configData = await loadRuntimeConfig()
      validation = validateBeds(configData, beds)
    }
    if (!validation.ok) {
      return res.json({
        code: 400,
        message: validation.message
      })
    }

    const order = {
      orderId: generateOrderId(),
      beds,
      totalDeposit,
      openid: openid || `openid_${Date.now()}`,
      status: 'unpaid',
      createTime: new Date(),
      updateTime: new Date()
    }

    if (config.database.type === 'mysql' && orderDao) {
      await orderDao.createOrder(order)
    } else {
      order.createTime = formatDate(order.createTime)
      order.updateTime = formatDate(order.updateTime)
      orders.set(order.orderId, order)
    }

    res.json({
      code: 200,
      message: '订单创建成功',
      data: {
        orderId: order.orderId,
        order
      }
    })
  } catch (error) {
    console.error('创建订单失败:', error)
    res.json({
      code: 500,
      message: '创建订单失败'
    })
  }
}

async function payOrder(req, res) {
  try {
    const { orderId } = req.body
    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      })
    }

    const result = await settlePaidOrder({
      orderId,
      transactionId: req.body.transactionId
    })

    res.json(result)
  } catch (error) {
    console.error('支付失败:', error)
    res.json({
      code: 500,
      message: '支付失败'
    })
  }
}

async function queryOrder(req, res) {
  try {
    const { orderId } = req.params
    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      })
    }

    const order = await getOrderById(orderId)
    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      })
    }

    res.json({
      code: 200,
      message: '查询成功',
      data: order
    })
  } catch (error) {
    console.error('查询订单失败:', error)
    res.json({
      code: 500,
      message: '查询订单失败'
    })
  }
}

async function getOrderList(req, res) {
  try {
    const openid = resolveRequestOpenid(req)
    let orderList

    if (config.database.type === 'mysql' && orderDao) {
      orderList = openid
        ? await orderDao.getOrdersByOpenid(openid)
        : await orderDao.getAllOrders()
    } else {
      orderList = Array.from(orders.values()).sort((a, b) =>
        new Date(b.createTime) - new Date(a.createTime)
      )

      if (openid) {
        orderList = orderList.filter(order => order.openid === openid)
      }
    }

    res.json({
      code: 200,
      message: '查询成功',
      data: orderList
    })
  } catch (error) {
    console.error('获取订单列表失败:', error)
    res.json({
      code: 500,
      message: '获取订单列表失败'
    })
  }
}

async function refundOrder(req, res) {
  try {
    const { orderId } = req.body
    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      })
    }

    const order = await getOrderById(orderId)
    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      })
    }

    if (!isOrderOwnedByRequester(order, req)) {
      return res.json({
        code: 403,
        message: '无权操作此订单'
      })
    }

    if (order.status !== 'paid') {
      return res.json({
        code: 400,
        message: '订单未支付，无法退款'
      })
    }

    // 调用微信退款接口（非模拟模式）
    const isMockPayment = !config.bed.payment.wechat.mchid ||
      config.bed.payment.wechat.mchid === 'your_mchid' ||
      !config.bed.payment.wechat.apiKey ||
      config.bed.payment.wechat.apiKey === 'your_api_key'

    if (!isMockPayment) {
      wechatPay.setConfig({
        appid: config.bed.payment.wechat.appid,
        mchid: config.bed.payment.wechat.mchid,
        apiKey: config.bed.payment.wechat.apiKey,
        notifyUrl: config.bed.payment.wechat.notifyUrl
      })
      const refundResult = await wechatPay.refund({
        orderId,
        totalFee: order.totalDeposit,
        refundFee: order.totalDeposit,
        refundDesc: '押金退还'
      })
      if (refundResult.code !== 200) {
        console.error('微信退款失败:', refundResult)
        return res.json({
          code: 500,
          message: `微信退款失败: ${refundResult.message}`
        })
      }
    }

    const restored = await restoreOrderInventory(order)
    if (!restored) {
      return res.json({
        code: 500,
        message: '恢复库存失败'
      })
    }

    const updatedOrder = await updateStoredOrderStatus(orderId, {
      status: 'refunded',
      refundTime: new Date()
    })

    broadcastOrderEvent('order_refunded', orderId)

    res.json({
      code: 200,
      message: '押金退还成功',
      data: updatedOrder
    })
  } catch (error) {
    console.error('退还押金失败:', error)
    res.json({
      code: 500,
      message: '退还押金失败'
    })
  }
}

async function deleteOrder(req, res) {
  try {
    const { orderId } = req.body
    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      })
    }

    let deleted = false
    if (config.database.type === 'mysql' && orderDao) {
      deleted = await orderDao.deleteOrder(orderId)
    } else {
      deleted = orders.delete(orderId)
    }

    if (!deleted) {
      return res.json({
        code: 404,
        message: '订单不存在'
      })
    }

    broadcastOrderEvent('order_deleted', orderId)

    res.json({
      code: 200,
      message: '订单删除成功'
    })
  } catch (error) {
    console.error('删除订单失败:', error)
    res.json({
      code: 500,
      message: '删除订单失败'
    })
  }
}

async function cancelOrder(req, res) {
  try {
    const { orderId } = req.body
    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      })
    }

    const order = await getOrderById(orderId)
    if (!order) {
      return res.json({
        code: 404,
        message: '订单不存在'
      })
    }

    if (!isOrderOwnedByRequester(order, req)) {
      return res.json({
        code: 403,
        message: '无权操作此订单'
      })
    }

    if (order.status !== 'unpaid') {
      return res.json({
        code: 400,
        message: '只有待支付订单可以取消'
      })
    }

    const updatedOrder = await updateStoredOrderStatus(orderId, {
      status: 'cancelled',
      cancelTime: new Date()
    })

    broadcastOrderEvent('order_cancelled', orderId)

    res.json({
      code: 200,
      message: '订单取消成功',
      data: updatedOrder
    })
  } catch (error) {
    console.error('取消订单失败:', error)
    res.json({
      code: 500,
      message: '取消订单失败'
    })
  }
}

async function mockPayNotify(req, res) {
  try {
    const { orderId } = req.body
    if (!orderId) {
      return res.json({
        code: 400,
        message: '订单号不能为空'
      })
    }

    setTimeout(async () => {
      try {
        await settlePaidOrder({
          orderId,
          transactionId: `MOCK_TXN_${Date.now()}`
        })
      } catch (error) {
        console.error('模拟支付回调失败:', error)
      }
    }, 3000)

    res.json({
      code: 200,
      message: '模拟支付成功，3 秒后更新订单状态'
    })
  } catch (error) {
    console.error('模拟支付失败:', error)
    res.json({
      code: 500,
      message: '模拟支付失败'
    })
  }
}

module.exports = {
  setBroadcast,
  createOrder,
  payOrder,
  queryOrder,
  getOrderList,
  refundOrder,
  deleteOrder,
  cancelOrder,
  mockPayNotify,
  getOrderById,
  getOrderStats,
  settlePaidOrder
}

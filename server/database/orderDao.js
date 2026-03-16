// 订单数据访问层
const db = require('./mysql');

/**
 * 格式化日期为 MySQL DATETIME 格式
 */
function formatDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取下一个订单ID计数器值
 */
async function getNextOrderIdCounter() {
  const result = await db.query('UPDATE order_counter SET counter_value = counter_value + 1 WHERE id = 1 RETURNING counter_value');
  // MySQL 不支持 RETURNING，需要用另一种方式
  await db.query('UPDATE order_counter SET counter_value = counter_value + 1 WHERE id = 1');
  const counter = await db.query('SELECT counter_value FROM order_counter WHERE id = 1');
  return counter[0].counter_value;
}

/**
 * 创建订单
 */
async function createOrder(order) {
  return db.transaction(async (connection) => {
    // 插入订单主表
    const orderSql = `
      INSERT INTO orders (
        order_id, openid, total_deposit, status,
        transaction_id, create_time, pay_time,
        refund_time, cancel_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const orderParams = [
      order.orderId,
      order.openid || null,
      order.totalDeposit,
      order.status || 'unpaid',
      order.transactionId || null,
      formatDate(order.createTime),
      order.payTime ? formatDate(order.payTime) : null,
      order.refundTime ? formatDate(order.refundTime) : null,
      order.cancelTime ? formatDate(order.cancelTime) : null,
      formatDate(order.updateTime)
    ];

    await new Promise((resolve, reject) => {
      connection.query(orderSql, orderParams, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // 插入订单床位详情
    if (order.beds && order.beds.length > 0) {
      const bedSql = `
        INSERT INTO order_beds (order_id, bed_id, bed_name, quantity, price, deposit, create_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      for (const bed of order.beds) {
        const bedParams = [
          order.orderId,
          bed.id,
          bed.name,
          bed.quantity,
          bed.price,
          bed.deposit,
          formatDate(new Date())
        ];

        await new Promise((resolve, reject) => {
          connection.query(bedSql, bedParams, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }
    }

    return order;
  });
}

/**
 * 根据订单号查询订单
 */
async function getOrderByOrderId(orderId) {
  // 查询订单主表
  const orderResult = await db.query(
    'SELECT * FROM orders WHERE order_id = ?',
    [orderId]
  );

  if (orderResult.length === 0) {
    return null;
  }

  const order = orderResult[0];

  // 查询订单床位详情
  const bedsResult = await db.query(
    'SELECT * FROM order_beds WHERE order_id = ?',
    [orderId]
  );

  // 转换为前端格式
  return {
    orderId: order.order_id,
    openid: order.openid,
    totalDeposit: parseFloat(order.total_deposit),
    status: order.status,
    transactionId: order.transaction_id,
    createTime: order.create_time,
    payTime: order.pay_time,
    refundTime: order.refund_time,
    cancelTime: order.cancel_time,
    updateTime: order.update_time,
    beds: bedsResult.map(bed => ({
      id: parseInt(bed.bed_id),  // 转换为数字类型
      name: bed.bed_name,
      quantity: bed.quantity,
      price: parseFloat(bed.price),
      deposit: parseFloat(bed.deposit)
    }))
  };
}

/**
 * 获取所有订单
 */
async function getAllOrders() {
  const ordersResult = await db.query(
    'SELECT * FROM orders ORDER BY create_time DESC'
  );

  const orders = [];
  for (const orderRow of ordersResult) {
    const bedsResult = await db.query(
      'SELECT * FROM order_beds WHERE order_id = ?',
      [orderRow.order_id]
    );

    orders.push({
      orderId: orderRow.order_id,
      openid: orderRow.openid,
      totalDeposit: parseFloat(orderRow.total_deposit),
      status: orderRow.status,
      transactionId: orderRow.transaction_id,
      createTime: orderRow.create_time,
      payTime: orderRow.pay_time,
      refundTime: orderRow.refund_time,
      cancelTime: orderRow.cancel_time,
      updateTime: orderRow.update_time,
      beds: bedsResult.map(bed => ({
        id: parseInt(bed.bed_id),  // 转换为数字类型
        name: bed.bed_name,
        quantity: bed.quantity,
        price: parseFloat(bed.price),
        deposit: parseFloat(bed.deposit)
      }))
    });
  }

  return orders;
}

/**
 * 根据openid查询订单
 */
async function getOrdersByOpenid(openid) {
  const ordersResult = await db.query(
    'SELECT * FROM orders WHERE openid = ? ORDER BY create_time DESC',
    [openid]
  );

  const orders = [];
  for (const orderRow of ordersResult) {
    const bedsResult = await db.query(
      'SELECT * FROM order_beds WHERE order_id = ?',
      [orderRow.order_id]
    );

    orders.push({
      orderId: orderRow.order_id,
      openid: orderRow.openid,
      totalDeposit: parseFloat(orderRow.total_deposit),
      status: orderRow.status,
      transactionId: orderRow.transaction_id,
      createTime: orderRow.create_time,
      payTime: orderRow.pay_time,
      refundTime: orderRow.refund_time,
      cancelTime: orderRow.cancel_time,
      updateTime: orderRow.update_time,
      beds: bedsResult.map(bed => ({
        id: parseInt(bed.bed_id),  // 转换为数字类型
        name: bed.bed_name,
        quantity: bed.quantity,
        price: parseFloat(bed.price),
        deposit: parseFloat(bed.deposit)
      }))
    });
  }

  return orders;
}

/**
 * 更新订单状态
 */
async function updateOrderStatus(orderId, updates) {
  const fields = [];
  const values = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.transactionId !== undefined) {
    fields.push('transaction_id = ?');
    values.push(updates.transactionId);
  }
  if (updates.payTime !== undefined) {
    fields.push('pay_time = ?');
    values.push(formatDate(updates.payTime));
  }
  if (updates.refundTime !== undefined) {
    fields.push('refund_time = ?');
    values.push(formatDate(updates.refundTime));
  }
  if (updates.cancelTime !== undefined) {
    fields.push('cancel_time = ?');
    values.push(formatDate(updates.cancelTime));
  }

  if (fields.length === 0) {
    return null;
  }

  fields.push('update_time = ?');
  values.push(formatDate(new Date()));
  values.push(orderId);

  const sql = `UPDATE orders SET ${fields.join(', ')} WHERE order_id = ?`;
  await db.query(sql, values);

  return getOrderByOrderId(orderId);
}

/**
 * 删除订单
 */
async function deleteOrder(orderId) {
  // 删除订单床位详情（外键会自动级联删除）
  // 删除订单主表
  const result = await db.query('DELETE FROM orders WHERE order_id = ?', [orderId]);
  return result.affectedRows > 0;
}

/**
 * 获取订单统计
 */
async function getOrderStats() {
  const result = await db.query(`
    SELECT
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'paid' THEN total_deposit ELSE 0 END) as total_deposit,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_orders,
      SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_orders,
      SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded_orders
    FROM orders
  `);

  const stats = result[0];
  return {
    totalOrders: parseInt(stats.total_orders),
    totalDeposit: parseFloat(stats.total_deposit) || 0,
    paidOrders: parseInt(stats.paid_orders),
    unpaidOrders: parseInt(stats.unpaid_orders),
    refundedOrders: parseInt(stats.refunded_orders)
  };
}

/**
 * 初始化订单数据（从内存迁移到数据库）
 */
async function migrateOrdersFromMemory(memoryOrders) {
  if (!memoryOrders || memoryOrders.length === 0) {
    console.log('没有需要迁移的订单数据');
    return 0;
  }

  console.log(`开始迁移 ${memoryOrders.length} 条订单数据...`);

  let successCount = 0;
  for (const order of memoryOrders) {
    try {
      await createOrder(order);
      successCount++;
      console.log(`✅ 迁移订单: ${order.orderId}`);
    } catch (error) {
      console.error(`❌ 迁移订单失败 ${order.orderId}:`, error.message);
    }
  }

  console.log(`订单迁移完成: ${successCount}/${memoryOrders.length}`);
  return successCount;
}

module.exports = {
  formatDate,
  getNextOrderIdCounter,
  createOrder,
  getOrderByOrderId,
  getAllOrders,
  getOrdersByOpenid,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
  migrateOrdersFromMemory
};

# MySQL 数据库集成 - 修改订单接口说明

## 问题说明

当前 `server.js` 中的订单接口都使用内存存储（`orders` Map），没有使用数据库。

## 快速修复方案

由于 `server.js` 文件较大，手动修改容易出错，请按以下步骤操作：

### 步骤1：备份 server.js

```bash
cd e:\SafeSleepRent\server
copy server.js server.js.backup
```

### 步骤2：修改订单接口 - 使用以下代码替换

找到所有订单相关的接口，将它们改为使用 `orderRoutes`：

#### 1. 替换创建订单接口（第139-214行）

将：
```javascript
app.post('/api/order/create', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 创建订单
app.post('/api/order/create', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.createOrder(req, res);
});
```

#### 2. 替换支付订单接口（第217-312行）

将：
```javascript
app.post('/api/order/pay', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 支付订单
app.post('/api/order/pay', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.payOrder(req, res);
});
```

#### 3. 替换查询订单接口（第537-568行）

将：
```javascript
app.get('/api/order/query', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 查询订单
app.get('/api/order/query/:orderId', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.queryOrder(req, res);
});
```

#### 4. 替换获取订单列表接口（第571-604行）

将：
```javascript
app.get('/api/order/list', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 获取订单列表
app.get('/api/order/list', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.getOrderList(req, res);
});
```

#### 5. 替换退还押金接口（第607-685行）

将：
```javascript
app.post('/api/order/refund', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 退还押金
app.post('/api/order/refund', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.refundOrder(req, res);
});
```

#### 6. 替换删除订单接口（第688-727行）

将：
```javascript
app.delete('/api/order/delete', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 删除订单
app.delete('/api/order/delete', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.deleteOrder(req, res);
});
```

#### 7. 替换取消订单接口（第730-783行）

将：
```javascript
app.post('/api/order/cancel', (req, res) => {
  // ... 大量代码
});
```

替换为：
```javascript
// 取消订单
app.post('/api/order/cancel', (req, res) => {
  req.broadcastToClients = broadcastToClients;
  orderRoutes.cancelOrder(req, res);
});
```

### 步骤3：修改统计接口（第786-816行）

找到 `app.get('/api/stats', ...)` 接口，将其中统计逻辑改为使用数据库：

```javascript
// 获取系统统计信息
app.get('/api/stats', async (req, res) => {
  try {
    let stats;

    if (config.database.type === 'mysql' && orderDao) {
      stats = await orderDao.getOrderStats();
    } else {
      // 内存模式
      let paidCount = 0;
      let unpaidCount = 0;
      let refundedCount = 0;
      let totalDeposit = 0;

      orders.forEach((order) => {
        if (order.status === 'paid') {
          paidCount++;
          totalDeposit += order.totalDeposit;
        } else if (order.status === 'unpaid') {
          unpaidCount++;
        } else if (order.status === 'refunded') {
          refundedCount++;
        }
      });

      stats = {
        totalOrders: orders.size,
        paidOrders: paidCount,
        unpaidOrders: unpaidCount,
        refundedOrders: refundedCount,
        totalDeposit: totalDeposit
      };
    }

    res.json({
      code: 200,
      message: '查询成功',
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.json({
      code: 500,
      message: '获取统计信息失败'
    });
  }
});
```

### 步骤4：安装依赖并启动

```bash
cd e:\SafeSleepRent\server
npm install mysql
npm start
```

## 验证是否成功

启动后看到以下日志说明成功：

```
订单路由: 使用 MySQL 数据库模式
正在连接 MySQL 数据库...
✅ MySQL 数据库连接成功
✅ 已切换到 MySQL 数据库模式
```

如果看到：

```
订单路由: 使用内存存储模式
```

说明数据库连接失败，请检查 MySQL 配置。

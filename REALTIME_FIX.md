# 实时刷新功能修复说明

## 问题描述

前端网页（后台管理系统）和小程序没有实时刷新库存和订单数量。

## 问题分析

### 原因
1. **前端管理网页** 缺少 WebSocket 实时监听机制
   - 没有建立 WebSocket 连接
   - 库存调整、订单变化后需要手动刷新页面
   - 数据概览页面无法实时更新

2. **小程序端** 实现已完善 ✅
   - 已有 WebSocket 连接和监听机制
   - 能接收并处理各种更新消息

3. **服务器端** 广播机制已完善 ✅
   - 有 WebSocket 服务器和广播机制
   - 订单支付/退款时会广播库存变化

## 解决方案

### 1. 为前端管理网页添加 WebSocket 支持

#### 文件：`admin/js/api.js`

添加了完整的 WebSocket 客户端实现：

```javascript
// WebSocket 连接管理
let ws = null;
let wsReconnectTimer = null;
let wsHeartbeatTimer = null;

// 连接WebSocket
function connectWebSocket() { ... }

// 心跳保活机制（30秒一次）
function startHeartbeat() { ... }

// 处理WebSocket消息
function handleWebSocketMessage(message) { ... }

// 根据消息类型刷新对应页面数据
- refreshBedTypesData()   // 刷新床位和库存
- refreshSettingsData()   // 刷新系统设置
- refreshOrderData()      // 刷新订单列表
- refreshDashboardData()  // 刷新数据概览
```

#### 支持的消息类型：
- `connection_established` - 连接建立成功
- `bed_types_update` - 床位类型更新
- `settings_update` - 系统设置更新
- `order_paid` - 订单支付成功
- `order_refunded` - 订单退款成功
- `data_update` - 通用数据更新

#### 文件：`admin/index.html`

添加了 WebSocket 连接状态显示：

```html
<div class="user-info">
  <span id="ws-status" class="ws-status ws-disconnected">🔴 未连接</span>
  <span>管理员</span>
</div>
```

#### 文件：`admin/css/style.css`

添加了连接状态样式：

```css
.ws-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  background: #fee;
  color: #c33;
  font-weight: 500;
}

.ws-status.ws-connected {
  background: #e8f5e9;
  color: #4caf50;
}
```

### 2. 确保库存调整通知小程序

#### 文件：`admin/js/inventory.js`

库存调整后添加通知：

```javascript
async function handleUpdateStock(event, id) {
  // ... 更新库存逻辑 ...

  // 通知小程序刷新数据
  await notifyMiniprogramRefresh('bed_types_update', {
    action: 'stock_update',
    data: { id, stock: newStock, reason, note }
  });
}
```

### 3. 确保订单操作通知小程序

#### 文件：`admin/js/orders.js`

退还押金后添加通知：

```javascript
async function handleRefund(orderId) {
  // ... 退还逻辑 ...

  // 通知小程序刷新数据
  await notifyMiniprogramRefresh('order_refunded', { orderId });
}
```

删除订单后添加通知：

```javascript
async function handleDeleteOrder(orderId) {
  // ... 删除逻辑 ...

  // 通知小程序刷新数据
  await notifyMiniprogramRefresh('data_update', { type: 'order_delete', orderId });
}
```

## 功能特性

### 前端管理网页实时更新

1. **自动连接**
   - 页面加载时自动建立 WebSocket 连接
   - 连接失败时 5 秒后自动重连

2. **心跳保活**
   - 每 30 秒发送一次 ping 消息
   - 保持连接稳定

3. **智能刷新**
   - 只刷新当前可见的页面数据
   - 减少不必要的网络请求

4. **连接状态显示**
   - 🟢 已连接 - 绿色
   - 🔴 未连接 - 红色
   - 实时显示连接状态

### 支持的实时更新场景

| 场景 | 前端管理网页 | 小程序 |
|------|-------------|--------|
| 添加床位类型 | ✅ | ✅ |
| 编辑床位类型 | ✅ | ✅ |
| 删除床位类型 | ✅ | ✅ |
| 调整库存 | ✅ | ✅ |
| 修改系统设置 | ✅ | ✅ |
| 订单支付 | ✅ | ✅ |
| 订单退款 | ✅ | ✅ |
| 订单取消 | ✅ | ✅ |

## 测试步骤

### 1. 测试前端实时刷新

1. 启动后端服务器：`start-backend.bat`
2. 启动前端管理网页：`start-frontend.bat`
3. 打开浏览器访问 `http://localhost:8080`
4. 检查右上角是否显示 "🟢 已连接"

### 2. 测试库存实时更新

1. 在前端打开"库存管理"页面
2. 调整某个床位的库存数量
3. 观察页面是否立即刷新（无需手动刷新）
4. 同时打开小程序，观察库存是否同步更新

### 3. 测试订单实时更新

1. 在前端打开"数据概览"页面
2. 在小程序中下单并支付
3. 观察前端"数据概览"的订单数量是否自动更新
4. 切换到"订单管理"页面，观察新订单是否出现

### 4. 测试连接状态

1. 关闭后端服务器
2. 观察前端状态变为 "🔴 未连接"
3. 重启后端服务器
4. 观察前端自动重连，状态变为 "🟢 已连接"

## 架构说明

### 实时通信流程

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ 小程序下单   │ ───> │  后端服务器   │ ───> │  WebSocket   │
│            │      │  扣减库存    │      │  广播消息    │
└─────────────┘      └──────────────┘      └──────┬───────┘
                                                 │
                      ┌──────────────────────────┼──────────────────────────┐
                      │                          │                          │
                      ▼                          ▼                          ▼
            ┌─────────────┐           ┌──────────────┐           ┌──────────────┐
            │ 小程序首页   │           │ 小程序订单页  │           │ 前端管理网页   │
            │ 刷新库存     │           │ 刷新订单      │           │ 刷新数据      │
            └─────────────┘           └──────────────┘           └──────────────┘
```

### 数据流向

```
用户操作
   ↓
前端管理网页
   ↓ API调用
后端服务器（处理逻辑 + 保存数据）
   ↓ WebSocket广播
所有连接的客户端（小程序 + 前端管理网页）
   ↓
自动刷新页面数据
```

## 注意事项

1. **WebSocket 地址配置**
   - 开发环境：`ws://localhost:3000/ws`
   - 生产环境需要修改为 `wss://your-domain.com/ws`

2. **防火墙设置**
   - 确保 WebSocket 端口（3000）未被防火墙阻止

3. **多客户端支持**
   - 支持多个小程序客户端同时连接
   - 所有客户端会同时收到更新通知

4. **性能优化**
   - 只刷新当前可见的页面
   - 使用心跳保活机制
   - 断线自动重连

## 相关文件

### 前端管理网页
- `admin/js/api.js` - WebSocket 客户端实现
- `admin/js/inventory.js` - 库存管理
- `admin/js/orders.js` - 订单管理
- `admin/js/bedTypes.js` - 床位管理
- `admin/index.html` - 页面结构
- `admin/css/style.css` - 样式文件

### 服务器端
- `server/server.js` - WebSocket 服务器
- `server/routes/bedTypes.js` - 库存管理路由

### 小程序端
- `miniprogram/pages/index/index.js` - 首页 WebSocket 监听
- `miniprogram/pages/order/order.js` - 订单页 WebSocket 监听

## 总结

通过为前端管理网页添加 WebSocket 实时监听机制，实现了前后端数据同步：

1. ✅ 库存调整后自动刷新
2. ✅ 订单变化后自动刷新
3. ✅ 系统设置更新后自动刷新
4. ✅ 连接状态实时显示
5. ✅ 断线自动重连
6. ✅ 多端数据同步

现在前端管理网页和小程序都能实时同步数据，无需手动刷新页面。

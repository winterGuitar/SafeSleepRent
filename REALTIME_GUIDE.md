# 实时数据同步使用指南

## 功能概述

后台管理系统和微信小程序之间已实现实时数据同步功能。当后台修改数据时，会自动通知所有连接的小程序客户端刷新数据。

## 技术实现

### 1. WebSocket 实时通信

后端服务器使用 WebSocket 协议与小程序建立长连接，实现双向通信。

**WebSocket 地址**: `ws://localhost:3000/ws?openid={用户openid}`

### 2. 通知机制

后台数据变更时，通过以下流程通知小程序：

```
后台管理网页 → 后端API → WebSocket广播 → 微信小程序接收 → 自动刷新数据
```

## 支持的实时更新场景

### 1. 床位类型变更
- 添加新床位类型
- 编辑床位信息（价格、押金、库存等）
- 删除床位类型
- 修改床位可用状态

### 2. 系统设置变更
- 押金规则调整
- 营业时间修改
- 库存管理配置
- 租赁政策更新

### 3. 库存变动
- 库存数量调整
- 库存预警触发

## 使用方法

### 后台操作流程

#### 添加床位类型

1. 登录后台管理系统
2. 进入"床位管理"页面
3. 点击"+ 添加床位类型"
4. 填写床位信息并保存
5. **系统自动通知所有小程序客户端刷新**

#### 编辑床位信息

1. 在"床位管理"页面找到要编辑的床位
2. 点击"编辑"按钮
3. 修改床位信息并保存
4. **系统自动通知所有小程序客户端刷新**

#### 删除床位类型

1. 在"床位管理"页面找到要删除的床位
2. 点击"删除"按钮
3. 确认删除操作
4. **系统自动通知所有小程序客户端刷新**

#### 修改系统设置

1. 进入"系统设置"页面
2. 修改押金规则、营业时间等配置
3. 点击"保存设置"
4. **系统自动通知所有小程序客户端刷新**

### 小程序自动刷新

小程序会自动监听来自服务器的更新通知：

```javascript
// pages/index/index.js

// 监听床位类型更新
case 'bed_types_update':
  this.handleBedTypesUpdate(message)
  break

// 监听设置更新
case 'settings_update':
  this.handleSettingsUpdate(message)
  break
```

当收到更新通知时：
1. 显示提示："床位数据已更新" 或 "系统设置已更新"
2. 自动重新加载床位类型数据
3. 更新页面显示

## 消息格式

### 服务器发送给小程序的消息

```json
{
  "type": "bed_types_update",
  "action": "add|update|delete",
  "data": {
    "id": 1,
    "name": "标准折叠床",
    "price": 30,
    "deposit": 300,
    ...
  },
  "timestamp": 1678888888888
}
```

**消息类型**：
- `bed_types_update` - 床位类型更新
- `settings_update` - 系统设置更新
- `data_update` - 通用数据更新

**操作类型**：
- `add` - 添加
- `update` - 更新
- `delete` - 删除

### 小程序心跳消息

```json
{
  "type": "ping"
}
```

服务器响应：
```json
{
  "type": "pong",
  "timestamp": 1678888888888
}
```

## API接口

### 通知小程序刷新

**接口**: `POST /api/notify/refresh`

**请求参数**:
```json
{
  "type": "bed_types_update",
  "data": {
    "action": "add",
    "data": { ... }
  }
}
```

**响应**:
```json
{
  "code": 200,
  "message": "刷新通知发送成功",
  "data": {
    "clientCount": 5
  }
}
```

## 心跳保活机制

为了保持连接稳定，小程序每30秒发送一次心跳消息：

```javascript
setInterval(() => {
  socketTask.send({
    data: JSON.stringify({ type: 'ping' })
  })
}, 30000)
```

如果连接断开，小程序会自动尝试重新连接。

## 错误处理

### 连接失败

```javascript
socketTask.onError((error) => {
  console.error('WebSocket错误:', error)
  // 可以在这里添加重连逻辑
})
```

### 连接关闭

```javascript
socketTask.onClose(() => {
  console.log('WebSocket连接已关闭')
  // 可以在这里添加重连逻辑
})
```

## 最佳实践

### 1. 用户体验优化

- 小程序收到更新通知时，先显示提示信息
- 保留用户当前选择的数量
- 平滑更新界面，避免闪烁

### 2. 性能优化

- 只在必要时才刷新数据
- 使用节流/防抖避免频繁刷新
- 数据缓存减少网络请求

### 3. 安全考虑

- 使用 openid 标识客户端
- 验证消息来源和格式
- 敏感操作需要二次确认

## 测试方法

### 1. 测试实时同步

1. 打开微信开发者工具
2. 在小程序中加载床位数据
3. 在后台管理网页修改床位信息
4. 观察小程序是否自动刷新

### 2. 测试连接状态

在浏览器控制台查看 WebSocket 连接状态：

```javascript
// 小程序控制台
console.log('WebSocket状态:', socketTask.readyState)
// 0: 正在连接
// 1: 已连接
// 2: 正在关闭
// 3: 已关闭
```

### 3. 测试多客户端同步

1. 打开多个小程序客户端（模拟器 + 真机）
2. 在后台修改数据
3. 检查所有客户端是否都收到通知并刷新

## 故障排查

### 问题1: 小程序收不到通知

**检查项**:
1. 后台服务器是否正常启动
2. WebSocket 地址是否正确
3. 网络连接是否正常
4. 防火墙是否阻止 WebSocket 连接

**解决方案**:
- 检查服务器日志
- 确认 WebSocket 地址格式
- 测试网络连接
- 配置防火墙规则

### 问题2: 后台修改后小程序未刷新

**检查项**:
1. 通知接口是否成功调用
2. WebSocket 连接是否正常
3. 小程序是否正确处理消息

**解决方案**:
- 查看后端日志确认通知是否发送
- 查看小程序控制台确认消息是否接收
- 检查消息处理逻辑

### 问题3: 频繁断线重连

**检查项**:
1. 网络稳定性
2. 心跳间隔设置
3. 服务器负载

**解决方案**:
- 增加心跳间隔
- 添加重连指数退避
- 优化服务器性能

## 生产环境部署

### 1. 域名配置

在微信公众平台配置 WebSocket 域名：

- **域名**: `wss://your-domain.com`
- **协议**: 必须使用 wss（加密 WebSocket）

### 2. Nginx 配置

```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

### 3. 负载均衡

多台服务器部署时，使用 Redis 存储连接状态：

```javascript
// 使用 Redis 管理连接
const redis = require('redis');
const client = redis.createClient();

// 存储连接
await client.hset('ws_connections', openid, serverId);

// 获取连接所在的服务器
const serverId = await client.hget('ws_connections', openid);
```

## 总结

实时数据同步功能确保了后台管理和小程序端数据的一致性，提升了用户体验。通过 WebSocket 长连接和自动刷新机制，用户可以即时看到最新的床位信息。

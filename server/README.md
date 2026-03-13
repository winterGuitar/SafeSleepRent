# 医院租床小程序 - 后端服务器

## 功能说明

### 已完成的功能

#### 1. 订单管理
- ✅ 创建订单 (`POST /api/order/create`)
- ✅ 查询订单 (`GET /api/order/query`)
- ✅ 获取订单列表 (`GET /api/order/list`)
- ✅ 删除订单 (`DELETE /api/order/delete`)

#### 2. 支付功能
- ✅ 获取微信支付参数 (`POST /api/payment/getParams`)
- ✅ 微信支付回调 (`POST /api/payment/notify`)
- ✅ 支付签名生成 (MD5算法)

#### 3. 押金管理
- ✅ 退还押金 (`POST /api/order/refund`)
- ✅ 押金金额计算

#### 4. 数据统计
- ✅ 系统统计信息 (`GET /api/stats`)
  - 总订单数
  - 已支付订单数
  - 未支付订单数
  - 已退还订单数
  - 总押金金额

#### 5. 基础功能
- ✅ 健康检查 (`GET /api/health`)
- ✅ CORS跨域支持
- ✅ 数据验证
- ✅ 错误处理

## API 接口文档

### 1. 健康检查
```
GET /api/health
```

**响应:**
```json
{
  "code": 200,
  "status": "ok",
  "message": "服务器运行正常",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 创建订单
```
POST /api/order/create
Content-Type: application/json

{
  "beds": [
    {
      "id": 1,
      "name": "标准折叠床",
      "price": 30,
      "deposit": 300,
      "quantity": 2
    }
  ],
  "totalDeposit": 600,
  "openid": "用户openid"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "订单创建成功",
  "data": {
    "orderId": "ORD12345678901234",
    "order": {
      "orderId": "ORD12345678901234",
      "beds": [...],
      "totalDeposit": 600,
      "status": "unpaid",
      "createTime": "2024-01-01 00:00:00"
    }
  }
}
```

### 3. 获取支付参数
```
POST /api/payment/getParams
Content-Type: application/json

{
  "orderId": "ORD12345678901234",
  "openid": "用户openid"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "获取支付参数成功",
  "data": {
    "timeStamp": "1234567890",
    "nonceStr": "randomString",
    "package": "prepay_id=wx123456",
    "signType": "MD5",
    "paySign": "ABCD1234..."
  }
}
```

### 4. 查询订单
```
GET /api/order/query?orderId=ORD12345678901234
```

**响应:**
```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "orderId": "ORD12345678901234",
    "beds": [...],
    "totalDeposit": 600,
    "status": "paid",
    "createTime": "2024-01-01 00:00:00"
  }
}
```

### 5. 获取订单列表
```
GET /api/order/list?openid=用户openid
```

**响应:**
```json
{
  "code": 200,
  "message": "查询成功",
  "data": [
    {
      "orderId": "ORD12345678901234",
      "beds": [...],
      "totalDeposit": 600,
      "status": "paid",
      "createTime": "2024-01-01 00:00:00"
    }
  ]
}
```

### 6. 退还押金
```
POST /api/order/refund
Content-Type: application/json

{
  "orderId": "ORD12345678901234"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "押金退还成功",
  "data": {
    "orderId": "ORD12345678901234",
    "status": "refunded",
    "refundTime": "2024-01-01 00:00:00"
  }
}
```

### 7. 删除订单
```
DELETE /api/order/delete
Content-Type: application/json

{
  "orderId": "ORD12345678901234"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "订单删除成功"
}
```

### 8. 获取统计信息
```
GET /api/stats
```

**响应:**
```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "totalOrders": 10,
    "paidOrders": 5,
    "unpaidOrders": 3,
    "refundedOrders": 2,
    "totalDeposit": 3000
  }
}
```

## 安装和运行

### 1. 安装依赖
```bash
cd server
npm install
```

### 2. 配置微信支付
编辑 `server.js`，修改以下配置：
```javascript
const WX_PAY_CONFIG = {
  appid: 'your_wx_appid',           // 您的小程序appid
  mchid: 'your_mchid',              // 您的商户号
  apiKey: 'your_api_key',           // 您的API密钥
  notifyUrl: 'http://your-domain.com/api/payment/notify'  // 支付回调地址
};
```

### 3. 启动服务器
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 4. 访问服务
服务器将在 `http://localhost:3000` 启动

## 测试API

使用 curl 或 Postman 测试：

```bash
# 健康检查
curl http://localhost:3000/api/health

# 创建订单
curl -X POST http://localhost:3000/api/order/create \
  -H "Content-Type: application/json" \
  -d '{
    "beds": [{"id": 1, "name": "标准折叠床", "price": 30, "deposit": 300, "quantity": 2}],
    "totalDeposit": 600,
    "openid": "test_openid"
  }'

# 查询订单
curl http://localhost:3000/api/order/query?orderId=ORD12345678901234
```

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web框架
- **crypto** - 加密模块（生成签名）

## 注意事项

1. **生产环境必须使用数据库**：当前使用内存存储，重启服务器后数据会丢失
2. **配置真实的微信支付参数**：需要申请微信支付商户号
3. **配置支付回调地址**：需要将服务器部署到公网，并配置微信支付回调URL
4. **安全性**：生产环境需要添加认证、限流、日志等功能

## 后续优化建议

1. 集成真实的微信支付API（使用 axios 调用微信统一下单接口）
2. 使用数据库存储订单（MySQL/MongoDB）
3. 添加用户认证系统
4. 添加日志记录
5. 添加数据备份功能
6. 部署到云服务器

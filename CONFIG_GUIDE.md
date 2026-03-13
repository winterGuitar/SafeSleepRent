# 配置文件使用指南

## 快速开始

### 1. 查看当前配置

```bash
# 查看床位类型
curl http://localhost:3000/api/bedTypes

# 查看可用床位
curl http://localhost:3000/api/bedTypes/available

# 查看库存信息
curl http://localhost:3000/api/bedTypes/inventory

# 查看押金规则
curl http://localhost:3000/api/rules/deposit

# 查看租赁政策
curl http://localhost:3000/api/rules/rental

# 查看营业时间
curl http://localhost:3000/api/rules/businessHours
```

### 2. 添加新床位类型

编辑 `config/bedTypes.js`：

```javascript
{
  id: 7,
  name: '您的床位名称',
  code: 'YOUR_BED_CODE',
  description: '床位描述',
  price: 50,                      // 日租金
  deposit: 500,                   // 押金
  image: '/images/bed7.png',       // 图片路径
  stock: 30,                      // 库存
  available: true,                // 是否可用
  features: ['特性1', '特性2']    // 特性列表
}
```

### 3. 调整价格和押金

```javascript
// 修改标准折叠床的价格
{
  id: 1,
  name: '标准折叠床',
  price: 35,                      // 原价30，改为35
  deposit: 350,                   // 原押金300，改为350
  // ...其他配置
}
```

### 4. 调整库存

```javascript
{
  id: 1,
  name: '标准折叠床',
  stock: 100,                     // 原库存50，改为100
  available: true,                // 可用状态
  // ...其他配置
}
```

### 5. 修改押金规则

```javascript
depositRules: {
  multiplier: 8,                  // 押金倍数（原10改为8）
  refundDays: 7,                  // 退还天数
  minDeposit: 150,                // 最小押金（原200改为150）
  maxDeposit: 3000                // 最大押金（原2000改为3000）
}
```

### 6. 修改营业时间

```javascript
businessHours: {
  start: '09:00',                 // 开门时间（原08:00改为09:00）
  end: '21:00',                   // 关门时间（原20:00改为21:00）
  is24Hours: false                // 是否24小时营业
}
```

## API接口说明

### 获取所有床位类型

```
GET /api/bedTypes
```

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "标准折叠床",
      "code": "STANDARD",
      "description": "医用级铝合金折叠床，承重200kg，可调节角度",
      "price": 30,
      "deposit": 300,
      "image": "/images/bed1.png",
      "stock": 50,
      "available": true,
      "features": ["铝合金材质", "承重200kg", "可调节角度", "轻便折叠"]
    }
  ]
}
```

### 根据ID获取床位类型

```
GET /api/bedTypes/:id
```

**示例：**
```bash
curl http://localhost:3000/api/bedTypes/1
```

### 获取可用床位类型

```
GET /api/bedTypes/available
```

只返回 `available: true` 的床位类型。

### 获取库存信息

```
GET /api/bedTypes/inventory
```

**响应示例：**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "标准折叠床",
      "stock": 50,
      "available": true,
      "isLowStock": false
    }
  ]
}
```

`isLowStock` 字段表示是否低于库存预警值（默认10）。

## 前端集成

小程序已自动集成配置API，会从服务器加载床位类型：

```javascript
// pages/index/index.js
loadBedTypes: function() {
  wx.request({
    url: 'http://localhost:3000/api/bedTypes',
    method: 'GET',
    success: (res) => {
      if (res.data.code === 200) {
        const bedList = res.data.data.map(bed => ({
          ...bed,
          quantity: 0
        }))
        
        this.setData({
          bedList: bedList
        })
      }
    }
  })
}
```

## 配置文件修改后

修改配置文件后，需要重启服务器才能生效：

```bash
# 开发环境（使用nodemon会自动重启）
npm run dev

# 生产环境（手动重启）
npm start
```

## 配置验证

服务器启动时会验证配置的有效性，如发现问题会在控制台输出错误信息。

## 常见问题

### Q: 如何添加新床位类型？
A: 编辑 `config/bedTypes.js`，在 `bedTypes` 数组中添加新的床位对象。

### Q: 如何调整价格？
A: 修改对应床位的 `price` 和 `deposit` 字段。

### Q: 如何禁用某个床位类型？
A: 将对应床位的 `available` 字段设置为 `false`。

### Q: 如何修改库存预警值？
A: 修改 `inventory.warningLevel` 的值。

### Q: 配置修改后不生效？
A: 确保已重启服务器。

### Q: 小程序无法加载床位类型？
A: 检查服务器是否启动，检查网络连接，确认接口地址正确。

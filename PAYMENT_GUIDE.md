# 支付功能说明

## 当前状态

### ✅ 开发环境（当前配置）

**模拟支付模式**：无需配置真实的微信支付，可以直接测试完整流程

**特性**：
- 点击"立即支付"后，系统自动模拟支付成功
- 3秒后自动将订单状态更新为"已支付"
- 可以正常跳转到订单页查看订单

**使用方法**：
1. 保持 `config/bedTypes.js` 中的支付配置为占位符
2. 启动后端服务：`start-backend.bat`
3. 在小程序中选择床位并点击支付
4. 支付会自动成功，无需任何操作

---

## 生产环境配置（正式上线）

如需正式使用微信支付，需要完成以下配置：

### 1. 申请微信支付

**申请地址**：https://pay.weixin.qq.com/

**所需材料**：
- 营业执照
- 法人身份证
- 对公银行账户
- 小程序 AppID（在微信公众平台获取）

### 2. 获取商户信息

开通成功后，你会获得：
- **商户号（mchid）**：8位数字
- **API 密钥（apiKey）**：32位字符串
- **API 证书**：用于退款等接口

### 3. 修改配置文件

编辑 `server/config/bedTypes.js`：

```javascript
payment: {
  wechat: {
    enabled: true,
    appid: 'wx15154681e284684e',        // 你的小程序 AppID
    mchid: '12345678',                   // 你的商户号（替换为实际值）
    apiKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  // API 密钥（替换为实际值）
    notifyUrl: 'https://yourdomain.com/api/payment/notify',  // 支付回调地址
    unifiedOrderUrl: 'https://api.mch.weixin.qq.com/pay/unifiedorder',
    orderQueryUrl: 'https://api.mch.weixin.qq.com/pay/orderquery',
    refundUrl: 'https://api.mch.weixin.qq.com/secapi/pay/refund'
  }
}
```

### 4. 实现真实支付接口

编辑 `server/server.js` 中的 `/api/payment/getParams` 接口：

需要调用微信统一下单 API：

```javascript
const axios = require('axios');

// 调用微信统一下单
async function callWechatUnifiedOrder(orderData) {
  const params = {
    appid: config.bed.payment.wechat.appid,
    mch_id: config.bed.payment.wechat.mchid,
    nonce_str: generateNonceStr(),
    body: '医院租床服务',
    out_trade_no: orderData.orderId,
    total_fee: orderData.totalDeposit * 100,  // 单位：分
    spbill_create_ip: req.ip,
    notify_url: config.bed.payment.wechat.notifyUrl,
    trade_type: 'JSAPI',
    openid: orderData.openid
  };

  // 生成签名
  const sign = generateMD5Sign(params, config.bed.payment.wechat.apiKey);
  params.sign = sign;

  // 发送请求（需要将参数转为 XML 格式）
  const result = await axios.post(
    config.bed.payment.wechat.unifiedOrderUrl,
    objectToXml(params)
  );

  return xmlToObject(result.data);
}
```

### 5. 配置支付回调 URL

在**微信支付商户平台**配置：
- 登录 https://pay.weixin.qq.com/
- 进入「产品中心」→「开发配置」
- 配置支付回调 URL：`https://yourdomain.com/api/payment/notify`

### 6. 小程序后台配置

在**微信公众平台**配置：
- 登录 https://mp.weixin.qq.com/
- 进入「设置」→「接口设置」→「微信支付」
- 绑定商户号

---

## 支付流程说明

### 开发环境流程

```
用户选择床位
    ↓
点击"立即支付"
    ↓
前端调用 /api/payment/getParams
    ↓
后端检测到是开发环境（mchid 为占位符）
    ↓
返回模拟支付参数
    ↓
前端显示"支付处理中..."
    ↓
后端 3 秒后模拟支付回调
    ↓
订单状态更新为"已支付"
    ↓
跳转到订单页
```

### 生产环境流程

```
用户选择床位
    ↓
点击"立即支付"
    ↓
前端调用 /api/payment/getParams
    ↓
后端调用微信统一下单 API
    ↓
获取 prepay_id
    ↓
返回支付参数给前端
    ↓
前端调起微信支付
    ↓
用户在微信中输入密码/指纹
    ↓
微信支付成功
    ↓
微信回调后端 /api/payment/notify
    ↓
后端更新订单状态
    ↓
前端跳转到订单页
```

---

## 常见问题

### Q1: 开发环境支付一直失败？
**A**: 确认 `config/bedTypes.js` 中的 `mchid` 和 `apiKey` 保持为占位符（`'your_mchid'` 和 `'your_api_key'`），这样才能启用模拟支付。

### Q2: 如何切换到真实支付？
**A**:
1. 申请并开通微信支付
2. 替换 `config/bedTypes.js` 中的真实商户信息
3. 配置支付回调 URL
4. 实现真实的统一下单 API 调用

### Q3: 支付回调地址如何配置？
**A**:
- 开发环境：`http://localhost:3000/api/payment/notify`
- 生产环境：`https://yourdomain.com/api/payment/notify`
- 注意：生产环境必须是 HTTPS

### Q4: 金额单位是什么？
**A**: 微信支付的金额单位是**分**，后端需要将元乘以 100。
- 示例：10.50 元 → 1050 分

### Q5: 如何测试支付？
**A**: 
- **开发环境**：使用模拟支付，无需真实资金
- **生产环境**：微信支付提供测试工具，可以使用小额资金测试

---

## 注意事项

1. **开发环境不要使用真实支付**：避免误扣费
2. **API 密钥要保密**：不要提交到代码仓库
3. **支付回调地址必须是 HTTPS**：生产环境强制要求
4. **订单号要唯一**：避免重复支付
5. **处理并发支付**：同一订单不能重复支付
6. **记录支付日志**：方便排查问题

---

## 参考文档

- [微信支付接入指南](https://pay.weixin.qq.com/wiki/doc/api/index.html)
- [小程序支付开发文档](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPayment.html)
- [支付结果通知](https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_7)

module.exports = {
  "bedTypes": [
    {
      "id": 1,
      "name": "标准折叠床",
      "code": "STANDARD",
      "description": "医用级铝合金折叠床，承重200kg，可调节角度",
      "price": 30,
      "deposit": 300,
      "image": "/images/bed1.png",
      "stock": 31,
      "available": true,
      "features": [
        "铝合金材质",
        "承重200kg",
        "可调节角度",
        "轻便折叠"
      ]
    },
    {
      "id": 2,
      "name": "电动折叠床",
      "code": "ELECTRIC",
      "description": "电动调节床角度，遥控操作，背部腿部可独立调节",
      "price": 80,
      "deposit": 800,
      "image": "/images/bed2.png",
      "stock": 10,
      "available": true,
      "features": [
        "电动调节",
        "遥控操作",
        "背部腿部独立调节",
        "静音设计"
      ]
    },
    {
      "id": 3,
      "name": "加厚折叠床",
      "code": "THICK",
      "description": "加厚床垫10cm，防褥疮设计，透气舒适",
      "price": 50,
      "deposit": 500,
      "image": "/images/bed3.png",
      "stock": 0,
      "available": true,
      "features": [
        "10cm加厚床垫",
        "防褥疮设计",
        "透气舒适",
        "环保材质"
      ]
    },
    {
      "id": 4,
      "name": "多功能护理床",
      "code": "CARE",
      "description": "可坐可躺，带护栏，方便病人上下床",
      "price": 120,
      "deposit": 1200,
      "image": "/images/bed4.png",
      "stock": 0,
      "available": true,
      "features": [
        "可坐可躺",
        "安全护栏",
        "方便上下床",
        "稳定耐用"
      ]
    },
    {
      "id": 5,
      "name": "儿童折叠床",
      "code": "CHILD",
      "description": "儿童专用尺寸，安全护栏，卡通图案",
      "price": 40,
      "deposit": 400,
      "image": "/images/bed5.png",
      "stock": 18,
      "available": true,
      "features": [
        "儿童专用尺寸",
        "双重安全护栏",
        "卡通图案",
        "环保无味"
      ]
    },
    {
      "id": 6,
      "name": "经济型折叠床",
      "code": "ECONOMY",
      "description": "性价比高，基本功能齐全，适合短期使用",
      "price": 25,
      "deposit": 250,
      "image": "/images/bed6.png",
      "stock": 93,
      "available": true,
      "features": [
        "价格实惠",
        "功能齐全",
        "适合短期",
        "轻便易携带"
      ]
    }
  ],
  "payment": {
    "wechat": {
      "enabled": true,
      "appid": "your_wx_appid",
      "mchid": "your_mchid",
      "apiKey": "your_api_key",
      "notifyUrl": "http://localhost:3000/api/payment/notify",
      "unifiedOrderUrl": "https://api.mch.weixin.qq.com/pay/unifiedorder",
      "orderQueryUrl": "https://api.mch.weixin.qq.com/pay/orderquery",
      "refundUrl": "https://api.mch.weixin.qq.com/secapi/pay/refund"
    },
    "alipay": {
      "enabled": false,
      "appId": "your_alipay_appid",
      "privateKey": "your_alipay_private_key",
      "publicKey": "your_alipay_public_key",
      "notifyUrl": "http://localhost:3000/api/alipay/notify"
    }
  },
  "depositRules": {
    "multiplier": 10,
    "refundDays": 7,
    "minDeposit": 200,
    "maxDeposit": 2000
  },
  "inventory": {
    "warningLevel": 10,
    "allowOverbooking": false,
    "overbookingRate": 0.1
  },
  "orderRules": {
    "minRentDays": 1,
    "maxRentDays": 30,
    "cancelLimit": 24,
    "orderTimeout": 30
  },
  "businessHours": {
    "start": "08:00",
    "end": "20:00",
    "is24Hours": false
  },
  "rentalPolicy": {
    "maxRentalDays": 30,
    "extendDays": 7,
    "overdueFee": 50,
    "overdueDeduction": 0.1
  }
}
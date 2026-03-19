module.exports = {
  "bedTypes": [
    {
      "id": 1,
      "name": "标准折叠床",
      "code": "STANDARD",
      "description": "医用级铝合金折叠床，承重200kg，可调节角度",
      "price": 30,
      "deposit": 300,
      "image": "/public/images/bed-1773493598958-259384733.png",
      "stock": 0,
      "available": false,
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
      "image": "/public/images/bed-1773493636374-121042253.png",
      "stock": 10,
      "available": false,
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
      "image": "/public/images/bed-1773494537523-486659758.png",
      "stock": 0,
      "available": false,
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
      "image": "/public/images/bed-1773494547083-726940194.png",
      "stock": 0,
      "available": false,
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
      "image": "/public/images/bed-1773494555165-203885668.png",
      "stock": 18,
      "available": false,
      "features": [
        "儿童专用尺寸",
        "双重安全护栏",
        "卡通图案",
        "环保无味"
      ]
    },
    {
      "name": "新的床位",
      "code": "STANDARD",
      "description": "1111",
      "price": 10,
      "deposit": 100,
      "stock": 13,
      "image": "/public/images/bed-1773494569080-626061223.png",
      "features": [
        "铝合金材质",
        "承重200kg",
        "可调节角度",
        "轻便折叠"
      ],
      "available": true,
      "id": 7
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
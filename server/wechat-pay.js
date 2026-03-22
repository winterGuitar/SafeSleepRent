// 微信支付集成模块
const axios = require('axios');
const { generateNonceStr, generateMD5Sign } = require('./utils/crypto');

// 微信支付配置（可通过setConfig更新）
let WX_PAY_CONFIG = {
  appid: 'your_wx_appid',
  mchid: 'your_mchid',
  apiKey: 'your_api_key',
  notifyUrl: 'http://your-domain.com/api/payment/notify',
  unifiedOrderUrl: 'https://api.mch.weixin.qq.com/pay/unifiedorder',
  orderQueryUrl: 'https://api.mch.weixin.qq.com/pay/orderquery',
  refundUrl: 'https://api.mch.weixin.qq.com/secapi/pay/refund'
};

/**
 * 更新微信支付配置
 * @param {Object} newConfig - 新的配置对象
 */
function setConfig(newConfig) {
  if (newConfig.appid) WX_PAY_CONFIG.appid = newConfig.appid;
  if (newConfig.mchid) WX_PAY_CONFIG.mchid = newConfig.mchid;
  if (newConfig.apiKey) WX_PAY_CONFIG.apiKey = newConfig.apiKey;
  if (newConfig.notifyUrl) WX_PAY_CONFIG.notifyUrl = newConfig.notifyUrl;
  if (newConfig.unifiedOrderUrl) WX_PAY_CONFIG.unifiedOrderUrl = newConfig.unifiedOrderUrl;
  if (newConfig.orderQueryUrl) WX_PAY_CONFIG.orderQueryUrl = newConfig.orderQueryUrl;
  if (newConfig.refundUrl) WX_PAY_CONFIG.refundUrl = newConfig.refundUrl;
}

/**
 * 调用微信统一下单接口
 * @param {Object} orderData - 订单数据
 * @returns {Promise<Object>}
 */
async function unifiedOrder(orderData) {
  const {
    orderId,
    totalFee,
    body,
    openid,
    tradeType = 'JSAPI'
  } = orderData;

  // 构造请求参数
  const params = {
    appid: WX_PAY_CONFIG.appid,
    mch_id: WX_PAY_CONFIG.mchid,
    nonce_str: generateNonceStr(),
    body: body || '医院租床服务',
    out_trade_no: orderId,
    total_fee: totalFee * 100, // 单位：分
    spbill_create_ip: '127.0.0.1',
    notify_url: WX_PAY_CONFIG.notifyUrl,
    trade_type: tradeType,
    openid: openid
  };

  // 生成签名
  params.sign = generateMD5Sign(params, WX_PAY_CONFIG.apiKey);

  // 转换为XML格式
  const xmlData = objectToXml(params);

  try {
    // 发送请求
    const response = await axios.post(WX_PAY_CONFIG.unifiedOrderUrl, xmlData, {
      headers: { 'Content-Type': 'application/xml' }
    });

    // 解析响应
    const result = xmlToObject(response.data);

    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return {
        code: 200,
        message: '下单成功',
        data: {
          prepayId: result.prepay_id,
          codeUrl: result.code_url
        }
      };
    } else {
      return {
        code: 400,
        message: result.return_msg || '下单失败',
        error: result
      };
    }
  } catch (error) {
    console.error('统一下单失败:', error);
    return {
      code: 500,
      message: '统一下单失败',
      error: error.message
    };
  }
}

/**
 * 生成小程序支付参数
 * @param {string} prepayId - 预支付ID
 * @returns {Object}
 */
function generateMinipayParams(prepayId) {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = generateNonceStr();
  const packageStr = `prepay_id=${prepayId}`;

  const params = {
    appId: WX_PAY_CONFIG.appid,
    timeStamp: timeStamp,
    nonceStr: nonceStr,
    package: packageStr,
    signType: 'MD5'
  };

  params.paySign = generateMD5Sign(params, WX_PAY_CONFIG.apiKey);

  return params;
}

/**
 * 查询订单
 * @param {string} orderId - 订单号
 * @returns {Promise<Object>}
 */
async function queryOrder(orderId) {
  const params = {
    appid: WX_PAY_CONFIG.appid,
    mch_id: WX_PAY_CONFIG.mchid,
    out_trade_no: orderId,
    nonce_str: generateNonceStr()
  };

  params.sign = generateMD5Sign(params, WX_PAY_CONFIG.apiKey);
  const xmlData = objectToXml(params);

  try {
    const response = await axios.post(WX_PAY_CONFIG.orderQueryUrl, xmlData, {
      headers: { 'Content-Type': 'application/xml' }
    });

    const result = xmlToObject(response.data);

    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return {
        code: 200,
        message: '查询成功',
        data: {
          tradeState: result.trade_state,
          transactionId: result.transaction_id,
          tradeStateDesc: result.trade_state_desc
        }
      };
    } else {
      return {
        code: 400,
        message: result.return_msg || '查询失败',
        error: result
      };
    }
  } catch (error) {
    console.error('查询订单失败:', error);
    return {
      code: 500,
      message: '查询订单失败',
      error: error.message
    };
  }
}

/**
 * 退款
 * @param {Object} refundData - 退款数据
 * @returns {Promise<Object>}
 */
async function refund(refundData) {
  const {
    orderId,
    totalFee,
    refundFee,
    refundDesc
  } = refundData;

  const params = {
    appid: WX_PAY_CONFIG.appid,
    mch_id: WX_PAY_CONFIG.mchid,
    nonce_str: generateNonceStr(),
    out_trade_no: orderId,
    out_refund_no: `REF${orderId}`,
    total_fee: totalFee * 100,
    refund_fee: refundFee * 100,
    refund_desc: refundDesc || '押金退还'
  };

  params.sign = generateMD5Sign(params, WX_PAY_CONFIG.apiKey);
  const xmlData = objectToXml(params);

  try {
    const response = await axios.post(WX_PAY_CONFIG.refundUrl, xmlData, {
      headers: { 'Content-Type': 'application/xml' }
    });

    const result = xmlToObject(response.data);

    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return {
        code: 200,
        message: '退款成功',
        data: {
          refundId: result.refund_id
        }
      };
    } else {
      return {
        code: 400,
        message: result.return_msg || '退款失败',
        error: result
      };
    }
  } catch (error) {
    console.error('退款失败:', error);
    return {
      code: 500,
      message: '退款失败',
      error: error.message
    };
  }
}

// 辅助函数
function objectToXml(obj) {
  let xml = '<xml>';
  for (const key in obj) {
    xml += `<${key}><![CDATA[${obj[key]}]]></${key}>`;
  }
  xml += '</xml>';
  return xml;
}

function xmlToObject(xml) {
  const result = {};
  const regex = /<([^>]+)><!\[CDATA\[([^\]]+)\]\]><\/\1>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  
  return result;
}

module.exports = {
  unifiedOrder,
  generateMinipayParams,
  queryOrder,
  refund,
  setConfig,
  xmlToObject
};

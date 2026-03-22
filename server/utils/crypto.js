const crypto = require('crypto');

function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMD5Sign(params, apiKey) {
  const sortedKeys = Object.keys(params).sort();
  let stringA = '';
  sortedKeys.forEach((key) => {
    if (params[key] !== undefined && params[key] !== '') {
      stringA += `${key}=${params[key]}&`;
    }
  });
  stringA += `key=${apiKey}`;
  return crypto.createHash('md5').update(stringA, 'utf8').digest('hex').toUpperCase();
}

function generateUserToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateNonceStr, generateMD5Sign, generateUserToken };

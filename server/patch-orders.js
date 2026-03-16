// 订单接口补丁脚本 - 自动替换 server.js 中的订单接口
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.backup');

console.log('='.repeat(60));
console.log('订单接口补丁脚本');
console.log('='.repeat(60));

// 1. 备份原文件
console.log('\n1. 备份原文件...');
if (fs.existsSync(backupPath)) {
  console.log('   ⚠️  备份文件已存在，跳过');
} else {
  fs.copyFileSync(filePath, backupPath);
  console.log('   ✅ 已备份到 server.js.backup');
}

// 2. 读取文件
console.log('\n2. 读取文件...');
let content = fs.readFileSync(filePath, 'utf8');

// 3. 统计替换
console.log('\n3. 替换订单接口...');
let replacements = 0;

// 替换创建订单接口
if (content.includes('// 创建订单\napp.post(\'/api/order/create\', (req, res) => {')) {
  const createOrderPattern = /\/\/ 创建订单\s*\napp\.post\('\/api\/order\/create', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 创建订单\napp.post('/api/order/create', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.createOrder(req, res);\n});`;
  content = content.replace(createOrderPattern, replacement);
  console.log('   ✅ 替换: 创建订单接口');
  replacements++;
} else {
  console.log('   ⚠️  创建订单接口可能已被替换');
}

// 替换支付订单接口
if (content.includes('// 支付成功回调\napp.post(\'/api/order/pay\', (req, res) => {')) {
  const payOrderPattern = /\/\/ 支付成功回调\s*\napp\.post\('\/api\/order\/pay', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 支付订单\napp.post('/api/order/pay', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.payOrder(req, res);\n});`;
  content = content.replace(payOrderPattern, replacement);
  console.log('   ✅ 替换: 支付订单接口');
  replacements++;
} else {
  console.log('   ⚠️  支付订单接口可能已被替换');
}

// 替换查询订单接口
if (content.includes('// 查询订单\napp.get(\'/api/order/query\', (req, res) => {')) {
  const queryOrderPattern = /\/\/ 查询订单\s*\napp\.get\('\/api\/order\/query', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 查询订单\napp.get('/api/order/query/:orderId', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.queryOrder(req, res);\n});`;
  content = content.replace(queryOrderPattern, replacement);
  console.log('   ✅ 替换: 查询订单接口');
  replacements++;
} else {
  console.log('   ⚠️  查询订单接口可能已被替换');
}

// 替换获取订单列表接口
if (content.includes('// 获取订单列表\napp.get(\'/api/order/list\', (req, res) => {')) {
  const listOrderPattern = /\/\/ 获取订单列表\s*\napp\.get\('\/api\/order\/list', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 获取订单列表\napp.get('/api/order/list', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.getOrderList(req, res);\n});`;
  content = content.replace(listOrderPattern, replacement);
  console.log('   ✅ 替换: 获取订单列表接口');
  replacements++;
} else {
  console.log('   ⚠️  获取订单列表接口可能已被替换');
}

// 替换退还押金接口
if (content.includes('// 退还押金\napp.post(\'/api/order/refund\', (req, res) => {')) {
  const refundOrderPattern = /\/\/ 退还押金\s*\napp\.post\('\/api\/order\/refund', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 退还押金\napp.post('/api/order/refund', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.refundOrder(req, res);\n});`;
  content = content.replace(refundOrderPattern, replacement);
  console.log('   ✅ 替换: 退还押金接口');
  replacements++;
} else {
  console.log('   ⚠️  退还押金接口可能已被替换');
}

// 替换删除订单接口
if (content.includes('// 删除订单\napp.delete(\'/api/order/delete\', (req, res) => {')) {
  const deleteOrderPattern = /\/\/ 删除订单\s*\napp\.delete\('\/api\/order\/delete', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 删除订单\napp.delete('/api/order/delete', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.deleteOrder(req, res);\n});`;
  content = content.replace(deleteOrderPattern, replacement);
  console.log('   ✅ 替换: 删除订单接口');
  replacements++;
} else {
  console.log('   ⚠️  删除订单接口可能已被替换');
}

// 替换取消订单接口
if (content.includes('// 取消订单\napp.post(\'/api/order/cancel\', (req, res) => {')) {
  const cancelOrderPattern = /\/\/ 取消订单\s*\napp\.post\('\/api\/order\/cancel', \(req, res\) => \{[\s\S]*?\n\}\);/g;
  const replacement = `// 取消订单\napp.post('/api/order/cancel', (req, res) => {\n  req.broadcastToClients = broadcastToClients;\n  orderRoutes.cancelOrder(req, res);\n});`;
  content = content.replace(cancelOrderPattern, replacement);
  console.log('   ✅ 替换: 取消订单接口');
  replacements++;
} else {
  console.log('   ⚠️  取消订单接口可能已被替换');
}

// 替换统计接口（需要特殊处理）
if (content.includes('// 获取系统统计信息\napp.get(\'/api/stats\', (req, res) => {')) {
  const statsPattern = /\/\/ 获取系统统计信息\s*\napp\.get\('\/api\/stats', \(req, res\) => \{[\s\S]*?}\);/g;
  const replacement = `// 获取系统统计信息\napp.get('/api/stats', async (req, res) => {\n  try {\n    let stats;\n\n    if (config.database.type === 'mysql' && orderDao) {\n      stats = await orderDao.getOrderStats();\n    } else {\n      let paidCount = 0;\n      let unpaidCount = 0;\n      let refundedCount = 0;\n      let totalDeposit = 0;\n\n      orders.forEach((order) => {\n        if (order.status === 'paid') {\n          paidCount++;\n          totalDeposit += order.totalDeposit;\n        } else if (order.status === 'unpaid') {\n          unpaidCount++;\n        } else if (order.status === 'refunded') {\n          refundedCount++;\n        }\n      });\n\n      stats = {\n        totalOrders: orders.size,\n        paidOrders: paidCount,\n        unpaidOrders: unpaidCount,\n        refundedOrders: refundedCount,\n        totalDeposit: totalDeposit\n      };\n    }\n\n    res.json({\n      code: 200,\n      message: '查询成功',\n      data: stats\n    });\n  } catch (error) {\n    console.error('获取统计信息失败:', error);\n    res.json({\n      code: 500,\n      message: '获取统计信息失败'\n    });\n  }\n});`;
  content = content.replace(statsPattern, replacement);
  console.log('   ✅ 替换: 统计接口');
  replacements++;
} else {
  console.log('   ⚠️  统计接口可能已被替换');
}

// 4. 保存文件
console.log('\n4. 保存文件...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('   ✅ 文件已保存');

// 5. 输出结果
console.log('\n' + '='.repeat(60));
console.log(`替换完成！共替换 ${replacements} 个接口`);
console.log('='.repeat(60));

console.log('\n后续步骤：');
console.log('1. 检查 server.js 确认修改正确');
console.log('2. 运行: npm install mysql');
console.log('3. 运行: npm start');
console.log('4. 如果有问题，可从 server.js.backup 恢复');

console.log('\n补丁脚本执行完成！');

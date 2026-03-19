// API基础配置 - 自动判断环境（支持localhost、局域网IP、生产环境）
const API_BASE = (function() {
  const hostname = location.hostname;

  // 本地开发环境
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }

  // 局域网IP访问 (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (/^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/.test(hostname)) {
    // 局域网环境，直接访问3000端口
    return `http://${hostname}:3000/api`;
  }

  // 生产环境（使用反向代理）
  return '/api';
})();

// 封装请求方法
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API请求失败:', error);
    return {
      code: 500,
      message: '网络错误'
    };
  }
}

// 获取统计数据
async function getStats() {
  return apiRequest('/stats');
}

// 获取订单列表
async function getOrders() {
  return apiRequest('/order/list');
}

// 查询订单
async function getOrder(orderId) {
  return apiRequest(`/order/query/${orderId}`);
}

// 删除订单
async function deleteOrder(orderId) {
  return apiRequest('/order/delete', {
    method: 'DELETE',
    body: JSON.stringify({ orderId })
  });
}

// 退还押金
async function refundOrder(orderId) {
  return apiRequest('/order/refund', {
    method: 'POST',
    body: JSON.stringify({ orderId })
  });
}

// 获取床位类型
async function getBedTypes() {
  return apiRequest('/bedTypes');
}

// 获取押金规则
async function getDepositRules() {
  return apiRequest('/rules/deposit');
}

// 获取租赁政策
async function getRentalPolicy() {
  return apiRequest('/rules/rental');
}

// 获取营业时间
async function getBusinessHours() {
  return apiRequest('/rules/businessHours');
}

// 创建床位类型
async function createBedType(bedData) {
  return apiRequest('/bedTypes', {
    method: 'POST',
    body: JSON.stringify(bedData)
  });
}

// 更新床位类型（API调用）
async function updateBedTypeApi(id, bedData) {
  console.log('API调用更新床位类型, id:', id, 'data:', bedData);
  return apiRequest(`/bedTypes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(bedData)
  });
}

// 删除床位类型（API调用）
async function deleteBedTypeApi(id) {
  return apiRequest(`/bedTypes/${id}`, {
    method: 'DELETE'
  });
}

// 保存设置
async function saveSystemSettings(settings) {
  return apiRequest('/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  });
}

// 通知小程序刷新数据
async function notifyMiniprogramRefresh(type, data = {}) {
  return apiRequest('/notify/refresh', {
    method: 'POST',
    body: JSON.stringify({ type, data })
  });
}

// ==================== WebSocket 实时监听 ====================

let ws = null;
let wsReconnectTimer = null;
let wsHeartbeatTimer = null;

/**
 * 连接WebSocket
 */
function connectWebSocket() {
  try {
    // 如果已有连接且状态正常，不要重复连接
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket已连接，跳过重复连接');
      return;
    }

    // 如果正在连接，等待连接完成
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket正在连接中，跳过');
      return;
    }

    const hostname = location.hostname;

    // 判断环境和协议
    let protocol, port;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // 本地开发环境
      protocol = 'ws:';
      port = ':3000';
    } else if (/^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))/.test(hostname)) {
      // 局域网IP访问
      protocol = 'ws:';
      port = ':3000';
    } else {
      // 生产环境
      protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      port = '';
    }

    // 为每个浏览器会话生成唯一ID，允许多个管理员同时登录
    const uniqueSessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wsUrl = `${protocol}//${hostname}${port}/ws?client=admin&openid=${uniqueSessionId}`;

    console.log('正在连接WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接成功');
      updateWsStatus(true);
      // 清除重连定时器
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
      // 启动心跳
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      console.log('===== WebSocket 收到消息 =====');
      console.log('原始数据:', event.data);
      try {
        const message = JSON.parse(event.data);
        console.log('解析后的消息:', message);
        console.log('消息类型:', message.type);
        console.log('============================');

        // 根据消息类型处理
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
        console.error('错误数据:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      updateWsStatus(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket连接已关闭, code:', event.code, 'reason:', event.reason);
      updateWsStatus(false);
      stopHeartbeat();
      
      // 清理旧连接
      ws = null;
      
      // 指数退避重连，避免频繁重连
      const maxRetries = 5;
      let retryCount = 0;
      const baseDelay = 5000; // 5秒
      
      function scheduleReconnect() {
        if (retryCount >= maxRetries) {
          console.log('WebSocket重连次数达到上限，停止重连');
          return;
        }
        
        const delay = baseDelay * Math.pow(2, retryCount); // 5s, 10s, 20s, 40s, 80s
        console.log(`WebSocket将在 ${delay/1000} 秒后尝试重连 (${retryCount + 1}/${maxRetries})`);
        
        wsReconnectTimer = setTimeout(() => {
          retryCount++;
          console.log('尝试重新连接WebSocket...');
          connectWebSocket();
        }, delay);
      }
      
      scheduleReconnect();
    };

  } catch (error) {
    console.error('WebSocket连接失败:', error);
  }
}

/**
 * 启动心跳保活
 */
function startHeartbeat() {
  stopHeartbeat();
  wsHeartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

/**
 * 停止心跳保活
 */
function stopHeartbeat() {
  if (wsHeartbeatTimer) {
    clearInterval(wsHeartbeatTimer);
    wsHeartbeatTimer = null;
  }
}

/**
 * 处理WebSocket消息
 */
function handleWebSocketMessage(message) {
  console.log('===== 处理 WebSocket 消息 =====');
  console.log('消息类型:', message.type);
  console.log('消息内容:', JSON.stringify(message));

  switch (message.type) {
    case 'connection_established':
      console.log('✓ WebSocket连接已建立');
      console.log('客户端ID:', message.clientId);
      break;

    case 'bed_types_update':
      console.log('✓ 收到床位类型更新');
      // 刷新相关页面数据
      refreshBedTypesData();
      break;

    case 'settings_update':
      console.log('✓ 收到系统设置更新');
      // 刷新设置页面数据
      refreshSettingsData();
      break;

    case 'order_paid':
      console.log('✓ 收到订单支付通知');
      console.log('订单号:', message.orderId);
      // 刷新订单和统计数据
      refreshOrderData();
      refreshDashboardData();
      break;

    case 'order_refunded':
      console.log('✓ 收到订单退款通知');
      console.log('订单号:', message.orderId);
      // 刷新订单和统计数据
      refreshOrderData();
      refreshDashboardData();
      break;

    case 'order_deleted':
      console.log('✓ 收到订单删除通知');
      console.log('订单号:', message.orderId);
      // 刷新订单和统计数据
      refreshOrderData();
      refreshDashboardData();
      break;

    case 'order_cancelled':
      console.log('✓ 收到订单取消通知');
      console.log('订单号:', message.orderId);
      // 刷新订单和统计数据
      refreshOrderData();
      refreshDashboardData();
      break;

    case 'data_update':
      console.log('✓ 收到数据更新通知');
      // 刷新所有数据
      refreshAllData();
      break;

    case 'pong':
      // 心跳响应，无需处理
      console.log('✓ 收到心跳响应');
      break;

    case 'server_shutdown':
      console.log('⚠️  服务器正在关闭');
      break;

    default:
      console.log('✗ 未知消息类型:', message.type);
  }
  console.log('===== 消息处理完成 =====');
}

/**
 * 刷新床位类型数据
 */
function refreshBedTypesData() {
  // 如果在床位管理页面，刷新数据
  const bedTypesPage = document.getElementById('page-bedTypes');
  if (bedTypesPage && bedTypesPage.classList.contains('active')) {
    if (typeof loadBedTypes === 'function') {
      loadBedTypes();
    }
  }
  // 如果在库存管理页面，刷新数据
  const inventoryPage = document.getElementById('page-inventory');
  if (inventoryPage && inventoryPage.classList.contains('active')) {
    if (typeof loadInventory === 'function') {
      loadInventory();
    }
  }
}

/**
 * 刷新设置数据
 */
function refreshSettingsData() {
  // 如果在设置页面，刷新数据
  const settingsPage = document.getElementById('page-settings');
  if (settingsPage && settingsPage.classList.contains('active')) {
    if (typeof loadSettings === 'function') {
      loadSettings();
    }
  }
}

/**
 * 刷新订单数据
 */
function refreshOrderData() {
  // 如果在订单页面，刷新数据
  const ordersPage = document.getElementById('page-orders');
  if (ordersPage && ordersPage.classList.contains('active')) {
    if (typeof loadOrders === 'function') {
      loadOrders();
    }
  }
}

/**
 * 刷新仪表盘数据
 */
function refreshDashboardData() {
  // 统计数据应该总是更新，即使不在数据概览页面
  // 这样可以确保统计数据显示始终是最新的
  if (typeof loadDashboard === 'function') {
    // 如果在数据概览页面，完全加载
    const dashboardPage = document.getElementById('page-dashboard');
    if (dashboardPage && dashboardPage.classList.contains('active')) {
      loadDashboard();
    } else {
      // 如果不在数据概览页面，只获取统计数据并更新DOM元素
      updateDashboardStats();
    }
  }
}

/**
 * 仅更新统计数据（不刷新整个页面）
 */
async function updateDashboardStats() {
  try {
    const statsResponse = await getStats();
    if (statsResponse.code === 200) {
      const data = statsResponse.data;

      // 更新统计卡片（如果DOM元素存在）
      const totalOrdersEl = document.getElementById('stat-total-orders');
      if (totalOrdersEl) totalOrdersEl.textContent = data.totalOrders || 0;

      const totalDepositEl = document.getElementById('stat-total-deposit');
      if (totalDepositEl) totalDepositEl.textContent = `¥${data.totalDeposit || 0}`;

      const paidEl = document.getElementById('stat-paid');
      if (paidEl) paidEl.textContent = data.paidOrders || 0;

      const unpaidEl = document.getElementById('stat-unpaid');
      if (unpaidEl) unpaidEl.textContent = data.unpaidOrders || 0;

      const refundedEl = document.getElementById('stat-refunded');
      if (refundedEl) refundedEl.textContent = data.refundedOrders || 0;

      console.log('统计数据已更新:', data);
    }
  } catch (error) {
    console.error('更新统计数据失败:', error);
  }
}

/**
 * 刷新所有数据
 */
function refreshAllData() {
  refreshBedTypesData();
  refreshSettingsData();
  refreshOrderData();
  refreshDashboardData();
}

/**
 * 更新WebSocket连接状态显示
 */
function updateWsStatus(connected) {
  const wsStatusEl = document.getElementById('ws-status');
  if (wsStatusEl) {
    if (connected) {
      wsStatusEl.className = 'ws-status ws-connected';
      wsStatusEl.textContent = '🟢 已连接';
    } else {
      wsStatusEl.className = 'ws-status ws-disconnected';
      wsStatusEl.textContent = '🔴 未连接';
    }
  }
}

/**
 * 关闭WebSocket连接
 */
function closeWebSocket() {
  stopHeartbeat();
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  updateWsStatus(false);
}

// 页面加载时自动连接WebSocket
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
  });
} else {
  connectWebSocket();
}

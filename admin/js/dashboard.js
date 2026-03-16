// 加载统计数据
async function loadDashboard() {
  try {
    // 获取统计数据
    const statsResponse = await getStats();
    if (statsResponse.code === 200) {
      const data = statsResponse.data;

      // 更新统计卡片
      document.getElementById('stat-total-orders').textContent = data.totalOrders || 0;
      document.getElementById('stat-total-deposit').textContent = `¥${data.totalDeposit || 0}`;
      document.getElementById('stat-paid').textContent = data.paidOrders || 0;
      document.getElementById('stat-unpaid').textContent = data.unpaidOrders || 0;
      document.getElementById('stat-refunded').textContent = data.refundedOrders || 0;

      // 更新订单状态图表
      updateOrderStatusChart(data);
    }

    // 获取床位总数
    const bedTypesResponse = await getBedTypes();
    if (bedTypesResponse.code === 200) {
      document.getElementById('stat-total-beds').textContent = bedTypesResponse.data.length;
    }

    // 加载近期订单
    loadRecentOrders();

  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

// 更新订单状态图表
function updateOrderStatusChart(data) {
  const chartContainer = document.getElementById('order-status-chart');
  const total = data.totalOrders || 1;

  const paidPercent = ((data.paidOrders || 0) / total * 100).toFixed(1);
  const unpaidPercent = ((data.unpaidOrders || 0) / total * 100).toFixed(1);
  const refundedPercent = ((data.refundedOrders || 0) / total * 100).toFixed(1);

  chartContainer.innerHTML = `
    <div style="display: flex; justify-content: space-around; align-items: flex-start; padding: 20px 0;">
      <div style="text-align: center; flex: 1;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: #07C160; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin: 0 auto;">
          ${paidPercent}%
        </div>
        <p style="margin-top: 10px; color: #666;">已支付</p>
        <p style="font-size: 20px; font-weight: bold; color: #07C160;">${data.paidOrders || 0}</p>
      </div>

      <div style="text-align: center; flex: 1;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: #ff6b35; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin: 0 auto;">
          ${unpaidPercent}%
        </div>
        <p style="margin-top: 10px; color: #666;">待支付</p>
        <p style="font-size: 20px; font-weight: bold; color: #ff6b35;">${data.unpaidOrders || 0}</p>
      </div>

      <div style="text-align: center; flex: 1;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: #2196f3; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin: 0 auto;">
          ${refundedPercent}%
        </div>
        <p style="margin-top: 10px; color: #666;">已退还</p>
        <p style="font-size: 20px; font-weight: bold; color: #2196f3;">${data.refundedOrders || 0}</p>
      </div>
    </div>
  `;
}

// 加载近期订单
async function loadRecentOrders() {
  try {
    const response = await getOrders();
    if (response.code === 200) {
      const orders = response.data || [];
      const recentOrders = orders.slice(0, 10); // 最近10条

      const container = document.getElementById('recent-orders-list');
      
      if (recentOrders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">暂无订单</p>';
        return;
      }

      container.innerHTML = recentOrders.map(order => `
        <div class="order-item">
          <div class="order-item-header">
            <span class="order-item-id">${order.orderId}</span>
            <span class="order-item-status status-${order.status}">${getStatusText(order.status)}</span>
          </div>
          <div class="order-item-info">
            押金: ¥${order.totalDeposit} | ${order.createTime}
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('加载近期订单失败:', error);
  }
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'unpaid': '待支付',
    'paid': '已支付',
    'refunded': '已退还'
  };
  return statusMap[status] || status;
}

// 订单数据
let allOrders = [];

// 加载订单列表
async function loadOrders() {
  try {
    const response = await getOrders();
    if (response.code === 200) {
      allOrders = response.data || [];
      renderOrders(allOrders);
    }
  } catch (error) {
    console.error('加载订单失败:', error);
    showError('加载订单失败');
  }
}

// 渲染订单列表
function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">暂无订单</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.orderId}</td>
      <td>
        ${order.beds.map(bed => `
          <div style="margin-bottom: 4px;">
            ${bed.name} x${bed.quantity}
          </div>
        `).join('')}
      </td>
      <td>¥${order.totalDeposit}</td>
      <td>
        <span class="order-item-status status-${order.status}">${getStatusText(order.status)}</span>
      </td>
      <td>${order.createTime}</td>
      <td>
        <button class="btn btn-sm" onclick="viewOrder('${order.orderId}')">查看</button>
        ${order.status === 'paid' ? `
          <button class="btn btn-sm btn-success" onclick="handleRefund('${order.orderId}')">退还</button>
        ` : ''}
        <button class="btn btn-sm btn-danger" onclick="handleDeleteOrder('${order.orderId}')">删除</button>
      </td>
    </tr>
  `).join('');
}

// 搜索订单
function searchOrders() {
  const searchValue = document.getElementById('order-search').value.trim();
  
  if (!searchValue) {
    renderOrders(allOrders);
    return;
  }

  const filteredOrders = allOrders.filter(order =>
    order.orderId.toLowerCase().includes(searchValue.toLowerCase())
  );
  
  renderOrders(filteredOrders);
}

// 过滤订单
function filterOrders() {
  const filterValue = document.getElementById('order-filter').value;
  
  if (filterValue === 'all') {
    renderOrders(allOrders);
  } else {
    const filteredOrders = allOrders.filter(order => order.status === filterValue);
    renderOrders(filteredOrders);
  }
}

// 查看订单详情
async function viewOrder(orderId) {
  try {
    const response = await getOrder(orderId);
    if (response.code === 200) {
      const order = response.data;
      
      showModal(`
        <h3>订单详情</h3>
        <div style="margin-top: 20px;">
          <p><strong>订单号：</strong>${order.orderId}</p>
          <p><strong>状态：</strong>${getStatusText(order.status)}</p>
          <p><strong>创建时间：</strong>${order.createTime}</p>
          <p><strong>总押金：</strong>¥${order.totalDeposit}</p>
          
          <h4 style="margin: 20px 0 10px 0;">床位信息</h4>
          ${order.beds.map(bed => `
            <div style="background: #f9f9f9; padding: 10px; margin-bottom: 10px; border-radius: 6px;">
              <p><strong>${bed.name}</strong></p>
              <p>数量: ${bed.quantity}</p>
              <p>单价: ¥${bed.price}/天</p>
              <p>押金: ¥${bed.deposit}</p>
            </div>
          `).join('')}
          
          ${order.transactionId ? `<p style="margin-top: 20px;"><strong>微信交易号：</strong>${order.transactionId}</p>` : ''}
          ${order.refundTime ? `<p><strong>退还时间：</strong>${order.refundTime}</p>` : ''}
        </div>
      `);
    } else {
      showError('获取订单详情失败');
    }
  } catch (error) {
    console.error('查看订单失败:', error);
    showError('获取订单详情失败');
  }
}

// 处理退还押金
async function handleRefund(orderId) {
  if (!confirm('确认退还该订单押金吗？')) {
    return;
  }

  try {
    const response = await refundOrder(orderId);
    if (response.code === 200) {
      showSuccess('押金退还成功');
      loadOrders();

      // 通知小程序刷新数据
      await notifyMiniprogramRefresh('order_refunded', { orderId });
    } else {
      showError(response.message || '退还失败');
    }
  } catch (error) {
    console.error('退还押金失败:', error);
    showError('退还失败');
  }
}

// 处理删除订单
async function handleDeleteOrder(orderId) {
  if (!confirm('确认删除该订单吗？此操作不可恢复！')) {
    return;
  }

  try {
    const response = await deleteOrder(orderId);
    if (response.code === 200) {
      showSuccess('订单删除成功');
      loadOrders();

      // 通知小程序刷新数据（虽然删除订单通常不影响库存，但保持一致性）
      await notifyMiniprogramRefresh('data_update', { type: 'order_delete', orderId });
    } else {
      showError(response.message || '删除失败');
    }
  } catch (error) {
    console.error('删除订单失败:', error);
    showError('删除失败');
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

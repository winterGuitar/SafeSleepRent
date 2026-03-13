// 加载库存信息
async function loadInventory() {
  try {
    const response = await getInventory();
    if (response.code === 200) {
      renderInventory(response.data || []);
    }
  } catch (error) {
    console.error('加载库存失败:', error);
    showError('加载库存失败');
  }
}

// 渲染库存列表
function renderInventory(inventoryData) {
  const container = document.getElementById('inventory-list');
  
  if (inventoryData.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无库存数据</p>';
    return;
  }

  container.innerHTML = inventoryData.map(item => `
    <div class="inventory-item">
      <div class="inventory-info">
        <h4>${item.name}</h4>
        <p>状态: ${item.available ? '可用' : '不可用'}</p>
      </div>
      <div class="inventory-stock">
        <div>
          <span class="stock-number ${item.isLowStock ? 'stock-warning' : 'stock-ok'}">${item.stock}</span>
          <span class="stock-label">可用</span>
        </div>
        ${item.isLowStock ? `
          <div style="color: #ff4757; font-size: 14px;">
            ⚠️ 库存不足
          </div>
        ` : `
          <div style="color: #07C160; font-size: 14px;">
            ✓ 库存充足
          </div>
        `}
        <button class="btn btn-sm" onclick="showStockModal(${item.id}, '${item.name}', ${item.stock})">调整库存</button>
      </div>
    </div>
  `).join('');
}

// 显示库存调整弹窗
function showStockModal(id, name, currentStock) {
  showModal(`
    <h3>调整库存</h3>
    <form onsubmit="handleUpdateStock(event, ${id})">
      <div class="form-group">
        <label>床位名称</label>
        <input type="text" value="${name}" disabled style="background: #f5f5f5;">
      </div>
      <div class="form-group">
        <label>当前库存</label>
        <input type="number" value="${currentStock}" disabled style="background: #f5f5f5;">
      </div>
      <div class="form-group">
        <label>新库存数量 *</label>
        <input type="number" id="new-stock" required min="0">
      </div>
      <div class="form-group">
        <label>调整原因</label>
        <select id="stock-reason">
          <option value="purchase">进货补充</option>
          <option value="damage">损坏报废</option>
          <option value="maintenance">维修中</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="stock-note" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px; min-height: 60px;" placeholder="请输入备注信息（可选）"></textarea>
      </div>
      <div style="text-align: right; margin-top: 20px;">
        <button type="button" class="btn" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">确认调整</button>
      </div>
    </form>
  `);
}

// 处理库存更新
async function handleUpdateStock(event, id) {
  event.preventDefault();

  const newStock = parseInt(document.getElementById('new-stock').value);
  const reason = document.getElementById('stock-reason').value;
  const note = document.getElementById('stock-note').value;

  try {
    const response = await updateInventory(id, newStock);
    console.log('库存更新响应:', response);

    if (response.code === 200) {
      showSuccess('库存调整成功');
      closeModal();
      loadInventory();

      // 后端已经在 updateBedType 中广播消息了，不需要再次通知
      // 但为了保险起见，可以再次触发通知
      console.log('发送库存更新通知到小程序');
    } else {
      showError(response.message || '库存调整失败');
    }
  } catch (error) {
    console.error('库存调整失败:', error);
    showError('库存调整失败');
  }
}

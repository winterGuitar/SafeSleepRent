// 床位类型数据
let allBedTypes = [];

// 加载床位类型
async function loadBedTypes() {
  try {
    const response = await getBedTypes();
    if (response.code === 200) {
      allBedTypes = response.data || [];
      renderBedTypes(allBedTypes);
    }
  } catch (error) {
    console.error('加载床位类型失败:', error);
    showError('加载床位类型失败');
  }
}

// 渲染床位类型
function renderBedTypes(bedTypes) {
  const container = document.getElementById('bed-types-grid');
  
  if (bedTypes.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">暂无床位类型</p>';
    return;
  }

  container.innerHTML = bedTypes.map(bed => `
    <div class="bed-card">
      <div class="bed-card-header">
        <div>
          <div class="bed-card-title">${bed.name}</div>
          <div style="color: #666; font-size: 14px; margin-top: 5px;">${bed.code}</div>
        </div>
        <div class="bed-card-price">
          ¥${bed.price}
          <small>/天</small>
        </div>
      </div>
      
      <div class="bed-card-info">
        <p>${bed.description}</p>
        <p>押金: ¥${bed.deposit}</p>
        <p>库存: ${bed.stock}</p>
        <p>状态: ${bed.available ? '<span style="color: #07C160;">可用</span>' : '<span style="color: #999;">不可用</span>'}</p>
      </div>
      
      <div class="bed-card-features">
        ${bed.features.map(feature => `<span class="bed-tag">${feature}</span>`).join('')}
      </div>
      
      <div class="bed-card-actions">
        <button class="btn" onclick="editBedType(${bed.id})">编辑</button>
        <button class="btn btn-danger" onclick="deleteBedType(${bed.id})">删除</button>
      </div>
    </div>
  `).join('');
}

// 显示添加床位弹窗
function showAddBedModal() {
  showModal(`
    <h3>添加床位类型</h3>
    <form id="bed-form" onsubmit="saveBedType(event)">
      <div class="form-group">
        <label>床位名称 *</label>
        <input type="text" id="bed-name" required>
      </div>
      <div class="form-group">
        <label>床位代码 *</label>
        <input type="text" id="bed-code" required>
      </div>
      <div class="form-group">
        <label>描述 *</label>
        <textarea id="bed-description" required style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px; min-height: 80px;"></textarea>
      </div>
      <div class="form-group">
        <label>日租金（元）*</label>
        <input type="number" id="bed-price" required min="1">
      </div>
      <div class="form-group">
        <label>押金（元）*</label>
        <input type="number" id="bed-deposit" required min="0">
      </div>
      <div class="form-group">
        <label>库存数量 *</label>
        <input type="number" id="bed-stock" required min="0">
      </div>
      <div class="form-group">
        <label>图片路径</label>
        <input type="text" id="bed-image" value="/images/bed.png">
      </div>
      <div class="form-group">
        <label>特性（用逗号分隔）</label>
        <input type="text" id="bed-features" placeholder="特性1, 特性2, 特性3">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="bed-available" checked> 可用
        </label>
      </div>
      <div style="text-align: right; margin-top: 20px;">
        <button type="button" class="btn" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  `);
}

// 保存床位类型
async function saveBedType(event) {
  event.preventDefault();

  const bedData = {
    name: document.getElementById('bed-name').value,
    code: document.getElementById('bed-code').value,
    description: document.getElementById('bed-description').value,
    price: parseInt(document.getElementById('bed-price').value),
    deposit: parseInt(document.getElementById('bed-deposit').value),
    stock: parseInt(document.getElementById('bed-stock').value),
    image: document.getElementById('bed-image').value,
    features: document.getElementById('bed-features').value
      .split(',')
      .map(f => f.trim())
      .filter(f => f),
    available: document.getElementById('bed-available').checked
  };

  try {
    const response = await createBedType(bedData);
    if (response.code === 200) {
      showSuccess('床位类型添加成功');
      closeModal();
      loadBedTypes();

      // 通知小程序刷新数据
      await notifyMiniprogramRefresh('bed_types_update', { action: 'add', data: bedData });
    } else {
      showError(response.message || '添加失败');
    }
  } catch (error) {
    console.error('添加床位类型失败:', error);
    showError('添加床位类型失败');
  }
}

// 编辑床位类型
function editBedType(id) {
  const bed = allBedTypes.find(b => b.id === id);
  if (!bed) {
    showError('床位类型不存在');
    return;
  }

  showModal(`
    <h3>编辑床位类型</h3>
    <form id="bed-form" onsubmit="updateBedType(event, ${id})">
      <div class="form-group">
        <label>床位名称 *</label>
        <input type="text" id="bed-name" value="${bed.name}" required>
      </div>
      <div class="form-group">
        <label>床位代码 *</label>
        <input type="text" id="bed-code" value="${bed.code}" required>
      </div>
      <div class="form-group">
        <label>描述 *</label>
        <textarea id="bed-description" required style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px; min-height: 80px;">${bed.description}</textarea>
      </div>
      <div class="form-group">
        <label>日租金（元）*</label>
        <input type="number" id="bed-price" value="${bed.price}" required min="1">
      </div>
      <div class="form-group">
        <label>押金（元）*</label>
        <input type="number" id="bed-deposit" value="${bed.deposit}" required min="0">
      </div>
      <div class="form-group">
        <label>库存数量 *</label>
        <input type="number" id="bed-stock" value="${bed.stock}" required min="0">
      </div>
      <div class="form-group">
        <label>图片路径</label>
        <input type="text" id="bed-image" value="${bed.image}">
      </div>
      <div class="form-group">
        <label>特性（用逗号分隔）</label>
        <input type="text" id="bed-features" value="${bed.features.join(', ')}">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="bed-available" ${bed.available ? 'checked' : ''}> 可用
        </label>
      </div>
      <div style="text-align: right; margin-top: 20px;">
        <button type="button" class="btn" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  `);
}

// 更新床位类型
async function updateBedType(event, id) {
  event.preventDefault();

  const bedData = {
    name: document.getElementById('bed-name').value,
    code: document.getElementById('bed-code').value,
    description: document.getElementById('bed-description').value,
    price: parseInt(document.getElementById('bed-price').value),
    deposit: parseInt(document.getElementById('bed-deposit').value),
    stock: parseInt(document.getElementById('bed-stock').value),
    image: document.getElementById('bed-image').value,
    features: document.getElementById('bed-features').value
      .split(',')
      .map(f => f.trim())
      .filter(f => f),
    available: document.getElementById('bed-available').checked
  };

  try {
    const response = await updateBedTypeApi(id, bedData);
    if (response.code === 200) {
      showSuccess('床位类型更新成功');
      closeModal();
      loadBedTypes();

      // 通知小程序刷新数据
      await notifyMiniprogramRefresh('bed_types_update', { action: 'update', data: bedData });
    } else {
      showError(response.message || '更新失败');
    }
  } catch (error) {
    console.error('更新床位类型失败:', error);
    showError('更新床位类型失败');
  }
}

// 删除床位类型
async function deleteBedType(id) {
  if (!confirm('确认删除该床位类型吗？此操作不可恢复！')) {
    return;
  }

  try {
    const response = await deleteBedTypeApi(id);
    if (response.code === 200) {
      showSuccess('床位类型删除成功');
      loadBedTypes();

      // 通知小程序刷新数据
      await notifyMiniprogramRefresh('bed_types_update', { action: 'delete', data: { id } });
    } else {
      showError(response.message || '删除失败');
    }
  } catch (error) {
    console.error('删除床位类型失败:', error);
    showError('删除床位类型失败');
  }
}

// 床位类型数据
let allBedTypes = [];

// 加载床位类型
async function loadBedTypes() {
  try {
    const response = await getBedTypes();
    if (response.code === 200) {
      allBedTypes = (response.data || []).sort((a, b) => {
        // 先按价格从低到高排序
        if (a.price !== b.price) {
          return a.price - b.price;
        }
        // 价格相同时，按库存从低到高排序
        return a.stock - b.stock;
      });
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

  container.innerHTML = bedTypes.map(bed => {
    const imageUrl = bed.imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="14"%3E暂无图片%3C/text%3E%3C/svg%3E';

    return `
    <div class="bed-card">
      <div class="bed-card-image">
        <img src="${imageUrl}" alt="${bed.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22%3E暂无图片%3C/text%3E%3C/svg%3E'">
      </div>
      <div class="bed-card-content">
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
    </div>
  `;
  }).join('');
}

// 图片预览
function previewImage(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('image-preview');
      const img = preview.querySelector('img');
      img.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

// 显示加载提示
function showLoading(message) {
  const existing = document.getElementById('loading-overlay');
  if (!existing) {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    overlay.innerHTML = `<div style="background: white; padding: 20px 40px; border-radius: 8px; font-size: 16px;">${message}</div>`;
    document.body.appendChild(overlay);
  }
}

// 隐藏加载提示
function hideLoading() {
  const existing = document.getElementById('loading-overlay');
  if (existing) {
    existing.remove();
  }
}

// 上传床位图片
async function uploadBedImage() {
  const fileInput = document.getElementById('bed-image-file');
  const file = fileInput.files[0];

  if (!file) {
    showError('请选择要上传的图片');
    return;
  }

  try {
    showLoading('上传中...');

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/upload/bedImage`, {
      method: 'POST',
      headers: getAuthToken() ? {
        Authorization: `Bearer ${getAuthToken()}`
      } : {},
      body: formData
    });

    const result = await response.json();

    if (result.code === 200) {
      document.getElementById('bed-image').value = result.data.url;
      showSuccess('图片上传成功');
    } else {
      showError(result.message || '上传失败');
    }
  } catch (error) {
    console.error('上传图片失败:', error);
    showError('上传图片失败');
  } finally {
    hideLoading();
  }
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
        <label>床位图片</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="file" id="bed-image-file" accept="image/*" onchange="previewImage(this)">
          <button type="button" class="btn" onclick="uploadBedImage()">上传图片</button>
        </div>
        <input type="hidden" id="bed-image" value="">
        <div id="image-preview" style="margin-top: 10px; max-width: 200px; max-height: 200px; display: none;">
          <img src="" alt="预览" style="max-width: 100%; max-height: 100%; border-radius: 4px;">
        </div>
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

  const currentImageUrl = bed.imageUrl || '';

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
        <label>床位图片</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="file" id="bed-image-file" accept="image/*" onchange="previewImage(this)">
          <button type="button" class="btn" onclick="uploadBedImage()">上传图片</button>
        </div>
        <input type="hidden" id="bed-image" value="${currentImageUrl}">
        <div id="image-preview" style="margin-top: 10px; max-width: 200px; max-height: 200px;">
          ${currentImageUrl ? `<img src="${currentImageUrl}" alt="当前图片" style="max-width: 100%; max-height: 100%; border-radius: 4px;">` : ''}
        </div>
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

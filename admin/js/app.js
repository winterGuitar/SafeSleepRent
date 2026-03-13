// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  initNavigation();
  loadPage('dashboard');
});

// 导航初始化
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const pageName = this.getAttribute('data-page');
      navigateTo(pageName);
    });
  });
}

// 页面导航
function navigateTo(pageName) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === pageName) {
      item.classList.add('active');
    }
  });

  // 更新页面标题
  const titles = {
    'dashboard': '数据概览',
    'orders': '订单管理',
    'bedTypes': '床位管理',
    'inventory': '库存管理',
    'settings': '系统设置'
  };
  document.getElementById('page-title').textContent = titles[pageName] || '数据概览';

  // 加载页面内容
  loadPage(pageName);
}

// 加载页面
function loadPage(pageName) {
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // 显示目标页面
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add('active');

    // 根据页面类型加载不同数据
    switch(pageName) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'orders':
        loadOrders();
        break;
      case 'bedTypes':
        loadBedTypes();
        break;
      case 'inventory':
        loadInventory();
        break;
      case 'settings':
        loadSettings();
        break;
    }
  }
}

// 显示弹窗
function showModal(content) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = content;
  modal.classList.add('show');
}

// 关闭弹窗
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('show');
}

// 点击弹窗外部关闭
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeModal();
  }
});

// 显示成功提示
function showSuccess(message) {
  showToast(message, 'success');
}

// 显示错误提示
function showError(message) {
  showToast(message, 'error');
}

// 显示提示
function showToast(message, type = 'info') {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // 添加样式
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${type === 'success' ? '#07C160' : type === 'error' ? '#ff4757' : '#667eea'};
    color: #fff;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 3000;
    animation: slideInRight 0.3s ease;
  `;
  
  // 添加到页面
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

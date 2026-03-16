// 用户认证相关
let currentUser = null;

// 默认管理员账号密码
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123'
};

// 检查登录状态
function checkAuth() {
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');

  if (token && user) {
    try {
      currentUser = JSON.parse(user);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// 显示登录页面
function showLoginPage() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('main-page').style.display = 'none';
}

// 显示主页面
function showMainPage() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-page').style.display = 'block';

  // 更新用户信息
  if (currentUser) {
    document.getElementById('current-user').textContent = currentUser.username;
  }

  // 初始化应用
  if (typeof initApp === 'function') {
    initApp();
  }
}

// 处理登录
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showError('请输入用户名和密码');
    return;
  }

  // 简单验证（实际项目应该调用后端API）
  if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
    // 登录成功
    currentUser = {
      username: username,
      loginTime: new Date().toISOString()
    };

    // 存储到localStorage
    localStorage.setItem('auth_token', Date.now().toString());
    localStorage.setItem('auth_user', JSON.stringify(currentUser));

    showSuccess('登录成功');
    showMainPage();

    // 初始化应用
    if (typeof initApp === 'function') {
      initApp();
    }
  } else {
    showError('用户名或密码错误');
  }
}

// 处理退出登录
function handleLogout() {
  if (!confirm('确定要退出登录吗？')) {
    return;
  }

  // 清除本地存储
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  currentUser = null;

  showSuccess('已退出登录');
  showLoginPage();
}

// 初始化认证检查
function initAuth() {
  if (checkAuth()) {
    showMainPage();
  } else {
    showLoginPage();
  }
}

// 页面加载时检查认证
document.addEventListener('DOMContentLoaded', function() {
  initAuth();
});

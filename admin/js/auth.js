// 用户认证相关
let currentUser = null;

// 检查登录状态
function checkAuth() {
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');

  if (token && user) {
    try {
      currentUser = JSON.parse(user);
      if (currentUser.expiresAt && currentUser.expiresAt < Date.now()) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        currentUser = null;
        return false;
      }
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

  if (typeof connectWebSocket === 'function') {
    connectWebSocket();
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

  try {
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (result.code !== 200 || !result.data || !result.data.token) {
      showError(result.message || '用户名或密码错误');
      return;
    }

    currentUser = {
      ...(result.data.user || { username }),
      loginTime: new Date().toISOString(),
      expiresAt: result.data.expiresAt
    };

    localStorage.setItem('auth_token', result.data.token);
    localStorage.setItem('auth_user', JSON.stringify(currentUser));

    showSuccess('登录成功');
    showMainPage();
  } catch (error) {
    console.error('Admin login failed:', error);
    showError('登录失败，请检查服务端连接');
  }
}

// 处理退出登录
function handleLogout() {
  if (!confirm('确定要退出登录吗？')) {
    return;
  }

  if (typeof closeWebSocket === 'function') {
    closeWebSocket();
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

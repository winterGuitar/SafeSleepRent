# 医院租床系统 - 部署指南

## 目录

- [环境准备](#环境准备)
- [后端部署](#后端部署)
- [前端部署](#前端部署)
- [生产环境配置](#生产环境配置)
- [常见问题](#常见问题)

---

## 环境准备

### 必需软件

1. **Node.js** (v14 或更高版本)
   - 下载地址：https://nodejs.org/
   - 安装后验证：`node -v` 和 `npm -v`

2. **MySQL** (v5.7 或更高版本)
   - 下载地址：https://dev.mysql.com/downloads/mysql/
   - 推荐使用 MySQL 8.0

3. **微信开发者工具**
   - 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 端口说明

- 后端服务端口：`3000`
- WebSocket 端口：`3000`（与后端共用）
- 前端服务端口：`8080`（或自行配置）

---

## 后端部署

### 1. 安装依赖

进入后端目录并安装依赖：

```bash
cd server
npm install
```

### 2. 配置数据库

#### 2.1 创建数据库

登录 MySQL：

```bash
mysql -u root -p
```

创建数据库：

```sql
CREATE DATABASE hosp_bed DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hosp_bed;

-- 创建订单表
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) UNIQUE NOT NULL,
  openid VARCHAR(100) NOT NULL,
  beds JSON NOT NULL,
  total_deposit DECIMAL(10, 2) NOT NULL,
  status ENUM('unpaid', 'paid', 'refunded', 'cancelled') DEFAULT 'unpaid',
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  pay_time DATETIME,
  refund_time DATETIME,
  transaction_id VARCHAR(100),
  INDEX idx_openid (openid),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 2.2 修改数据库配置

编辑 `server/config/appConfig.js`：

```javascript
database: {
  type: 'mysql',
  mysql: {
    host: 'localhost',        // 数据库地址
    port: 3306,             // 数据库端口
    database: 'hosp_bed',     // 数据库名
    username: 'root',         // 用户名
    password: '你的密码',     // 密码
    connectionLimit: 10
  }
}
```

### 3. 配置服务器参数

编辑 `server/config/appConfig.js`：

```javascript
server: {
  port: 3000,
  host: '0.0.0.0',         // 生产环境使用 0.0.0.0 监听所有接口
  domain: 'your-domain.com',  // 修改为实际域名
  https: false               // 如果使用 HTTPS，设置为 true
}
```

### 4. 配置小程序参数

编辑 `server/config/appConfig.js`：

```javascript
miniprogram: {
  loginUrl: 'https://api.weixin.qq.com/sns/jscode2session',
  sessionSecret: 'your_appsecret',  // 从微信小程序后台获取
  tokenExpire: 7200
}
```

获取 AppSecret：
1. 登录微信公众平台：https://mp.weixin.qq.com/
2. 进入「开发」→「开发管理」→「开发设置」
3. 复制 AppID 和 AppSecret

### 5. 创建必要目录

```bash
cd server
mkdir -p public/images
mkdir -p logs
```

### 6. 启动后端服务

#### 开发环境

```bash
cd server
npm run dev
```

#### 生产环境

```bash
cd server
npm start
```

或者使用 PM2 进程管理（推荐）：

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name "safesleep-server"

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs safesleep-server

# 重启服务
pm2 restart safesleep-server
```

### 7. 验证后端部署

访问以下地址验证：

```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试获取床位列表
curl http://localhost:3000/api/bedTypes
```

---

## 前端部署

### 方式一：直接部署静态文件

#### 1. 准备前端文件

前端管理后台位于 `admin` 目录，是纯静态文件。

#### 2. 使用 Nginx 部署

创建 Nginx 配置文件 `/etc/nginx/conf.d/safesleep-admin.conf`：

```nginx
server {
    listen 80;
    server_name admin.your-domain.com;  # 修改为实际域名

    # 前端静态文件
    root /path/to/SafeSleepRent/admin;
    index index.html;

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 反向代理到后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 反向代理
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # 图片文件访问
    location /public/ {
        proxy_pass http://localhost:3000;
    }
}
```

重启 Nginx：

```bash
sudo nginx -t          # 测试配置
sudo systemctl reload nginx
```

#### 3. 使用 Apache 部署

创建 `.htaccess` 文件在 `admin` 目录：

```apache
RewriteEngine On

# API 反向代理
RewriteRule ^api/(.*)$ http://localhost:3000/api/$1 [P,L]

# WebSocket
RewriteRule ^ws/(.*)$ ws://localhost:3000/ws/$1 [P,L]

# 图片文件
RewriteRule ^public/(.*)$ http://localhost:3000/public/$1 [P,L]
```

### 方式二：使用 Node.js 服务器

#### 1. 创建简单 HTTP 服务器

在项目根目录创建 `admin-server.js`：

```javascript
const express = require('express');
const path = require('path');
const proxy = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'admin')));

// API 代理
app.use('/api', proxy({
  target: 'http://localhost:3000',
  changeOrigin: true
}));

// WebSocket 代理
app.use('/ws', proxy({
  target: 'ws://localhost:3000',
  ws: true
}));

// 图片代理
app.use('/public', proxy({
  target: 'http://localhost:3000',
  changeOrigin: true
}));

// SPA 路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`管理后台运行在 http://localhost:${PORT}`);
});
```

#### 2. 安装依赖并启动

```bash
npm install -g http-proxy-middleware
node admin-server.js
```

### 方式三：使用 Docker 部署

#### 1. 创建 Dockerfile

**后端 Dockerfile** (`server/Dockerfile`)：

```dockerfile
FROM node:16-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制代码
COPY . .

# 创建必要目录
RUN mkdir -p public/images logs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
```

**前端 Dockerfile** (`admin/Dockerfile`)：

```dockerfile
FROM nginx:alpine

# 复制静态文件
COPY . /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 2. 创建 docker-compose.yml

在项目根目录创建：

```yaml
version: '3.8'

services:
  # MySQL 数据库
  mysql:
    image: mysql:8.0
    container_name: safesleep-mysql
    environment:
      MYSQL_ROOT_PASSWORD: 123456
      MYSQL_DATABASE: hosp_bed
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./server/database/init.sql:/docker-entrypoint-initdb.d/init.sql

  # 后端服务
  backend:
    build: ./server
    container_name: safesleep-backend
    ports:
      - "3000:3000"
    depends_on:
      - mysql
    volumes:
      - ./server/public:/app/public
      - ./server/logs:/app/logs
    environment:
      NODE_ENV: production
    restart: unless-stopped

  # 前端管理后台
  admin:
    build: ./admin
    container_name: safesleep-admin
    ports:
      - "8080:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mysql-data:
```

#### 3. 启动 Docker 容器

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 生产环境配置

### 1. 环境变量配置

创建 `.env` 文件在 `server` 目录：

```env
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hosp_bed
DB_USER=root
DB_PASSWORD=your_password
SERVER_PORT=3000
DOMAIN=your-domain.com
```

修改 `server/config/appConfig.js` 使用环境变量：

```javascript
module.exports = {
  server: {
    port: process.env.SERVER_PORT || 3000,
    domain: process.env.DOMAIN || 'localhost',
    https: process.env.NODE_ENV === 'production'
  },
  database: {
    mysql: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'hosp_bed',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456'
    }
  }
};
```

### 2. 安全配置

#### 2.1 配置防火墙

```bash
# 仅开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

#### 2.2 使用 HTTPS

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d admin.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

#### 2.3 修改 Nginx 配置支持 HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name admin.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/admin.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.your-domain.com/privkey.pem;

    # 其他配置...
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name admin.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. 日志管理

#### 3.1 配置日志轮转

创建 `/etc/logrotate.d/safesleep`：

```
/server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reload safesleep-server
    endscript
}
```

#### 3.2 查看日志

```bash
# PM2 日志
pm2 logs safesleep-server

# 系统日志
tail -f /server/logs/app.log

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 4. 性能优化

#### 4.1 Nginx 缓存配置

```nginx
# 添加到 http 块
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

server {
    # 缓存配置
    location /api/bedTypes {
        proxy_cache my_cache;
        proxy_cache_valid 200 5m;
        proxy_pass http://localhost:3000;
    }
}
```

#### 4.2 MySQL 优化

编辑 MySQL 配置文件 `/etc/mysql/my.cnf`：

```ini
[mysqld]
# 连接数
max_connections = 200

# 缓冲池大小（根据服务器内存调整）
innodb_buffer_pool_size = 1G

# 日志配置
innodb_log_file_size = 256M

# 查询缓存
query_cache_size = 64M
query_cache_type = 1
```

重启 MySQL：

```bash
sudo systemctl restart mysql
```

---

## 小程序部署

### 1. 上传小程序代码

1. 打开微信开发者工具
2. 导入项目，选择 `miniprogram` 目录
3. 修改 `miniprogram/config/api.js` 中的服务器地址：

```javascript
module.exports = {
  // 开发环境
  development: 'http://localhost:3000',

  // 生产环境
  production: 'https://your-domain.com',

  // 根据环境选择
  apiBaseUrl: function() {
    if (wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      return this.development;
    } else {
      return this.production;
    }
  }
};
```

4. 点击「上传」按钮，填写版本号和备注
5. 登录微信公众平台，提交审核

### 2. 配置服务器域名

在微信公众平台配置：
1. 进入「开发」→「开发管理」→「开发设置」
2. 配置服务器域名：
   - request 合法域名：`https://your-domain.com`
   - socket 合法域名：`wss://your-domain.com`
   - uploadFile 合法域名：`https://your-domain.com`

### 3. 测试小程序

使用真机调试功能测试：
- 预览 → 生成二维码 → 扫码预览

---

## 常见问题

### 1. 后端无法启动

**问题**：端口被占用

```bash
# 查看占用端口的进程
lsof -i :3000
netstat -ano | findstr :3000  # Windows

# 杀死进程
kill -9 PID
taskkill /PID PID /F  # Windows
```

**问题**：数据库连接失败

检查：
1. MySQL 服务是否启动
2. 用户名密码是否正确
3. 数据库是否存在

### 2. 前端无法访问 API

**问题**：CORS 错误

在 Nginx 配置中添加：

```nginx
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
add_header Access-Control-Allow-Headers 'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization';
```

### 3. WebSocket 连接失败

**问题**：WebSocket 无法连接

检查：
1. 确认使用 `ws://` 或 `wss://` 协议
2. Nginx 配置中正确代理 WebSocket
3. 防火墙允许 WebSocket 端口

### 4. 小程序无法上传图片

**问题**：上传失败

检查：
1. 配置 uploadFile 合法域名
2. 确认后端 `/api/upload/bedImage` 接口正常
3. 检查 `public/images` 目录权限

### 5. PM2 自动启动失败

```bash
# 重新设置开机自启
pm2 startup
pm2 save

# 检查服务状态
pm2 list
pm2 monit
```

---

## 快速部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash

echo "开始部署医院租床系统..."

# 1. 拉取最新代码
echo "1. 拉取最新代码..."
git pull

# 2. 安装后端依赖
echo "2. 安装后端依赖..."
cd server
npm install

# 3. 重启后端服务
echo "3. 重启后端服务..."
pm2 restart safesleep-server

# 4. 清理 Nginx 缓存
echo "4. 清理 Nginx 缓存..."
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx

echo "部署完成！"
echo "后端服务状态："
pm2 status
```

使用：

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 监控和维护

### 1. 健康检查

创建健康检查脚本 `health-check.sh`：

```bash
#!/bin/bash

# 检查后端服务
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ $BACKEND_STATUS -eq 200 ]; then
    echo "✓ 后端服务正常"
else
    echo "✗ 后端服务异常"
    # 发送告警通知
    pm2 restart safesleep-server
fi

# 检查 Nginx
if pgrep nginx > /dev/null; then
    echo "✓ Nginx 服务正常"
else
    echo "✗ Nginx 服务异常"
    sudo systemctl start nginx
fi
```

### 2. 数据库备份

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mysql"
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u root -p hosp_bed > $BACKUP_DIR/hosp_bed_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/hosp_bed_$DATE.sql

# 删除 30 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "数据库备份完成：$BACKUP_DIR/hosp_bed_$DATE.sql.gz"
```

定时备份：

```bash
# 添加到 crontab（每天凌晨 2 点备份）
crontab -e
0 2 * * * /path/to/backup.sh
```

---

## 总结

部署流程总结：

1. ✅ 安装必需软件（Node.js、MySQL）
2. ✅ 配置数据库并创建表结构
3. ✅ 修改后端配置文件
4. ✅ 启动后端服务（使用 PM2）
5. ✅ 部署前端静态文件（Nginx）
6. ✅ 配置 Nginx 反向代理
7. ✅ 配置 HTTPS（可选但推荐）
8. ✅ 上传小程序代码并配置域名
9. ✅ 测试所有功能

如有问题，请参考「常见问题」部分或查看日志文件。

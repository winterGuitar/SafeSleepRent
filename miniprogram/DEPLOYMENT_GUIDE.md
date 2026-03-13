# 小程序部署指南

## 开发环境配置

### 1. 微信开发者工具设置
在微信开发者工具中，开启以下选项：
- 右上角「详情」→「本地设置」
- 勾选 ✅ **「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**

### 2. 本地开发
确保后端服务已启动：
```bash
cd server
npm start
```

后端服务运行在 `http://localhost:3000`

## 生产环境配置

### 1. 域名要求
- 域名必须通过 **ICP 备案**
- 必须配置 **HTTPS 证书**（TLS 1.2 及以上版本）
- 证书信任链必须完整
- 不支持自签名证书

### 2. 小程序后台配置
登录 [微信公众平台](https://mp.weixin.qq.com/)，进入：
- 「开发」→「开发设置」→「服务器域名」

配置以下域名：

**request 合法域名**
```
https://yourdomain.com
```

**socket 合法域名**
```
wss://yourdomain.com
```

**注意：**
- 配置时域名必须以 `https://` 或 `wss://` 开头
- 不支持 IP 地址或 localhost
- 如果配置端口（如 `https://yourdomain.com:8080`），则请求时必须使用相同端口
- wss 域名无需配置端口，默认允许所有端口

### 3. 修改配置文件

编辑 `config/api.js`：

```javascript
const currentEnv = ENV.PROD  // 改为生产环境

apiConfig[ENV.PROD] = {
  baseURL: 'https://yourdomain.com',  // 替换为实际域名
  wsURL: 'wss://yourdomain.com/ws'    // 替换为实际域名
}
```

### 4. HTTPS 证书检查

使用以下命令检查证书是否符合要求：

```bash
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

检查项：
- 证书是否在有效期内
- 证书信任链是否完整
- TLS 版本是否支持 1.2 及以上

或使用在线工具检测：
- https://www.ssllabs.com/ssltest/
- https://myssl.com/

### 5. 后端服务部署

#### 方案一：使用 Nginx 反向代理
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 方案二：使用 Node.js HTTPS 服务器
在 `server/config/appConfig.js` 中配置：
```javascript
server: {
  port: 3000,
  host: '0.0.0.0',
  https: true,
  // 配置 SSL 证书路径
  ssl: {
    key: '/path/to/key.pem',
    cert: '/path/to/cert.pem'
  }
}
```

### 6. 上传发布

1. 在微信开发者工具中：
   - 点击「上传」
   - 填写版本号和项目备注

2. 登录微信公众平台：
   - 进入「版本管理」
   - 提交审核

### 7. 域名配置注意事项

1. **域名白名单**
   - 只能向配置过的域名发起请求
   - 不能请求 api.weixin.qq.com（相关接口需通过服务器端调用）

2. **端口规则**
   - https 域名：可以配置端口，但请求时必须使用相同端口
   - wss 域名：无需配置端口，允许所有端口

3. **DNS 预解析（可选）**
   - 在「开发设置」中可配置最多 5 个预解析域名
   - 预解析域名无需填写协议头
   - 可提升请求速度

## 常见问题

### Q1: 开发时提示"不在以下 request 合法域名列表中"
**A:** 在开发者工具中勾选「不校验合法域名...」选项

### Q2: 真机调试可以，正式版无法请求
**A:** 检查以下几点：
1. 是否在小程序后台配置了服务器域名
2. 域名是否使用 https 协议
3. 证书是否有效且信任链完整
4. TLS 版本是否支持 1.2 及以上

### Q3: 连接 WebSocket 失败
**A:**
1. 确认使用 wss 协议
2. 检查服务器是否支持 WebSocket
3. 确认 wss 域名已在小程序后台配置

### Q4: 证书验证失败
**A:**
1. 检查证书是否过期
2. 检查证书域名是否与访问域名一致
3. 检查证书信任链是否完整
4. iOS 设备不支持自签名证书

## 安全建议

1. 不要在小程序中存储敏感信息（如 AppSecret）
2. 所有需要使用 AppSecret 的接口应在服务器端调用
3. 使用 HTTPS/WSS 加密所有网络请求
4. 定期更新 SSL 证书
5. 开启 TLS 1.3（如服务器支持）

## 参考资料

- [微信小程序网络请求文档](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html)
- [HTTPS 证书配置](https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/domain.html)
- [WebSocket 文档](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.connectSocket.html)

# SafeSleep - 医院租床系统

一个完整的医院租床管理系统，包含微信小程序、后台管理系统和后端服务。

## 项目结构

```
e:/SafeSleep/
├── admin/              # 后台管理系统（Web前端）
│   ├── index.html      # 管理系统首页
│   ├── css/            # 样式文件
│   ├── js/             # JavaScript文件
│   └── package.json    # 前端依赖配置
│
├── server/             # 后端服务
│   ├── server.js       # 服务器入口文件
│   ├── routes/         # 路由文件
│   ├── config/         # 配置文件（后端配置）
│   │   ├── appConfig.js     # 应用主配置
│   │   └── bedTypes.js     # 床位类型配置
│   └── package.json    # 后端依赖配置
│
├── miniprogram/        # 微信小程序
│   ├── app.js          # 小程序入口
│   ├── app.json        # 小程序配置
│   ├── project.config.json  # 项目配置
│   ├── pages/          # 页面文件
│   │   ├── index/      # 首页（选择租床）
│   │   └── order/      # 订单页
│   ├── images/         # 图片资源
│   └── sitemap.json    # 站点地图
│
├── start.bat           # 启动所有服务
├── stop.bat            # 停止所有服务
├── menu.bat            # 管理菜单
└── *.md               # 文档文件
```

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../admin
npm install
```

或运行一键安装脚本：
```bash
install.bat
```

### 2. 启动服务

**方式一：启动所有服务**
```bash
start.bat
```

**方式二：使用管理菜单**
```bash
menu.bat
```

**方式三：单独启动**
- 后端：`start-backend.bat`
- 前端：`start-frontend.bat`

### 3. 访问系统

- **后台管理系统**：http://localhost:8080
- **后端API**：http://localhost:3000
- **微信小程序**：使用微信开发者工具打开 `miniprogram/` 目录

## 功能说明

### 后台管理系统
- 数据概览：查看订单统计、押金金额等
- 订单管理：查看、管理、退还押金
- 床位管理：添加、编辑、删除床位类型
- 库存管理：查看和调整库存
- 系统设置：配置押金规则、营业时间等

### 后端服务
- RESTful API 接口
- WebSocket 实时通信
- 微信支付集成
- 数据管理

### 微信小程序
- 床位类型展示
- 数量选择
- 微信支付
- 订单管理
- 实时数据更新

## 技术栈

- **后端**：Node.js + Express + WebSocket
- **前端**：HTML5 + CSS3 + JavaScript
- **小程序**：微信原生小程序
- **部署**：http-server（开发环境）

## 注意事项

1. **开发环境**：默认使用 localhost，生产环境需要修改配置
2. **微信支付**：需要在微信公众平台开通并配置商户号
3. **图片资源**：在 `miniprogram/images/` 目录下放置床位图片
4. **服务器域名**：正式发布时需要在微信公众平台配置合法域名

## 文档

- `README.md` - 本文件
- `STARTUP_GUIDE.md` - 启动指南
- `CONFIG_GUIDE.md` - 配置指南
- `REALTIME_GUIDE.md` - 实时同步指南
- `SYNC_FEATURE.md` - 同步功能说明

## 许可证

MIT License

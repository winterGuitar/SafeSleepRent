# MySQL 数据库集成说明

## 1. 安装 MySQL 依赖

```bash
cd server
npm install mysql
```

## 2. 配置 MySQL 连接

编辑 `server/config/appConfig.js`，设置你的 MySQL 密码：

```javascript
database: {
  type: 'mysql', // 设置为 'mysql' 启用数据库
  mysql: {
    host: 'localhost',
    port: 3306,
    database: 'hosp_bed',
    username: 'root',
    password: '你的MySQL密码'  // 修改这里
  }
}
```

## 3. 创建数据库和表

### 方式一：使用命令行

```bash
# 登录 MySQL
mysql -u root -p

# 执行建表脚本
source server/database/schema.sql
```

### 方式二：使用 MySQL Workbench

1. 打开 MySQL Workbench
2. 连接到你的 MySQL 服务器
3. 打开 `server/database/schema.sql` 文件
4. 点击闪电图标执行 SQL

## 4. 验证数据库

执行以下 SQL 查看表是否创建成功：

```sql
USE hosp_bed;
SHOW TABLES;
```

应该看到以下表：
- `orders` - 订单表
- `order_beds` - 订单床位详情表
- `system_config` - 系统配置表
- `order_counter` - 订单ID计数器

## 5. 启动后端服务

```bash
cd server
npm start
```

启动时会看到以下日志：

```
==================================================
正在初始化服务器...
正在连接 MySQL 数据库...
✅ MySQL 数据库连接成功
正在初始化数据库...
已存在的表: ['orders', 'order_beds', 'system_config', 'order_counter']
✅ 数据库初始化完成
✅ 已切换到 MySQL 数据库模式
==================================================
==================================================
医院租床后端服务器已启动
HTTP地址: http://localhost:3000
WebSocket地址: ws://localhost:3000/ws
数据库模式: mysql
==================================================
```

## 6. 数据迁移说明

如果之前使用内存存储模式有订单数据，系统会自动迁移到 MySQL 数据库：

```
检测到内存中有 5 条订单数据，正在迁移...
✅ 迁移订单: ORD12345678901234
✅ 迁移订单: ORD12345678905678
✅ 订单数据迁移完成: 5 条
```

## 7. 数据库表结构说明

### orders（订单表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| order_id | VARCHAR(32) | 订单号（唯一） |
| openid | VARCHAR(100) | 用户openid |
| total_deposit | DECIMAL(10,2) | 总押金 |
| status | ENUM | 订单状态（unpaid/paid/refunded/cancelled） |
| transaction_id | VARCHAR(64) | 微信交易号 |
| create_time | DATETIME | 创建时间 |
| pay_time | DATETIME | 支付时间 |
| refund_time | DATETIME | 退款时间 |
| cancel_time | DATETIME | 取消时间 |
| update_time | DATETIME | 更新时间 |

### order_beds（订单床位详情表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| order_id | VARCHAR(32) | 订单号（外键） |
| bed_id | VARCHAR(50) | 床位ID |
| bed_name | VARCHAR(100) | 床位名称 |
| quantity | INT | 数量 |
| price | DECIMAL(10,2) | 单价 |
| deposit | DECIMAL(10,2) | 押金 |

## 8. 故障排查

### 问题：MySQL 连接失败

**错误信息**：`❌ MySQL 数据库连接失败`

**解决方法**：
1. 检查 MySQL 服务是否启动
2. 检查 `config/appConfig.js` 中的密码是否正确
3. 检查 MySQL 端口（默认3306）是否正确

### 问题：表不存在

**错误信息**：`⚠️  数据库表不存在，请先执行 schema.sql 创建表`

**解决方法**：
按照第3步创建数据库表

### 问题：切换回内存模式

如果需要临时切换回内存存储模式，修改配置：

```javascript
database: {
  type: 'memory',  // 改为 'memory'
  // ...
}
```

## 9. SQL 查询示例

```sql
-- 查询所有订单
SELECT * FROM orders ORDER BY create_time DESC;

-- 查询某用户的订单
SELECT * FROM orders WHERE openid = '用户openid' ORDER BY create_time DESC;

-- 查询订单统计
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status='paid' THEN total_deposit ELSE 0 END) as total_deposit,
  SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count,
  SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END) as unpaid_count
FROM orders;

-- 查询订单的床位详情
SELECT * FROM order_beds WHERE order_id = 'ORD12345678901234';
```

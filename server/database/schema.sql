-- 医院租床系统数据库表结构
-- 适用于 MySQL 5.7+

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS hosp_bed DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hosp_bed;

-- 订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `order_id` VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
  `openid` VARCHAR(100) COMMENT '用户openid',
  `total_deposit` DECIMAL(10,2) NOT NULL COMMENT '总押金',
  `status` ENUM('unpaid', 'paid', 'refunded', 'cancelled') NOT NULL DEFAULT 'unpaid' COMMENT '订单状态',
  `transaction_id` VARCHAR(64) COMMENT '微信交易号',
  `create_time` DATETIME NOT NULL COMMENT '创建时间',
  `pay_time` DATETIME COMMENT '支付时间',
  `refund_time` DATETIME COMMENT '退款时间',
  `cancel_time` DATETIME COMMENT '取消时间',
  `update_time` DATETIME NOT NULL COMMENT '更新时间',
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_openid` (`openid`),
  INDEX `idx_status` (`status`),
  INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 订单床位详情表
CREATE TABLE IF NOT EXISTS `order_beds` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `order_id` VARCHAR(32) NOT NULL COMMENT '订单号',
  `bed_id` VARCHAR(50) NOT NULL COMMENT '床位ID',
  `bed_name` VARCHAR(100) NOT NULL COMMENT '床位名称',
  `quantity` INT NOT NULL COMMENT '数量',
  `price` DECIMAL(10,2) NOT NULL COMMENT '单价',
  `deposit` DECIMAL(10,2) NOT NULL COMMENT '押金',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_bed_id` (`bed_id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单床位详情表';

-- 系统配置表（存储床位类型等配置）
CREATE TABLE IF NOT EXISTS `system_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `config_key` VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
  `config_value` TEXT COMMENT '配置值（JSON格式）',
  `description` VARCHAR(255) COMMENT '配置描述',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 初始化床位类型配置
INSERT IGNORE INTO `system_config` (`config_key`, `config_value`, `description`) VALUES
('bedTypes', '[]', '床位类型配置'),
('depositRules', '{"multiplier":10,"refundDays":7,"minDeposit":200,"maxDeposit":2000}', '押金规则配置');

-- 创建订单ID计数器表（用于生成订单号）
CREATE TABLE IF NOT EXISTS `order_counter` (
  `id` INT PRIMARY KEY COMMENT '主键',
  `counter_value` BIGINT NOT NULL DEFAULT 0 COMMENT '计数器值',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单ID计数器';

-- 初始化计数器
INSERT IGNORE INTO `order_counter` (`id`, `counter_value`) VALUES (1, 0);

-- 查询验证表是否创建成功
SHOW TABLES;

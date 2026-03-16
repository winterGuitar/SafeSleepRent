// MySQL 数据库连接模块
const mysql = require('mysql');
const config = require('../config/appConfig');

// 创建连接池
const pool = mysql.createPool({
  host: config.database.mysql.host,
  port: config.database.mysql.port,
  user: config.database.mysql.username,
  password: config.database.mysql.password,
  database: config.database.mysql.database,
  connectionLimit: config.database.mysql.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  timezone: '+08:00' // 设置为北京时间
});

// 封装查询方法（Promise化）
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('获取数据库连接失败:', err);
        reject(err);
        return;
      }

      connection.query(sql, params, (error, results) => {
        connection.release();

        if (error) {
          console.error('SQL查询失败:', error);
          console.error('SQL语句:', sql);
          console.error('参数:', params);
          reject(error);
          return;
        }

        resolve(results);
      });
    });
  });
}

// 执行事务
async function transaction(callback) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        reject(err);
        return;
      }

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          reject(err);
          return;
        }

        // 执行事务回调
        callback(connection)
          .then((result) => {
            connection.commit((err) => {
              if (err) {
                connection.rollback(() => {
                  connection.release();
                  reject(err);
                });
                return;
              }
              connection.release();
              resolve(result);
            });
          })
          .catch((error) => {
            connection.rollback(() => {
              connection.release();
              reject(error);
            });
          });
      });
    });
  });
}

// 测试数据库连接
async function testConnection() {
  try {
    const results = await query('SELECT 1 as test');
    console.log('✅ MySQL 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ MySQL 数据库连接失败:', error.message);
    return false;
  }
}

// 初始化表数据
async function initDatabase() {
  try {
    console.log('正在初始化数据库...');

    // 检查表是否存在
    const tables = await query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    console.log('已存在的表:', tableNames);

    // 如果表不存在，需要执行 schema.sql
    if (tableNames.length === 0) {
      console.log('⚠️  数据库表不存在，请先执行 schema.sql 创建表');
      return false;
    }

    // 检查并初始化订单计数器
    const counter = await query('SELECT counter_value FROM order_counter WHERE id = 1');
    if (counter.length === 0) {
      await query('INSERT INTO order_counter (id, counter_value) VALUES (1, 0)');
    }

    console.log('✅ 数据库初始化完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return false;
  }
}

// 关闭连接池
function closePool() {
  return new Promise((resolve) => {
    pool.end((err) => {
      if (err) {
        console.error('关闭连接池失败:', err);
      } else {
        console.log('数据库连接池已关闭');
      }
      resolve();
    });
  });
}

module.exports = {
  query,
  transaction,
  testConnection,
  initDatabase,
  closePool,
  pool
};

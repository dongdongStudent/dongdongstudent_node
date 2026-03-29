const mysql = require('mysql');
const fs = require('fs');

const pool = mysql.createPool({
  connectionLimit: 10,
  host: '127.0.0.1',
  user: 'root',
  password: '123456',
  database: 'a_test',
});

pool.on('error', (err) => {
  console.error('连接池错误: ', err);
});

// 封装查询函数
function query(sql, values, requestUrl) {
  const localTimestamp = new Date().toLocaleString();
  // console.log("本地时间:", localTimestamp);
  const logMessage = `[${localTimestamp}] 访问地址: ${requestUrl} | 执行查询: ${sql} | 参数: ${JSON.stringify(values)}`;

  // 将日志写入文件
  // fs.appendFile('query.log', logMessage + '\n', (err) => {
  //   if (err) console.error('写入日志失败:', err);
  // });

  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
}

module.exports = {
  query,
};
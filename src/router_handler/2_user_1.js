//导入验证规则的包
const jwt = require("jsonwebtoken"); // 导入生成Token字符串的包
const config = require("../tool/config.js"); // 导入全局配置文件
const db = require("../tool/t-db.js"); // 导入数据库操作模块
const bcrypt = require("bcryptjs"); // 导入bcryptjs模块: 用于密码加密

// 验证规则
const Joi = require("joi");
const schema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email(),
  password: Joi.string().pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')),
  repeat_password: Joi.ref('password'),
  age: Joi.number().integer().min(18).max(99),
}).with('username', 'password');


exports.regUser = (req, res) => { // 注册新用户
  console.log('注册新用户', req.body);
  const result = schema.validate(req.body);

  if (result.error) {
    // 验证不通过，处理错误信息
    console.log('验证失败');
    console.error(result.error.details);
  } else {

    console.log('验证成功');// 验证通过，处理有效数据

    const userinfo = req.body; // 接受请求参数

    const sqlStr = "select * from a_test.student where username=?";// 定义sql语句 查询用户是否存在

    db.query(sqlStr, userinfo.username, (err, results) => {
      console.log('验证用户名是否存在', results);
      if (err) {

      }
      if (results.length > 0) {
        return res.send({
          flag: 0,
          message: "用户名已存在！",
        });
      }

      const sql = "insert into a_test.student set ?";

      db.query(sql, { username: userinfo.username, password: userinfo.password }, (err, results) => {
        if (err) {

        }
        if (results.affectedRows !== 1) {

        }

        // 在数据库操作完成后发送响应
        res.send({
          flag: 1,
          message: "注册成功！",
        });
      }
      );
    });
  }

};

exports.login = async (req, res) => {
  console.log('用户登录1', req.body);
  const userinfo = req.body; // 接受请求参数
  const sql = `SELECT * FROM a_test.student WHERE username=?`; // 查询用户是否存在

  try {
    // 使用封装的查询函数
    const results = await db.query(sql, [userinfo.username], req.originalUrl);
    console.log('验证用户名是否存在', results);
    
    if (!results || results.length !== 1) {
      console.log('没有找到用户');
      return res.send({
        flag: 0,
        message: "没有找到用户",
      });
    }

    // 判断用户输入的登录密码是否和数据库中的密码一致
    if (userinfo.password === results[0].password) {
      // 生成Token字符串
      const user = { ...results[0], password: "", user_pic: "" }; // 不携带密码和头像信息
      const tokenStr = jwt.sign(user, config.jwtSecreKey, {
        expiresIn: config.expiresIn,
      }); // expiresIn: 有效期30天

      return res.send({
        flag: 1,
        message: "登录成功！",
        token: "Bearer " + tokenStr,
      });
    } else {
      console.log("密码不相等");
      return res.send({
        flag: 0,
        message: "密码不正确",
      });
    }
  } catch (error) {
    console.log("执行sql语句失败", error);
    return res.send({
      flag: 0,
      message: "数据库查询失败",
    });
  }
};

exports.get_my_info = (req, res) => {
  const authHeader = req.body.headers.Authorization;

  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "未提供 token",
    });
  }

  // 解析 token
  const id = fun_1(authHeader).id;

  const sql = `SELECT username, image_url, style FROM a_test.student WHERE id=?`;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.log("执行 SQL 语句失败", err);
      return res.status(500).send({
        flag: 0,
        message: "服务器错误",
      });
    }
    res.send({
      flag: 1,
      message: "获取用户信息成功",
      content: results[0],
    });
  });
}

exports.getUserInfo = (req, res) => { // 解析token字符串，获取用户基本信息
  console.log('getUserInfo1', req.body.headers);

  const userinfo = req.body.headers.Authorization; // 获取请求头中的Authorization的值

  const d_a = fun_1(userinfo).id
  console.log('getUserInfo', d_a);
  const sql = `SELECT student.username, article.title
   FROM student
   INNER JOIN student_article ON student.id = student_article.studentid
   INNER JOIN article ON student_article.articleid = article.id
   WHERE student.id = ${d_a}` //

  console.log('as2', sql); //

  db.query(sql, (err, results) => {
    console.log('as3', results); //
    res.send({

      flag: 1,
      weisi: results
    });
  });
}

exports.up_read_info = (req, res) => { // 上传用户阅读信息
  // 获取请求头中的Authorization的值的id
  const userinfo = req.body.headers.Authorization; // 获取请求头中的Authorization的值
  const studentid = fun_1(userinfo).id
  const articleid = 'test';
  let content = JSON.stringify(req.body.data);
  console.log('上传用户阅读信息', studentid, articleid, content);
  // 先保存文章
  // 已有文章,就更新文章
  // 往a_test.student_article表中插入数据,studentid,articleid
  const sql = `UPDATE a_test.student t SET t.style = ? WHERE t.id = ?;`;
  db.query(sql, [content, studentid], (err, results) => {
    if (err) {
      console.log('保存文章失败');
    }
    if (results.affectedRows !== 1) {

    }
    // 在数据库操作完成后发送响应
    console.log('保存文章成功');
    res.send({
      flag: 1,
      message: '保存成功'
    });
  });
}

exports.fun_2 = (req, res) => { // 判断用户是否登录
  const userinfo = req.body.headers.Authorization; // 获取请求头中的Authorization的值
  if (userinfo === null || userinfo === undefined) {
    res.send({
      flag: 0,
    });
    return
  }
  if (fun_1(userinfo) == null) {
    console.log('验证登录失败');
    res.send({
      flag: 0,
    });
    return
  }

  res.send({
    flag: 1,
  });

}

exports.fun_3 = (req, res) => { // 保存用户文章
  console.log('123');
  // console.log('保存用户文章',req.body.data.title, req.body.data.content);
  // 获取请求头中的Authorization的值的id
  const userinfo = req.body.headers.Authorization; // 获取请求头中的Authorization的值
  const d_a = fun_1(userinfo).id
  console.log('保存用户文章', d_a);
  // 先保存文章
  // 已有文章,就更新文章
  const sql = `SELECT id FROM a_test.article WHERE title = ?;`;
  db.query(sql, [req.body.data.title], (err, results) => {
    console.log('保存用户文章', results[0]);
    if (results[0] == null) {
      console.log('没有文章,就保存文章');
      fun_3_fun_2()
    } else {
      console.log('已有文章,就更新文章');
      fun_3_fun_3()
    };
  });

  function fun_3_fun_2() {  // 没有文章,就保存文章
    const sql = `insert into a_test.article(title,content,student_id) values (?,?,?);`;
    db.query(sql, [req.body.data.title, req.body.data.content, d_a], (err, results) => {
      if (err) {
        console.log('保存文章失败');
      }
      if (results.affectedRows !== 1) {

      }
      // 在数据库操作完成后发送响应
      console.log('保存文章成功');
    });
  }
  function fun_3_fun_3() {  // 已有文章,就更新文章
    const sql = `UPDATE a_test.article
    SET  content = ?
    WHERE title = ?;`;
    db.query(sql, [req.body.data.content, req.body.data.title], (err, results) => {
      if (err) {
        console.log('更新文章失败');
      }
      if (results.affectedRows !== 1) {

      }
      // 在数据库操作完成后发送响应
      console.log('更新文章成功');

    });
  }

  // 在设置文章与用户的关系
}

exports.fun_4 = (req, res) => { // 跟新用户头像
  console.log('跟新用户头像');
}

exports.fun_5 = (req, res) => { // 获取头像地址
  console.log('获取头像地址', req.headers.authorization);
  // 获取请求头中的Authorization的值的id
  const userinfo = req.headers.authorization; // 获取请求头中的Authorization的值

  const d_a = fun_1(userinfo).id

  const sql = `SELECT image_url FROM a_test.student WHERE id = ?;`;
  db.query(sql, [d_a], (err, results) => {
    if (results[0].image_url == null) {
      console.log('没有头像');
      res.send({
        flag: 0,
      });
    } else {
      console.log('有头像');
      res.send({
        flag: 1,
        src_img: results[0].image_url
      });
    };
  });
}
exports.get_name = (req, res) => { // 获取用户名

  // 获取请求头中的Authorization的值的id
  const userinfo = req.body.headers.Authorization; // 获取请求头中的Authorization的值

  const d_a = fun_1(userinfo).username_2
  console.log('获取用户名', d_a);

  try {
    if (d_a == null) {
      console.log('获取用户名失败');
      res.send({
        flag: 0,
        message: '获取用户名失败'
      });
      return
    }
    res.send({
      flag: 1,
      content: d_a
    });

  } catch (e) {
    console.log('获取用户名失败', e);
    res.send({
      flag: 0,
      message: '获取用户名失败'
    });
    return
  }
}


exports.save_my_article = (req, res) => { // 保存文章
  console.log('123123保存文章');
  // 获取请求头中的Authorization的值的id
  // const userinfo = req.headers.authorization; // 获取请求头中的Authorization的值
}

exports.fun_6 = (req, res) => { // 获取文章
  console.log('获取文章');
  const userinfo = req.headers.authorization; // 获取请求头中的Authorization的值

  const d_a = fun_1(userinfo).id

  const sql = `select title from a_test.article where student_id = ?`;
  db.query(sql, [d_a], (err, results) => {
    console.log('获取文章', results);
    if (results == null) {
      console.log('没有文章');
      res.send({
        flag: 0,
      });
    } else {
      console.log('有文章');
      res.send({
        flag: 1,
        article: results
      });
    };
  });
}

exports.fun_7 = (req, res) => { // 获取我的收藏
  console.log('获取我的收藏');

  // 获取请求头中的Authorization的值的id
  const userinfo = req.headers.authorization; // 获取请求头中的Authorization的值

  const d_a = fun_1(userinfo).id

  const sql = `SELECT aricle_id title FROM a_test.student_intbook WHERE student_id = ?;`;
  console.log('获取我的收藏', d_a);
  db.query(sql, [d_a], (err, results) => {
    console.log('获取我的收藏', results);
    if (results[0] == null) {
      console.log('没有收藏');
      res.send({
        flag: 0,
      });
    } else {
      console.log('有收藏');
      res.send({
        flag: 1,
        results: results
      });
    };
  });
}

exports.fun_8 = (req, res) => { // 判断是否收藏

  const userinfo = req.body.headers.Authorization; // 获取请求头中的Authorization的值
  const id = fun_1(userinfo).id
  const path = req.body.path;
  const content = req.body.content
  console.log('判断是否收藏', id, path, content);
  // 判断是否收藏,有了更新,没有就插入
  // 查看是否有了路径
  const sql = `SELECT * FROM a_test.student_articleid WHERE  path = ?;`;
  db.query(sql, [path], (err, results) => {

    if (results[0] == null) {
      { // 没有就插入
        const sql = `INSERT INTO a_test.student_articleid ( student_id, path, content)
                   VALUES ( ?, ?, ?);`;

        db.query(sql, [id, path, content], (err, results) => {
          console.log('获取收藏', results);
          if (results == null) {
            console.log('没有收藏');
            res.send({
              flag: 0,
              message: '保存失败'
            });
          } else {
            console.log('有收藏');
            res.send({
              flag: 1,
              message: '保存成功'
            });
          };
        });
      }

    } else {
      { // 有了更新
        console.log('有收藏,插入的是', content, id);
        const sql = `UPDATE a_test.student_articleid t
                   SET t.content = ?
                   WHERE path = ?;`;
        db.query(sql, [content, path], (err, results) => {
          console.log('获取收藏', results);
          if (err) {
            console.log('更新收藏失败');
            res.send({
              flag: 0,
              message: '更新失败'
            });
          }
          if (results.affectedRows !== 1) {
            console.log('更新收藏失败');
            res.send({
              flag: 0,
              message: '更新失败'
            });
            return
          }
          // 在数据库操作完成后发送响应
          res.send({
            flag: 1,
            message: '更新成功'
          });
          console.log('更新收藏成功');
        });
      }
    };
  });
}

function fun_1(userinfo) { // 解析token字符串，获取用户基本信息
  token = userinfo

  token = token.replace(/Bearer /g, '')

  secret_key = 'new_secret_key'

  decoded_token = jwt.decode(token, secret_key, algorithms = ['HS256'])
  console.log('解析token字符串，获取用户基本信息', decoded_token);

  return decoded_token
}

// md
exports.up_img = (req, res) => { // 上传图片
  console.log('获取md文件', req.body);
}

// 获取视频
exports.get_video = (req, res) => { // 获取视频
  console.log('获取视频', req.body);
}

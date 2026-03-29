// 导入数据库操作模块
const db = require("../router/t-db");

// 获取文章分类列表的处理函数
exports.getArtCate = (req, res) => {

  const userinfo = req.body; // 接受请求参数
  // 定义查询分类列表的sql语句
  console.log('test',userinfo);
  // const sql = `select * from a_test. `; //先获取个人文章列表


  // // 执行sql语句
  // db.query(sql, (err, results) => {
  //   // 执行sql语句失败
  //   if (err) return res.cc(err);
  //   // 执行sql语句成功
  //   res.send({
  //     status: 0,
  //     message: "获取文章分类列表成功！",
  //     data: results,
  //   });
  // });
};

// 新增文章分类的处理函数
exports.addArticleCates = (req, res) => {
  // 定义查询分类名称是否存在的sql语句
  const sql = `select * from my_db_01.ev_article_cate where name=? or alias=?`;
  // 执行sql语句
  db.query(sql, [req.body.name, req.body.alias], (err, results) => {
    // 执行sql语句失败
    if (err) return res.cc(err);
    // 判断分类名称和分类别名是否被占用
    if (results.length === 2)
      return res.cc("分类名称与分类别名被占用，请更换后重试！");
    if (results.length === 1 && results[0].name === req.body.name)
      return res.cc("分类名称被占用，请更换后重试！");
    if (results.length === 1 && results[0].alias === req.body.alias)
      return res.cc("分类别名被占用，请更换后重试！");

    // 定义新增文章分类的sql语句
    const sql = `insert into my_db_01.ev_article_cate set ?`;
    // 执行sql语句
    db.query(sql, req.body, (err, results) => {
      // 执行sql语句失败
      if (err) return res.cc(err);
      // 执行sql语句成功，但影响行数不为1
      if (results.affectedRows !== 1) return res.cc("新增文章分类失败！");
      // 新增文章分类成功
      res.cc("新增文章分类成功！", 0);
    });
  });
};

// 根据id删除文章分类的处理函数
exports.deleteCateById = (req, res) => {
  // 定义根据id删除文章分类的sql语句
  const sql = `update my_db_01.ev_article_cate set is_delete=1 where id=?`;
  // 执行sql语句
  db.query(sql, req.params.id, (err, results) => {
    // 执行sql语句失败
    if (err) return res.cc(err);
    // 执行sql语句成功，但影响行数不为1
    if (results.affectedRows !== 1) return res.cc("删除文章分类失败！");
    // 删除文章分类成功
    res.cc("删除文章分类成功！", 0);
  });
};

// 根据id获取文章分类的处理函数
exports.getArtCateById = (req, res) => {
  // 定义根据id获取文章分类的sql语句
  const sql = `select * from my_db_01.ev_article_cate where id=?`;
  // 执行sql语句
  db.query(sql, req.params.id, (err, results) => {
    // 执行sql语句失败
    if (err) return res.cc(err);
    // 执行sql语句成功，但结果为空
    if (results.length !== 1) return res.cc("获取文章分类数据失败！");
    // 获取文章分类数据成功
    res.send({
      status: 0,
      message: "获取文章分类数据成功！",
      data: results[0],
    });
  });
};

// 根据id更新文章分类的处理函数
exports.updateCateById = (req, res) => {
  console.log('1111',req.body.id);
  // 定义根据id查询文章分类的sql语句
  const sql = `select * from my_db_01.ev_article_cate where id<>? and (name=? or alias=?)`;
  
  // 执行sql语句
  db.query(
    sql,
    [req.body.id, req.body.name, req.body.alias],
    (err, results) => {
      // 执行sql语句失败
      if (err) return res.cc(err);
      // 判断分类名称和分类别名是否被占用
      if (results.length === 2)
        return res.cc("分类名称与分类别名被占用，请更换后重试！");
      if (results.length === 1 && results[0].name === req.body.name)
        return res.cc("分类名称被占用，请更换后重试！");
      if (results.length === 1 && results[0].alias === req.body.alias)
        return res.cc("分类别名被占用，请更换后重试！");

      // 定义更新文章分类的sql语句
      const sql = `update my_db_01.ev_article_cate set ? where id=?`;
      // 执行sql语句
      
      db.query(sql, [req.body, req.body.id], (err, results) => {
        console.log('req.body',req.body,'req.body.id',req.body.id);
        // 执行sql语句失败
        if (err) return res.cc(err);
        // 执行sql语句成功，但影响行数不为1
        if (results.affectedRows !== 1) return res.cc("更新文章分类失败！");
        // 更新文章分类成功
        res.cc("更新文章分类成功！", 0);
      });
    }
  );
};

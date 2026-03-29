// 描述：用户路由模块
const userController = require("../router_handler/2_user");

const express = require("express");
const router = express.Router();


// md
const multer = require('multer'); // 用于文件上传
// 配置Multer中间件，指定图片保存的存储位置和文件名
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/img/md/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// 处理图片上传的 POST 请求
router.post('/img/md', upload.single('fileName'), (req, res) => {
  // 在这里可以访问上传的文件
  const uploadedFile = req.file;

  // 进行你要的图片处理操作
  console.log('上传成功:', uploadedFile);

  // 返回响应
  res.send('图片上传成功');
});

module.exports = router;

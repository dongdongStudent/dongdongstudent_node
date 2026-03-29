// 描述：用户路由模块
const userController = require("../router_handler/2_user_1");

const express = require("express");
const router = express.Router();

router.post("/register", userController.regUser);// 注册新用户---这是数据库
router.post("/login",  userController.login);// 登录,登录成功返回token字符串
router.post("/get_my_info", userController.get_my_info);// 获取个人信息

router.post("/up_book_info", userController.up_read_info);// 上传用户阅读信息,style
router.post("/check-auth", userController.getUserInfo);// 解析token字符串，获取用户基本信息
router.post("/is_login",  userController.fun_2);// 验证token是否有效
router.post("/up_article", userController.fun_3);// 更新用户信息
router.post("/update_avatar", userController.fun_4);// 更新用户头像
router.get("/get_avatar", userController.fun_5);// 获取头像地址
router.post("/get_name", userController.get_name);// 获取头像地址

router.post('save_my_article', userController.save_my_article);// 保存文章
router.get("/get_article", userController.fun_6);// 获取文章
router.get("/get_book_collect", userController.fun_7);// 获取我的收藏
router.post("/is_collect", userController.fun_8);// 判断是否收藏

// md
router.post("/img/md", userController.up_img);// 获取md文件

// video
router.post("/video", userController.get_video);// 获取视频文件

module.exports = router;

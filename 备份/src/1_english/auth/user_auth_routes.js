// router/json_user_routes.js - 用户相关路由
const express = require("express");
const router = express.Router();
const userController = require("./user_auth_controller.js");

// 导入各个功能模块
const wordStudyRouter = require("./personal_word_study.js");
const wordRouter = require("./personal_word_review.js");
const pepa_sentence = require("./pepa_sentence.js");
const notebookRouter = require("./notebook.js"); // 新增笔记本路由
const readingProgressRouter = require('./readingProgress.js');
const english_test_study = require("./english_test_select.js"); // 英语测试学习模块


// 使用各个功能模块
router.use("/", wordStudyRouter);      // 单词学习
router.use("/", wordRouter);           // 单词复习
router.use("/", pepa_sentence);        // 句子学习
router.use("/", notebookRouter); // 笔记本功能
router.use('/', readingProgressRouter); // 阅读进度模块
router.use("/questions", english_test_study);   // 英语测试学习模块

// ==================== 用户认证相关路由 ====================
router.post("/register", userController.regUser);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.post("/changepwd",userController.verifyToken,userController.changePassword);

// ==================== 用户信息相关路由 ====================
router.get(
  "/userinfo",
  userController.verifyToken,
  userController.getCurrentUser
);
router.put("/update", userController.verifyToken, userController.updateUser);
router.get("/user", userController.getUserInfo);

// ==================== 学习进度相关路由 ====================
router.get(
  "/progress",
  userController.verifyToken,
  userController.getUserProgress
);
router.post(
  "/progress",
  userController.verifyToken,
  userController.updateProgress
);

// 

module.exports = router;
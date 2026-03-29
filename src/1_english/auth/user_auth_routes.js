// router/json_user_routes.js - 用户相关路由
const express = require("express");
const router = express.Router();
const userController = require("./user_auth_controller.js");

// 导入各个功能模块
const word_study = require("./personal_word_study.js");
const word_review = require("./personal_word_review.js");
const sentence_review = require("./personal_sentence_review.js");
const pepa_sentence = require("./pepa_sentence.js");
const notebookRouter = require("./notebook.js"); // 新增笔记本路由
const readingProgressRouter = require('./readingProgress.js');
const english_test_study = require("./english_test_select.js"); // 英语测试学习模块
const english_test_cloze = require("./english_test_cloze.js");  // 
const english_test_cloze_wordbank = require("./english_test_cloze_wordbank.js");  // 
const english_test_CtoE = require("./english_test_CtoE.js");  // 
const english_test_cloze_sentence = require("./english_test_cloze_sentence.js");  // 
const english_test_6_cloze_wordbank_select = require("./english_test_6_cloze_wordbank_select.js");  // 
const english_test_7_passage_cloze = require("./english_test_7_passage_cloze.js");  // 
const english_test_8_reading_comprehension = require("./english_test_8_reading_comprehension.js");  // 
const english_book_1_work = require("./english_book_1_work.js");  // 
const english_book_1_sentence = require("./english_book_1_sentence.js");  // 
const english_a_z = require("./english_a_z.js");  // 

// 使用各个功能模块
router.use("/", word_study);      // 单词学习
router.use("/", word_review);           // 单词复习
router.use("/", sentence_review);        // 句子复习
router.use("/", pepa_sentence);        // 句子学习
router.use("/", notebookRouter); // 笔记本功能
router.use('/', readingProgressRouter); // 阅读进度模块
router.use("/questions", english_test_study);   // 英语测试学习模块
router.use("/cloze", english_test_cloze);   // 英语测试完形填空模块
router.use("/wordbank", english_test_cloze_wordbank);   // 英语测试完形填空词库模块
router.use("/c_to_e", english_test_CtoE);   // 英语测试CtoE模块
router.use("/cloze_sentence", english_test_cloze_sentence);   // 英语测试完形填空句子模块
router.use("/6_cloze_wordbank_select", english_test_6_cloze_wordbank_select);   // 英语测试5完形填空词库选择模块
router.use("/7_passage_cloze", english_test_7_passage_cloze);   // 英语测试7段完形填空模块
router.use("/8_reading_comprehension", english_test_8_reading_comprehension);   // 英语测试8阅读理解模块
router.use("/english_book_1_work", english_book_1_work);   // 英语书籍练习模块
router.use("/english_book_1_sentence", english_book_1_sentence);   // 英语书籍句子模块
router.use("/english_a_z", english_a_z);   // 

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
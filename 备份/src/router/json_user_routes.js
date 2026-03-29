// router/json_user_routes.js - 用户相关路由
const express = require("express");
const router = express.Router();
const userController = require("./json_user_controller");
const learningManager = require("./json_user_m");

// ==================== 用户认证相关路由 ====================
router.post("/register", userController.regUser);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.post("/changepwd", userController.verifyToken, userController.changePassword);

// ==================== 用户信息相关路由 ====================
router.get("/userinfo", userController.verifyToken, userController.getCurrentUser);
router.put("/update", userController.verifyToken, userController.updateUser);
router.get("/user", userController.getUserInfo);

// ==================== 学习进度相关路由 ====================
router.get("/progress", userController.verifyToken, userController.getUserProgress);
router.post("/progress", userController.verifyToken, userController.updateProgress);

// ==================== 学习数据管理路由 ====================

// 获取学习数据
router.get("/learning/:bookType/:mode", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  const { bookType, mode } = req.params;
  
  try {
    if (!['study', 'review'].includes(mode)) {
      return res.send({
        flag: 0,
        message: "模式参数错误，只能是 study 或 review"
      });
    }
    
    if (!['textbook', 'reading', 'pepa'].includes(bookType)) {
      return res.send({
        flag: 0,
        message: "书本类型参数错误，只能是 textbook、reading 或 pepa"
      });
    }
    
    const data = learningManager.getLearningData(userId, bookType, mode);
    
    res.send({
      flag: 1,
      message: "获取学习数据成功",
      book_type: bookType,
      mode: mode,
      data: data,
      count: Array.isArray(data) ? data.length : Object.keys(data).length
    });
  } catch (error) {
    console.error("获取学习数据失败:", error);
    res.send({
      flag: 0,
      message: "获取学习数据失败"
    });
  }
});

// 保存学习数据
router.post("/learning/:bookType/:mode", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  const { bookType, mode } = req.params;
  const { data, action, word_data } = req.body;
  
  try {
    if (!['study', 'review'].includes(mode)) {
      return res.send({
        flag: 0,
        message: "模式参数错误"
      });
    }
    
    if (!['textbook', 'reading', 'pepa'].includes(bookType)) {
      return res.send({
        flag: 0,
        message: "书本类型参数错误"
      });
    }
    
    let success = false;
    let message = "操作成功";
    
    if (action === 'save' && data) {
      // 保存整个数据
      learningManager.saveLearningData(userId, bookType, mode, data);
      success = true;
      message = "保存成功";
    } else if (action === 'add_word' && word_data) {
      // 添加单个单词
      if (mode !== 'study') {
        return res.send({
          flag: 0,
          message: "只能在学习本中添加单词"
        });
      }
      
      if (!word_data.word || !word_data.translation) {
        return res.send({
          flag: 0,
          message: "单词和翻译不能为空"
        });
      }
      
      success = learningManager.addWordToStudy(userId, bookType, word_data);
      message = success ? "添加单词成功" : "单词已存在";
    } else if (action === 'update_word' && word_data) {
      // 更新单词状态（主要用于学习本）
      if (mode === 'study') {
        const studyData = learningManager.getLearningData(userId, bookType, 'study');
        const wordIndex = parseInt(req.body.word_index);
        
        if (isNaN(wordIndex) || wordIndex < 0 || wordIndex >= studyData.length) {
          return res.send({
            flag: 0,
            message: "单词索引无效"
          });
        }
        
        // 更新单词状态
        if (word_data.status) {
          studyData[wordIndex].status = word_data.status;
          
          // 检查是否已掌握
          const isMastered = word_data.status.listening && 
                            word_data.status.reading && 
                            word_data.status.translation && 
                            word_data.status.pronunciation;
          
          if (isMastered) {
            // 移动到复习本
            const wordToMove = studyData[wordIndex];
            learningManager.moveToReview(userId, bookType, wordToMove);
            
            // 从学习本中移除
            studyData.splice(wordIndex, 1);
            message = "单词已掌握并移至复习本";
          }
          
          learningManager.saveLearningData(userId, bookType, 'study', studyData);
          success = true;
        }
      } else if (mode === 'review') {
        // 更新复习单词
        const reviewData = learningManager.getLearningData(userId, bookType, 'review');
        const wordKey = word_data.word.toLowerCase();
        
        if (reviewData[wordKey]) {
          if (word_data.pass !== undefined) {
            reviewData[wordKey].pass = word_data.pass;
          }
          if (word_data.correct_count !== undefined) {
            reviewData[wordKey].correct_count = word_data.correct_count;
          }
          if (word_data.wrong_count !== undefined) {
            reviewData[wordKey].wrong_count = word_data.wrong_count;
          }
          if (word_data.extraction_count !== undefined) {
            reviewData[wordKey].extraction_count = word_data.extraction_count;
          }
          
          reviewData[wordKey].time = new Date().toISOString();
          learningManager.saveLearningData(userId, bookType, 'review', reviewData);
          success = true;
          message = "复习单词更新成功";
        }
      }
    }
    
    res.send({
      flag: success ? 1 : 0,
      message: message
    });
  } catch (error) {
    console.error("操作学习数据失败:", error);
    res.send({
      flag: 0,
      message: "操作失败"
    });
  }
});

// 获取需要复习的单词
router.get("/review/due/:bookType", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  const { bookType } = req.params;
  
  try {
    if (!['textbook', 'reading', 'pepa'].includes(bookType)) {
      return res.send({
        flag: 0,
        message: "书本类型参数错误"
      });
    }
    
    const dueWords = learningManager.getDueReviewWords(userId, bookType);
    
    res.send({
      flag: 1,
      message: "获取复习单词成功",
      book_type: bookType,
      due_words: dueWords,
      count: Object.keys(dueWords).length
    });
  } catch (error) {
    console.error("获取复习单词失败:", error);
    res.send({
      flag: 0,
      message: "获取复习单词失败"
    });
  }
});

// 获取用户配置
router.get("/config", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  
  try {
    const config = learningManager.getUserConfig(userId);
    
    if (!config) {
      return res.send({
        flag: 0,
        message: "用户配置不存在"
      });
    }
    
    res.send({
      flag: 1,
      message: "获取用户配置成功",
      config: config
    });
  } catch (error) {
    console.error("获取用户配置失败:", error);
    res.send({
      flag: 0,
      message: "获取用户配置失败"
    });
  }
});

// 更新用户配置
router.post("/config", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  const { current_status, settings, progress_stats } = req.body;
  
  try {
    const updates = {};
    
    if (current_status) updates.current_status = current_status;
    if (settings) updates.settings = settings;
    if (progress_stats) updates.progress_stats = progress_stats;
    
    if (Object.keys(updates).length === 0) {
      return res.send({
        flag: 0,
        message: "没有提供更新数据"
      });
    }
    
    const success = learningManager.updateUserConfig(userId, updates);
    
    res.send({
      flag: success ? 1 : 0,
      message: success ? "用户配置更新成功" : "更新失败"
    });
  } catch (error) {
    console.error("更新用户配置失败:", error);
    res.send({
      flag: 0,
      message: "更新用户配置失败"
    });
  }
});

// 数据统计
router.get("/stats", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  
  try {
    const config = learningManager.getUserConfig(userId);
    
    if (!config) {
      return res.send({
        flag: 0,
        message: "用户配置不存在"
      });
    }
    
    const stats = {
      total_study_words: 0,
      total_review_words: 0,
      mastered_words: 0,
      due_review_words: 0
    };
    
    // 统计各模块数据
    const bookTypes = ['textbook', 'reading', 'pepa'];
    
    bookTypes.forEach(bookType => {
      // 学习本统计
      const studyData = learningManager.getLearningData(userId, bookType, 'study');
      stats.total_study_words += Array.isArray(studyData) ? studyData.length : 0;
      
      // 复习本统计
      const reviewData = learningManager.getLearningData(userId, bookType, 'review');
      const reviewCount = Object.keys(reviewData).length;
      stats.total_review_words += reviewCount;
      
      // 统计已通过的复习单词
      let masteredCount = 0;
      let dueCount = 0;
      for (const word in reviewData) {
        if (reviewData[word].pass) {
          masteredCount++;
        } else {
          dueCount++;
        }
      }
      stats.mastered_words += masteredCount;
      stats.due_review_words += dueCount;
    });
    
    // 合并配置中的统计数据
    const combinedStats = {
      ...stats,
      progress_stats: config.progress_stats,
      current_status: config.current_status,
      settings: config.settings,
      study_stats: config.study_stats || {}
    };
    
    res.send({
      flag: 1,
      message: "获取统计数据成功",
      stats: combinedStats
    });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    res.send({
      flag: 0,
      message: "获取统计数据失败"
    });
  }
});

// 批量操作
router.post("/batch", userController.verifyToken, (req, res) => {
  const userId = req.user.id;
  const { operations } = req.body;
  
  if (!operations || !Array.isArray(operations)) {
    return res.send({
      flag: 0,
      message: "操作列表不能为空"
    });
  }
  
  const results = [];
  let successCount = 0;
  
  operations.forEach((op, index) => {
    try {
      const { type, bookType, mode, data } = op;
      
      switch(type) {
        case 'add_words':
          if (mode === 'study' && data && Array.isArray(data)) {
            data.forEach(wordData => {
              learningManager.addWordToStudy(userId, bookType, wordData);
            });
            results.push({ index, success: true });
            successCount++;
          }
          break;
          
        case 'clear_data':
          if (bookType && mode) {
            const defaultData = mode === 'study' ? [] : {};
            learningManager.saveLearningData(userId, bookType, mode, defaultData);
            results.push({ index, success: true });
            successCount++;
          }
          break;
          
        case 'update_config':
          if (data) {
            learningManager.updateUserConfig(userId, data);
            results.push({ index, success: true });
            successCount++;
          }
          break;
      }
    } catch (error) {
      results.push({ index, success: false, error: error.message });
    }
  });
  
  res.send({
    flag: 1,
    message: `批量操作完成，成功 ${successCount}/${operations.length}`,
    results: results
  });
});

// 测试路由
router.get("/test", userController.verifyToken, (req, res) => {
  res.send({
    flag: 1,
    message: "用户路由测试成功",
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// 数据迁移路由（仅开发环境使用）
router.get("/migrate", (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.send({
      flag: 0,
      message: "此功能仅在开发环境可用"
    });
  }
  
  userController.migrateData(req, res);
});

module.exports = router;
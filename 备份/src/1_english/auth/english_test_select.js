// questionRoutes.js - 题目相关路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

// 公共函数
const token_decode = (userinfo) => {
  const token = userinfo.replace(/Bearer /g, "");
  const secret_key = "new_secret_key";
  const decoded_token = jwt.decode(token, secret_key, (algorithms = ["HS256"]));
  return decoded_token;
};

const sendResponse = (res, flag, message, content = null) => {
  res.json({ flag, message, content });
};

// ==================== 工具函数 ====================

// 智能读取文件
const smartRead = async (filePath, defaultData = {}) => {
  if (!fs.existsSync(filePath)) {
    return defaultData;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return defaultData;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("读取失败，初始化为默认数据:", e.message);
    return defaultData;
  }
};

// 智能写入文件
const smartWrite = async (filePath, data) => {
  const content = JSON.stringify(data, null, 2);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return fs.promises.writeFile(filePath, content, "utf8");
};

// ==================== 多题库支持 ====================

// 题库配置
const QUESTION_BANKS = {
  default: {
    id: 'default',
    key: 'default',
    name: '默认题库',
    description: '标准英语选择题库',
    icon: '📚',
    color: '#1a237e',
    masterFile: 'master.json',
    statsFile: 'default_stats.json',
    aliases: ['default', '默认题库', '默认'],
    totalQuestions: 40,
    categories: ['名词复数', '形容词', '动词', '语法', '情态动词']
  },
  zhongkao: {
    id: '中考',
    key: 'zhongkao',
    name: '中考真题库',
    description: '历年中考英语真题',
    icon: '🎯',
    color: '#c62828',
    masterFile: 'zhongkao_master.json',
    statsFile: 'zhongkao_stats.json',
    aliases: ['zhongkao', '中考', '中考真题库', '中考试题'],
    totalQuestions: 120,
    categories: ['时态', '语态', '从句', '非谓语']
  },
  gaokao: {
    id: '高考',
    key: 'gaokao',
    name: '高考真题库',
    description: '历年高考英语真题',
    icon: '🏆',
    color: '#2e7d32',
    masterFile: 'gaokao_master.json',
    statsFile: 'gaokao_stats.json',
    aliases: ['gaokao', '高考', '高考真题库', '高考试题'],
    totalQuestions: 150,
    categories: ['完形填空', '阅读理解', '语法填空']
  },
  special: {
    id: '专项',
    key: 'special',
    name: '语法专项库',
    description: '语法知识点专项练习',
    icon: '⚡',
    color: '#ed6c02',
    masterFile: 'special_master.json',
    statsFile: 'special_stats.json',
    aliases: ['special', '专项', '语法专项库', '专项练习'],
    totalQuestions: 80,
    categories: ['时态', '语态', '虚拟语气', '非谓语']
  }
};

/**
 * 根据ID或别名获取题库配置
 * @param {string} bankId - 题库ID或别名
 * @returns {Object} 题库配置
 */
const getBankConfig = (bankId) => {
  
  // 1. 直接通过key匹配（英文key）
  if (QUESTION_BANKS[bankId]) {
    return QUESTION_BANKS[bankId];
  }
  
  // 2. 遍历所有配置，检查id和别名
  for (const [key, config] of Object.entries(QUESTION_BANKS)) {
    // 检查id是否匹配（中文ID）
    if (config.id === bankId) {
      return config;
    }
    
    // 检查别名是否匹配
    if (config.aliases && config.aliases.includes(bankId)) {
      return config;
    }
  }
  
  // 3. 特殊处理：如果bankId是中文，尝试模糊匹配
  const chineseToKey = {
    '高考': 'gaokao',
    '中考': 'zhongkao',
    '专项': 'special',
    '默认': 'default'
  };
  
  if (chineseToKey[bankId] && QUESTION_BANKS[chineseToKey[bankId]]) {
    return QUESTION_BANKS[chineseToKey[bankId]];
  }
  
  // 4. 默认返回default
  return QUESTION_BANKS.default;
};

/**
 * 获取学生统计文件路径
 * 目录结构: /resource/person_name/用户名/test_select_master/题库_stats.json
 * @param {string} username - 用户名
 * @param {string} bankId - 题库ID或别名
 * @returns {string} 文件路径
 */
const getStudentStatsPath = (username, bankId = 'default') => {
  const bank = getBankConfig(bankId);
  
  // 路径: /resource/person_name/用户名/test_select_master/题库_stats.json
  const filePath = path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_select_master",
    bank.statsFile
  );

  return filePath;
};

/**
 * 获取题目母版路径
 * 目录结构: /resource/test_master/题库_master.json
 * @param {string} bankId - 题库ID或别名
 * @returns {string} 文件路径
 */
const getMasterQuestionsPath = (bankId = 'default') => {
  const bank = getBankConfig(bankId);
  
  // 保持原路径：/resource/english_test_select_master/题库_master.json
  const filePath = path.join(
    __dirname, 
    "../", 
    "resource/english_test_select_master",
    bank.masterFile
  );

  return filePath;
};

/**
 * 确保用户统计目录存在
 * @param {string} username - 用户名
 * @returns {string} 目录路径
 */
const ensureUserStatsDirectory = (username) => {
  const userStatsDir = path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_select_master"
  );
  
  if (!fs.existsSync(userStatsDir)) {
    fs.mkdirSync(userStatsDir, { recursive: true });
    console.log(`创建用户统计目录: ${userStatsDir}`);
  }
  
  return userStatsDir;
};

/**
 * 创建默认的统计文件（如果不存在）
 * @param {string} username - 用户名
 * @param {string} bankId - 题库ID
 */
const ensureDefaultStatsFile = async (username, bankId) => {
  const bank = getBankConfig(bankId);
  const statsPath = getStudentStatsPath(username, bankId);
  
  if (!fs.existsSync(statsPath)) {
    const now = new Date().toISOString();
    const defaultStats = {
      metadata: {
        username,
        bank: bank.id,
        createdAt: now,
        lastActive: now,
        totalAttempts: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracy: 0
      },
      stats: {}
    };
    
    await smartWrite(statsPath, defaultStats);
    console.log(`创建默认统计文件: ${statsPath}`);
  }
};

// ==================== 获取题库列表接口 ====================

/**
 * 获取可用题库列表
 * GET /api/questions/banks
 */
router.get("/banks", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    // 为每个题库确保默认统计文件存在
    for (const bank of Object.values(QUESTION_BANKS)) {
      await ensureDefaultStatsFile(username, bank.id);
    }

    // 获取每个题库的实际题目数量（从原路径读取）
    const banksWithStats = await Promise.all(
      Object.values(QUESTION_BANKS).map(async (bank) => {
        const masterPath = getMasterQuestionsPath(bank.id);
        const masterData = await smartRead(masterPath, { questions: [] });
        const actualTotal = masterData.questions?.length || 0;
        
        // 获取该题库的分类
        const categories = [...new Set(masterData.questions?.map(q => q.category).filter(Boolean) || [])];
        
        // 读取用户的统计文件
        const statsPath = getStudentStatsPath(username, bank.id);
        const userStats = await smartRead(statsPath, { metadata: {}, stats: {} });
        
        return {
          id: bank.id,
          key: bank.key,
          name: bank.name,
          description: bank.description,
          icon: bank.icon,
          color: bank.color,
          totalQuestions: actualTotal || bank.totalQuestions,
          categories: categories.length > 0 ? categories : bank.categories,
          masterFile: bank.masterFile,
          statsFile: bank.statsFile,
          userStats: {
            totalAttempts: userStats.metadata?.totalAttempts || 0,
            totalCorrect: userStats.metadata?.totalCorrect || 0,
            accuracy: userStats.metadata?.accuracy || 0
          }
        };
      })
    );

    return sendResponse(res, 1, "获取成功", { 
      banks: banksWithStats,
      userDir: `/resource/person_name/${username}/test_select_master`
    });
  } catch (err) {
    console.error("获取题库列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

// ==================== 原有函数保持不变 ====================

// 创建默认题目统计对象
const createDefaultQuestionStat = (now) => {
  return {
    extraction_count: 0,
    correct_count: 0,
    wrong_count: 0,
    first_seen: now,
    last_extracted: now,
    last_result: null,
    mastery_level: 0,
    history: [],
    streak: {
      current_correct: 0,
      current_wrong: 0,
      max_correct: 0,
      max_wrong: 0
    },
    time_stats: {
      avg_time: 0,
      fastest: 0,
      slowest: 0
    }
  };
};

// 计算掌握程度
const calculateMasteryLevel = (stat) => {
  const total = stat.correct_count + stat.wrong_count;
  if (total === 0) return 0;

  const accuracy = stat.correct_count / total;
  
  let recentTwoCorrect = 0;
  if (stat.history && stat.history.length >= 2) {
    const lastTwo = stat.history.slice(-2);
    recentTwoCorrect = lastTwo.filter(h => h.result).length / 2;
  } else if (stat.history && stat.history.length === 1) {
    recentTwoCorrect = stat.history[0].result ? 0.5 : 0;
  }

  let recentThreeCorrect = 0;
  if (stat.history && stat.history.length >= 3) {
    const lastThree = stat.history.slice(-3);
    recentThreeCorrect = lastThree.filter(h => h.result).length / 3;
  } else if (stat.history && stat.history.length === 2) {
    const lastTwo = stat.history.slice(-2);
    recentThreeCorrect = lastTwo.filter(h => h.result).length / 2;
  } else if (stat.history && stat.history.length === 1) {
    recentThreeCorrect = stat.history[0].result ? 1 : 0;
  }

  let streakBonus = 0;
  if (stat.streak?.current_correct >= 3) {
    streakBonus = 0.15;
  } else if (stat.streak?.current_correct === 2) {
    streakBonus = 0.1;
  }

  let timeDecay = 1;
  if (stat.last_extracted) {
    const daysSinceLast = (new Date() - new Date(stat.last_extracted)) / (1000 * 60 * 60 * 24);
    timeDecay = Math.max(0.8, 1 - daysSinceLast * 0.1);
  }

  const mastery = (recentTwoCorrect * 0.5 + recentThreeCorrect * 0.3 + accuracy * 0.2) * timeDecay + streakBonus;
  
  return Math.min(1, Number(mastery.toFixed(2)));
};

// 更新用时统计
const updateTimeStats = (stat, currentTime) => {
  const times = stat.history.map(h => h.time).filter(t => t > 0);
  if (times.length === 0) return;
  
  const sum = times.reduce((a, b) => a + b, 0);
  stat.time_stats.avg_time = Number((sum / times.length).toFixed(1));
  stat.time_stats.fastest = Math.min(...times);
  stat.time_stats.slowest = Math.max(...times);
};

// 更新连续记录
const updateStreak = (stat, isCorrect) => {
  if (!stat.streak) {
    stat.streak = { current_correct: 0, current_wrong: 0, max_correct: 0, max_wrong: 0 };
  }

  if (isCorrect) {
    stat.streak.current_correct++;
    stat.streak.current_wrong = 0;
    stat.streak.max_correct = Math.max(stat.streak.max_correct, stat.streak.current_correct);
  } else {
    stat.streak.current_wrong++;
    stat.streak.current_correct = 0;
    stat.streak.max_wrong = Math.max(stat.streak.max_wrong, stat.streak.current_wrong);
  }
};

// 更新学生统计的元数据
const updateMetadata = (stats) => {
  let totalAttempts = 0;
  let totalCorrect = 0;

  Object.values(stats.stats || {}).forEach(stat => {
    totalAttempts += (stat.correct_count || 0) + (stat.wrong_count || 0);
    totalCorrect += stat.correct_count || 0;
  });

  stats.metadata = stats.metadata || {};
  stats.metadata.lastActive = new Date().toISOString();
  stats.metadata.totalAttempts = totalAttempts;
  stats.metadata.totalCorrect = totalCorrect;
  stats.metadata.totalWrong = totalAttempts - totalCorrect;
  stats.metadata.accuracy = totalAttempts > 0 
    ? Math.round((totalCorrect / totalAttempts) * 100) / 100 
    : 0;

  return stats;
};

// ==================== 抽取算法 ====================

// 获取薄弱题
const getWeakQuestions = (allQuestions, studentStats, count) => {
  const weak = allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    if (!stat) return false;
    return stat.mastery_level < 0.5 && stat.mastery_level > 0;
  });

  return shuffleAndTake(weak, count);
};

// 获取新题
const getNewQuestions = (allQuestions, studentStats, count) => {
  const newQ = allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    return !stat || (stat.correct_count + stat.wrong_count === 0);
  });

  return shuffleAndTake(newQ, count);
};

// 获取复习题
const getReviewQuestions = (allQuestions, studentStats, count) => {
  const review = allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    if (!stat) return false;
    return stat.mastery_level >= 0.5 && stat.mastery_level < 0.8;
  });

  return shuffleAndTake(review, count);
};

// 获取已掌握题
const getMasteredQuestions = (allQuestions, studentStats, count) => {
  const mastered = allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    if (!stat) return false;
    return stat.mastery_level >= 0.8;
  });

  return shuffleAndTake(mastered, count);
};

// 智能抽题算法
const smartDraw = (allQuestions, studentStats, count) => {
  const weak = getWeakQuestions(allQuestions, studentStats, 999);
  const review = getReviewQuestions(allQuestions, studentStats, 999);
  const newQ = getNewQuestions(allQuestions, studentStats, 999);
  const mastered = getMasteredQuestions(allQuestions, studentStats, 999);

  let result = [];
  const resultIds = new Set();

  const weakCount = Math.min(Math.floor(count * 0.4), weak.length);
  const weakSelected = shuffleAndTake(weak, weakCount);
  weakSelected.forEach(q => {
    result.push(q);
    resultIds.add(q.id);
  });

  const reviewAvailable = review.filter(q => !resultIds.has(q.id));
  const reviewCount = Math.min(Math.floor(count * 0.3), reviewAvailable.length);
  const reviewSelected = shuffleAndTake(reviewAvailable, reviewCount);
  reviewSelected.forEach(q => {
    result.push(q);
    resultIds.add(q.id);
  });

  const newAvailable = newQ.filter(q => !resultIds.has(q.id));
  const newCount = Math.min(Math.floor(count * 0.2), newAvailable.length);
  const newSelected = shuffleAndTake(newAvailable, newCount);
  newSelected.forEach(q => {
    result.push(q);
    resultIds.add(q.id);
  });

  const remaining = count - result.length;
  if (remaining > 0) {
    const masteredAvailable = mastered.filter(q => !resultIds.has(q.id));
    const masteredSelected = shuffleAndTake(masteredAvailable, remaining);
    masteredSelected.forEach(q => {
      result.push(q);
      resultIds.add(q.id);
    });
  }

  if (result.length < count) {
    const remainingCount = count - result.length;
    const available = allQuestions.filter(q => !resultIds.has(q.id));
    const extraSelected = shuffleAndTake(available, remainingCount);
    result = [...result, ...extraSelected];
  }

  return result;
};

// 辅助：随机取几个
const shuffleAndTake = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// 获取统计数量
const getWeakCount = (allQuestions, studentStats) => {
  return allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    if (!stat) return false;
    return stat.mastery_level < 0.5 && stat.mastery_level > 0;
  }).length;
};

const getNewCount = (allQuestions, studentStats) => {
  return allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    return !stat || (stat.correct_count + stat.wrong_count === 0);
  }).length;
};

const getMasteredCount = (allQuestions, studentStats) => {
  return allQuestions.filter(q => {
    const stat = studentStats.stats[q.id];
    if (!stat) return false;
    return stat.mastery_level >= 0.8;
  }).length;
};

// ==================== 核心API ====================

/**
 * 获取题目（支持智能抽取和多题库）
 * GET /api/questions/get?type=smart&count=10&bank=default
 */
router.get("/get", async (req, res) => {
  try {
    // 1. 验证token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    // 2. 获取参数
    const { type = "smart", count = 10, bank = "default" } = req.query;
    const questionCount = parseInt(count) || 10;

    // 3. 获取题库配置
    const bankConfig = getBankConfig(bank);

    // 4. 读取对应题库的题目母版（从原路径读取）
    const masterPath = getMasterQuestionsPath(bank);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    if (allQuestions.length === 0) {
      return sendResponse(res, 0, "题库为空");
    }

    // 5. 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 6. 读取对应题库的学生统计（从新路径读取）
    const statsPath = getStudentStatsPath(username, bank);
    
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: bankConfig.id },
      stats: {} 
    });

    // 7. 根据类型抽取题目
    let selectedQuestions = [];
    const now = new Date().toISOString();

    switch (type) {
      case "weak":
        selectedQuestions = getWeakQuestions(allQuestions, studentStats, questionCount);
        break;
      case "new":
        selectedQuestions = getNewQuestions(allQuestions, studentStats, questionCount);
        break;
      case "review":
        selectedQuestions = getReviewQuestions(allQuestions, studentStats, questionCount);
        break;
      case "mastered":
        selectedQuestions = getMasteredQuestions(allQuestions, studentStats, questionCount);
        break;
      case "smart":
      default:
        selectedQuestions = smartDraw(allQuestions, studentStats, questionCount);
        break;
    }

    // 8. 记录抽取次数
    selectedQuestions.forEach(q => {
      if (!studentStats.stats[q.id]) {
        studentStats.stats[q.id] = createDefaultQuestionStat(now);
      }
      studentStats.stats[q.id].extraction_count++;
      studentStats.stats[q.id].last_extracted = now;
    });

    // 9. 更新元数据并保存
    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 10. 返回题目
    const questionsForClient = selectedQuestions.map(q => ({
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      stars: q.stars,
      question: q.question,
      options: q.options,
      category: q.category,
      source: q.source,
      tags: q.tags,
      correct: q.correct,
      explanation: q.explanation
    }));

    return sendResponse(res, 1, "获取成功", {
      questions: questionsForClient,
      count: questionsForClient.length,
      type: type,
      bank: bankConfig.id,
      stats: {
        totalQuestions: allQuestions.length,
        masteredCount: getMasteredCount(allQuestions, studentStats),
        weakCount: getWeakCount(allQuestions, studentStats),
        newCount: getNewCount(allQuestions, studentStats)
      },
      filePath: `/resource/person_name/${username}/test_select_master/${bankConfig.statsFile}`
    });

  } catch (err) {
    console.error("获取题目失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 按题号范围获取题目
 * GET /api/questions/range?start=1&end=10&bank=default
 */
router.get("/range", async (req, res) => {
  try {
    // 1. 验证token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    // 2. 获取参数
    const { start = 1, end = 10, bank = "default" } = req.query;
    const startIndex = parseInt(start) - 1; // 转换为0基索引
    const endIndex = parseInt(end) - 1;

    // 3. 验证参数
    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      return sendResponse(res, 0, "无效的题号范围");
    }

    // 4. 获取题库配置
    const bankConfig = getBankConfig(bank);

    // 5. 读取对应题库的题目母版
    const masterPath = getMasterQuestionsPath(bank);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    if (allQuestions.length === 0) {
      return sendResponse(res, 0, "题库为空");
    }

    // 6. 验证范围有效性
    if (startIndex >= allQuestions.length || endIndex >= allQuestions.length) {
      return sendResponse(res, 0, `题号超出范围，题库共有 ${allQuestions.length} 题`);
    }

    // 7. 获取指定范围的题目
    const selectedQuestions = allQuestions.slice(startIndex, endIndex + 1);

    // 8. 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 9. 读取对应题库的学生统计
    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: bankConfig.id },
      stats: {} 
    });

    // 10. 记录抽取次数
    const now = new Date().toISOString();
    selectedQuestions.forEach(q => {
      if (!studentStats.stats[q.id]) {
        studentStats.stats[q.id] = createDefaultQuestionStat(now);
      }
      studentStats.stats[q.id].extraction_count++;
      studentStats.stats[q.id].last_extracted = now;
    });

    // 11. 更新元数据并保存
    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 12. 返回题目
    const questionsForClient = selectedQuestions.map(q => ({
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      stars: q.stars,
      question: q.question,
      options: q.options,
      category: q.category,
      source: q.source,
      tags: q.tags,
      correct: q.correct,
      explanation: q.explanation
    }));

    return sendResponse(res, 1, "获取成功", {
      questions: questionsForClient,
      range: {
        start: parseInt(start),
        end: parseInt(end),
        total: selectedQuestions.length
      },
      bank: bankConfig.id,
      stats: {
        totalQuestions: allQuestions.length,
        masteredCount: getMasteredCount(allQuestions, studentStats),
        weakCount: getWeakCount(allQuestions, studentStats),
        newCount: getNewCount(allQuestions, studentStats)
      },
      filePath: `/resource/person_name/${username}/test_select_master/${bankConfig.statsFile}`
    });

  } catch (err) {
    console.error("获取范围题目失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 获取题库总题数
 * GET /api/questions/total?bank=default
 */
router.get("/total", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    const { bank = "default" } = req.query;

    // 读取对应题库的题目母版
    const masterPath = getMasterQuestionsPath(bank);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const totalQuestions = masterData.questions?.length || 0;

    return sendResponse(res, 1, "获取成功", {
      total: totalQuestions,
      bank: getBankConfig(bank).id
    });

  } catch (err) {
    console.error("获取总题数失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 提交答案（支持多题库）
 * POST /api/questions/submit
 * body: { answers: { questionId: "A", ... }, timeSpent: 120, bank: "default" }
 */
router.post("/submit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    // 获取提交的答案和题库参数
    const { answers, timeSpent = 0, bank = "default" } = req.body;
    if (!answers || typeof answers !== 'object') {
      return sendResponse(res, 0, "请提供答案数据");
    }

    // 读取对应题库的题目母版（从原路径读取）
    const masterPath = getMasterQuestionsPath(bank);
    const masterData = await smartRead(masterPath, { questions: [] });
    const questionsMap = {};
    masterData.questions.forEach(q => {
      questionsMap[q.id] = q;
    });

    // 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 读取对应题库的学生统计（从新路径读取）
    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    // 统计结果
    const results = [];
    const now = new Date().toISOString();

    Object.entries(answers).forEach(([questionId, userAnswer]) => {
      const question = questionsMap[questionId];
      if (!question) return;

      const isCorrect = userAnswer === question.correct;
      const responseTime = Math.floor(Math.random() * 10) + 3; // 模拟答题时间

      if (!studentStats.stats[questionId]) {
        studentStats.stats[questionId] = createDefaultQuestionStat(now);
      }

      const stat = studentStats.stats[questionId];

      if (isCorrect) {
        stat.correct_count++;
      } else {
        stat.wrong_count++;
      }

      stat.last_extracted = now;
      stat.last_result = isCorrect;

      stat.history.push({
        date: now,
        result: isCorrect,
        time: responseTime
      });

      if (stat.history.length > 20) {
        stat.history = stat.history.slice(-20);
      }

      updateStreak(stat, isCorrect);
      updateTimeStats(stat, responseTime);
      stat.mastery_level = calculateMasteryLevel(stat);

      results.push({
        questionId,
        isCorrect,
        correctAnswer: question.correct,
        userAnswer
      });
    });

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    const correctCount = results.filter(r => r.isCorrect).length;
    const totalCount = results.length;

    return sendResponse(res, 1, "提交成功", {
      results,
      summary: {
        total: totalCount,
        correct: correctCount,
        wrong: totalCount - correctCount,
        accuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) / 100 : 0
      },
      stats: {
        totalAttempts: studentStats.metadata.totalAttempts,
        accuracy: studentStats.metadata.accuracy,
        weakCount: getWeakCount(masterData.questions, studentStats)
      },
      bank: bank,
      filePath: `/resource/person_name/${username}/test_select_master/${getBankConfig(bank).statsFile}`
    });

  } catch (err) {
    console.error("提交答案失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学习报告（支持多题库）
 * GET /api/questions/report?bank=default
 */
router.get("/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    const { bank = "default" } = req.query;

    // 读取对应题库的题目母版（从原路径读取）
    const masterPath = getMasterQuestionsPath(bank);
    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    // 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 读取对应题库的学生统计（从新路径读取）
    const statsPath = getStudentStatsPath(username, bank);
    const studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    // 生成报告
    const weakQuestions = [];
    const masteredQuestions = [];
    const categoryStats = {};

    allQuestions.forEach(q => {
      const stat = studentStats.stats[q.id];
      const mastery = stat ? stat.mastery_level : 0;

      if (!categoryStats[q.category]) {
        categoryStats[q.category] = {
          total: 0,
          weak: 0,
          mastered: 0,
          avgMastery: 0,
          sumMastery: 0
        };
      }
      categoryStats[q.category].total++;
      categoryStats[q.category].sumMastery += mastery;

      if (mastery > 0 && mastery < 0.5) {
        weakQuestions.push({
          id: q.id,
          question: q.question,
          category: q.category,
          mastery: mastery,
          stats: stat
        });
      }

      if (mastery >= 0.8) {
        masteredQuestions.push({
          id: q.id,
          question: q.question,
          category: q.category,
          mastery: mastery
        });
      }
    });

    Object.keys(categoryStats).forEach(cat => {
      const catStat = categoryStats[cat];
      catStat.avgMastery = catStat.total > 0 
        ? Math.round((catStat.sumMastery / catStat.total) * 100) / 100 
        : 0;
    });

    const weakCategories = Object.entries(categoryStats)
      .map(([name, data]) => ({ name, ...data }))
      .filter(c => c.avgMastery < 0.6)
      .sort((a, b) => a.avgMastery - b.avgMastery);

    let recommendation = "";
    if (weakQuestions.length > allQuestions.length * 0.3) {
      recommendation = "建议先重点复习薄弱题目，每天坚持练习";
    } else if (studentStats.metadata.totalAttempts < 50) {
      recommendation = "刚开始练习，建议多做新题，熟悉题型";
    } else if (studentStats.metadata.accuracy > 0.8) {
      recommendation = "掌握得很好！可以挑战更高难度的题目";
    } else {
      recommendation = "保持当前学习节奏，定期复习巩固";
    }

    return sendResponse(res, 1, "获取报告成功", {
      metadata: studentStats.metadata,
      summary: {
        totalQuestions: allQuestions.length,
        attempted: Object.keys(studentStats.stats).length,
        weakCount: weakQuestions.length,
        masteredCount: masteredQuestions.length,
        newCount: allQuestions.length - Object.keys(studentStats.stats).length
      },
      categoryStats,
      weakCategories: weakCategories.slice(0, 5),
      weakQuestions: weakQuestions.slice(0, 10),
      masteredQuestions: masteredQuestions.slice(0, 10),
      recommendation,
      bank: bank,
      filePath: `/resource/person_name/${username}/test_select_master/${getBankConfig(bank).statsFile}`
    });

  } catch (err) {
    console.error("获取报告失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 重置题目统计（支持多题库）
 * POST /api/questions/reset
 * body: { questionId: "q_xxx", all: true, bank: "default" }
 */
router.post("/reset", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    const { questionId, all, bank = "default" } = req.body;

    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    if (all) {
      // 重置所有统计
      const now = new Date().toISOString();
      studentStats = {
        metadata: { 
          username, 
          bank,
          createdAt: studentStats.metadata?.createdAt || now,
          lastActive: now,
          totalAttempts: 0,
          totalCorrect: 0,
          totalWrong: 0,
          accuracy: 0
        },
        stats: {}
      };
    } else if (questionId) {
      if (studentStats.stats[questionId]) {
        delete studentStats.stats[questionId];
      } else {
        return sendResponse(res, 0, "题目不存在");
      }
    } else {
      return sendResponse(res, 0, "请指定要重置的题目");
    }

    await smartWrite(statsPath, studentStats);

    return sendResponse(res, 1, all ? "已重置所有统计" : "已重置题目统计", {
      filePath: `/resource/person_name/${username}/test_select_master/${getBankConfig(bank).statsFile}`
    });

  } catch (err) {
    console.error("重置失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取所有母版题（带学生统计，支持多题库）
 * GET /api/questions/master?bank=default
 */
router.get("/master", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    const { bank = "default" } = req.query;

    // 读取对应题库的题目母版（从原路径读取）
    const masterPath = getMasterQuestionsPath(bank);
    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    // 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 读取对应题库的学生统计（从新路径读取）
    const statsPath = getStudentStatsPath(username, bank);
    const studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    // 合并题目和统计信息
    const questionsWithStats = allQuestions.map(q => {
      const stat = studentStats.stats[q.id] || createDefaultQuestionStat(null);
      
      const totalAttempts = (stat.correct_count || 0) + (stat.wrong_count || 0);
      const accuracy = totalAttempts > 0 
        ? Math.round((stat.correct_count / totalAttempts) * 100) / 100 
        : 0;

      return {
        id: q.id,
        type: q.type,
        difficulty: q.difficulty,
        stars: q.stars,
        question: q.question,
        options: q.options,
        category: q.category,
        source: q.source,
        tags: q.tags,
        correct: q.correct,
        explanation: q.explanation,
        stats: {
          ...stat,
          total_attempts: totalAttempts,
          accuracy: accuracy
        }
      };
    });

    // 计算总体统计
    const totalAttempts = Object.values(studentStats.stats || {}).reduce(
      (sum, s) => sum + (s.correct_count || 0) + (s.wrong_count || 0), 0
    );
    
    const totalCorrect = Object.values(studentStats.stats || {}).reduce(
      (sum, s) => sum + (s.correct_count || 0), 0
    );

    // 按分类统计
    const categorySummary = {};
    const difficultySummary = {
      easy: { total: 0, mastered: 0, weak: 0 },
      medium: { total: 0, mastered: 0, weak: 0 },
      hard: { total: 0, mastered: 0, weak: 0 }
    };

    allQuestions.forEach(q => {
      if (!categorySummary[q.category]) {
        categorySummary[q.category] = {
          total: 0,
          attempted: 0,
          mastered: 0,
          weak: 0,
          avgMastery: 0,
          sumMastery: 0
        };
      }
      categorySummary[q.category].total++;
      
      if (difficultySummary[q.difficulty]) {
        difficultySummary[q.difficulty].total++;
      }

      const stat = studentStats.stats[q.id];
      if (stat) {
        categorySummary[q.category].attempted++;
        categorySummary[q.category].sumMastery += stat.mastery_level || 0;
        
        if (stat.mastery_level >= 0.8) {
          categorySummary[q.category].mastered++;
          if (difficultySummary[q.difficulty]) {
            difficultySummary[q.difficulty].mastered++;
          }
        }
        if (stat.mastery_level < 0.5 && stat.mastery_level > 0) {
          categorySummary[q.category].weak++;
          if (difficultySummary[q.difficulty]) {
            difficultySummary[q.difficulty].weak++;
          }
        }
      }
    });

    Object.keys(categorySummary).forEach(cat => {
      const catStat = categorySummary[cat];
      catStat.avgMastery = catStat.attempted > 0 
        ? Math.round((catStat.sumMastery / catStat.attempted) * 100) / 100 
        : 0;
    });

    return sendResponse(res, 1, "获取成功", {
      metadata: {
        username,
        totalQuestions: allQuestions.length,
        totalAttempts,
        totalCorrect,
        totalWrong: totalAttempts - totalCorrect,
        accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) / 100 : 0,
        lastActive: studentStats.metadata?.lastActive || null,
        createdAt: studentStats.metadata?.createdAt || null,
        bank: bank
      },
      questions: questionsWithStats,
      categorySummary,
      difficultySummary,
      stats: {
        mastered: questionsWithStats.filter(q => q.stats.mastery_level >= 0.8).length,
        weak: questionsWithStats.filter(q => q.stats.mastery_level < 0.5 && q.stats.mastery_level > 0).length,
        never: questionsWithStats.filter(q => q.stats.mastery_level === 0).length,
        review: questionsWithStats.filter(q => q.stats.mastery_level >= 0.5 && q.stats.mastery_level < 0.8).length
      },
      filePath: `/resource/person_name/${username}/test_select_master/${getBankConfig(bank).statsFile}`
    });

  } catch (err) {
    console.error("获取母版题失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 调试接口：检查文件系统状态
 * GET /api/questions/debug/check-files
 */
router.get("/debug/check-files", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    
    const testMasterDir = path.join(__dirname, "../", "resource/english_test_select_master");
    const personNameDir = path.join(__dirname, "../", "resource/person_name");
    
    const result = {
      directories: {
        testMaster: {
          path: testMasterDir,
          exists: fs.existsSync(testMasterDir),
          content: fs.existsSync(testMasterDir) ? fs.readdirSync(testMasterDir) : []
        },
        personName: {
          path: personNameDir,
          exists: fs.existsSync(personNameDir),
          content: fs.existsSync(personNameDir) ? fs.readdirSync(personNameDir) : []
        }
      },
      bankFiles: {},
      userStats: {}
    };

    // 检查每个题库文件（原路径）
    for (const [key, bank] of Object.entries(QUESTION_BANKS)) {
      const filePath = path.join(testMasterDir, bank.masterFile);
      const fileExists = fs.existsSync(filePath);
      
      let fileInfo = null;
      if (fileExists) {
        try {
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          fileInfo = {
            size: stats.size,
            lastModified: stats.mtime,
            questionCount: data.questions?.length || 0,
            sampleIds: data.questions?.slice(0, 3).map(q => q.id) || []
          };
        } catch (e) {
          fileInfo = { error: e.message };
        }
      }
      
      result.bankFiles[bank.id] = {
        id: bank.id,
        name: bank.name,
        masterFile: bank.masterFile,
        filePath,
        exists: fileExists,
        fileInfo
      };
    }

    // 检查当前用户统计文件（新路径）
    if (username) {
      const userTestMasterDir = path.join(personNameDir, username, "test_select_master");
      result.userDirectory = {
        username,
        path: userTestMasterDir,
        exists: fs.existsSync(userTestMasterDir),
        files: fs.existsSync(userTestMasterDir) ? fs.readdirSync(userTestMasterDir) : []
      };
      
      for (const [key, bank] of Object.entries(QUESTION_BANKS)) {
        const statsPath = getStudentStatsPath(username, bank.id);
        const statsExists = fs.existsSync(statsPath);
        
        result.userStats[bank.id] = {
          statsFile: bank.statsFile,
          filePath: statsPath,
          exists: statsExists
        };
      }
    }

    return sendResponse(res, 1, "调试信息", result);
  } catch (err) {
    console.error("调试检查失败:", err);
    return sendResponse(res, 0, "调试失败", { error: err.message });
  }
});

/**
 * 批量获取题目统计（支持多题库）
 * POST /api/questions/stats/batch
 * body: { questionIds: ["q_1", "q_2", ...], bank: "default" }
 */
router.post("/stats/batch", async (req, res) => {
  try {
    // 1. 验证token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    // 2. 获取参数
    const { questionIds = [], bank = "default" } = req.body;
    
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return sendResponse(res, 0, "请提供题目ID数组");
    }

    // 3. 获取题库配置
    const bankConfig = getBankConfig(bank);

    // 4. 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 5. 读取对应题库的学生统计
    const statsPath = getStudentStatsPath(username, bank);
    const studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: bankConfig.id },
      stats: {} 
    });

    // 6. 批量获取题目统计
    const statsList = [];
    const now = new Date().toISOString();

    questionIds.forEach(questionId => {
      // 获取该题的统计，如果没有则创建默认统计但只返回基础数据
      let stat = studentStats.stats[questionId];
      
      if (!stat) {
        // 如果没有统计记录，返回默认值（不保存到文件）
        stat = createDefaultQuestionStat(now);
        // 设置 last_practiced 为 null 表示从未练习过
        stat.last_extracted = null;
      }

      // 计算总尝试次数
      const totalAttempts = (stat.correct_count || 0) + (stat.wrong_count || 0);
      
      // 计算正确率
      const accuracy = totalAttempts > 0 
        ? Math.round((stat.correct_count / totalAttempts) * 100) / 100 
        : 0;

      // 获取最近的答题历史（最多10条）
      const recentHistory = (stat.history || []).slice(-10).map(h => ({
        date: h.date,
        result: h.result,
        time: h.time
      }));

      statsList.push({
        questionId,
        mastery_level: stat.mastery_level || 0,
        correct_count: stat.correct_count || 0,
        wrong_count: stat.wrong_count || 0,
        total_attempts: totalAttempts,
        accuracy: accuracy,
        last_practiced: stat.last_extracted || null,
        last_result: stat.last_result || null,
        first_seen: stat.first_seen || null,
        streak: {
          current_correct: stat.streak?.current_correct || 0,
          current_wrong: stat.streak?.current_wrong || 0,
          max_correct: stat.streak?.max_correct || 0,
          max_wrong: stat.streak?.max_wrong || 0
        },
        time_stats: {
          avg_time: stat.time_stats?.avg_time || 0,
          fastest: stat.time_stats?.fastest || 0,
          slowest: stat.time_stats?.slowest || 0
        },
        history: recentHistory
      });
    });

    // 7. 返回结果
    return sendResponse(res, 1, "获取成功", {
      stats: statsList,
      count: statsList.length,
      bank: bankConfig.id,
      filePath: `/resource/person_name/${username}/test_select_master/${bankConfig.statsFile}`
    });

  } catch (err) {
    console.error("批量获取题目统计失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 获取单题详细统计（包含完整历史）
 * GET /api/questions/stats/:questionId?bank=default
 */
router.get("/stats/:questionId", async (req, res) => {
  try {
    // 1. 验证token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 确保用户统计目录存在
    ensureUserStatsDirectory(username);

    // 2. 获取参数
    const { questionId } = req.params;
    const { bank = "default" } = req.query;

    if (!questionId) {
      return sendResponse(res, 0, "请提供题目ID");
    }

    // 3. 获取题库配置
    const bankConfig = getBankConfig(bank);

    // 4. 确保该题库的统计文件存在
    await ensureDefaultStatsFile(username, bank);

    // 5. 读取对应题库的学生统计
    const statsPath = getStudentStatsPath(username, bank);
    const studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: bankConfig.id },
      stats: {} 
    });

    // 6. 获取该题的统计
    const stat = studentStats.stats[questionId];
    
    if (!stat) {
      // 如果没有统计记录，返回提示
      return sendResponse(res, 1, "该题暂无练习记录", {
        questionId,
        hasData: false,
        message: "您还没有练习过这道题"
      });
    }

    // 计算总尝试次数和正确率
    const totalAttempts = (stat.correct_count || 0) + (stat.wrong_count || 0);
    const accuracy = totalAttempts > 0 
      ? Math.round((stat.correct_count / totalAttempts) * 100) / 100 
      : 0;

    // 7. 返回详细统计
    return sendResponse(res, 1, "获取成功", {
      questionId,
      hasData: true,
      mastery_level: stat.mastery_level || 0,
      correct_count: stat.correct_count || 0,
      wrong_count: stat.wrong_count || 0,
      total_attempts: totalAttempts,
      accuracy: accuracy,
      first_seen: stat.first_seen,
      last_practiced: stat.last_extracted,
      last_result: stat.last_result,
      streak: stat.streak || {
        current_correct: 0,
        current_wrong: 0,
        max_correct: 0,
        max_wrong: 0
      },
      time_stats: stat.time_stats || {
        avg_time: 0,
        fastest: 0,
        slowest: 0
      },
      history: stat.history || [],
      filePath: `/resource/person_name/${username}/test_select_master/${bankConfig.statsFile}`
    });

  } catch (err) {
    console.error("获取题目统计失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

module.exports = router;
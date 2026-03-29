// questionRoutes.js - 限制历史记录最多7条
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

// ==================== 动态题库发现 ====================

/**
 * 从文件系统动态发现所有可用的题库
 * @returns {Array} 题库列表
 */
const discoverQuestionBanks = async () => {
  const masterDir = path.join(__dirname, "../", "resource/english_test_select_master");
  
  if (!fs.existsSync(masterDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(masterDir);
    const banks = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(masterDir, file);
      try {
        const data = await smartRead(filePath, { questions: [] });
        const questions = data.questions || [];
        
        const bankId = file.replace('.json', '');
        const categories = [...new Set(questions.map(q => q.category).filter(Boolean))];
        let bankName = data.name || bankId;
        
        banks.push({
          id: bankId,
          name: bankName,
          description: data.description || `${bankId}题库`,
          totalQuestions: questions.length,
          categories: categories.length > 0 ? categories : ['未分类'],
          masterFile: file,
          statsFile: `${bankId}_stats.json`
        });
      } catch (err) {
        const bankId = file.replace('.json', '');
        banks.push({
          id: bankId,
          name: bankId,
          description: `${bankId}题库`,
          totalQuestions: 0,
          categories: ['未知'],
          masterFile: file,
          statsFile: `${bankId}_stats.json`
        });
      }
    }

    return banks;
  } catch (err) {
    return [];
  }
};

/**
 * 根据ID获取题库配置
 * @param {string} bankId - 题库ID
 * @returns {Promise<Object>} 题库配置
 */
const getBankConfig = async (bankId) => {
  const banks = await discoverQuestionBanks();
  return banks.find(b => b.id === bankId) || null;
};

/**
 * 获取题目母版路径
 * @param {string} bankId - 题库ID
 * @returns {string} 文件路径
 */
const getMasterQuestionsPath = (bankId) => {
  return path.join(
    __dirname, 
    "../", 
    "resource/english_test_select_master",
    `${bankId}.json`
  );
};

/**
 * 获取学生统计文件路径
 * @param {string} username - 用户名
 * @param {string} bankId - 题库ID
 * @returns {string} 文件路径
 */
const getStudentStatsPath = (username, bankId) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_select_master",
    `${bankId}_stats.json`
  );
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
  }
  
  return userStatsDir;
};

/**
 * 确保默认统计文件存在
 * @param {string} username - 用户名
 * @param {string} bankId - 题库ID
 */
const ensureDefaultStatsFile = async (username, bankId) => {
  const statsPath = getStudentStatsPath(username, bankId);
  
  if (!fs.existsSync(statsPath)) {
    const now = new Date().toISOString();
    const defaultStats = {
      metadata: {
        username,
        bank: bankId,
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
  }
};

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

// ==================== API接口 ====================

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

    ensureUserStatsDirectory(username);

    const banks = await discoverQuestionBanks();

    for (const bank of banks) {
      await ensureDefaultStatsFile(username, bank.id);
    }

    const banksWithStats = await Promise.all(
      banks.map(async (bank) => {
        const statsPath = getStudentStatsPath(username, bank.id);
        const userStats = await smartRead(statsPath, { metadata: {}, stats: {} });
        
        return {
          ...bank,
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
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取题目（支持智能抽取和多题库）
 * GET /api/questions/get?type=smart&count=10&bank=default
 */
router.get("/get", async (req, res) => {
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

    ensureUserStatsDirectory(username);

    const { type = "smart", count = 10, bank = "default" } = req.query;
    const questionCount = parseInt(count) || 10;

    const masterPath = getMasterQuestionsPath(bank);
    // console.log('11111111111',req.query,bank,masterPath)
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bank}.json`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    if (allQuestions.length === 0) {
      return sendResponse(res, 0, "题库为空");
    }

    await ensureDefaultStatsFile(username, bank);
    
    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

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

    selectedQuestions.forEach(q => {
      if (!studentStats.stats[q.id]) {
        studentStats.stats[q.id] = createDefaultQuestionStat(now);
      }
      studentStats.stats[q.id].extraction_count++;
      studentStats.stats[q.id].last_extracted = now;
    });

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

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

    const masteredCount = getMasteredCount(allQuestions, studentStats);
    const weakCount = getWeakCount(allQuestions, studentStats);
    const newCount = getNewCount(allQuestions, studentStats);

    return sendResponse(res, 1, "获取成功", {
      questions: questionsForClient,
      count: questionsForClient.length,
      type: type,
      bank: bank,
      stats: {
        totalQuestions: allQuestions.length,
        masteredCount: masteredCount,
        weakCount: weakCount,
        newCount: newCount
      },
      filePath: `/resource/person_name/${username}/test_select_master/${bank}_stats.json`
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 按题号范围获取题目（支持按类型筛选）
 * GET /api/questions/range?start=1&end=10&type=smart&bank=default
 */
router.get("/range", async (req, res) => {
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

    ensureUserStatsDirectory(username);

    const { 
      start = 1, 
      end = 10, 
      type = "smart",
      bank = "default" 
    } = req.query;

    const startIndex = parseInt(start) - 1;
    const endIndex = parseInt(end) - 1;

    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      return sendResponse(res, 0, "无效的题号范围");
    }

    const masterPath = getMasterQuestionsPath(bank);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bank}.json`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    if (allQuestions.length === 0) {
      return sendResponse(res, 0, "题库为空");
    }

    if (startIndex >= allQuestions.length || endIndex >= allQuestions.length) {
      return sendResponse(res, 0, `题号超出范围，题库共有 ${allQuestions.length} 题`);
    }

    const rangeQuestions = allQuestions.slice(startIndex, endIndex + 1);

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    let selectedQuestions = [];

    switch (type) {
      case "weak":
        selectedQuestions = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          return stat && stat.mastery_level < 0.5 && stat.mastery_level > 0;
        });
        break;
        
      case "new":
        selectedQuestions = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          const isNew = !stat || (stat.correct_count + stat.wrong_count === 0);
          return isNew;
        });
        break;
        
      case "review":
        selectedQuestions = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          return stat && stat.mastery_level >= 0.5 && stat.mastery_level < 0.8;
        });
        break;
        
      case "mastered":
        selectedQuestions = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          return stat && stat.mastery_level >= 0.8;
        });
        break;
        
      case "random":
        selectedQuestions = [...rangeQuestions];
        break;
        
      case "smart":
      default:
        const newOnes = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          return !stat || (stat.correct_count + stat.wrong_count === 0);
        });
        
        const weakOnes = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          return stat && stat.mastery_level < 0.5 && stat.mastery_level > 0;
        });
        
        const reviewOnes = rangeQuestions.filter(q => {
          const stat = studentStats.stats[q.id];
          return stat && stat.mastery_level >= 0.5 && stat.mastery_level < 0.8;
        });
        
        const smartQuestions = [
          ...newOnes,
          ...weakOnes,
          ...reviewOnes
        ];
        
        const uniqueIds = new Set();
        selectedQuestions = smartQuestions.filter(q => {
          if (uniqueIds.has(q.id)) return false;
          uniqueIds.add(q.id);
          return true;
        });
        break;
    }

    if (selectedQuestions.length === 0) {
      return sendResponse(res, 1, "获取成功", {
        questions: [],
        range: {
          start: parseInt(start),
          end: parseInt(end),
          total: 0,
          rangeTotal: rangeQuestions.length
        },
        type: type,
        bank: bank,
        stats: {
          totalQuestions: allQuestions.length,
          rangeTotal: rangeQuestions.length,
          masteredCount: getMasteredCount(allQuestions, studentStats),
          weakCount: getWeakCount(allQuestions, studentStats),
          newCount: getNewCount(allQuestions, studentStats)
        }
      });
    }

    const now = new Date().toISOString();
    selectedQuestions.forEach(q => {
      if (!studentStats.stats[q.id]) {
        studentStats.stats[q.id] = createDefaultQuestionStat(now);
      }
      studentStats.stats[q.id].extraction_count++;
      studentStats.stats[q.id].last_extracted = now;
    });

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

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
        total: questionsForClient.length,
        rangeTotal: rangeQuestions.length
      },
      type: type,
      bank: bank,
      stats: {
        totalQuestions: allQuestions.length,
        rangeTotal: rangeQuestions.length,
        masteredCount: getMasteredCount(allQuestions, studentStats),
        weakCount: getWeakCount(allQuestions, studentStats),
        newCount: getNewCount(allQuestions, studentStats)
      }
    });

  } catch (err) {
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

    const masterPath = getMasterQuestionsPath(bank);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const totalQuestions = masterData.questions?.length || 0;

    return sendResponse(res, 1, "获取成功", {
      total: totalQuestions,
      bank: bank
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 提交答案 - 限制历史记录最多7条
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

    ensureUserStatsDirectory(username);

    const { answers, timeSpent = 0, bank = "default" } = req.body;
    if (!answers || typeof answers !== 'object') {
      return sendResponse(res, 0, "请提供答案数据");
    }

    const masterPath = getMasterQuestionsPath(bank);
    const masterData = await smartRead(masterPath, { questions: [] });
    const questionsMap = {};
    masterData.questions.forEach(q => {
      questionsMap[q.id] = q;
    });

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    const results = [];
    const now = new Date().toISOString();
    const MAX_HISTORY = 7; // 最多保存7条历史记录

    Object.entries(answers).forEach(([questionId, userAnswer]) => {
      const question = questionsMap[questionId];
      if (!question) return;

      const isCorrect = userAnswer === question.correct;
      const responseTime = Math.floor(Math.random() * 10) + 3;

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

      // 添加历史记录
      stat.history.push({
        date: now,
        result: isCorrect,
        time: responseTime
      });

      // 限制历史记录最多7条（只保留最新的7条）
      if (stat.history.length > MAX_HISTORY) {
        stat.history = stat.history.slice(-MAX_HISTORY);
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
      filePath: `/resource/person_name/${username}/test_select_master/${bank}_stats.json`
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学习报告
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

    ensureUserStatsDirectory(username);

    const { bank = "default" } = req.query;

    const masterPath = getMasterQuestionsPath(bank);
    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    const studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

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
      filePath: `/resource/person_name/${username}/test_select_master/${bank}_stats.json`
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 重置题目统计
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

    ensureUserStatsDirectory(username);

    const { questionId, all, bank = "default" } = req.body;

    const statsPath = getStudentStatsPath(username, bank);
    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

    if (all) {
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
      filePath: `/resource/person_name/${username}/test_select_master/${bank}_stats.json`
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取所有母版题（带学生统计）
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

    ensureUserStatsDirectory(username);

    const { bank = "default" } = req.query;

    const masterPath = getMasterQuestionsPath(bank);
    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    const studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      stats: {} 
    });

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

    const totalAttempts = Object.values(studentStats.stats || {}).reduce(
      (sum, s) => sum + (s.correct_count || 0) + (s.wrong_count || 0), 0
    );
    
    const totalCorrect = Object.values(studentStats.stats || {}).reduce(
      (sum, s) => sum + (s.correct_count || 0), 0
    );

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
      filePath: `/resource/person_name/${username}/test_select_master/${bank}_stats.json`
    });

  } catch (err) {
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
    
    const banks = await discoverQuestionBanks();
    
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
      discoveredBanks: banks,
      userStats: {}
    };

    if (username) {
      const userTestMasterDir = path.join(personNameDir, username, "test_select_master");
      result.userDirectory = {
        username,
        path: userTestMasterDir,
        exists: fs.existsSync(userTestMasterDir),
        files: fs.existsSync(userTestMasterDir) ? fs.readdirSync(userTestMasterDir) : []
      };
      
      for (const bank of banks) {
        const statsPath = getStudentStatsPath(username, bank.id);
        const statsExists = fs.existsSync(statsPath);
        
        result.userStats[bank.id] = {
          statsFile: `${bank.id}_stats.json`,
          filePath: statsPath,
          exists: statsExists
        };
      }
    }

    return sendResponse(res, 1, "调试信息", result);
  } catch (err) {
    return sendResponse(res, 0, "调试失败", { error: err.message });
  }
});

module.exports = router;
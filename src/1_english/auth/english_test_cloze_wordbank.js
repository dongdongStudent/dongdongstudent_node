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

const smartRead = async (filePath, defaultData = {}) => {
  if (!fs.existsSync(filePath)) {
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return defaultData;
    return JSON.parse(raw);
  } catch (e) {
    console.error("读取失败:", e.message);
    return defaultData;
  }
};

const smartWrite = async (filePath, data) => {
  const content = JSON.stringify(data, null, 2);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return fs.promises.writeFile(filePath, content, "utf8");
};

// ==================== 题库配置 ====================

const WORD_BANKS = {
  middle: {
    id: '中考',
    key: 'middle',
    name: '中考词汇变形',
    description: '中考英语词汇变形填空',
    icon: '📝',
    color: '#c62828',
    masterFile: 'wordbank_middle_master.json',
    statsFile: 'wordbank_middle_stats.json',
    aliases: ['middle', '中考', '词汇变形中考'],
    totalQuestions: 15,
    categories: ['教育', '生活', '健康', '故事', '科普']
  },
  high: {
    id: '高考',
    key: 'high',
    name: '高考词汇变形',
    description: '高考英语词汇变形填空',
    icon: '✍️',
    color: '#2e7d32',
    masterFile: 'wordbank_high_master.json',
    statsFile: 'wordbank_high_stats.json',
    aliases: ['high', '高考', '词汇变形高考'],
    totalQuestions: 15,
    categories: ['社会', '文化', '科技', '哲理']
  }
};

/**
 * 根据ID或别名获取题库配置
 */
const getBankConfig = (bankId) => {
  if (WORD_BANKS[bankId]) return WORD_BANKS[bankId];
  
  for (const [key, config] of Object.entries(WORD_BANKS)) {
    if (config.id === bankId) return config;
    if (config.aliases && config.aliases.includes(bankId)) return config;
  }
  return null;
};

/**
 * 获取学生统计文件路径
 */
const getStudentStatsPath = (username, bankId = 'default') => {
  const bank = getBankConfig(bankId);
  if (!bank) return null;
  
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_wordbank_master",
    bank.statsFile
  );
};

/**
 * 获取题目母版路径
 */
const getMasterQuestionsPath = (bankId = 'default') => {
  const bank = getBankConfig(bankId);
  if (!bank) return null;
  
  return path.join(
    __dirname, 
    "../", 
    "resource/english_wordbank_master",
    bank.masterFile
  );
};

/**
 * 确保用户统计目录存在
 */
const ensureUserStatsDirectory = (username) => {
  const userStatsDir = path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_wordbank_master"
  );
  
  if (!fs.existsSync(userStatsDir)) {
    fs.mkdirSync(userStatsDir, { recursive: true });
  }
  return userStatsDir;
};

/**
 * 创建默认的统计文件
 */
const ensureDefaultStatsFile = async (username, bankId) => {
  const bank = getBankConfig(bankId);
  if (!bank) return;
  
  const statsPath = getStudentStatsPath(username, bankId);
  if (!statsPath) return;
  
  if (!fs.existsSync(statsPath)) {
    const now = new Date().toISOString();
    const defaultStats = {
      metadata: {
        username,
        bank: bank.id,
        createdAt: now,
        lastActive: now,
        totalExtracts: 0,
        totalQuestionsAttempted: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracy: 0,
        avgMastery: 0,
        practicedQuestions: 0
      },
      questions: {}
    };
    
    await smartWrite(statsPath, defaultStats);
  }
};

// ==================== 统计函数 ====================

const createDefaultQuestionStat = (now) => ({
  extract_count: 0,
  answer_count: 0,
  correct_count: 0,
  wrong_count: 0,
  accuracy: 0,
  mastery_level: 0,
  first_seen: now,
  last_practiced: now,
  last_result: null,
  history: [],
  time_stats: { avg_time: 0, fastest: 0, slowest: 0 }
});

const calculateMasteryLevel = (stat) => {
  const total = stat.correct_count + stat.wrong_count;
  if (total === 0) return 0;

  const accuracy = stat.correct_count / total;
  
  let recentCorrect = 0;
  if (stat.history && stat.history.length >= 3) {
    const lastThree = stat.history.slice(-3);
    recentCorrect = lastThree.filter(h => h.result).length / 3;
  } else if (stat.history && stat.history.length === 2) {
    const lastTwo = stat.history.slice(-2);
    recentCorrect = lastTwo.filter(h => h.result).length / 2;
  } else if (stat.history && stat.history.length === 1) {
    recentCorrect = stat.history[0].result ? 1 : 0;
  }

  let timeDecay = 1;
  if (stat.last_practiced) {
    const daysSinceLast = (new Date() - new Date(stat.last_practiced)) / (1000 * 60 * 60 * 24);
    timeDecay = Math.max(0.7, 1 - daysSinceLast * 0.1);
  }

  const mastery = (recentCorrect * 0.6 + accuracy * 0.4) * timeDecay;
  return Math.min(1, Number(mastery.toFixed(2)));
};

/**
 * 更新元数据
 */
const updateMetadata = (stats) => {
  let totalExtracts = 0;
  let totalQuestionsAttempted = 0;
  let totalCorrect = 0;
  let totalMastery = 0;
  let questionCount = 0;

  // ✅ 修复：添加空值检查
  if (stats.questions) {
    Object.values(stats.questions).forEach(qStat => {
      if (qStat) { // 确保 qStat 存在
        totalExtracts += qStat.extract_count || 0;
        totalQuestionsAttempted += qStat.answer_count || 0;
        totalCorrect += qStat.correct_count || 0;
        totalMastery += qStat.mastery_level || 0;
        questionCount++;
      }
    });
  }

  stats.metadata = stats.metadata || {};
  stats.metadata.lastActive = new Date().toISOString();
  stats.metadata.totalExtracts = totalExtracts;
  stats.metadata.totalQuestionsAttempted = totalQuestionsAttempted;
  stats.metadata.totalCorrect = totalCorrect;
  stats.metadata.totalWrong = totalQuestionsAttempted - totalCorrect;
  stats.metadata.accuracy = totalQuestionsAttempted > 0 
    ? Math.round((totalCorrect / totalQuestionsAttempted) * 100) / 100 
    : 0;
  stats.metadata.avgMastery = questionCount > 0 
    ? Math.round((totalMastery / questionCount) * 100) / 100 
    : 0;
  stats.metadata.practicedQuestions = Object.keys(stats.questions || {}).length;

  return stats;
};

/**
 * 获取题目完整信息（带统计）
 */
const getQuestionWithStats = (question, qStat) => {
  return {
    id: question.id,
    number: question.number,
    givenWord: question.givenWord,
    correctForm: question.correctForm,
    explanation: question.explanation,
    sentence: question.sentence,
    source: question.source || {
      passageId: question.id.split('_')[0] + '_' + question.id.split('_')[1],
      passageTitle: '未知文章',
      category: '未分类',
      difficulty: 2
    },
    stats: qStat ? {
      extract_count: qStat.extract_count || 0,
      answer_count: qStat.answer_count || 0,
      correct_count: qStat.correct_count || 0,
      wrong_count: qStat.wrong_count || 0,
      accuracy: qStat.accuracy || 0,
      mastery_level: qStat.mastery_level || 0,
      first_seen: qStat.first_seen || null,
      last_practiced: qStat.last_practiced || null,
      last_result: qStat.last_result || null,
      history: qStat.history || [],
      time_stats: qStat.time_stats || { avg_time: 0, fastest: 0, slowest: 0 }
    } : null
  };
};

// ==================== API接口 ====================

/**
 * 获取题库列表
 * GET /api/wordbank/banks
 */
router.get("/banks", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const banksWithStats = await Promise.all(
      Object.values(WORD_BANKS).map(async (bank) => {
        const masterPath = getMasterQuestionsPath(bank.id);
        
        if (!masterPath || !fs.existsSync(masterPath)) return null;
        
        const masterData = await smartRead(masterPath, { questions: [] });
        
        if (!masterData.questions || masterData.questions.length === 0) return null;
        
        const actualTotal = masterData.questions?.length || 0;
        const categories = [...new Set(masterData.questions?.map(q => q.source?.category).filter(Boolean) || [])];
        
        return {
          id: bank.id,
          key: bank.key,
          name: bank.name,
          description: bank.description,
          icon: bank.icon,
          color: bank.color,
          totalQuestions: actualTotal,
          categories: categories.length > 0 ? categories : []
        };
      })
    );

    const existingBanks = banksWithStats.filter(bank => bank !== null);
    return sendResponse(res, 1, "获取成功", { banks: existingBanks });
  } catch (err) {
    console.error("获取题库列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取词汇变形题目
 * GET /api/wordbank/questions?type=smart&bank=default&count=10
 */
router.get("/questions", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { 
      type = "smart", 
      bank = "default", 
      count = 10,
      category = "all",
      difficulty = "all"
    } = req.query;
    
    const bankConfig = getBankConfig(bank);
    if (!bankConfig) return sendResponse(res, 0, `题库不存在: ${bank}`);

    const masterPath = getMasterQuestionsPath(bank);
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    let allQuestions = masterData.questions || [];

    if (allQuestions.length === 0) return sendResponse(res, 0, "题库为空");

    // 根据分类和难度过滤
    if (category !== "all") {
      allQuestions = allQuestions.filter(q => q.source?.category === category);
    }
    if (difficulty !== "all") {
      allQuestions = allQuestions.filter(q => q.source?.difficulty === parseInt(difficulty));
    }

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: bankConfig.id },
      questions: {} 
    });

    let selectedQuestions = [];
    const now = new Date().toISOString();

    // 如果是 all 类型，返回所有题目
    if (type === "all") {
      const questionsWithStats = allQuestions.map(question => {
        const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
        return getQuestionWithStats(question, qStat);
      });
    
      return sendResponse(res, 1, "获取成功", {
        questions: questionsWithStats,
        bank: bankConfig.id,
        total: questionsWithStats.length
      });
    }

    // 抽取逻辑
    if (type === "smart") {
      // 智能推荐：优先抽取未练习过或掌握程度低的题目
      const questionScores = allQuestions.map(question => {
        const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
        
        if (!qStat) return { question, score: 100 };
        
        // 掌握程度越低，分数越高
        const masteryScore = (1 - (qStat.mastery_level || 0)) * 100;
        // 练习次数越少，分数越高
        const extractScore = qStat.extract_count ? Math.max(0, 30 - qStat.extract_count * 10) : 30;
        
        return { question, score: masteryScore + extractScore };
      });
      
      questionScores.sort((a, b) => b.score - a.score);
      selectedQuestions = questionScores.slice(0, count).map(item => item.question);
    } 
    else if (type === "weak") {
      // 薄弱题目：掌握程度 < 50% 且 > 0
      const weakQuestions = allQuestions.filter(question => {
        const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
        return qStat && qStat.mastery_level > 0 && qStat.mastery_level < 0.5;
      });
      
      selectedQuestions = weakQuestions.length > 0 
        ? weakQuestions.slice(0, Math.min(count, weakQuestions.length))
        : allQuestions.slice(0, count);
    }
    else if (type === "new") {
      // 新题目：从未练习过的
      const newQuestions = allQuestions.filter(question => {
        return !studentStats.questions || !studentStats.questions[question.id];
      });
      selectedQuestions = newQuestions.length > 0 
        ? newQuestions.slice(0, Math.min(count, newQuestions.length))
        : allQuestions.slice(0, count);
    }
    else if (type === "review") {
      // 复习题目：掌握程度在 50%-80% 之间
      const reviewQuestions = allQuestions.filter(question => {
        const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
        return qStat && qStat.mastery_level >= 0.5 && qStat.mastery_level < 0.8;
      });
      
      selectedQuestions = reviewQuestions.length > 0 
        ? reviewQuestions.slice(0, Math.min(count, reviewQuestions.length))
        : allQuestions.slice(0, count);
    }
    else if (type === "mastered") {
      // 已掌握题目：掌握程度 >= 80%
      const masteredQuestions = allQuestions.filter(question => {
        const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
        return qStat && qStat.mastery_level >= 0.8;
      });
      
      selectedQuestions = masteredQuestions.length > 0 
        ? masteredQuestions.slice(0, Math.min(count, masteredQuestions.length))
        : allQuestions.slice(0, count);
    }
    else if (type === "random") {
      // 随机抽取
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      selectedQuestions = shuffled.slice(0, count);
    }
    else {
      // 默认随机
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      selectedQuestions = shuffled.slice(0, count);
    }

    // ✅ 修复：确保 studentStats.questions 存在
    if (!studentStats.questions) {
      studentStats.questions = {};
    }

    // 记录题目被查看
    selectedQuestions.forEach(question => {
      if (!studentStats.questions[question.id]) {
        studentStats.questions[question.id] = createDefaultQuestionStat(now);
      } else {
        studentStats.questions[question.id].last_practiced = now;
      }
    });

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 返回题目（不包含正确答案，用于练习）
    const questionsForClient = selectedQuestions.map(q => ({
      id: q.id,
      number: q.number,
      givenWord: q.givenWord,
      sentence: q.sentence,
      source: q.source
      // 不发送 correctForm 和 explanation，只在提交时验证
    }));

    return sendResponse(res, 1, "获取成功", {
      questions: questionsForClient,
      bank: bankConfig.id,
      stats: {
        totalQuestions: allQuestions.length,
        attemptedQuestions: Object.keys(studentStats.questions || {}).length,
        currentCount: selectedQuestions.length
      }
    });

  } catch (err) {
    console.error("获取题目失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 提交词汇变形答案
 * POST /api/wordbank/submit
 */
router.post("/submit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { questionIds = [], answers = [], timeSpent = 0, bank = "default" } = req.body;
    
    if (!questionIds.length || !answers.length) {
      return sendResponse(res, 0, "请提供题目ID和答案");
    }

    if (questionIds.length !== answers.length) {
      return sendResponse(res, 0, "题目数量与答案数量不匹配");
    }

    const bankConfig = getBankConfig(bank);
    if (!bankConfig) return sendResponse(res, 0, `题库不存在: ${bank}`);

    const masterPath = getMasterQuestionsPath(bank);
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    
    // 创建题目映射，便于快速查找
    const questionsMap = {};
    masterData.questions.forEach(q => {
      questionsMap[q.id] = q;
    });

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      questions: {} 
    });

    const now = new Date().toISOString();
    const results = [];

    // ✅ 修复：确保 studentStats.questions 存在
    if (!studentStats.questions) {
      studentStats.questions = {};
    }

    // 批量处理每个答案
    for (let i = 0; i < questionIds.length; i++) {
      const questionId = questionIds[i];
      const userAnswer = answers[i];
      const question = questionsMap[questionId];
      
      if (!question) {
        results.push({
          questionId,
          isCorrect: false,
          error: "题目不存在"
        });
        continue;
      }

      // 词汇变形比较忽略大小写和空格
      const normalizedUser = String(userAnswer).trim().toLowerCase();
      const normalizedCorrect = String(question.correctForm).trim().toLowerCase();
      const isCorrect = normalizedUser === normalizedCorrect;

      const responseTime = Math.floor(Math.random() * 15) + 5; // 模拟用时

      // 确保该题目的统计存在
      if (!studentStats.questions[questionId]) {
        studentStats.questions[questionId] = createDefaultQuestionStat(now);
      }

      const qStat = studentStats.questions[questionId];

      // 更新统计
      qStat.extract_count += 1;
      qStat.answer_count += 1;
      
      if (isCorrect) {
        qStat.correct_count += 1;
      } else {
        qStat.wrong_count += 1;
      }

      qStat.last_practiced = now;
      qStat.last_result = isCorrect;
      qStat.accuracy = qStat.correct_count / qStat.answer_count;

      // ========== 修改点：在历史记录中添加用户填写的答案，并限制只保留最新的7条 ==========
      // 添加历史记录（包含用户填写的答案）
      qStat.history.push({
        date: now,
        result: isCorrect,
        time: responseTime,
        userAnswer: userAnswer,  // 记录用户填写的答案
        correctAnswer: question.correctForm  // 记录正确答案，方便对比
      });

      // 限制历史记录只保留最新的7条
      if (qStat.history.length > 7) {
        qStat.history = qStat.history.slice(-7);
      }
      // ======================================================

      // 更新时间统计
      const times = qStat.history.map(h => h.time).filter(t => t > 0);
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        qStat.time_stats.avg_time = Number((sum / times.length).toFixed(1));
        qStat.time_stats.fastest = Math.min(...times);
        qStat.time_stats.slowest = Math.max(...times);
      }

      // 重新计算掌握程度
      qStat.mastery_level = calculateMasteryLevel(qStat);

      results.push({
        questionId,
        number: question.number,
        isCorrect,
        correctAnswer: question.correctForm,
        userAnswer: userAnswer
      });
    }

    // 更新元数据并保存
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
        totalExtracts: studentStats.metadata.totalExtracts,
        totalQuestionsAttempted: studentStats.metadata.totalQuestionsAttempted,
        totalCorrect: studentStats.metadata.totalCorrect,
        accuracy: studentStats.metadata.accuracy,
        avgMastery: studentStats.metadata.avgMastery
      }
    });

  } catch (err) {
    console.error("提交答案失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取题目详情（带解析）
 * GET /api/wordbank/questions/:questionId/details?bank=default
 */
router.get("/questions/:questionId/details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { questionId } = req.params;
    const { bank = "default" } = req.query;

    const bankConfig = getBankConfig(bank);
    if (!bankConfig) return sendResponse(res, 0, `题库不存在: ${bank}`);

    const masterPath = getMasterQuestionsPath(bank);
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    
    const question = masterData.questions.find(q => q.id === questionId);
    if (!question) return sendResponse(res, 0, "题目不存在");

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    const studentStats = await smartRead(statsPath, { metadata: {}, questions: {} });

    const qStat = studentStats.questions ? studentStats.questions[questionId] : null;

    const questionWithStats = getQuestionWithStats(question, qStat);

    return sendResponse(res, 1, "获取成功", {
      question: questionWithStats,
      stats: qStat ? {
        extract_count: qStat.extract_count || 0,
        answer_count: qStat.answer_count || 0,
        avg_mastery: qStat.mastery_level || 0
      } : null
    });

  } catch (err) {
    console.error("获取题目详情失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学习报告
 * GET /api/wordbank/report?bank=default
 */
router.get("/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { bank = "default" } = req.query;

    const bankConfig = getBankConfig(bank);
    if (!bankConfig) return sendResponse(res, 0, `题库不存在: ${bank}`);

    const masterPath = getMasterQuestionsPath(bank);
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { questions: [] });
    const allQuestions = masterData.questions || [];

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    const studentStats = await smartRead(statsPath, { metadata: {}, questions: {} });

    // ✅ 直接返回原始的 studentStats 数据
    return sendResponse(res, 1, "获取报告成功", studentStats);

  } catch (err) {
    console.error("获取报告失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 健康检查
 * GET /api/wordbank/health
 */
router.get("/health", async (req, res) => {
  res.json({ flag: 1, message: "WordBank API is running" });
});

module.exports = router;
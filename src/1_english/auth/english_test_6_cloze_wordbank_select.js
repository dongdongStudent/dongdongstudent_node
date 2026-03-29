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

const BANK_CONFIG = {
  id: '六选五',
  name: '六选五基础练习',
  description: '六选五词汇填空练习',
  masterFile: 'english_test_6_select_word.json', // 注意：文件名是 english_test_5_select_word.json
  statsFile: 'six_select_word_stats.json',
  categories: ['基础词汇', '生活', '科普', '日常']
};

/**
 * 获取题库文件路径
 */
const getMasterQuestionsPath = () => {
  return path.join(
    __dirname,
    "../",
    "resource/english_test_6_select_word",
    BANK_CONFIG.masterFile  // 将使用 english_test_5_select_word.json
  );
};

/**
 * 获取学生统计文件路径
 */
const getStudentStatsPath = (username) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_wordbank_master",
    BANK_CONFIG.statsFile
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
const ensureDefaultStatsFile = async (username) => {
  const statsPath = getStudentStatsPath(username);
  if (!statsPath) return;
  
  if (!fs.existsSync(statsPath)) {
    const now = new Date().toISOString();
    const defaultStats = {
      metadata: {
        username,
        bank: BANK_CONFIG.id,
        createdAt: now,
        lastActive: now,
        totalExtracts: 0,
        totalQuestionsAttempted: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracy: 0,
        avgMastery: 0,
        practicedQuestions: 0,
        practicedPassages: []
      },
      passages: {},
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

const createDefaultPassageStat = (passageId, now) => ({
  passageId,
  extract_count: 0,
  last_practiced: now,
  questions: {},
  history: []
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

  if (stats.questions) {
    Object.values(stats.questions).forEach(qStat => {
      if (qStat) {
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
  stats.metadata.practicedPassages = Object.keys(stats.passages || {}).length;

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
      passageId: question.source?.passageId || question.id.split('_')[0] + '_' + question.id.split('_')[1],
      passageTitle: question.source?.passageTitle || '未知文章',
      category: question.source?.category || '未分类',
      difficulty: question.source?.difficulty || 2
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

// ==================== API 接口 ====================

/**
 * 获取题库信息
 * GET /api/6_cloze_wordbank_select/info
 */
router.get("/info", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const masterPath = getMasterQuestionsPath();
    console.log('111',masterPath)
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    
    return sendResponse(res, 1, "获取成功", {
      bank: BANK_CONFIG,
      totalPassages: masterData.passages?.length || 0,
      categories: BANK_CONFIG.categories
    });

  } catch (err) {
    console.error("获取题库信息失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取所有篇章列表
 * GET /api/6_cloze_wordbank_select/passages
 */
router.get("/passages", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const masterPath = getMasterQuestionsPath();
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    
    const passages = masterData.passages?.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      difficulty: p.difficulty,
      totalQuestions: p.totalQuestions
    })) || [];

    return sendResponse(res, 1, "获取成功", { passages });

  } catch (err) {
    console.error("获取篇章列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取篇章题目（6题一组，实际是六选五）
 * GET /api/6_cloze_wordbank_select/passage?passageId=xxx&type=random
 */
router.get("/passage", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { 
      passageId = null,
      type = "random"
    } = req.query;
    
    const masterPath = getMasterQuestionsPath();
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    let passages = masterData.passages || [];

    if (passages.length === 0) return sendResponse(res, 0, "题库为空");

    await ensureDefaultStatsFile(username);

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: BANK_CONFIG.id },
      passages: {},
      questions: {} 
    });

    // 确保对象存在
    if (!studentStats.passages) {
      studentStats.passages = {};
    }
    if (!studentStats.questions) {
      studentStats.questions = {};
    }

    let selectedPassage = null;
    const now = new Date().toISOString();

    // 如果指定了 passageId，直接使用该篇章
    if (passageId) {
      selectedPassage = passages.find(p => p.id === passageId);
      if (!selectedPassage) {
        return sendResponse(res, 0, `篇章不存在: ${passageId}`);
      }
    } else {
      // 根据类型选择篇章
      if (type === "random") {
        // 随机抽取一个篇章
        const shuffled = [...passages].sort(() => 0.5 - Math.random());
        selectedPassage = shuffled[0];
      } else if (type === "new") {
        // 抽取未练习过的篇章
        const practicedPassageIds = new Set(Object.keys(studentStats.passages || {}));
        const newPassages = passages.filter(p => !practicedPassageIds.has(p.id));
        
        if (newPassages.length > 0) {
          const shuffled = [...newPassages].sort(() => 0.5 - Math.random());
          selectedPassage = shuffled[0];
        } else {
          const shuffled = [...passages].sort(() => 0.5 - Math.random());
          selectedPassage = shuffled[0];
        }
      } else if (type === "review") {
        // 抽取需要复习的篇章（最近正确率<80%）
        const reviewPassages = passages.filter(p => {
          const pStat = studentStats.passages?.[p.id];
          if (!pStat || !pStat.history || pStat.history.length === 0) return false;
          
          const recentHistory = pStat.history.slice(-3);
          const correctCount = recentHistory.filter(h => {
            const correctAnswers = h.results?.filter(r => r.isCorrect).length || 0;
            return correctAnswers / h.totalQuestions >= 0.8;
          }).length;
          
          return correctCount / recentHistory.length < 0.7;
        });
        
        if (reviewPassages.length > 0) {
          const shuffled = [...reviewPassages].sort(() => 0.5 - Math.random());
          selectedPassage = shuffled[0];
        } else {
          const shuffled = [...passages].sort(() => 0.5 - Math.random());
          selectedPassage = shuffled[0];
        }
      } else {
        const shuffled = [...passages].sort(() => 0.5 - Math.random());
        selectedPassage = shuffled[0];
      }
    }

    // 记录篇章被查看
    if (!studentStats.passages[selectedPassage.id]) {
      studentStats.passages[selectedPassage.id] = createDefaultPassageStat(selectedPassage.id, now);
    } else {
      studentStats.passages[selectedPassage.id].last_practiced = now;
    }

    // 记录每道题被查看
    selectedPassage.questions.forEach(question => {
      if (!studentStats.questions[question.id]) {
        studentStats.questions[question.id] = createDefaultQuestionStat(now);
      } else {
        studentStats.questions[question.id].last_practiced = now;
      }
    });

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 返回篇章信息（不包含正确答案）
    const passageForClient = {
      id: selectedPassage.id,
      title: selectedPassage.title,
      description: selectedPassage.description,
      category: selectedPassage.category,
      difficulty: selectedPassage.difficulty,
      totalQuestions: selectedPassage.totalQuestions,
      givenWords: selectedPassage.givenWords,
      questions: selectedPassage.questions.map(q => ({
        id: q.id,
        number: q.number,
        givenWord: q.givenWord,
        sentence: q.sentence,
        source: q.source
      }))
    };

    return sendResponse(res, 1, "获取成功", {
      passage: passageForClient,
      stats: {
        totalPassages: passages.length,
        practicedPassages: Object.keys(studentStats.passages || {}).length,
        currentPassage: selectedPassage.id
      }
    });

  } catch (err) {
    console.error("获取篇章题目失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 提交篇章答案
 * POST /api/6_cloze_wordbank_select/passage/submit
 */
router.post("/passage/submit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { 
      passageId, 
      answers = [], 
      questionIds = [], 
      timeSpent = 0
    } = req.body;
    
    if (!passageId) {
      return sendResponse(res, 0, "请提供篇章ID");
    }

    if (!questionIds.length || !answers.length) {
      return sendResponse(res, 0, "请提供题目ID和答案");
    }

    if (questionIds.length !== answers.length) {
      return sendResponse(res, 0, "题目数量与答案数量不匹配");
    }

    const masterPath = getMasterQuestionsPath();
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    
    // 查找篇章
    const passage = masterData.passages.find(p => p.id === passageId);
    if (!passage) {
      return sendResponse(res, 0, `篇章不存在: ${passageId}`);
    }

    // 创建题目映射
    const questionsMap = {};
    passage.questions.forEach(q => {
      questionsMap[q.id] = q;
    });

    await ensureDefaultStatsFile(username);

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: BANK_CONFIG.id },
      passages: {},
      questions: {} 
    });

    // 确保对象存在
    if (!studentStats.passages) studentStats.passages = {};
    if (!studentStats.questions) studentStats.questions = {};

    const now = new Date().toISOString();
    const results = [];

    // 确保篇章统计存在
    if (!studentStats.passages[passageId]) {
      studentStats.passages[passageId] = createDefaultPassageStat(passageId, now);
    }
    const passageStat = studentStats.passages[passageId];

    // 增加篇章练习次数
    passageStat.extract_count += 1;
    passageStat.last_practiced = now;

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

      const responseTime = Math.floor(Math.random() * 15) + 5;

      // 确保该题目的统计存在
      if (!studentStats.questions[questionId]) {
        studentStats.questions[questionId] = createDefaultQuestionStat(now);
      }

      const qStat = studentStats.questions[questionId];

      // 更新题目统计
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

      // 添加历史记录
      qStat.history.push({
        date: now,
        result: isCorrect,
        time: responseTime,
        userAnswer: userAnswer,
        correctAnswer: question.correctForm,
        passageId: passageId
      });

      // 限制历史记录只保留最新的7条
      if (qStat.history.length > 7) {
        qStat.history = qStat.history.slice(-7);
      }

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

      // 更新篇章中的题目统计
      if (!passageStat.questions) passageStat.questions = {};
      if (!passageStat.questions[questionId]) {
        passageStat.questions[questionId] = { correct_count: 0, wrong_count: 0 };
      }
      
      if (isCorrect) {
        passageStat.questions[questionId].correct_count += 1;
      } else {
        passageStat.questions[questionId].wrong_count += 1;
      }

      results.push({
        questionId,
        number: question.number,
        isCorrect,
        correctAnswer: question.correctForm,
        userAnswer: userAnswer
      });
    }

    // 添加篇章练习历史
    const correctCount = results.filter(r => r.isCorrect).length;
    const totalCount = results.length;
    
    passageStat.history.push({
      date: now,
      timeSpent,
      totalQuestions: totalCount,
      correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : 0,
      results: results
    });

    // 限制篇章历史记录只保留最新的10条
    if (passageStat.history.length > 10) {
      passageStat.history = passageStat.history.slice(-10);
    }

    // 更新元数据并保存
    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    return sendResponse(res, 1, "提交成功", {
      passageId,
      results,
      summary: {
        total: totalCount,
        correct: correctCount,
        wrong: totalCount - correctCount,
        accuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) / 100 : 0
      },
      passageStats: {
        extractCount: passageStat.extract_count,
        totalAttempts: passageStat.history.length
      }
    });

  } catch (err) {
    console.error("提交篇章答案失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取篇章详情
 * GET /api/6_cloze_wordbank_select/passage/:passageId/details
 */
router.get("/passage/:passageId/details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { passageId } = req.params;

    const masterPath = getMasterQuestionsPath();
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    
    const passage = masterData.passages.find(p => p.id === passageId);
    if (!passage) return sendResponse(res, 0, "篇章不存在");

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    const studentStats = await smartRead(statsPath, { metadata: {}, passages: {}, questions: {} });

    const passageStat = studentStats.passages ? studentStats.passages[passageId] : null;

    // 获取每道题的统计
    const questionsWithStats = passage.questions.map(question => {
      const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
      return getQuestionWithStats(question, qStat);
    });

    return sendResponse(res, 1, "获取成功", {
      passage: {
        id: passage.id,
        title: passage.title,
        description: passage.description,
        category: passage.category,
        difficulty: passage.difficulty,
        givenWords: passage.givenWords,
        createdAt: passage.createdAt,
        updatedAt: passage.updatedAt
      },
      questions: questionsWithStats,
      passageStats: passageStat ? {
        extract_count: passageStat.extract_count || 0,
        last_practiced: passageStat.last_practiced || null,
        history: passageStat.history || [],
        questions: passageStat.questions || {}
      } : null
    });

  } catch (err) {
    console.error("获取篇章详情失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学生统计报告
 * GET /api/6_cloze_wordbank_select/report
 */
router.get("/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    const studentStats = await smartRead(statsPath, { metadata: {}, questions: {}, passages: {} });

    return sendResponse(res, 1, "获取成功", studentStats);

  } catch (err) {
    console.error("获取报告失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 健康检查
 * GET /api/6_cloze_wordbank_select/health
 */
router.get("/health", async (req, res) => {
  res.json({ 
    flag: 1, 
    message: "六选五词库选择模块运行正常",
    config: {
      bank: BANK_CONFIG,
      masterPath: getMasterQuestionsPath()
    }
  });
});

module.exports = router;
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
  id: '阅读理解',
  name: '阅读理解练习',
  description: '阅读短文，选择正确答案',
  statsFile: 'reading_comprehension_stats.json',
  categories: ['生活', '教育', '社会', '科普', '故事']
};

/**
 * 获取resource目录路径
 */
const getResourcePath = () => {
  return path.join(__dirname, "../", "resource/english_a_z");
};

/**
 * 获取JSON文件完整路径
 */
const getJsonFilePath = (fileName) => {
  if (!fileName) {
    console.error('getJsonFilePath: fileName 为空');
    return null;
  }
  return path.join(getResourcePath(), fileName);
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
    "english_a_z",
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
    "english_a_z"
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
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
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

// ==================== 新增API接口 ====================

/**
 * 获取所有JSON文件列表
 * GET /api/english_a_z/json-files
 */
router.get("/json-files", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const resourcePath = getResourcePath();
    console.log('JSON文件目录:', resourcePath);
    
    // 确保目录存在
    if (!fs.existsSync(resourcePath)) {
      fs.mkdirSync(resourcePath, { recursive: true });
      return sendResponse(res, 1, "获取成功", { files: [] });
    }

    // 读取目录下所有JSON文件
    const files = fs.readdirSync(resourcePath)
      .filter(file => file.endsWith('.json') && file !== BANK_CONFIG.statsFile)
      .map(file => {
        const filePath = path.join(resourcePath, file);
        const stats = fs.statSync(filePath);
        return {
          id: file.replace('.json', ''),
          name: file.replace('.json', '').replace(/_/g, ' '),
          fileName: file, // 确保有 fileName 字段
          size: stats.size,
          modified: stats.mtime
        };
      });

    console.log('找到的JSON文件:', files);
    return sendResponse(res, 1, "获取成功", { files });

  } catch (err) {
    console.error("获取JSON文件列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取指定JSON文件内容
 * GET /api/english_a_z/json-content/:fileName
 */
router.get("/json-content/:fileName", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { fileName } = req.params;
    
    // 添加详细日志
    console.log('收到json-content请求, fileName:', fileName);
    
    // 检查fileName是否存在
    if (!fileName) {
      console.error('fileName为空');
      return sendResponse(res, 0, "文件名不能为空");
    }
    
    // 安全检查：防止路径遍历攻击
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return sendResponse(res, 0, "无效的文件名");
    }

    const filePath = getJsonFilePath(fileName);
    console.log('尝试读取文件:', filePath);
    
    if (!filePath) {
      return sendResponse(res, 0, "文件路径无效");
    }
    
    if (!fs.existsSync(filePath)) {
      console.error('文件不存在:', filePath);
      return sendResponse(res, 0, `文件不存在: ${fileName}`);
    }

    const fileContent = await smartRead(filePath, { passages: [] });
    console.log('文件读取成功, 包含passages:', fileContent.passages?.length || 0);
    
    return sendResponse(res, 1, "获取成功", fileContent);

  } catch (err) {
    console.error("获取JSON内容失败:", err);
    return sendResponse(res, 0, "服务器内部错误: " + err.message);
  }
});

// ==================== 修改原有API接口 ====================

/**
 * 获取题库信息
 * GET /api/english_a_z/info?jsonFile=xxx.json
 */
router.get("/info", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { jsonFile = 'reading_comprehension_master.json' } = req.query;
    
    const filePath = getJsonFilePath(jsonFile);
    if (!filePath) {
      return sendResponse(res, 0, "文件路径无效");
    }
    
    console.log('读取题库文件:', filePath);
    
    if (!fs.existsSync(filePath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const fileData = await smartRead(filePath, { passages: [] });
    
    return sendResponse(res, 1, "获取成功", {
      bank: {
        ...BANK_CONFIG,
        currentFile: jsonFile
      },
      totalPassages: fileData.passages?.length || 0,
      categories: BANK_CONFIG.categories
    });

  } catch (err) {
    console.error("获取题库信息失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取所有篇章列表
 * GET /api/english_a_z/passages?jsonFile=xxx.json
 */
router.get("/passages", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { jsonFile = 'reading_comprehension_master.json' } = req.query;

    const filePath = getJsonFilePath(jsonFile);
    if (!filePath) {
      return sendResponse(res, 0, "文件路径无效");
    }
    
    if (!fs.existsSync(filePath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const fileData = await smartRead(filePath, { passages: [] });
    
    // 返回篇章数据
    const passages = fileData.passages?.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      difficulty: p.difficulty,
      totalQuestions: p.totalQuestions,
      content: p.content,
      givenWords: p.givenWords || [],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    })) || [];

    return sendResponse(res, 1, "获取成功", { passages, jsonFile });

  } catch (err) {
    console.error("获取篇章列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取阅读理解篇章
 * GET /api/english_a_z/passage?jsonFile=xxx.json&passageId=xxx
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
      jsonFile = 'reading_comprehension_master.json',
      type = "random"
    } = req.query;
    
    const filePath = getJsonFilePath(jsonFile);
    if (!filePath) {
      return sendResponse(res, 0, "文件路径无效");
    }
    
    if (!fs.existsSync(filePath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const fileData = await smartRead(filePath, { passages: [] });
    let passages = fileData.passages || [];

    if (passages.length === 0) return sendResponse(res, 0, "题库为空");

    await ensureDefaultStatsFile(username);

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: BANK_CONFIG.id },
      passages: {},
      questions: {} 
    });

    if (!studentStats.passages) studentStats.passages = {};
    if (!studentStats.questions) studentStats.questions = {};

    let selectedPassage = null;
    const now = new Date().toISOString();

    if (passageId) {
      selectedPassage = passages.find(p => p.id === passageId);
      if (!selectedPassage) {
        return sendResponse(res, 0, `篇章不存在: ${passageId}`);
      }
    } else {
      const shuffled = [...passages].sort(() => 0.5 - Math.random());
      selectedPassage = shuffled[0];
    }

    if (!studentStats.passages[selectedPassage.id]) {
      studentStats.passages[selectedPassage.id] = createDefaultPassageStat(selectedPassage.id, now);
    } else {
      studentStats.passages[selectedPassage.id].last_practiced = now;
    }

    if (selectedPassage.questions) {
      selectedPassage.questions.forEach(question => {
        if (!studentStats.questions[question.id]) {
          studentStats.questions[question.id] = createDefaultQuestionStat(now);
        } else {
          studentStats.questions[question.id].last_practiced = now;
        }
      });
    }

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    const passageForClient = {
      id: selectedPassage.id,
      title: selectedPassage.title,
      description: selectedPassage.description,
      category: selectedPassage.category,
      difficulty: selectedPassage.difficulty,
      totalQuestions: selectedPassage.totalQuestions,
      content: selectedPassage.content,
      questions: selectedPassage.questions ? selectedPassage.questions.map(q => ({
        id: q.id,
        number: q.number,
        question: q.question,
        options: q.options
      })) : []
    };

    return sendResponse(res, 1, "获取成功", {
      passage: passageForClient,
      jsonFile,
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
 * 提交阅读理解答案
 * POST /api/english_a_z/passage/submit
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
      jsonFile = 'reading_comprehension_master.json',
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

    const filePath = getJsonFilePath(jsonFile);
    if (!filePath) {
      return sendResponse(res, 0, "文件路径无效");
    }
    
    if (!fs.existsSync(filePath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const fileData = await smartRead(filePath, { passages: [] });
    
    const passage = fileData.passages.find(p => p.id === passageId);
    if (!passage) {
      return sendResponse(res, 0, `篇章不存在: ${passageId}`);
    }

    const questionsMap = {};
    if (passage.questions) {
      passage.questions.forEach(q => {
        questionsMap[q.id] = q;
      });
    }

    await ensureDefaultStatsFile(username);

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: BANK_CONFIG.id },
      passages: {},
      questions: {} 
    });

    if (!studentStats.passages) studentStats.passages = {};
    if (!studentStats.questions) studentStats.questions = {};

    const now = new Date().toISOString();
    const results = [];

    if (!studentStats.passages[passageId]) {
      studentStats.passages[passageId] = createDefaultPassageStat(passageId, now);
    }
    const passageStat = studentStats.passages[passageId];

    passageStat.extract_count += 1;
    passageStat.last_practiced = now;

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

      const normalizedUser = String(userAnswer).trim().toUpperCase();
      const normalizedCorrect = String(question.correctAnswer).trim().toUpperCase();
      const isCorrect = normalizedUser === normalizedCorrect;

      const responseTime = Math.floor(Math.random() * 15) + 5;

      if (!studentStats.questions[questionId]) {
        studentStats.questions[questionId] = createDefaultQuestionStat(now);
      }

      const qStat = studentStats.questions[questionId];

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

      qStat.history.push({
        date: now,
        result: isCorrect,
        time: responseTime,
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer,
        passageId: passageId,
        jsonFile: jsonFile
      });

      if (qStat.history.length > 7) {
        qStat.history = qStat.history.slice(-7);
      }

      const times = qStat.history.map(h => h.time).filter(t => t > 0);
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        qStat.time_stats.avg_time = Number((sum / times.length).toFixed(1));
        qStat.time_stats.fastest = Math.min(...times);
        qStat.time_stats.slowest = Math.max(...times);
      }

      qStat.mastery_level = calculateMasteryLevel(qStat);

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
        correctAnswer: question.correctAnswer,
        userAnswer: userAnswer
      });
    }

    const correctCount = results.filter(r => r.isCorrect).length;
    const totalCount = results.length;
    
    passageStat.history.push({
      date: now,
      timeSpent,
      totalQuestions: totalCount,
      correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : 0,
      results: results,
      jsonFile: jsonFile
    });

    if (passageStat.history.length > 10) {
      passageStat.history = passageStat.history.slice(-10);
    }

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    return sendResponse(res, 1, "提交成功", {
      passageId,
      jsonFile,
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
 * 获取篇章详情（带解析）
 * GET /api/english_a_z/passage/:passageId/details?jsonFile=xxx.json
 */
router.get("/passage/:passageId/details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { passageId } = req.params;
    const { jsonFile = 'reading_comprehension_master.json' } = req.query;

    const filePath = getJsonFilePath(jsonFile);
    if (!filePath) {
      return sendResponse(res, 0, "文件路径无效");
    }
    
    if (!fs.existsSync(filePath)) {
      return sendResponse(res, 0, "题库文件不存在");
    }

    const fileData = await smartRead(filePath, { passages: [] });
    
    const passage = fileData.passages.find(p => p.id === passageId);
    if (!passage) return sendResponse(res, 0, "篇章不存在");

    const statsPath = getStudentStatsPath(username);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    const studentStats = await smartRead(statsPath, { metadata: {}, passages: {}, questions: {} });

    const passageStat = studentStats.passages ? studentStats.passages[passageId] : null;

    const questionsWithStats = passage.questions ? passage.questions.map(question => {
      const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
      return getQuestionWithStats(question, qStat);
    }) : [];

    return sendResponse(res, 1, "获取成功", {
      passage: {
        id: passage.id,
        title: passage.title,
        description: passage.description,
        category: passage.category,
        difficulty: passage.difficulty,
        content: passage.content,
        createdAt: passage.createdAt,
        updatedAt: passage.updatedAt
      },
      questions: questionsWithStats,
      passageStats: passageStat ? {
        extract_count: passageStat.extract_count || 0,
        last_practiced: passageStat.last_practiced || null,
        history: passageStat.history || [],
        questions: passageStat.questions || {}
      } : null,
      jsonFile
    });

  } catch (err) {
    console.error("获取篇章详情失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学生统计报告
 * GET /api/english_a_z/report
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
 * GET /api/english_a_z/health
 */
router.get("/health", async (req, res) => {
  res.json({ 
    flag: 1, 
    message: "阅读理解模块运行正常",
    config: {
      bank: BANK_CONFIG,
      resourcePath: getResourcePath()
    }
  });
});

module.exports = router;
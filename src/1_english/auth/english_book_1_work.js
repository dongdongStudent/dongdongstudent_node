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

// ==================== 可用的单词库配置 ====================

const WORD_BANKS = {
  "word_master.json": {
    id: "word_master",
    name: "基础词汇",
    description: "基础词汇库",
    categories: ["基础", "常用", "核心"],
    file: "word_master.json",
  },
  "renjiao_7a.json": {
    id: "renjiao_7a",
    name: "人教版初一上册",
    description: "人教版初一上册英语单词",
    categories: [],
    file: "renjiao_7a.json",
  },
  "renjiao_7b.json": {
    "id": "renjiao_7b",
    "name": "人教版初一下册",
    "description": "人教版初一下册英语单词",
    "categories": [
      
    ],
    "file": "renjiao_7b.json"
},
  "english_book_1_work.json": {
    id: "english_book_1",
    name: "英语第一册",
    description: "英语第一册单词",
    categories: ["职业", "动物", "食物", "日常"],
    file: "english_book_1_work.json",
  },
  "english_book_2_work.json": {
    id: "english_book_2",
    name: "英语第二册",
    description: "英语第二册单词",
    categories: ["家庭", "学校", "旅行", "购物"],
    file: "english_book_2_work.json",
  },
  "english_book_3_work.json": {
    id: "english_book_3",
    name: "英语第三册",
    description: "英语第三册单词",
    categories: ["工作", "健康", "环境", "科技"],
    file: "english_book_3_work.json",
  },
  "nce_1.json": {
    id: "nce_1",
    name: "新概念英语1",
    description: "新概念英语第一册",
    categories: ["基础", "日常", "语法", "对话"],
    file: "nce_1.json",
  },
  "nce_2.json": {
    id: "nce_2",
    name: "新概念英语2",
    description: "新概念英语第二册",
    categories: ["进阶", "阅读", "写作", "听力"],
    file: "nce_2.json",
  },
  "kaoyan.json": {
    id: "kaoyan",
    name: "考研词汇",
    description: "考研英语词汇",
    categories: ["核心", "高频", "低频", "超纲"],
    file: "kaoyan.json",
  },
  "ielts.json": {
    id: "ielts",
    name: "雅思词汇",
    description: "雅思考试词汇",
    categories: ["学术", "生活", "写作", "口语"],
    file: "ielts.json",
  },
  "toefl.json": {
    id: "toefl",
    name: "托福词汇",
    description: "托福考试词汇",
    categories: ["学术", "校园", "讲座", "讨论"],
    file: "toefl.json",
  },
  "cet4.json": {
    id: "cet4",
    name: "四级词汇",
    description: "大学英语四级词汇",
    categories: ["基础", "高频", "阅读", "听力"],
    file: "cet4.json",
  },
  "cet6.json": {
    id: "cet6",
    name: "六级词汇",
    description: "大学英语六级词汇",
    categories: ["进阶", "高频", "阅读", "听力"],
    file: "cet6.json",
  },
};

/**
 * 获取当前使用的单词库（没有默认值，不存在返回null）
 */
const getCurrentWordBank = (req) => {
  const bankFile = req.headers["x-word-bank"];

  if (!bankFile || !WORD_BANKS[bankFile]) {
    return null;
  }

  return WORD_BANKS[bankFile];
};

/**
 * 获取单词库文件路径
 */
const getMasterWordsPath = (bankFile) => {
  return path.join(__dirname, "../", "resource/english_book_1_work", bankFile);
};

/**
 * 获取学生统计文件路径（按单词库分开存储）
 */
const getStudentStatsPath = (username, bankId) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "english_book_1_work",
    bankId,
    "stats.json"
  );
};

/**
 * 确保用户统计目录存在
 */
const ensureUserStatsDirectory = (username, bankId) => {
  const userStatsDir = path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "english_book_1_work",
    bankId
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
  const statsPath = getStudentStatsPath(username, bankId);
  if (!statsPath) return;

  if (!fs.existsSync(statsPath)) {
    const now = new Date().toISOString();
    const defaultStats = {
      metadata: {
        username,
        bank: bankId,
        createdAt: now,
        lastActive: now,
        totalPractice: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracy: 0,
        masteredCount: 0,
      },
      words: {},
    };

    await smartWrite(statsPath, defaultStats);
  }
};

// ==================== 统计函数 ====================

/**
 * 创建默认的单词统计对象
 */
const createDefaultWordStat = (wordId, now) => ({
  wordId,
  extract_count: 0,
  correct_count: 0,
  wrong_count: 0,
  mastery_level: 0,
  mastered: false,
  mastered_date: null,
  first_seen: now,
  last_practiced: now,
  recent_results: {
    picture: [],
    en2zh: [],
    listen: [],
  },
  mode_stats: {
    picture: { correct: 0, wrong: 0, accuracy: 0 },
    en2zh: { correct: 0, wrong: 0, accuracy: 0 },
    listen: { correct: 0, wrong: 0, accuracy: 0 },
  },
});

/**
 * 确保单词统计对象包含所有必要的模式字段（兼容旧数据）
 */
const ensureWordStatModes = (wordStat) => {
  if (!wordStat) return wordStat;

  if (!wordStat.mode_stats) {
    wordStat.mode_stats = {};
  }

  const allModes = ["picture", "en2zh", "listen"];
  allModes.forEach((mode) => {
    if (!wordStat.mode_stats[mode]) {
      wordStat.mode_stats[mode] = { correct: 0, wrong: 0, accuracy: 0 };
    }
  });

  // 确保 recent_results 存在（兼容旧数据）
  if (!wordStat.recent_results) {
    wordStat.recent_results = {
      picture: [],
      en2zh: [],
      listen: [],
    };
  }

  return wordStat;
};

/**
 * 更新最近结果记录
 */
const updateRecentResults = (wordStat, mode, isCorrect) => {
  if (!wordStat.recent_results) {
    wordStat.recent_results = { picture: [], en2zh: [], listen: [] };
  }

  if (!wordStat.recent_results[mode]) {
    wordStat.recent_results[mode] = [];
  }

  // 添加最新结果
  wordStat.recent_results[mode].push(isCorrect);

  // 只保留最近3次
  if (wordStat.recent_results[mode].length > 3) {
    wordStat.recent_results[mode] = wordStat.recent_results[mode].slice(-3);
  }
};

/**
 * 计算掌握程度 - 基于正确次数
 */
const calculateMasteryLevel = (stat) => {
  const modes = ["picture", "en2zh", "listen"];
  let totalScore = 0;
  let hasAnyPractice = false;

  modes.forEach((mode) => {
    const modeStat = stat.mode_stats?.[mode];
    if (!modeStat) return;

    const totalAttempts = (modeStat.correct || 0) + (modeStat.wrong || 0);
    if (totalAttempts === 0) return;

    hasAnyPractice = true;

    // 基础分：正确率 × 80
    const accuracy = modeStat.correct / totalAttempts;
    let modeScore = accuracy * 80;

    // 正确奖励分：每次正确加5分，最高20分
    const correctBonus = Math.min(modeStat.correct * 5, 20);
    modeScore += correctBonus;

    // 限制单个模式最高100分
    modeScore = Math.min(modeScore, 100);

    totalScore += modeScore;
  });

  if (!hasAnyPractice) return 0;

  // 计算平均分
  let finalScore = totalScore / 3;
  finalScore = Math.round(finalScore);

  return finalScore;
};

/**
 * 判断词语是否掌握 - 基于正确次数
 * 每种模式只要正确一次就掌握
 */
const isWordMastered = (wordStat) => {
  const modes = ["picture", "en2zh", "listen"];

  // 检查每种模式是否都正确过至少一次
  for (const mode of modes) {
    const modeStat = wordStat.mode_stats?.[mode];
    if (!modeStat || (modeStat.correct || 0) === 0) {
      return false;
    }
  }

  return true;
};

/**
 * 更新元数据
 */
const updateMetadata = (stats) => {
  let totalPractice = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let masteredCount = 0;

  if (stats.words) {
    Object.values(stats.words).forEach((wordStat) => {
      if (wordStat) {
        totalPractice +=
          (wordStat.correct_count || 0) + (wordStat.wrong_count || 0);
        totalCorrect += wordStat.correct_count || 0;
        totalWrong += wordStat.wrong_count || 0;

        // 重新计算是否掌握
        const wasMastered = wordStat.mastered;
        wordStat.mastered = isWordMastered(wordStat);

        // 如果新达到掌握状态，记录掌握日期
        if (!wasMastered && wordStat.mastered) {
          wordStat.mastered_date = new Date().toISOString();
        }

        if (wordStat.mastered) {
          masteredCount++;
        }
      }
    });
  }

  stats.metadata = stats.metadata || {};
  stats.metadata.lastActive = new Date().toISOString();
  stats.metadata.totalPractice = totalPractice;
  stats.metadata.totalCorrect = totalCorrect;
  stats.metadata.totalWrong = totalWrong;
  stats.metadata.accuracy =
    totalPractice > 0
      ? Math.round((totalCorrect / totalPractice) * 100) / 100
      : 0;
  stats.metadata.masteredCount = masteredCount;

  return stats;
};

// ==================== API 接口 ====================

/**
 * 获取可用的单词库列表
 * GET /api/english_book_1_work/banks
 */
router.get("/banks", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const bankList = Object.values(WORD_BANKS).map((bank) => ({
      id: bank.id,
      name: bank.name,
      description: bank.description,
      categories: bank.categories,
      file: bank.file,
    }));

    return sendResponse(res, 1, "获取成功", { banks: bankList });
  } catch (err) {
    console.error("获取单词库列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 健康检查
 * GET /api/english_book_1_work/health
 */
router.get("/health", async (req, res) => {
  try {
    const currentBank = getCurrentWordBank(req);

    return sendResponse(res, 1, "单词记忆模块运行正常", {
      currentBank,
      availableBanks: Object.keys(WORD_BANKS).length,
      banks: Object.values(WORD_BANKS).map((b) => ({ id: b.id, name: b.name })),
    });
  } catch (err) {
    console.error("健康检查失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取单词库信息
 * GET /api/english_book_1_work/info
 */
router.get("/info", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    const masterPath = getMasterWordsPath(currentBank.file);

    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `单词库文件 ${currentBank.file} 不存在`);
    }

    const masterData = await smartRead(masterPath, { words: [] });

    return sendResponse(res, 1, "获取成功", {
      config: currentBank,
      totalWords: masterData.words?.length || 0,
      categories: currentBank.categories,
      bankFile: currentBank.file,
    });
  } catch (err) {
    console.error("获取单词库信息失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取所有单词（带统计）
 * GET /api/english_book_1_work/words
 */
router.get("/words", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    const masterPath = getMasterWordsPath(currentBank.file);

    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "单词库文件不存在");
    }

    const masterData = await smartRead(masterPath, { words: [] });

    await ensureDefaultStatsFile(username, currentBank.id);
    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { words: {} });

    const wordsWithStats = masterData.words.map((word) => ({
      ...word,
      stats: studentStats.words[word.id]
        ? ensureWordStatModes(studentStats.words[word.id])
        : null,
    }));

    return sendResponse(res, 1, "获取成功", { words: wordsWithStats });
  } catch (err) {
    console.error("获取单词列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取单个单词
 * GET /api/english_book_1_work/word/:wordId
 */
router.get("/word/:wordId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    const { wordId } = req.params;
    const wordIdNum = parseInt(wordId);

    const masterPath = getMasterWordsPath(currentBank.file);
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "单词库文件不存在");
    }

    const masterData = await smartRead(masterPath, { words: [] });
    const word = masterData.words.find((w) => w.id === wordIdNum);

    if (!word) {
      return sendResponse(res, 0, "单词不存在");
    }

    await ensureDefaultStatsFile(username, currentBank.id);
    const statsPath = getStudentStatsPath(username, currentBank.id);
    let studentStats = await smartRead(statsPath, { words: {} });

    let wordStat = studentStats.words[wordId]
      ? ensureWordStatModes(studentStats.words[wordId])
      : null;

    if (wordStat) {
      wordStat.last_practiced = new Date().toISOString();

      studentStats = updateMetadata(studentStats);
      await smartWrite(statsPath, studentStats);
    }

    return sendResponse(res, 1, "获取成功", {
      word: {
        ...word,
        stats: wordStat,
      },
    });
  } catch (err) {
    console.error("获取单词失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 生成测试题目
 * POST /api/english_book_1_work/test/generate
 */
router.post("/test/generate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    const { testType, questionCount = 5 } = req.body;

    if (!testType || !["picture", "en2zh", "listen"].includes(testType)) {
      return sendResponse(res, 0, "无效的测试类型");
    }

    const masterPath = getMasterWordsPath(currentBank.file);
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "单词库文件不存在");
    }

    const masterData = await smartRead(masterPath, { words: [] });
    const allWords = masterData.words || [];

    if (allWords.length === 0) {
      return sendResponse(res, 0, "单词库为空");
    }

    await ensureDefaultStatsFile(username, currentBank.id);
    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { words: {} });

    const wordsWithMastery = allWords.map((word) => {
      const stat = studentStats.words[word.id];
      const updatedStat = stat ? ensureWordStatModes(stat) : null;
      const mastery = updatedStat ? calculateMasteryLevel(updatedStat) : 0;
      return { ...word, mastery };
    });

    wordsWithMastery.sort((a, b) => a.mastery - b.mastery);
    const selectedWords = wordsWithMastery.slice(0, questionCount);

    const questions = selectedWords.map((word) => {
      let correct;
      let options;

      if (testType === "en2zh" || testType === "listen") {
        correct = word.translation;
        const otherTranslations = allWords
          .filter((w) => w.id !== word.id)
          .map((w) => w.translation)
          .filter((v, i, a) => a.indexOf(v) === i);

        const shuffled = otherTranslations.sort(() => 0.5 - Math.random());
        options = [correct, ...shuffled.slice(0, 3)];
      } else {
        correct = word.word;
        const otherWords = allWords
          .filter((w) => w.id !== word.id)
          .map((w) => w.word)
          .filter((v, i, a) => a.indexOf(v) === i);

        const shuffled = otherWords.sort(() => 0.5 - Math.random());
        options = [correct, ...shuffled.slice(0, 3)];
      }

      while (options.length < 4) {
        options.push(
          testType === "en2zh" || testType === "listen" ? "未知" : "unknown"
        );
      }

      options = options.sort(() => 0.5 - Math.random());

      return {
        id: word.id,
        word: word.word,
        translation: word.translation,
        image: word.image,
        correct,
        options,
      };
    });

    return sendResponse(res, 1, "生成成功", { questions });
  } catch (err) {
    console.error("生成测试题目失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 提交测试答案
 * POST /api/english_book_1_work/test/submit
 */
router.post("/test/submit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    const { testType, results, timeSpent = 0 } = req.body;

    if (!testType || !results || !Array.isArray(results)) {
      return sendResponse(res, 0, "无效的提交数据");
    }

    const missingCorrect = results.filter((r) => !r || r.correct === undefined);
    if (missingCorrect.length > 0) {
      return sendResponse(res, 0, "提交的数据缺少 correct 字段");
    }

    ensureUserStatsDirectory(username, currentBank.id);
    await ensureDefaultStatsFile(username, currentBank.id);

    const statsPath = getStudentStatsPath(username, currentBank.id);
    let studentStats = await smartRead(statsPath, {
      words: {},
    });

    const now = new Date().toISOString();
    const updatedResults = [];
    let correctCount = 0;

    for (const result of results) {
      const { wordId, userAnswer, correct, isCorrect, responseTime } = result;

      if (!studentStats.words[wordId]) {
        studentStats.words[wordId] = createDefaultWordStat(wordId, now);
      } else {
        studentStats.words[wordId] = ensureWordStatModes(
          studentStats.words[wordId]
        );
      }

      const wordStat = studentStats.words[wordId];

      // 更新对应模式的统计
      if (testType === "picture") {
        if (!wordStat.mode_stats.picture) {
          wordStat.mode_stats.picture = { correct: 0, wrong: 0, accuracy: 0 };
        }
        if (isCorrect) {
          wordStat.mode_stats.picture.correct += 1;
        } else {
          wordStat.mode_stats.picture.wrong += 1;
        }
        const total =
          wordStat.mode_stats.picture.correct +
          wordStat.mode_stats.picture.wrong;
        wordStat.mode_stats.picture.accuracy =
          total > 0 ? wordStat.mode_stats.picture.correct / total : 0;
      } else if (testType === "en2zh") {
        if (!wordStat.mode_stats.en2zh) {
          wordStat.mode_stats.en2zh = { correct: 0, wrong: 0, accuracy: 0 };
        }
        if (isCorrect) {
          wordStat.mode_stats.en2zh.correct += 1;
        } else {
          wordStat.mode_stats.en2zh.wrong += 1;
        }
        const total =
          wordStat.mode_stats.en2zh.correct + wordStat.mode_stats.en2zh.wrong;
        wordStat.mode_stats.en2zh.accuracy =
          total > 0 ? wordStat.mode_stats.en2zh.correct / total : 0;
      } else if (testType === "listen") {
        if (!wordStat.mode_stats.listen) {
          wordStat.mode_stats.listen = { correct: 0, wrong: 0, accuracy: 0 };
        }
        if (isCorrect) {
          wordStat.mode_stats.listen.correct += 1;
        } else {
          wordStat.mode_stats.listen.wrong += 1;
        }
        const total =
          wordStat.mode_stats.listen.correct + wordStat.mode_stats.listen.wrong;
        wordStat.mode_stats.listen.accuracy =
          total > 0 ? wordStat.mode_stats.listen.correct / total : 0;
      }

      wordStat.extract_count += 1;
      if (isCorrect) {
        wordStat.correct_count += 1;
        correctCount += 1;
      } else {
        wordStat.wrong_count += 1;
      }
      wordStat.last_practiced = now;

      // 更新最近结果记录
      updateRecentResults(wordStat, testType, isCorrect);

      // 重新计算掌握程度
      wordStat.mastery_level = calculateMasteryLevel(wordStat);

      updatedResults.push({
        ...result,
        mastery_level: wordStat.mastery_level,
        mastered: wordStat.mastered,
      });
    }

    // 更新元数据
    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 重新获取更新后的结果，包含正确的 mastered 状态
    const finalUpdatedResults = updatedResults.map((r) => {
      const wordStat = studentStats.words[r.wordId];
      return {
        ...r,
        mastered: wordStat ? wordStat.mastered : false,
      };
    });

    const response = {
      summary: {
        total: results.length,
        correct: correctCount,
        wrong: results.length - correctCount,
        accuracy: results.length > 0 ? correctCount / results.length : 0,
      },
      results: finalUpdatedResults,
    };

    return sendResponse(res, 1, "提交成功", response);
  } catch (err) {
    console.error("提交测试答案失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学习报告
 * GET /api/english_book_1_work/report
 */
router.get("/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    ensureUserStatsDirectory(username, currentBank.id);

    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, {
      metadata: {},
      words: {},
    });

    if (studentStats.words) {
      Object.keys(studentStats.words).forEach((wordId) => {
        studentStats.words[wordId] = ensureWordStatModes(
          studentStats.words[wordId]
        );
      });
    }

    const masterPath = getMasterWordsPath(currentBank.file);
    const masterData = await smartRead(masterPath, { words: [] });
    const totalWords = masterData.words?.length || 0;

    return sendResponse(res, 1, "获取成功", {
      ...studentStats,
      totalWords,
      bankName: currentBank.name,
    });
  } catch (err) {
    console.error("获取报告失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取各模式统计
 * GET /api/english_book_1_work/mode-stats
 */
router.get("/mode-stats", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentWordBank(req);

    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的单词库");
    }

    ensureUserStatsDirectory(username, currentBank.id);

    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { words: {} });

    const modeStats = {
      picture: { total: 0, correct: 0, wrong: 0, accuracy: 0 },
      en2zh: { total: 0, correct: 0, wrong: 0, accuracy: 0 },
      listen: { total: 0, correct: 0, wrong: 0, accuracy: 0 },
    };

    Object.values(studentStats.words || {}).forEach((wordStat) => {
      const updatedStat = ensureWordStatModes(wordStat);

      const picTotal =
        (updatedStat.mode_stats?.picture?.correct || 0) +
        (updatedStat.mode_stats?.picture?.wrong || 0);
      modeStats.picture.total += picTotal;
      modeStats.picture.correct +=
        updatedStat.mode_stats?.picture?.correct || 0;
      modeStats.picture.wrong += updatedStat.mode_stats?.picture?.wrong || 0;

      const en2zhTotal =
        (updatedStat.mode_stats?.en2zh?.correct || 0) +
        (updatedStat.mode_stats?.en2zh?.wrong || 0);
      modeStats.en2zh.total += en2zhTotal;
      modeStats.en2zh.correct += updatedStat.mode_stats?.en2zh?.correct || 0;
      modeStats.en2zh.wrong += updatedStat.mode_stats?.en2zh?.wrong || 0;

      const listenTotal =
        (updatedStat.mode_stats?.listen?.correct || 0) +
        (updatedStat.mode_stats?.listen?.wrong || 0);
      modeStats.listen.total += listenTotal;
      modeStats.listen.correct += updatedStat.mode_stats?.listen?.correct || 0;
      modeStats.listen.wrong += updatedStat.mode_stats?.listen?.wrong || 0;
    });

    modeStats.picture.accuracy =
      modeStats.picture.total > 0
        ? Math.round(
            (modeStats.picture.correct / modeStats.picture.total) * 100
          ) / 100
        : 0;
    modeStats.en2zh.accuracy =
      modeStats.en2zh.total > 0
        ? Math.round((modeStats.en2zh.correct / modeStats.en2zh.total) * 100) /
          100
        : 0;
    modeStats.listen.accuracy =
      modeStats.listen.total > 0
        ? Math.round(
            (modeStats.listen.correct / modeStats.listen.total) * 100
          ) / 100
        : 0;

    return sendResponse(res, 1, "获取成功", modeStats);
  } catch (err) {
    console.error("获取模式统计失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

module.exports = router;
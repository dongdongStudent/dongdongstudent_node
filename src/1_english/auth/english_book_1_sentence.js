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

// ==================== 可用的句子库配置 ====================

const SENTENCE_BANKS = {
  'word_master.json': {
    id: 'word_master',
    name: '基础句子',
    description: '基础句子库',
    categories: ['基础', '常用', '核心'],
    file: 'word_master.json'
  },
  'english_book_1_work.json': {
    id: 'english_book_1',
    name: '英语第一册',
    description: '英语第一册句子',
    categories: ['职业', '动物', '食物', '日常'],
    file: 'english_book_1_work.json'
  },
  'english_book_2_work.json': {
    id: 'english_book_2',
    name: '英语第二册',
    description: '英语第二册句子',
    categories: ['家庭', '学校', '旅行', '购物'],
    file: 'english_book_2_work.json'
  },
  'english_book_3_work.json': {
    id: 'english_book_3',
    name: '英语第三册',
    description: '英语第三册句子',
    categories: ['工作', '健康', '环境', '科技'],
    file: 'english_book_3_work.json'
  },
  'nce_1.json': {
    id: 'nce_1',
    name: '新概念英语1',
    description: '新概念英语第一册句子',
    categories: ['基础', '日常', '语法', '对话'],
    file: 'nce_1.json'
  },
  'nce_2.json': {
    id: 'nce_2',
    name: '新概念英语2',
    description: '新概念英语第二册句子',
    categories: ['进阶', '阅读', '写作', '听力'],
    file: 'nce_2.json'
  },
  'kaoyan.json': {
    id: 'kaoyan',
    name: '考研句子',
    description: '考研英语句子',
    categories: ['核心', '高频', '低频', '超纲'],
    file: 'kaoyan.json'
  },
  'ielts.json': {
    id: 'ielts',
    name: '雅思句子',
    description: '雅思考试句子',
    categories: ['学术', '生活', '写作', '口语'],
    file: 'ielts.json'
  },
  'toefl.json': {
    id: 'toefl',
    name: '托福句子',
    description: '托福考试句子',
    categories: ['学术', '校园', '讲座', '讨论'],
    file: 'toefl.json'
  },
  'cet4.json': {
    id: 'cet4',
    name: '四级句子',
    description: '大学英语四级句子',
    categories: ['基础', '高频', '阅读', '听力'],
    file: 'cet4.json'
  },
  'cet6.json': {
    id: 'cet6',
    name: '六级句子',
    description: '大学英语六级句子',
    categories: ['进阶', '高频', '阅读', '听力'],
    file: 'cet6.json'
  }
};

/**
 * 获取当前使用的句子库（没有默认值，不存在返回null）
 */
const getCurrentSentenceBank = (req) => {
  const bankFile = req.headers['x-word-bank'];
  if (!bankFile || !SENTENCE_BANKS[bankFile]) {
    return null;
  }
  return SENTENCE_BANKS[bankFile];
};

/**
 * 获取句子库文件路径
 */
const getMasterWordsPath = (bankFile) => {
  return path.join(
    __dirname,
    "../",
    "resource/english_book_1_sentence",
    bankFile
  );
};

/**
 * 获取学生统计文件路径（按句子库分开存储）
 */
const getStudentStatsPath = (username, bankId) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "english_book_1_sentence",
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
    "english_book_1_sentence",
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
        masteredCount: 0
      },
      words: {},
      testHistory: []
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
  history: [],
  // 记录每种模式最近3次的结果
  recent_results: {
    choice: [],
    cloze: [],
    input: []
  },
  mode_stats: {
    choice: { correct: 0, wrong: 0, accuracy: 0 },
    cloze: { correct: 0, wrong: 0, accuracy: 0 },
    input: { correct: 0, wrong: 0, accuracy: 0 }
  }
});

/**
 * 确保单词统计对象包含所有必要的模式字段（兼容旧数据）
 */
const ensureWordStatModes = (wordStat) => {
  if (!wordStat) return wordStat;
  
  if (!wordStat.mode_stats) {
    wordStat.mode_stats = {};
  }
  
  const allModes = ['choice', 'cloze', 'input'];
  allModes.forEach(mode => {
    if (!wordStat.mode_stats[mode]) {
      wordStat.mode_stats[mode] = { correct: 0, wrong: 0, accuracy: 0 };
    }
  });
  
  // 确保 recent_results 存在（兼容旧数据）
  if (!wordStat.recent_results) {
    wordStat.recent_results = {
      choice: [],
      cloze: [],
      input: []
    };
  }
  
  return wordStat;
};

/**
 * 更新最近结果记录
 */
const updateRecentResults = (wordStat, mode, isCorrect) => {
  if (!wordStat.recent_results) {
    wordStat.recent_results = { choice: [], cloze: [], input: [] };
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
 * 检查某种模式是否连续N次正确
 */
const isModeConsecutiveCorrect = (recentResults, mode, times = 2) => {
  const results = recentResults?.[mode] || [];
  if (results.length < times) return false;
  
  // 检查最近times次是否都正确
  return results.slice(-times).every(r => r === true);
};

/**
 * 计算掌握程度 - 基于连续正确
 */
const calculateMasteryLevel = (stat) => {
  const modes = ['choice', 'cloze', 'input'];
  let totalScore = 0;
  let hasAnyPractice = false;
  
  modes.forEach(mode => {
    const modeStat = stat.mode_stats?.[mode];
    if (!modeStat) return;
    
    const totalAttempts = (modeStat.correct || 0) + (modeStat.wrong || 0);
    if (totalAttempts === 0) return;
    
    hasAnyPractice = true;
    
    // 基础分：正确率 × 60
    const accuracy = modeStat.correct / totalAttempts;
    let modeScore = accuracy * 60;
    
    // 连续正确奖励分
    const recentResults = stat.recent_results?.[mode] || [];
    if (recentResults.length >= 2) {
      const lastTwoCorrect = recentResults.slice(-2).every(r => r === true);
      if (lastTwoCorrect) {
        modeScore += 40; // 连续两次正确，加40分
      } else if (recentResults.slice(-1)[0] === true) {
        modeScore += 20; // 最后一次正确，加20分
      }
    } else if (recentResults.length === 1 && recentResults[0] === true) {
      modeScore += 20; // 只有一次正确，加20分
    }
    
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
 * 判断词语是否掌握 - 基于连续正确
 * 每种模式连续两次正确即掌握
 */
const isWordMastered = (wordStat) => {
  const modes = ['choice', 'cloze', 'input'];
  
  // 检查每种模式是否都有记录
  for (const mode of modes) {
    const recentResults = wordStat.recent_results?.[mode] || [];
    if (recentResults.length === 0) return false;
  }
  
  // 检查是否连续两次正确
  const choiceOK = isModeConsecutiveCorrect(wordStat.recent_results, 'choice', 2);
  const clozeOK = isModeConsecutiveCorrect(wordStat.recent_results, 'cloze', 2);
  const inputOK = isModeConsecutiveCorrect(wordStat.recent_results, 'input', 2);
  
  return choiceOK && clozeOK && inputOK;
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
    Object.values(stats.words).forEach(wordStat => {
      if (wordStat) {
        totalPractice += (wordStat.correct_count || 0) + (wordStat.wrong_count || 0);
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
  stats.metadata.accuracy = totalPractice > 0 ? Math.round((totalCorrect / totalPractice) * 100) / 100 : 0;
  stats.metadata.masteredCount = masteredCount;

  return stats;
};

// ==================== API 接口 ====================

/**
 * 获取可用的句子库列表
 * GET /api/english_book_1_sentence/banks
 */
router.get("/banks", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const bankList = Object.values(SENTENCE_BANKS).map(bank => ({
      id: bank.id,
      name: bank.name,
      description: bank.description,
      categories: bank.categories,
      file: bank.file
    }));

    return sendResponse(res, 1, "获取成功", { banks: bankList });
  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 健康检查
 * GET /api/english_book_1_sentence/health
 */
router.get("/health", async (req, res) => {
  try {
    const currentBank = getCurrentSentenceBank(req);
    
    return sendResponse(res, 1, "句子记忆模块运行正常", {
      currentBank,
      availableBanks: Object.keys(SENTENCE_BANKS).length,
      banks: Object.values(SENTENCE_BANKS).map(b => ({ id: b.id, name: b.name }))
    });
  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取句子库信息
 * GET /api/english_book_1_sentence/info
 */
router.get("/info", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentSentenceBank(req);
    
    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的句子库");
    }

    const masterPath = getMasterWordsPath(currentBank.file);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `句子库文件 ${currentBank.file} 不存在`);
    }

    const masterData = await smartRead(masterPath, { words: [] });
    
    return sendResponse(res, 1, "获取成功", {
      config: currentBank,
      totalWords: masterData.words?.length || 0,
      categories: currentBank.categories,
      bankFile: currentBank.file
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取所有句子（带统计）
 * GET /api/english_book_1_sentence/words
 */
router.get("/words", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentSentenceBank(req);
    
    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的句子库");
    }

    const masterPath = getMasterWordsPath(currentBank.file);
    
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "句子库文件不存在");
    }

    const masterData = await smartRead(masterPath, { words: [] });
    
    await ensureDefaultStatsFile(username, currentBank.id);
    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { words: {} });

    const wordsWithStats = masterData.words.map(word => ({
      ...word,
      stats: studentStats.words[word.id] ? ensureWordStatModes(studentStats.words[word.id]) : null
    }));

    return sendResponse(res, 1, "获取成功", { words: wordsWithStats });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 生成测试题目
 * POST /api/english_book_1_sentence/test/generate
 */
router.post("/test/generate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentSentenceBank(req);
    
    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的句子库");
    }

    const { testType, questionCount = 5 } = req.body;
    const validTypes = ['choice', 'cloze', 'input'];
    
    if (!testType || !validTypes.includes(testType)) {
      return sendResponse(res, 0, "无效的测试类型");
    }

    const masterPath = getMasterWordsPath(currentBank.file);
    if (!fs.existsSync(masterPath)) {
      return sendResponse(res, 0, "句子库文件不存在");
    }

    const masterData = await smartRead(masterPath, { words: [] });
    const allWords = masterData.words || [];

    if (allWords.length === 0) {
      return sendResponse(res, 0, "句子库为空");
    }

    await ensureDefaultStatsFile(username, currentBank.id);
    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { words: {} });

    const wordsWithMastery = allWords.map(word => {
      const stat = studentStats.words[word.id];
      const updatedStat = stat ? ensureWordStatModes(stat) : null;
      const mastery = updatedStat ? calculateMasteryLevel(updatedStat) : 0;
      return { ...word, mastery };
    });

    wordsWithMastery.sort((a, b) => a.mastery - b.mastery);
    const selectedWords = wordsWithMastery.slice(0, questionCount);

    const questions = selectedWords.map(word => {
      if (testType === 'choice') {
        const correct = word.translation;
        const otherTranslations = allWords
          .filter(w => w.id !== word.id)
          .map(w => w.translation)
          .filter((v, i, a) => a.indexOf(v) === i);
        
        const shuffled = otherTranslations.sort(() => 0.5 - Math.random());
        let options = [correct, ...shuffled.slice(0, 3)];

        while (options.length < 4) {
          options.push('未知');
        }

        options = options.sort(() => 0.5 - Math.random());

        return {
          id: word.id,
          word: word.word,
          translation: word.translation,
          correct,
          options,
          testType
        };
      } 
      else if (testType === 'cloze') {
        return {
          id: word.id,
          word: word.word,
          translation: word.translation,
          words: word.word.split(' '),
          options: word.options || {},
          testType
        };
      } 
      else if (testType === 'input') {
        return {
          id: word.id,
          word: word.word,
          translation: word.translation,
          words: word.word.split(' '),
          testType
        };
      }
    });

    return sendResponse(res, 1, "生成成功", { questions });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 提交测试答案
 * POST /api/english_book_1_sentence/test/submit
 */
router.post("/test/submit", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendResponse(res, 0, "未提供 token");
  
      const decoded = token_decode(authHeader);
      const username = decoded.username;
      if (!username) return sendResponse(res, 0, "用户信息不存在");
  
      const currentBank = getCurrentSentenceBank(req);
      if (!currentBank) {
        return sendResponse(res, 0, "请先选择有效的句子库");
      }
  
      const { testType, results, timeSpent = 0 } = req.body;
      
      if (!testType || !results || !Array.isArray(results)) {
        return sendResponse(res, 0, "无效的提交数据");
      }
  
      const missingCorrect = results.filter(r => !r || r.correct === undefined);
      if (missingCorrect.length > 0) {
        return sendResponse(res, 0, "提交的数据缺少 correct 字段");
      }
  
      ensureUserStatsDirectory(username, currentBank.id);
      await ensureDefaultStatsFile(username, currentBank.id);
  
      const statsPath = getStudentStatsPath(username, currentBank.id);
      let studentStats = await smartRead(statsPath, { words: {}, testHistory: [] });
  
      const now = new Date().toISOString();
      const updatedResults = [];
      let correctCount = 0;
      
      for (const result of results) {
        const { wordId, userAnswer, correct, isCorrect, responseTime } = result;
  
        if (!studentStats.words[wordId]) {
          studentStats.words[wordId] = createDefaultWordStat(wordId, now);
        } else {
          studentStats.words[wordId] = ensureWordStatModes(studentStats.words[wordId]);
        }
  
        const wordStat = studentStats.words[wordId];
  
        // 更新对应模式的统计
        if (testType === 'choice') {
          if (!wordStat.mode_stats.choice) {
            wordStat.mode_stats.choice = { correct: 0, wrong: 0, accuracy: 0 };
          }
          if (isCorrect) {
            wordStat.mode_stats.choice.correct += 1;
          } else {
            wordStat.mode_stats.choice.wrong += 1;
          }
          const total = wordStat.mode_stats.choice.correct + wordStat.mode_stats.choice.wrong;
          wordStat.mode_stats.choice.accuracy = total > 0 ? wordStat.mode_stats.choice.correct / total : 0;
        }
        else if (testType === 'cloze') {
          if (!wordStat.mode_stats.cloze) {
            wordStat.mode_stats.cloze = { correct: 0, wrong: 0, accuracy: 0 };
          }
          if (isCorrect) {
            wordStat.mode_stats.cloze.correct += 1;
          } else {
            wordStat.mode_stats.cloze.wrong += 1;
          }
          const total = wordStat.mode_stats.cloze.correct + wordStat.mode_stats.cloze.wrong;
          wordStat.mode_stats.cloze.accuracy = total > 0 ? wordStat.mode_stats.cloze.correct / total : 0;
        }
        else if (testType === 'input') {
          if (!wordStat.mode_stats.input) {
            wordStat.mode_stats.input = { correct: 0, wrong: 0, accuracy: 0 };
          }
          if (isCorrect) {
            wordStat.mode_stats.input.correct += 1;
          } else {
            wordStat.mode_stats.input.wrong += 1;
          }
          const total = wordStat.mode_stats.input.correct + wordStat.mode_stats.input.wrong;
          wordStat.mode_stats.input.accuracy = total > 0 ? wordStat.mode_stats.input.correct / total : 0;
        }
  
        wordStat.extract_count += 1;
        if (isCorrect) {
          wordStat.correct_count += 1;
          correctCount += 1;
        } else {
          wordStat.wrong_count += 1;
        }
        wordStat.last_practiced = now;
  
        wordStat.history.push({
          date: now,
          mode: testType,
          result: isCorrect,
          time: responseTime,
          userAnswer,
          correctAnswer: correct
        });
  
        if (wordStat.history.length > 7) {
          wordStat.history = wordStat.history.slice(-7);
        }
  
        // 更新最近结果记录
        updateRecentResults(wordStat, testType, isCorrect);
  
        // 重新计算掌握程度
        wordStat.mastery_level = calculateMasteryLevel(wordStat);
        
        // 注意：不在这里直接设置 mastered，会在 updateMetadata 中统一计算
  
        updatedResults.push({
          ...result,
          mastery_level: wordStat.mastery_level,
          mastered: wordStat.mastered // 这里的 mastered 还是旧值
        });
      }
  
      const testRecord = {
        date: now,
        mode: testType,
        totalQuestions: results.length,
        correctCount,
        timeSpent,
        results: updatedResults
      };
  
      if (!studentStats.testHistory) {
        studentStats.testHistory = [];
      }
      studentStats.testHistory.push(testRecord);
  
      if (studentStats.testHistory.length > 7) {
        studentStats.testHistory = studentStats.testHistory.slice(-7);
      }
  
      // 更新元数据（这里会重新计算每个单词的掌握状态）
      studentStats = updateMetadata(studentStats);
      await smartWrite(statsPath, studentStats);
  
      // 重新获取更新后的结果，包含正确的 mastered 状态
      const finalUpdatedResults = updatedResults.map(r => {
        const wordStat = studentStats.words[r.wordId];
        return {
          ...r,
          mastered: wordStat ? wordStat.mastered : false
        };
      });
  
      const response = {
        summary: {
          total: results.length,
          correct: correctCount,
          wrong: results.length - correctCount,
          accuracy: results.length > 0 ? correctCount / results.length : 0
        },
        results: finalUpdatedResults,
        testRecord
      };
  
      return sendResponse(res, 1, "提交成功", response);
  
    } catch (err) {
      console.error('提交测试答案失败:', err);
      return sendResponse(res, 0, "服务器内部错误");
    }
  });

/**
 * 获取学习报告
 * GET /api/english_book_1_sentence/report
 */
router.get("/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentSentenceBank(req);
    
    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的句子库");
    }

    ensureUserStatsDirectory(username, currentBank.id);

    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { metadata: {}, words: {}, testHistory: [] });

    if (studentStats.words) {
      Object.keys(studentStats.words).forEach(wordId => {
        studentStats.words[wordId] = ensureWordStatModes(studentStats.words[wordId]);
      });
    }

    const masterPath = getMasterWordsPath(currentBank.file);
    const masterData = await smartRead(masterPath, { words: [] });
    const totalWords = masterData.words?.length || 0;

    return sendResponse(res, 1, "获取成功", {
      ...studentStats,
      totalWords,
      bankName: currentBank.name
    });

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取各模式统计
 * GET /api/english_book_1_sentence/mode-stats
 */
router.get("/mode-stats", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const currentBank = getCurrentSentenceBank(req);
    
    if (!currentBank) {
      return sendResponse(res, 0, "请先选择有效的句子库");
    }

    ensureUserStatsDirectory(username, currentBank.id);

    const statsPath = getStudentStatsPath(username, currentBank.id);
    const studentStats = await smartRead(statsPath, { words: {} });

    const modeStats = {
      choice: { total: 0, correct: 0, wrong: 0, accuracy: 0 },
      cloze: { total: 0, correct: 0, wrong: 0, accuracy: 0 },
      input: { total: 0, correct: 0, wrong: 0, accuracy: 0 }
    };

    Object.values(studentStats.words || {}).forEach(wordStat => {
      const updatedStat = ensureWordStatModes(wordStat);
      
      const choiceTotal = (updatedStat.mode_stats?.choice?.correct || 0) + (updatedStat.mode_stats?.choice?.wrong || 0);
      modeStats.choice.total += choiceTotal;
      modeStats.choice.correct += updatedStat.mode_stats?.choice?.correct || 0;
      modeStats.choice.wrong += updatedStat.mode_stats?.choice?.wrong || 0;

      const clozeTotal = (updatedStat.mode_stats?.cloze?.correct || 0) + (updatedStat.mode_stats?.cloze?.wrong || 0);
      modeStats.cloze.total += clozeTotal;
      modeStats.cloze.correct += updatedStat.mode_stats?.cloze?.correct || 0;
      modeStats.cloze.wrong += updatedStat.mode_stats?.cloze?.wrong || 0;

      const inputTotal = (updatedStat.mode_stats?.input?.correct || 0) + (updatedStat.mode_stats?.input?.wrong || 0);
      modeStats.input.total += inputTotal;
      modeStats.input.correct += updatedStat.mode_stats?.input?.correct || 0;
      modeStats.input.wrong += updatedStat.mode_stats?.input?.wrong || 0;
    });

    modeStats.choice.accuracy = modeStats.choice.total > 0 ? 
      Math.round((modeStats.choice.correct / modeStats.choice.total) * 100) / 100 : 0;
    modeStats.cloze.accuracy = modeStats.cloze.total > 0 ? 
      Math.round((modeStats.cloze.correct / modeStats.cloze.total) * 100) / 100 : 0;
    modeStats.input.accuracy = modeStats.input.total > 0 ? 
      Math.round((modeStats.input.correct / modeStats.input.total) * 100) / 100 : 0;

    return sendResponse(res, 1, "获取成功", modeStats);

  } catch (err) {
    return sendResponse(res, 0, "服务器内部错误");
  }
});

module.exports = router;
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

// ==================== 完形填空题库配置 ====================

const CLOZE_BANKS = {
    default: {
      id: 'default',
      key: 'default',
      name: '完形填空基础库',
      description: '基础完形填空练习',
      icon: '📖',
      color: '#1a237e',
      masterFile: 'cloze_default_master.json',
      statsFile: 'cloze_default_stats.json',
      aliases: ['default', '完形填空', 'cloze'],
      totalPassages: 5,
      categories: ['故事', '科普', '社会', '教育', '文化']
    },
    middle: {
      id: '中考',
      key: 'middle',
      name: '中考完形填空',
      description: '中考完形填空真题',
      icon: '🎯',
      color: '#c62828',
      masterFile: 'cloze_middle_master.json',
      statsFile: 'cloze_middle_stats.json',
      aliases: ['middle', '中考', '中考完形'],
      totalPassages: 10,
      categories: ['故事', '社会', '教育', '生活']
    },
    high: {
      id: '高考',
      key: 'high',
      name: '高考完形填空',
      description: '高考完形填空真题',
      icon: '🏆',
      color: '#2e7d32',
      masterFile: 'cloze_high_master.json',
      statsFile: 'cloze_high_stats.json',
      aliases: ['high', '高考', '高考完形'],
      totalPassages: 12,
      categories: ['科普', '社会', '文化', '哲理']
    },
    // ✅ 添加53练习册题库
    rjb: {
      id: '53练习册',
      key: 'rjb',
      name: '53练习册七年级',
      description: '53练习册七年级完形填空',
      icon: '📘',
      color: '#9c27b0',
      masterFile: 'cloze_53_rjb_7b.json',
      statsFile: 'cloze_53_rjb_7b_stats.json',
      aliases: ['rjb', '53', '53练习册', '七年级'],
      totalPassages: 2,
      categories: ['故事', '经历']
    }
  };

/**
 * 根据ID或别名获取题库配置
 * 【修改】如果没有找到匹配的题库，返回null而不是默认
 */
const getBankConfig = (bankId) => {
  // 直接匹配ID
  if (CLOZE_BANKS[bankId]) {
    return CLOZE_BANKS[bankId];
  }
  
  // 在别名中查找
  for (const [key, config] of Object.entries(CLOZE_BANKS)) {
    if (config.id === bankId) {
      return config;
    }
    if (config.aliases && config.aliases.includes(bankId)) {
      return config;
    }
  }
  
  // ❌ 没有找到，返回null而不是默认
  return null;
};

/**
 * 获取学生统计文件路径
 */
const getStudentStatsPath = (username, bankId = 'default') => {
  const bank = getBankConfig(bankId);
  // 如果bank为null，返回null
  if (!bank) return null;
  
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_cloze_master",
    bank.statsFile
  );
};

/**
 * 获取题目母版路径
 */
const getMasterQuestionsPath = (bankId = 'default') => {
  const bank = getBankConfig(bankId);
  // 如果bank为null，返回null
  if (!bank) return null;
  
  return path.join(
    __dirname, 
    "../", 
    "resource/english_test_cloze_master",
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
    "test_cloze_master"
  );
  
  if (!fs.existsSync(userStatsDir)) {
    fs.mkdirSync(userStatsDir, { recursive: true });
    console.log(`创建用户统计目录: ${userStatsDir}`);
  }
  
  return userStatsDir;
};

/**
 * 创建默认的统计文件
 */
const ensureDefaultStatsFile = async (username, bankId) => {
  const bank = getBankConfig(bankId);
  // 如果bank为null，直接返回
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
        totalExtracts: 0,                 // 总练习次数（完成答题的次数）
        totalQuestionsAttempted: 0,
        totalCorrect: 0,
        totalWrong: 0,
        accuracy: 0,
        avgMastery: 0,
        practicedPassages: 0
      },
      passages: {}
    };
    
    await smartWrite(statsPath, defaultStats);
    console.log(`创建默认统计文件: ${statsPath}`);
  }
};

// ==================== 统计函数 ====================

/**
 * 创建默认题目统计对象
 */
const createDefaultQuestionStat = (now) => {
  return {
    extract_count: 0,             // 题目被练习的次数（由提交触发）
    answer_count: 0,              // 答题次数
    correct_count: 0,
    wrong_count: 0,
    accuracy: 0,
    mastery_level: 0,
    first_seen: now,
    last_practiced: now,
    last_result: null,
    history: [],
    time_stats: {
      avg_time: 0,
      fastest: 0,
      slowest: 0
    }
  };
};

/**
 * 创建默认文章统计对象
 */
const createDefaultPassageStat = (now) => {
  return {
    first_seen: now,
    last_practiced: now,
    extract_count: 0,             // 文章被练习的次数（由提交触发）
    answer_count: 0,               // 答题总次数
    correct_count: 0,
    wrong_count: 0,
    accuracy: 0,
    avg_mastery: 0,
    attempted_questions: 0,
    questions: {}
  };
};

/**
 * 计算掌握程度
 */
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
 * 更新文章统计
 */
const updatePassageStats = (passageStats, questionStats) => {
  const questions = Object.values(questionStats);
  const totalQuestions = questions.length;
  const attemptedQuestions = questions.filter(q => q.answer_count > 0).length;
  
  if (totalQuestions === 0) return passageStats;
  
  let totalAnswerCount = 0;
  let totalCorrect = 0;
  let totalMastery = 0;
  
  questions.forEach(q => {
    totalAnswerCount += q.answer_count || 0;
    totalCorrect += q.correct_count || 0;
    totalMastery += q.mastery_level || 0;
  });
  
  const totalWrong = totalAnswerCount - totalCorrect;
  const accuracy = totalAnswerCount > 0 ? totalCorrect / totalAnswerCount : 0;
  const avgMastery = totalQuestions > 0 ? totalMastery / totalQuestions : 0;
  
  return {
    ...passageStats,
    answer_count: totalAnswerCount,
    correct_count: totalCorrect,
    wrong_count: totalWrong,
    accuracy: accuracy,
    avg_mastery: avgMastery,
    attempted_questions: attemptedQuestions,
    last_practiced: new Date().toISOString()
    // extract_count 保持不变，由外部维护
  };
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

  Object.values(stats.passages || {}).forEach(passage => {
    totalExtracts += passage.extract_count || 0;
    
    Object.values(passage.questions || {}).forEach(qStat => {
      totalQuestionsAttempted += qStat.answer_count || 0;
      totalCorrect += qStat.correct_count || 0;
      totalMastery += qStat.mastery_level || 0;
      questionCount++;
    });
  });

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
 * 合并文章和统计信息（用于列表展示）
 */
const mergePassageWithStats = (passage, passageStats) => {
  const stats = passageStats || {
    first_seen: null,
    last_practiced: null,
    extract_count: 0,
    answer_count: 0,
    correct_count: 0,
    wrong_count: 0,
    accuracy: 0,
    avg_mastery: 0,
    attempted_questions: 0
  };

  let totalMastery = 0;
  let questionCount = 0;
  let totalCorrect = 0;
  let totalAnswerCount = 0;

  if (stats.questions) {
    Object.values(stats.questions).forEach(qStat => {
      totalMastery += qStat.mastery_level || 0;
      questionCount++;
      totalCorrect += qStat.correct_count || 0;
      totalAnswerCount += qStat.answer_count || 0;
    });
  }

  const avgMastery = questionCount > 0 ? totalMastery / questionCount : stats.avg_mastery || 0;
  const accuracy = totalAnswerCount > 0 ? totalCorrect / totalAnswerCount : stats.accuracy || 0;
  const totalWrong = totalAnswerCount - totalCorrect;

  return {
    id: passage.id,
    title: passage.title,
    category: passage.category,
    difficulty: passage.difficulty,
    source: passage.source,
    content: passage.content,
    questions: passage.questions,
    stats: {
      extract_count: stats.extract_count || 0,        // 文章被练习次数（由提交触发）
      answer_count: totalAnswerCount || stats.answer_count || 0,
      correct_count: totalCorrect || stats.correct_count || 0,
      wrong_count: totalWrong >= 0 ? totalWrong : stats.wrong_count || 0,
      accuracy: accuracy,
      avg_mastery: avgMastery,
      attempted_questions: questionCount || stats.attempted_questions || 0,
      last_practiced: stats.last_practiced || null,
      first_seen: stats.first_seen || null
    }
  };
};

// ==================== API接口 ====================

/**
 * 获取题库列表
 * GET /api/cloze/banks
 * 【修改】只返回实际存在的题库（有文件且不为空）
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

    // 只返回实际存在题库文件的配置
    const banksWithStats = await Promise.all(
      Object.values(CLOZE_BANKS).map(async (bank) => {
        const masterPath = getMasterQuestionsPath(bank.id);
        
        // ✅ 检查题库文件是否存在
        if (!masterPath || !fs.existsSync(masterPath)) {
          return null; // 文件不存在，跳过
        }
        
        const masterData = await smartRead(masterPath, { passages: [] });
        
        // ✅ 如果没有文章，也跳过
        if (!masterData.passages || masterData.passages.length === 0) {
          return null;
        }
        
        const actualTotal = masterData.passages?.length || 0;
        const categories = [...new Set(masterData.passages?.map(p => p.category).filter(Boolean) || [])];
        
        let totalQuestions = 0;
        masterData.passages?.forEach(p => {
          totalQuestions += p.questions?.length || 0;
        });
        
        return {
          id: bank.id,
          key: bank.key,
          name: bank.name,
          description: bank.description,
          icon: bank.icon,
          color: bank.color,
          totalPassages: actualTotal,
          totalQuestions: totalQuestions,
          categories: categories.length > 0 ? categories : []
        };
      })
    );

    // ✅ 过滤掉不存在的题库
    const existingBanks = banksWithStats.filter(bank => bank !== null);

    return sendResponse(res, 1, "获取成功", { banks: existingBanks });
  } catch (err) {
    console.error("获取题库列表失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取完形填空文章
 * GET /api/cloze/passage?type=smart&bank=default
 * 【修改】如果题库不存在或为空，返回错误
 */
router.get("/passage", async (req, res) => {
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

    const { type = "smart", bank = "default" } = req.query;
    
    // ✅ 获取题库配置，如果不存在返回错误
    const bankConfig = getBankConfig(bank);
    if (!bankConfig) {
      return sendResponse(res, 0, `题库不存在: ${bank}`);
    }

    const masterPath = getMasterQuestionsPath(bank);
    
    // ✅ 检查题库文件是否存在
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    const allPassages = masterData.passages || [];

    if (allPassages.length === 0) {
      return sendResponse(res, 0, "题库为空");
    }

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) {
      return sendResponse(res, 0, "无法获取统计文件路径");
    }

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank: bankConfig.id },
      passages: {} 
    });

    let selectedPassage = null;
    const now = new Date().toISOString();

    // ===== 如果是 all 类型，返回所有文章（包含题目统计信息）=====
    if (type === "all") {
      const passagesWithStats = allPassages.map(passage => {
        const passageStats = studentStats.passages[passage.id];
        
        // 为每个题目添加完整的统计信息
        const questionsWithStats = passage.questions.map(q => {
          const qStat = passageStats?.questions?.[q.id] || null;
          
          // 如果有统计信息，返回完整数据
          if (qStat) {
            return {
              id: q.id,
              number: q.number,
              options: q.options,
              correct: q.correct,
              explanation: q.explanation,
              stats: {
                extract_count: qStat.extract_count || 0,
                answer_count: qStat.answer_count || 0,
                correct_count: qStat.correct_count || 0,
                wrong_count: qStat.wrong_count || 0,
                accuracy: qStat.accuracy || 0,
                mastery_level: qStat.mastery_level || 0,
                first_seen: qStat.first_seen || null,
                last_practiced: qStat.last_practiced || null,
                last_result: qStat.last_result || null,
                history: qStat.history || [],  // ✅ 包含历史记录
                time_stats: qStat.time_stats || { avg_time: 0, fastest: 0, slowest: 0 }
              }
            };
          } else {
            // 没有统计信息，返回基础数据
            return {
              id: q.id,
              number: q.number,
              options: q.options,
              correct: q.correct,
              explanation: q.explanation,
              stats: null
            };
          }
        });
        
        // 获取文章级别的统计
        const passageLevelStats = mergePassageWithStats(passage, passageStats);
        
        return {
          id: passage.id,
          title: passage.title,
          category: passage.category,
          difficulty: passage.difficulty,
          source: passage.source,
          content: passage.content,
          questions: questionsWithStats,  // ✅ 替换为带统计的题目
          stats: passageLevelStats.stats   // 文章级别统计
        };
      });
    
      return sendResponse(res, 1, "获取成功", {
        passages: passagesWithStats,
        bank: bankConfig.id,
        total: passagesWithStats.length
      });
    }

    // 原有的抽取逻辑
    if (type === "smart") {
      const passageScores = allPassages.map(passage => {
        const passageStats = studentStats.passages[passage.id];
        
        if (!passageStats) {
          return { passage, score: 100 };
        }
        
        let totalMastery = 0;
        let questionCount = 0;
        
        passage.questions.forEach(q => {
          const qStat = passageStats.questions?.[q.id];
          if (qStat) {
            totalMastery += qStat.mastery_level || 0;
            questionCount++;
          }
        });
        
        const avgMastery = questionCount > 0 ? totalMastery / questionCount : 0;
        return { passage, score: (1 - avgMastery) * 100 };
      });
      
      passageScores.sort((a, b) => b.score - a.score);
      selectedPassage = passageScores[0].passage;
    } 
    else if (type === "weak") {
      const weakPassages = allPassages.filter(passage => {
        const passageStats = studentStats.passages[passage.id];
        if (!passageStats) return false;
        
        let weakCount = 0;
        passage.questions.forEach(q => {
          const qStat = passageStats.questions?.[q.id];
          if (qStat && qStat.mastery_level < 0.5 && qStat.mastery_level > 0) {
            weakCount++;
          }
        });
        return weakCount > 0;
      });
      
      selectedPassage = weakPassages.length > 0 
        ? weakPassages[Math.floor(Math.random() * weakPassages.length)]
        : allPassages[Math.floor(Math.random() * allPassages.length)];
    }
    else if (type === "review") {
      const reviewPassages = allPassages.filter(passage => {
        const passageStats = studentStats.passages[passage.id];
        if (!passageStats) return false;
        
        let reviewCount = 0;
        passage.questions.forEach(q => {
          const qStat = passageStats.questions?.[q.id];
          if (qStat && qStat.mastery_level >= 0.5 && qStat.mastery_level < 0.8) {
            reviewCount++;
          }
        });
        return reviewCount > 0;
      });
      
      selectedPassage = reviewPassages.length > 0 
        ? reviewPassages[Math.floor(Math.random() * reviewPassages.length)]
        : allPassages[Math.floor(Math.random() * allPassages.length)];
    }
    else if (type === "mastered") {
      const masteredPassages = allPassages.filter(passage => {
        const passageStats = studentStats.passages[passage.id];
        if (!passageStats) return false;
        
        let masteredCount = 0;
        passage.questions.forEach(q => {
          const qStat = passageStats.questions?.[q.id];
          if (qStat && qStat.mastery_level >= 0.8) {
            masteredCount++;
          }
        });
        return masteredCount > 0;
      });
      
      selectedPassage = masteredPassages.length > 0 
        ? masteredPassages[Math.floor(Math.random() * masteredPassages.length)]
        : allPassages[Math.floor(Math.random() * allPassages.length)];
    }
    else if (type === "random") {
      selectedPassage = allPassages[Math.floor(Math.random() * allPassages.length)];
    }
    else if (type === "new") {
      const newPassages = allPassages.filter(p => !studentStats.passages[p.id]);
      selectedPassage = newPassages.length > 0 
        ? newPassages[Math.floor(Math.random() * newPassages.length)]
        : allPassages[Math.floor(Math.random() * allPassages.length)];
    }
    else {
      selectedPassage = allPassages[Math.floor(Math.random() * allPassages.length)];
    }

    // 记录文章被查看，但不增加 extract_count
    if (!studentStats.passages[selectedPassage.id]) {
      studentStats.passages[selectedPassage.id] = createDefaultPassageStat(now);
    } else {
      // 只更新最后练习时间，不增加 extract_count
      studentStats.passages[selectedPassage.id].last_practiced = now;
    }

    // 为每个题目创建默认统计（如果不存在）
    selectedPassage.questions.forEach(q => {
      if (!studentStats.passages[selectedPassage.id].questions[q.id]) {
        studentStats.passages[selectedPassage.id].questions[q.id] = createDefaultQuestionStat(now);
      } else {
        // 只更新最后练习时间，不增加 extract_count
        studentStats.passages[selectedPassage.id].questions[q.id].last_practiced = now;
      }
    });

    // 更新元数据并保存
    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 返回文章
    const passageForClient = {
      id: selectedPassage.id,
      title: selectedPassage.title,
      category: selectedPassage.category,
      difficulty: selectedPassage.difficulty,
      source: selectedPassage.source,
      content: selectedPassage.content,
      questions: selectedPassage.questions.map(q => ({
        id: q.id,
        number: q.number,
        options: q.options
      }))
    };

    return sendResponse(res, 1, "获取成功", {
      passage: passageForClient,
      bank: bankConfig.id,
      stats: {
        totalPassages: allPassages.length,
        attemptedPassages: Object.keys(studentStats.passages).length,
        totalQuestions: selectedPassage.questions.length,
        currentPassageExtracts: studentStats.passages[selectedPassage.id].extract_count
      }
    });

  } catch (err) {
    console.error("获取文章失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 提交完形填空答案
 * POST /api/cloze/submit
 * 【修改】如果题库不存在，返回错误
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

    const { passageId, answers = {}, timeSpent = 0, bank = "default" } = req.body;
    
    if (!passageId) {
      return sendResponse(res, 0, "请提供文章ID");
    }

    // ✅ 获取题库配置，如果不存在返回错误
    const bankConfig = getBankConfig(bank);
    if (!bankConfig) {
      return sendResponse(res, 0, `题库不存在: ${bank}`);
    }

    const masterPath = getMasterQuestionsPath(bank);
    
    // ✅ 检查题库文件是否存在
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    
    const passage = masterData.passages.find(p => p.id === passageId);
    if (!passage) {
      return sendResponse(res, 0, "文章不存在");
    }

    const questionsMap = {};
    passage.questions.forEach(q => {
      questionsMap[q.id] = q;
    });

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) {
      return sendResponse(res, 0, "无法获取统计文件路径");
    }

    let studentStats = await smartRead(statsPath, { 
      metadata: { username, createdAt: new Date().toISOString(), bank },
      passages: {} 
    });

    const now = new Date().toISOString();

    // 确保该文章的统计存在
    if (!studentStats.passages[passageId]) {
      // 如果提交时没有记录，创建新记录
      studentStats.passages[passageId] = {
        first_seen: now,
        last_practiced: now,
        extract_count: 1,  // 第一次提交，练习次数为1
        answer_count: 0,
        correct_count: 0,
        wrong_count: 0,
        accuracy: 0,
        avg_mastery: 0,
        attempted_questions: 0,
        questions: {}
      };
    } else {
      // 在提交时增加 extract_count
      studentStats.passages[passageId].extract_count += 1;
      studentStats.passages[passageId].last_practiced = now;
    }

    const results = [];
    const passageStats = studentStats.passages[passageId];

    Object.entries(answers).forEach(([questionId, userAnswer]) => {
      const question = questionsMap[questionId];
      if (!question) return;

      const isCorrect = userAnswer === question.correct;
      const responseTime = Math.floor(Math.random() * 15) + 5;

      if (!passageStats.questions[questionId]) {
        passageStats.questions[questionId] = createDefaultQuestionStat(now);
      }

      const qStat = passageStats.questions[questionId];

      // 题目练习次数增加
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
        time: responseTime
      });

      // 限制历史记录最多保留5条，超过时移除最旧的
      if (qStat.history.length > 5) {
        qStat.history = qStat.history.slice(-5);
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

      results.push({
        questionId,
        number: question.number,
        isCorrect,
        correctAnswer: question.correct,
        userAnswer
      });
    });

    // 更新文章统计
    studentStats.passages[passageId] = updatePassageStats(
      studentStats.passages[passageId],
      studentStats.passages[passageId].questions
    );

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
      passageStats: {
        extract_count: studentStats.passages[passageId].extract_count,
        answer_count: studentStats.passages[passageId].answer_count,
        correct_count: studentStats.passages[passageId].correct_count,
        accuracy: studentStats.passages[passageId].accuracy,
        avg_mastery: studentStats.passages[passageId].avg_mastery
      }
    });

  } catch (err) {
    console.error("提交答案失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取文章详情（带解析）
 * GET /api/cloze/passage/:passageId/details?bank=default
 * 【修改】如果题库不存在，返回错误
 */
router.get("/passage/:passageId/details", async (req, res) => {
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

    const { passageId } = req.params;
    const { bank = "default" } = req.query;

    // ✅ 获取题库配置，如果不存在返回错误
    const bankConfig = getBankConfig(bank);
    if (!bankConfig) {
      return sendResponse(res, 0, `题库不存在: ${bank}`);
    }

    const masterPath = getMasterQuestionsPath(bank);
    
    // ✅ 检查题库文件是否存在
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    
    const passage = masterData.passages.find(p => p.id === passageId);
    if (!passage) {
      return sendResponse(res, 0, "文章不存在");
    }

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) {
      return sendResponse(res, 0, "无法获取统计文件路径");
    }

    const studentStats = await smartRead(statsPath, { 
      metadata: {}, 
      passages: {} 
    });

    const passageStats = studentStats.passages[passageId] || { questions: {} };

    const questionsWithStats = passage.questions.map(q => {
      const qStat = passageStats.questions?.[q.id] || null;
      
      return {
        id: q.id,
        number: q.number,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation,
        stats: qStat ? {
          extract_count: qStat.extract_count || 0,
          answer_count: qStat.answer_count || 0,
          correct_count: qStat.correct_count || 0,
          wrong_count: qStat.wrong_count || 0,
          accuracy: qStat.answer_count > 0 ? qStat.correct_count / qStat.answer_count : 0,
          mastery_level: qStat.mastery_level || 0,
          last_practiced: qStat.last_practiced
        } : null
      };
    });

    return sendResponse(res, 1, "获取成功", {
      passage: {
        id: passage.id,
        title: passage.title,
        category: passage.category,
        difficulty: passage.difficulty,
        source: passage.source,
        content: passage.content,
        questions: questionsWithStats
      },
      stats: {
        extract_count: passageStats.extract_count || 0,
        answer_count: passageStats.answer_count || 0,
        avg_mastery: passageStats.avg_mastery || 0
      }
    });

  } catch (err) {
    console.error("获取文章详情失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 批量获取题目统计
 * POST /api/cloze/stats/batch
 * 【修改】如果题库不存在，返回错误
 */
router.post("/stats/batch", async (req, res) => {
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

    const { questionIds = [], bank = "default" } = req.body;
    
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return sendResponse(res, 0, "请提供题目ID数组");
    }

    // ✅ 获取题库配置，如果不存在返回错误
    const bankConfig = getBankConfig(bank);
    if (!bankConfig) {
      return sendResponse(res, 0, `题库不存在: ${bank}`);
    }

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) {
      return sendResponse(res, 0, "无法获取统计文件路径");
    }

    const studentStats = await smartRead(statsPath, { 
      metadata: {}, 
      passages: {} 
    });

    const statsList = [];

    questionIds.forEach(questionId => {
      const passageId = questionId.split('_q')[0];
      const qStat = studentStats.passages[passageId]?.questions?.[questionId];
      
      if (!qStat) {
        statsList.push({
          questionId,
          extract_count: 0,
          answer_count: 0,
          correct_count: 0,
          wrong_count: 0,
          accuracy: 0,
          mastery_level: 0,
          last_practiced: null,
          last_result: null,
          history: []
        });
      } else {
        const accuracy = qStat.answer_count > 0 ? qStat.correct_count / qStat.answer_count : 0;

        statsList.push({
          questionId,
          extract_count: qStat.extract_count || 0,
          answer_count: qStat.answer_count || 0,
          correct_count: qStat.correct_count || 0,
          wrong_count: qStat.wrong_count || 0,
          accuracy: accuracy,
          mastery_level: qStat.mastery_level || 0,
          last_practiced: qStat.last_practiced,
          last_result: qStat.last_result,
          history: (qStat.history || []).slice(-5)
        });
      }
    });

    return sendResponse(res, 1, "获取成功", {
      stats: statsList,
      count: statsList.length,
      bank: bankConfig.id
    });

  } catch (err) {
    console.error("批量获取题目统计失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学习报告
 * GET /api/cloze/report?bank=default
 * 【修改】如果题库不存在，返回错误
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

    // ✅ 获取题库配置，如果不存在返回错误
    const bankConfig = getBankConfig(bank);
    if (!bankConfig) {
      return sendResponse(res, 0, `题库不存在: ${bank}`);
    }

    const masterPath = getMasterQuestionsPath(bank);
    
    // ✅ 检查题库文件是否存在
    if (!masterPath || !fs.existsSync(masterPath)) {
      return sendResponse(res, 0, `题库文件不存在: ${bankConfig.masterFile}`);
    }

    const masterData = await smartRead(masterPath, { passages: [] });
    const allPassages = masterData.passages || [];

    await ensureDefaultStatsFile(username, bank);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) {
      return sendResponse(res, 0, "无法获取统计文件路径");
    }

    const studentStats = await smartRead(statsPath, { 
      metadata: {}, 
      passages: {} 
    });

    const categoryStats = {};
    const weakQuestions = [];
    const masteredQuestions = [];
    const passagesStats = {};

    allPassages.forEach(passage => {
      if (!categoryStats[passage.category]) {
        categoryStats[passage.category] = {
          total: 0,
          attempted: 0,
          correct: 0,
          wrong: 0,
          avgMastery: 0,
          sumMastery: 0,
          totalExtracts: 0
        };
      }
      
      const passageStats = studentStats.passages[passage.id];
      
      let totalMastery = 0;
      let questionCount = 0;
      let totalCorrect = 0;
      let totalAnswerCount = 0;

      if (passageStats) {
        categoryStats[passage.category].attempted++;
        categoryStats[passage.category].totalExtracts += passageStats.extract_count || 0;
        
        if (passageStats.questions) {
          passage.questions.forEach(question => {
            const qStat = passageStats.questions?.[question.id];
            if (qStat) {
              totalMastery += qStat.mastery_level || 0;
              questionCount++;
              totalCorrect += qStat.correct_count || 0;
              totalAnswerCount += qStat.answer_count || 0;
              
              categoryStats[passage.category].sumMastery += qStat.mastery_level || 0;
              
              if (qStat.mastery_level < 0.5 && qStat.mastery_level > 0) {
                weakQuestions.push({
                  passageId: passage.id,
                  passageTitle: passage.title,
                  questionId: question.id,
                  number: question.number,
                  mastery: qStat.mastery_level
                });
              }
              
              if (qStat.mastery_level >= 0.8) {
                masteredQuestions.push({
                  passageId: passage.id,
                  passageTitle: passage.title,
                  questionId: question.id,
                  number: question.number,
                  mastery: qStat.mastery_level
                });
              }
            }
          });
        }
      }
      
      categoryStats[passage.category].total += passage.questions.length;

      const avgMastery = questionCount > 0 ? totalMastery / questionCount : 0;
      const accuracy = totalAnswerCount > 0 ? totalCorrect / totalAnswerCount : 0;

      passagesStats[passage.id] = {
        extract_count: passageStats?.extract_count || 0,
        answer_count: totalAnswerCount,
        correct_count: totalCorrect,
        wrong_count: totalAnswerCount - totalCorrect,
        accuracy: accuracy,
        avg_mastery: avgMastery,
        attempted_questions: questionCount,
        last_practiced: passageStats?.last_practiced || null,
        first_seen: passageStats?.first_seen || null
      };
    });

    Object.keys(categoryStats).forEach(cat => {
      const catStat = categoryStats[cat];
      catStat.avgMastery = catStat.sumMastery > 0 
        ? Math.round((catStat.sumMastery / catStat.total) * 100) / 100 
        : 0;
    });

    return sendResponse(res, 1, "获取报告成功", {
      metadata: studentStats.metadata,
      summary: {
        totalPassages: allPassages.length,
        attemptedPassages: Object.keys(studentStats.passages).length,
        totalExtracts: studentStats.metadata?.totalExtracts || 0,
        totalAnswers: studentStats.metadata?.totalQuestionsAttempted || 0,
        weakQuestions: weakQuestions.length,
        masteredQuestions: masteredQuestions.length
      },
      categoryStats,
      weakQuestions: weakQuestions.slice(0, 10),
      masteredQuestions: masteredQuestions.slice(0, 10),
      passages: passagesStats
    });

  } catch (err) {
    console.error("获取报告失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

module.exports = router;
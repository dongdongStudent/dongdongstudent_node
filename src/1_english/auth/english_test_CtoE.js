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

// ==================== 中译英题库配置 ====================

const C_TO_E_BANKS = {
  middle: {
    id: '中考',
    key: 'middle',
    name: '中考中译英',
    description: '根据中文提示完成英文句子',
    masterFile: 'c_to_e_middle.json',
    statsFile: 'c_to_e_middle_stats.json',
    aliases: ['middle', '中考', '中译英中考'],
    categories: ['生活', '日常对话', '教育', '健康', '故事']
  },
  high: {
    id: '高考',
    key: 'high',
    name: '高考中译英',
    description: '高考难度的中译英句子练习',
    masterFile: 'c_to_e_high.json',
    statsFile: 'c_to_e_high_stats.json',
    aliases: ['high', '高考', '中译英高考'],
    categories: ['社会', '文化', '科技', '哲理']
  }
};

/**
 * 根据ID或别名获取题库配置
 */
const getBankConfig = (bankId) => {
  if (C_TO_E_BANKS[bankId]) return C_TO_E_BANKS[bankId];
  
  for (const [key, config] of Object.entries(C_TO_E_BANKS)) {
    if (config.id === bankId) return config;
    if (config.aliases && config.aliases.includes(bankId)) return config;
  }
  return null;
};

/**
 * 获取学生统计文件路径
 */
const getStudentStatsPath = (username, bankId = 'middle') => {
  const bank = getBankConfig(bankId);
  if (!bank) return null;
  
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "test_c_to_e",
    bank.statsFile
  );
};

/**
 * 获取题目母版路径
 */
const getMasterQuestionsPath = (bankId = 'middle') => {
  const bank = getBankConfig(bankId);
  if (!bank) return null;
  
  return path.join(
    __dirname, 
    "../", 
    "resource/english_test_chinese_to_english_master",
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
    "test_c_to_e"
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
  history: []
});

const calculateMasteryLevel = (stat) => {
  const total = stat.correct_count + stat.wrong_count;
  if (total === 0) return 0;

  const accuracy = stat.correct_count / total;
  
  // 近期表现（最近3次）
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

  // 时间衰减
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

  return stats;
};

// ==================== API接口 ====================

/**
 * 获取题库列表
 * GET /api/c_to_e/banks
 */
router.get("/banks", async (req, res) => {
  console.log('调用 /banks 接口');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const banksWithStats = await Promise.all(
      Object.values(C_TO_E_BANKS).map(async (bank) => {
        const masterPath = getMasterQuestionsPath(bank.id);
        
        if (!masterPath || !fs.existsSync(masterPath)) return null;
        
        const masterData = await smartRead(masterPath, { questions: [] });
        
        if (!masterData.questions || masterData.questions.length === 0) return null;
        
        const actualTotal = masterData.questions?.length || 0;
        const categories = [...new Set(masterData.questions?.map(q => q.category).filter(Boolean) || [])];
        
        return {
          id: bank.id,
          key: bank.key,
          name: bank.name,
          description: bank.description,
          totalQuestions: actualTotal,
          categories: categories.length > 0 ? categories : bank.categories
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
 * 获取中译英题目
 * GET /api/c_to_e/questions?type=random&bank=middle&count=10&withDetails=true
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
      type = "random", 
      bank = "middle", 
      count = 10,
      category = "all",
      difficulty = "all",
      withDetails = "true"
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
      allQuestions = allQuestions.filter(q => q.category === category);
    }
    if (difficulty !== "all") {
      allQuestions = allQuestions.filter(q => q.difficulty === parseInt(difficulty));
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

    // 抽取逻辑
    if (type === "all") {
      selectedQuestions = allQuestions;
    } else if (type === "random") {
      // 随机抽取
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      selectedQuestions = shuffled.slice(0, Math.min(count, shuffled.length));
    } else if (type === "weak") {
      // 薄弱题目
      const weakQuestions = allQuestions.filter(question => {
        const qStat = studentStats.questions ? studentStats.questions[question.id] : null;
        return qStat && qStat.mastery_level > 0 && qStat.mastery_level < 0.5;
      });
      selectedQuestions = weakQuestions.length > 0 
        ? weakQuestions.slice(0, Math.min(count, weakQuestions.length))
        : allQuestions.slice(0, count);
    } else if (type === "new") {
      // 新题目
      const newQuestions = allQuestions.filter(question => {
        return !studentStats.questions || !studentStats.questions[question.id];
      });
      selectedQuestions = newQuestions.length > 0 
        ? newQuestions.slice(0, Math.min(count, newQuestions.length))
        : allQuestions.slice(0, count);
    } else {
      // 默认随机
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      selectedQuestions = shuffled.slice(0, Math.min(count, shuffled.length));
    }

    // 确保 studentStats.questions 存在
    if (!studentStats.questions) {
      studentStats.questions = {};
    }

    // 记录题目被查看
    selectedQuestions.forEach(question => {
      if (!studentStats.questions[question.id]) {
        studentStats.questions[question.id] = createDefaultQuestionStat(now);
      } else {
        studentStats.questions[question.id].last_practiced = now;
        studentStats.questions[question.id].extract_count += 1;
      }
    });

    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    // 根据 withDetails 参数决定返回的内容
    const questionsForClient = selectedQuestions.map(q => {
      const baseQuestion = {
        id: q.id,
        number: q.number,
        chinese: q.chinese,
        english: q.english,
        category: q.category,
        difficulty: q.difficulty
      };

      // 如果需要返回详细信息，添加这些字段
      if (withDetails === "true") {
        return {
          ...baseQuestion,
          type: q.type || (q.blanks ? 'multi' : 'single'),
          correctForm: q.correctForm,
          blanks: q.blanks,
          combinedCorrectForms: q.combinedCorrectForms,
          explanation: q.explanation
        };
      }
      
      return baseQuestion;
    });

    return sendResponse(res, 1, "获取成功", {
      questions: questionsForClient,
      bank: bankConfig.id,
      total: questionsForClient.length,
      stats: {
        totalQuestions: allQuestions.length,
        attemptedQuestions: Object.keys(studentStats.questions || {}).length
      }
    });

  } catch (err) {
    console.error("获取题目失败:", err);
    return sendResponse(res, 0, "服务器内部错误", { error: err.message });
  }
});

/**
 * 提交中译英答案
 * POST /api/c_to_e/submit
 */
router.post("/submit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { questionIds = [], answers = [], timeSpent = 0, bank = "middle" } = req.body;
    
    // console.log('收到提交数据:', { questionIds, answers, timeSpent, bank });

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
    
    // 创建题目映射
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

    // 确保 studentStats.questions 存在
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

      // 判断题目类型并验证答案
      let isCorrect = false;
      
      if (question.type === 'multi' && question.blanks) {
        // 多空题验证 - 直接处理数组格式
        try {
          // 如果 userAnswer 已经是数组，直接使用
          let userAnswers;
          if (Array.isArray(userAnswer)) {
            userAnswers = userAnswer;
          } 
          // 如果是字符串，尝试解析 JSON
          else if (typeof userAnswer === 'string') {
            if (userAnswer.startsWith('[') && userAnswer.endsWith(']')) {
              userAnswers = JSON.parse(userAnswer);
            } else {
              // 如果不是 JSON 格式，可能是错误的格式
              userAnswers = [userAnswer];
            }
          } 
          // 其他情况，创建空数组
          else {
            userAnswers = new Array(question.blanks.length).fill('');
          }

          // 确保数组长度匹配
          if (userAnswers.length !== question.blanks.length) {
            console.log(`答案数组长度不匹配: 期望 ${question.blanks.length}, 实际 ${userAnswers.length}`);
            userAnswers = userAnswers.slice(0, question.blanks.length);
            while (userAnswers.length < question.blanks.length) {
              userAnswers.push('');
            }
          }

          // 检查每个空是否匹配
          const allCorrect = question.blanks.every((blank, index) => {
            const userAns = String(userAnswers[index] || '').trim().toLowerCase().replace(/\s+/g, ' ');
            
            // 如果用户答案为空，返回 false
            if (!userAns) return false;

            // 检查是否匹配任何一个正确形式
            return blank.correctForms.some(correct => {
              const normalizedCorrect = String(correct).trim().toLowerCase().replace(/\s+/g, ' ');
              
              // 完全匹配
              if (normalizedCorrect === userAns) return true;
              
              // 用户答案是正确答案的前缀（如 "why" 匹配 "why are jenny and jack"）
              if (normalizedCorrect.startsWith(userAns)) {
                const nextChar = normalizedCorrect.charAt(userAns.length);
                if (nextChar === '' || nextChar === ' ') return true;
              }
              
              return false;
            });
          });

          isCorrect = allCorrect;
          console.log(`多空题验证结果: ${isCorrect ? '正确' : '错误'}, 用户答案:`, userAnswers);
          
        } catch (e) {
          console.error('多空题验证出错:', e);
          isCorrect = false;
        }
      } else {
        // 单空题验证
        const normalizedUser = String(userAnswer || '').trim().toLowerCase().replace(/\s+/g, ' ');
        
        if (!normalizedUser) {
          isCorrect = false;
        }
        // 如果 correctForm 包含 "/"，分割成多个可能答案
        else if (question.correctForm && question.correctForm.includes('/')) {
          const correctForms = question.correctForm.split('/').map(s => s.trim().toLowerCase());
          isCorrect = correctForms.some(correct => {
            const normalizedCorrect = correct.replace(/\s+/g, ' ');
            
            // 完全匹配
            if (normalizedCorrect === normalizedUser) return true;
            
            // 用户答案是正确答案的前缀
            if (normalizedCorrect.startsWith(normalizedUser)) {
              const nextChar = normalizedCorrect.charAt(normalizedUser.length);
              if (nextChar === '' || nextChar === ' ') return true;
            }
            
            return false;
          });
        } else {
          const normalizedCorrect = String(question.correctForm || '').trim().toLowerCase().replace(/\s+/g, ' ');
          
          // 完全匹配
          if (normalizedCorrect === normalizedUser) {
            isCorrect = true;
          }
          // 用户答案是正确答案的前缀
          else if (normalizedCorrect.startsWith(normalizedUser)) {
            const nextChar = normalizedCorrect.charAt(normalizedUser.length);
            if (nextChar === '' || nextChar === ' ') {
              isCorrect = true;
            }
          }
        }
      }

      // 模拟答题时间
      const responseTime = timeSpent ? Math.floor(timeSpent / questionIds.length) : Math.floor(Math.random() * 15) + 5;

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

      // 准备要存储的用户答案（如果是多空题，存储为数组）
      let answerToStore = userAnswer;
      if (question.type === 'multi' && question.blanks) {
        if (Array.isArray(userAnswer)) {
          answerToStore = userAnswer;
        } else if (typeof userAnswer === 'string' && userAnswer.startsWith('[') && userAnswer.endsWith(']')) {
          try {
            answerToStore = JSON.parse(userAnswer);
          } catch {
            answerToStore = userAnswer;
          }
        } else {
          answerToStore = userAnswer;
        }
      }

      // 添加历史记录
      qStat.history.push({
        date: now,
        result: isCorrect,
        time: responseTime,
        userAnswer: answerToStore,
        correctAnswer: question.type === 'multi' 
          ? JSON.stringify(question.blanks.map(b => b.correctForms))
          : (question.correctForm || '')
      });

      // ========== 限制历史记录只保留最新的7条 ==========
      if (qStat.history.length > 7) {
        qStat.history = qStat.history.slice(-7);
      }
      // ===============================================

      // 重新计算掌握程度
      qStat.mastery_level = calculateMasteryLevel(qStat);

      // 准备正确答案显示
      let correctAnswerDisplay;
      if (question.type === 'multi' && question.blanks) {
        correctAnswerDisplay = question.combinedCorrectForms?.[0] || 
          question.blanks.map((b, idx) => `空${idx+1}: ${b.correctForms.join('/')}`).join('; ');
      } else {
        correctAnswerDisplay = question.correctForm || '请查看解析';
      }

      results.push({
        questionId,
        number: question.number,
        isCorrect,
        correctAnswer: correctAnswerDisplay,
        userAnswer: userAnswer
      });
    }

    // 更新元数据并保存
    studentStats = updateMetadata(studentStats);
    await smartWrite(statsPath, studentStats);

    const correctCount = results.filter(r => r.isCorrect).length;
    const totalCount = results.length;

    console.log('提交完成, 结果:', { correctCount, totalCount });

    return sendResponse(res, 1, "提交成功", {
      results,
      summary: {
        total: totalCount,
        correct: correctCount,
        wrong: totalCount - correctCount,
        accuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) / 100 : 0
      }
    });

  } catch (err) {
    console.error("提交答案失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取题目详情（带解析）
 * GET /api/c_to_e/questions/:questionId/details?bank=middle
 */
router.get("/questions/:questionId/details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    const { questionId } = req.params;
    const { bank = "middle" } = req.query;

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

    // 返回完整题目信息（含答案和解析）
    const questionWithStats = {
      id: question.id,
      number: question.number,
      chinese: question.chinese,
      english: question.english,
      type: question.type || (question.blanks ? 'multi' : 'single'),
      correctForm: question.correctForm,
      blanks: question.blanks,
      combinedCorrectForms: question.combinedCorrectForms,
      explanation: question.explanation,
      category: question.category,
      difficulty: question.difficulty,
      stats: qStat ? {
        extract_count: qStat.extract_count || 0,
        answer_count: qStat.answer_count || 0,
        correct_count: qStat.correct_count || 0,
        wrong_count: qStat.wrong_count || 0,
        accuracy: qStat.accuracy || 0,
        mastery_level: qStat.mastery_level || 0,
        last_practiced: qStat.last_practiced || null,
        history: qStat.history || []
      } : null
    };

    return sendResponse(res, 1, "获取成功", { question: questionWithStats });

  } catch (err) {
    console.error("获取题目详情失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取学习报告
 * GET /api/c_to_e/report?bank=middle
 */
router.get("/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendResponse(res, 0, "未提供 token");

    const decoded = token_decode(authHeader);
    const username = decoded.username;
    if (!username) return sendResponse(res, 0, "用户信息不存在");

    ensureUserStatsDirectory(username);

    const { bank = "middle" } = req.query;

    const bankConfig = getBankConfig(bank);
    if (!bankConfig) return sendResponse(res, 0, `题库不存在: ${bank}`);

    const statsPath = getStudentStatsPath(username, bank);
    if (!statsPath) return sendResponse(res, 0, "无法获取统计文件路径");

    const studentStats = await smartRead(statsPath, { metadata: {}, questions: {} });

    return sendResponse(res, 1, "获取报告成功", studentStats);

  } catch (err) {
    console.error("获取报告失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 健康检查
 * GET /api/c_to_e/health
 */
router.get("/health", async (req, res) => {
  res.json({ flag: 1, message: "中译英 API is running" });
});

module.exports = router;
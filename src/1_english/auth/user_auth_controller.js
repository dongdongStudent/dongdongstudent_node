// router/json_user_controller.js - 用户控制器
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// 导入学习数据管理器
const learningManager = require("./json_learning_manager");

// JWT密钥配置
const JWT_SECRET = "lingoflow-secret-key-2024";
const JWT_EXPIRES_IN = "30d";

// 文件路径配置
const USER_PROFILES_FILE = path.join(__dirname, "..", "user_profiles.json");
const USERS_DATA_DIR = path.join(__dirname, "..", "users");

// 确保数据目录存在
const ensureDataDir = () => {
  const dirs = [USERS_DATA_DIR];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // 初始化 user_profiles.json 如果不存在
  if (!fs.existsSync(USER_PROFILES_FILE)) {
    const initialData = {
      metadata: {
        version: "2.0", // 更新版本号
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        next_user_id: 1001,
      },
      users: {},
      username_index: {},
      email_index: {},
    };

    fs.writeFileSync(USER_PROFILES_FILE, JSON.stringify(initialData, null, 2));
    console.log("已创建新的 user_profiles.json 文件");
  }
};

// 读取用户档案
const readUserProfiles = () => {
  ensureDataDir();
  try {
    const data = fs.readFileSync(USER_PROFILES_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("读取用户档案失败:", error);
    return {
      metadata: { next_user_id: 1001 },
      users: {},
      username_index: {},
    };
  }
};

// 保存用户档案
const saveUserProfiles = (profiles) => {
  try {
    profiles.metadata.last_updated = new Date().toISOString();
    fs.writeFileSync(USER_PROFILES_FILE, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error("保存用户档案失败:", error);
  }
};

// 初始化用户学习数据（使用新的学习管理器）
const initUserStudyData = (userId, username) => {
  try {
    return learningManager.initUserDataFiles(userId, username);
  } catch (error) {
    console.error("初始化用户学习数据失败:", error);
    return null;
  }
};

// 获取用户学习数据
const getUserStudyData = (userId) => {
  return learningManager.getUserConfig(userId);
};

// 生成JWT Token
const generateToken = (userData) => {
  return jwt.sign(
    {
      id: userData.id,
      username: userData.username || (userData.basic_info && userData.basic_info.username),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// 验证Token中间件
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.send({
      flag: 0,
      message: "未提供token",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.send({
      flag: 0,
      message: "token无效或已过期",
    });
  }
};

// 验证规则
const validateUser = (userData) => {
  const { username, password, repeat_password } = userData;

  if (!username || !password) {
    return { valid: false, message: "用户名和密码不能为空" };
  }

  if (repeat_password && password !== repeat_password) {
    return { valid: false, message: "两次输入的密码不一致" };
  }

  if (password.length < 6) {
    return { valid: false, message: "密码长度不能少于6位" };
  }

  if (username.length < 3 || username.length > 30) {
    return { valid: false, message: "用户名长度应在3-30个字符之间" };
  }

  // 用户名只能包含字母、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return { valid: false, message: "用户名只能包含字母、数字和下划线" };
  }

  return { valid: true };
};

// 迁移旧数据到新结构（可选）
const migrateOldUserData = (userId, username) => {
  const oldProgressFile = path.join(__dirname, "..", "data", "user_progress", `${userId}.json`);
  
  if (fs.existsSync(oldProgressFile)) {
    try {
      console.log(`检测到用户 ${username} 的旧数据，尝试迁移...`);
      const oldData = JSON.parse(fs.readFileSync(oldProgressFile, "utf8"));
      
      // 这里可以添加数据迁移逻辑
      // 例如，将旧的学习进度迁移到新结构
      
      console.log(`用户 ${username} 的旧数据迁移完成`);
      return true;
    } catch (error) {
      console.error(`迁移用户 ${username} 的旧数据失败:`, error);
      return false;
    }
  }
  return false;
};

// 1. 注册新用户
exports.regUser = async (req, res) => {
  console.log("注册新用户", req.body);

  const validation = validateUser(req.body);
  if (!validation.valid) {
    return res.send({
      flag: 0,
      message: validation.message,
    });
  }

  const userinfo = req.body;
  const profiles = readUserProfiles();

  // 检查用户名是否已存在
  const existingUserId = profiles.username_index[userinfo.username.toLowerCase()];
  if (existingUserId) {
    console.log("用户名已存在");
    return res.send({
      flag: 0,
      message: "用户名已存在！",
    });
  }

  try {
    // 生成用户ID
    const userId = profiles.metadata.next_user_id.toString();
    profiles.metadata.next_user_id++;

    // 加密密码
    const hashedPassword = await bcrypt.hash(userinfo.password, 10);

    // 创建新用户档案
    profiles.users[userId] = {
      basic_info: {
        username: userinfo.username,
        username_2: userinfo.username,
        display_name: userinfo.username,
        email: userinfo.email || `${userinfo.username}@example.com`,
        avatar_url: null,
        bio: null,
      },
      security: {
        password_hash: hashedPassword,
        password_changed_at: new Date().toISOString(),
        password_strength: "medium",
        failed_login_attempts: 0,
      },
      timestamps: {
        join_date: new Date().toISOString().split("T")[0],
        last_login: null,
        last_activity: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      account_status: {
        is_active: true,
        is_verified: false,
        is_premium: false,
      },
      study_settings: {
        daily_target: 20,
        preferred_modules: ["pepa", "reading"],
        auto_play_audio: true,
        show_hints: false,
        difficulty_level: "medium",
        timezone: "Asia/Shanghai",
      },
      ui_settings: {
        theme: "light",
        language: "zh-CN",
        font_size: "medium",
      },
      study_stats: {
        current_streak: 0,
        longest_streak: 0,
        total_study_days: 0,
        total_words_studied: 0,
        total_words_mastered: 0,
        total_study_time_minutes: 0,
        average_daily_words: 0,
        accuracy_rate: 0,
      },
    };

    // 更新索引
    profiles.username_index[userinfo.username.toLowerCase()] = userId;
    if (userinfo.email) {
      profiles.email_index[userinfo.email.toLowerCase()] = userId;
    }

    profiles.metadata.last_updated = new Date().toISOString();

    // 保存用户档案
    saveUserProfiles(profiles);

    // 初始化学习数据（新结构）
    const studyData = initUserStudyData(userId, userinfo.username);
    
    if (!studyData) {
      throw new Error("初始化学习数据失败");
    }

    console.log("用户注册成功:", userinfo.username);

    // 生成token
    const token = generateToken({ id: userId, username: userinfo.username });

    // 返回响应
    res.send({
      flag: 1,
      message: "注册成功！",
      user: {
        id: userId,
        username: userinfo.username,
        name: userinfo.username,
        email: userinfo.email || `${userinfo.username}@example.com`,
        join_date: profiles.users[userId].timestamps.join_date,
      },
      study_data: studyData,
      token: token,
    });
  } catch (error) {
    console.error("注册失败:", error);
    res.send({
      flag: 0,
      message: "注册失败，请稍后重试",
    });
  }
};

// 2. 登录函数
exports.login = async (req, res) => {
  console.log("用户登录", req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.send({
      flag: 0,
      message: "用户名和密码不能为空",
    });
  }

  try {
    const profiles = readUserProfiles();
    
    // 通过用户名索引查找用户ID
    const userId = profiles.username_index[username.toLowerCase()];

    if (!userId || !profiles.users[userId]) {
      return res.send({
        flag: 0,
        message: "用户名或密码错误！",
      });
    }

    const user = profiles.users[userId];

    // 验证密码
    const isValidPassword = await bcrypt.compare(
      password,
      user.security.password_hash
    );

    if (!isValidPassword) {
      // 记录失败尝试
      user.security.failed_login_attempts += 1;
      profiles.metadata.last_updated = new Date().toISOString();
      saveUserProfiles(profiles);

      return res.send({
        flag: 0,
        message: "用户名或密码错误！",
      });
    }

    // 重置失败尝试计数
    user.security.failed_login_attempts = 0;

    // 更新最后登录时间
    user.timestamps.last_login = new Date().toISOString();
    user.timestamps.last_activity = new Date().toISOString();

    profiles.metadata.last_updated = new Date().toISOString();
    saveUserProfiles(profiles);

    // 生成token
    const token = generateToken({
      id: userId,
      username: user.basic_info.username,
    });

    // 解密测试
    const decoded = jwt.verify(token, JWT_SECRET);

    // 获取用户学习数据（新结构）
    const studyData = getUserStudyData(userId);
    
    // 如果没有学习数据，初始化
    if (!studyData) {
      console.log(`用户 ${username} 的学习数据不存在，正在初始化...`);
      initUserStudyData(userId, user.basic_info.username);
    }

    // 返回用户信息
    res.send({
      flag: 1,
      message: "登录成功！",
      user: {
        id: userId,
        username: user.basic_info.username,
        name: user.basic_info.display_name,
        email: user.basic_info.email,
        join_date: user.timestamps.join_date,
        settings: user.study_settings,
        stats: user.study_stats,
      },
      study_data: studyData,
      token: token,
    });
  } catch (error) {
    console.error("登录失败:", error);
    res.send({
      flag: 0,
      message: "登录失败，请稍后重试",
    });
  }
};

// 3. 获取用户学习进度
exports.getUserProgress = (req, res) => {
  if (!req.user) {
    return res.send({
      flag: 0,
      message: "未登录",
    });
  }

  const userId = req.user.id;
  const module = req.query.module || "all";

  const studyData = getUserStudyData(userId);

  if (!studyData) {
    return res.send({
      flag: 0,
      message: "学习数据不存在",
    });
  }

  if (module === "all") {
    res.send({
      flag: 1,
      message: "获取学习进度成功",
      progress: studyData.progress_stats,
      current_status: studyData.current_status
    });
  } else if (studyData.progress_stats[module]) {
    res.send({
      flag: 1,
      message: "获取模块进度成功",
      module: module,
      progress: studyData.progress_stats[module]
    });
  } else {
    res.send({
      flag: 0,
      message: "模块不存在",
    });
  }
};

// 4. 更新学习进度
exports.updateProgress = (req, res) => {
  if (!req.user) {
    return res.send({
      flag: 0,
      message: "未登录",
    });
  }

  const userId = req.user.id;
  const { module, word_data, action } = req.body;

  if (!module) {
    return res.send({
      flag: 0,
      message: "缺少模块参数",
    });
  }

  try {
    // 获取当前配置
    const userConfig = learningManager.getUserConfig(userId);
    
    if (!userConfig) {
      return res.send({
        flag: 0,
        message: "用户配置不存在",
      });
    }

    // 处理不同的操作
    let success = false;
    let message = "操作成功";
    
    if (action === 'update_status') {
      // 更新学习状态
      if (word_data && word_data.status) {
        learningManager.updateUserConfig(userId, {
          current_status: word_data.status
        });
        success = true;
      }
    } else if (action === 'update_stats') {
      // 更新统计信息
      if (word_data && word_data.stats) {
        learningManager.updateStudyProgress(userId, module, word_data.stats);
        success = true;
      }
    } else if (action === 'add_word') {
      // 添加单词
      if (word_data) {
        success = learningManager.addWordToStudy(userId, module, word_data);
        message = success ? "添加单词成功" : "单词已存在";
      }
    } else if (action === 'move_to_review') {
      // 移动到复习本
      if (word_data) {
        success = learningManager.moveToReview(userId, module, word_data);
        message = success ? "单词已移至复习本" : "移动失败";
      }
    }

    // 获取更新后的进度
    const progress = learningManager.getUserProgress(userId);

    res.send({
      flag: success ? 1 : 0,
      message: message,
      progress: progress
    });
  } catch (error) {
    console.error("更新学习进度失败:", error);
    res.send({
      flag: 0,
      message: "更新学习进度失败",
    });
  }
};

// 5. 获取当前用户信息
exports.getCurrentUser = (req, res) => {
  if (!req.user) {
    return res.send({
      flag: 0,
      message: "未登录",
    });
  }

  const userId = req.user.id;
  const profiles = readUserProfiles();
  const user = profiles.users[userId];

  if (!user) {
    return res.send({
      flag: 0,
      message: "用户不存在",
    });
  }

  // 获取学习数据
  const studyData = getUserStudyData(userId);

  res.send({
    flag: 1,
    message: "获取用户信息成功",
    user: {
      id: userId,
      username: user.basic_info.username,
      name: user.basic_info.display_name,
      email: user.basic_info.email,
      join_date: user.timestamps.join_date,
      settings: user.study_settings,
      stats: user.study_stats,
    },
    study_data: studyData
  });
};

// 6. 更新用户信息
exports.updateUser = (req, res) => {
  if (!req.user) {
    return res.send({
      flag: 0,
      message: "未登录",
    });
  }

  const userId = req.user.id;
  const { name, email, settings } = req.body;

  const profiles = readUserProfiles();
  if (!profiles.users[userId]) {
    return res.send({
      flag: 0,
      message: "用户不存在",
    });
  }

  const user = profiles.users[userId];

  // 更新基本信息
  if (name) user.basic_info.display_name = name;
  if (email) {
    // 检查邮箱是否已被使用
    const existingUserId = profiles.email_index[email.toLowerCase()];
    if (existingUserId && existingUserId !== userId) {
      return res.send({
        flag: 0,
        message: "邮箱已被使用",
      });
    }
    
    // 更新邮箱索引
    delete profiles.email_index[user.basic_info.email.toLowerCase()];
    user.basic_info.email = email;
    profiles.email_index[email.toLowerCase()] = userId;
  }

  // 更新设置
  if (settings) {
    user.study_settings = { ...user.study_settings, ...settings };
    
    // 同步更新学习数据中的设置
    learningManager.updateUserConfig(userId, {
      settings: user.study_settings
    });
  }

  user.timestamps.updated_at = new Date().toISOString();

  profiles.metadata.last_updated = new Date().toISOString();
  saveUserProfiles(profiles);

  res.send({
    flag: 1,
    message: "用户信息更新成功",
    user: {
      id: userId,
      username: user.basic_info.username,
      name: user.basic_info.display_name,
      email: user.basic_info.email,
      settings: user.study_settings,
    },
  });
};

// 7. 修改密码
exports.changePassword = async (req, res) => {
  if (!req.user) {
    return res.send({
      flag: 0,
      message: "未登录",
    });
  }

  const userId = req.user.id;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.send({
      flag: 0,
      message: "请提供旧密码和新密码",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.send({
      flag: 0,
      message: "两次输入的新密码不一致",
    });
  }

  if (newPassword.length < 6) {
    return res.send({
      flag: 0,
      message: "新密码长度不能少于6位",
    });
  }

  try {
    const profiles = readUserProfiles();
    const user = profiles.users[userId];

    if (!user) {
      return res.send({
        flag: 0,
        message: "用户不存在",
      });
    }

    // 验证旧密码
    const isValidPassword = await bcrypt.compare(
      oldPassword,
      user.security.password_hash
    );

    if (!isValidPassword) {
      return res.send({
        flag: 0,
        message: "旧密码错误",
      });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.security.password_hash = hashedPassword;
    user.security.password_changed_at = new Date().toISOString();
    user.security.password_strength = newPassword.length > 8 ? "strong" : "medium";
    
    user.timestamps.updated_at = new Date().toISOString();
    profiles.metadata.last_updated = new Date().toISOString();
    
    saveUserProfiles(profiles);

    res.send({
      flag: 1,
      message: "密码修改成功",
    });
  } catch (error) {
    console.error("修改密码失败:", error);
    res.send({
      flag: 0,
      message: "密码修改失败",
    });
  }
};

// 8. 获取指定用户信息
exports.getUserInfo = (req, res) => {
  const userId = req.query.id;

  if (!userId) {
    return res.send({
      flag: 0,
      message: "请提供用户ID",
    });
  }

  const profiles = readUserProfiles();
  const user = profiles.users[userId];

  if (!user) {
    return res.send({
      flag: 0,
      message: "用户不存在",
    });
  }

  res.send({
    flag: 1,
    message: "获取用户信息成功",
    user: {
      id: userId,
      username: user.basic_info.username,
      name: user.basic_info.display_name,
      join_date: user.timestamps.join_date,
      stats: user.study_stats,
    },
  });
};

// 9. 退出登录
exports.logout = (req, res) => {
  res.send({
    flag: 1,
    message: "退出成功",
  });
};

// 10. 导出 verifyToken 中间件
exports.verifyToken = verifyToken;

// 11. 数据迁移接口（开发用）
exports.migrateData = (req, res) => {
  if (req.query.secret !== "lingoflow2024") {
    return res.send({
      flag: 0,
      message: "未授权",
    });
  }

  const profiles = readUserProfiles();
  let migratedCount = 0;

  for (const [userId, user] of Object.entries(profiles.users)) {
    try {
      const username = user.basic_info.username;
      const studyData = initUserStudyData(userId, username);
      
      if (studyData) {
        migratedCount++;
        console.log(`用户 ${username} (${userId}) 数据迁移完成`);
      }
    } catch (error) {
      console.error(`用户 ${userId} 数据迁移失败:`, error);
    }
  }

  res.send({
    flag: 1,
    message: `数据迁移完成，共迁移 ${migratedCount} 个用户`,
  });
};

module.exports = exports;
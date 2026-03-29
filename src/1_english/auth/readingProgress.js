// readingProgress.js - 阅读进度相关路由模块
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

// 获取用户阅读进度文件夹路径
const getReadingProgressPath = (username_2) => {
  return path.join(__dirname, "../", "resource/person_name", username_2, "reading_progress");
};

// 读取阅读进度数据
const readReadingProgressData = async (username_2) => {
  const progressPath = getReadingProgressPath(username_2);
  const filePath = path.join(progressPath, "reading_progress.json");
  const dirPath = path.dirname(filePath);

  // 1. 检查目录是否存在，不存在则创建
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[获取阅读进度] 用户: ${username_2}, 创建目录: ${dirPath}`);
  }

  // 2. 检查文件是否存在，不存在则创建
  if (!fs.existsSync(filePath)) {
    console.log(`[获取阅读进度] 用户: ${username_2}, 文件不存在，创建新文件`, filePath);

    // 创建默认的JSON数据
    const defaultData = {};

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
    return defaultData;
  }

  // 3. 从磁盘读取数据
  try {
    const rawData = fs.readFileSync(filePath, "utf8").trim();
    let data = {};

    if (rawData) {
      try {
        if (rawData.startsWith("module.exports")) {
          const jsonPart = rawData
            .replace(/module\.exports\s*=\s*/, "")
            .replace(/;$/, "");
          data = JSON.parse(jsonPart);
        } else {
          data = JSON.parse(rawData);
        }
      } catch (parseError) {
        console.error(`[解析失败] 用户: ${username_2}, 文件内容:`, rawData.substring(0, 200));
        data = {};
      }
    }

    console.log(`[获取阅读进度] 用户: ${username_2}, 读取成功`);
    return data;
  } catch (error) {
    console.error(`[读取失败] 用户: ${username_2}`, error);
    return {};
  }
};

// 写入阅读进度数据
const writeReadingProgressData = async (username_2, data) => {
  const progressPath = getReadingProgressPath(username_2);
  const filePath = path.join(progressPath, "reading_progress.json");
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[写入阅读进度] 用户: ${username_2}, 写入成功`);

  return data;
};

// 获取阅读进度
router.get("/progress", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    const data = await readReadingProgressData(username_2);
    return res.json({ 
      success: true, 
      data: data,
      message: '获取阅读进度成功' 
    });
  } catch (err) {
    console.error(`[获取阅读进度失败]`, err);

    try {
      const decoded = token_decode(authHeader);
      const username_2 = decoded.username;
      const progressPath = getReadingProgressPath(username_2);
      const filePath = path.join(progressPath, "reading_progress.json");

      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const defaultData = {};
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");

      console.log(`[获取阅读进度] 用户: ${username_2}, 创建新文件成功`);
      return res.json({ 
        success: true, 
        data: defaultData,
        message: '获取阅读进度成功' 
      });
    } catch (writeErr) {
      console.error("创建新文件失败:", writeErr);
      return res
        .status(500)
        .json({ 
          success: false, 
          message: "服务器解析最新数据失败且无法创建新文件" 
        });
    }
  }
});

// 更新阅读进度
router.post("/progress", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { articleId, grade, unit, readStatus: status } = req.body;

  console.log(`[更新阅读进度] 收到请求:`, { articleId, grade, unit, status });

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  if (!articleId) {
    return res.status(400).json({ success: false, message: "文章ID不能为空" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    // 读取现有数据
    const existingData = await readReadingProgressData(username_2);
    
    // 确定年级和单元
    const articleGrade = grade || articleId.match(/^(7A|7B|8A|8B|9A|9B)/)?.[0] || 'other';
    const articleUnit = unit || articleId.match(/U[1-8]/)?.[0] || 'other';
    
    // 初始化数据结构
    if (!existingData[articleGrade]) {
      existingData[articleGrade] = {};
    }
    if (!existingData[articleGrade][articleUnit]) {
      existingData[articleGrade][articleUnit] = {};
    }
    
    // 更新阅读状态
    existingData[articleGrade][articleUnit][articleId] = {
      read: status !== false, // 默认标记为已读，除非明确传false
      readAt: new Date().toISOString(),
      lastRead: new Date().toLocaleString('zh-CN')
    };
    
    // 写入文件
    await writeReadingProgressData(username_2, existingData);
    
    console.log(`[更新阅读进度] 用户: ${username_2}, 更新成功，文章: ${articleId}`);
    
    res.json({
      success: true,
      data: existingData[articleGrade][articleUnit][articleId],
      message: '阅读进度更新成功'
    });
  } catch (error) {
    console.error("更新阅读进度失败:", error);
    res.status(500).json({
      success: false,
      message: '更新阅读进度失败'
    });
  }
});

// 批量更新阅读进度
router.post("/progress/batch", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { progressData } = req.body;

  console.log(`[批量更新阅读进度] 收到请求，数据量:`, progressData ? Object.keys(progressData).length : 0);

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    // 读取现有数据
    const existingData = await readReadingProgressData(username_2);
    
    // 合并新数据
    Object.keys(progressData).forEach(grade => {
      if (!existingData[grade]) {
        existingData[grade] = {};
      }
      
      Object.keys(progressData[grade]).forEach(unit => {
        if (!existingData[grade][unit]) {
          existingData[grade][unit] = {};
        }
        
        Object.keys(progressData[grade][unit]).forEach(articleId => {
          existingData[grade][unit][articleId] = progressData[grade][unit][articleId];
        });
      });
    });
    
    // 写入文件
    await writeReadingProgressData(username_2, existingData);
    
    console.log(`[批量更新阅读进度] 用户: ${username_2}, 更新成功`);
    
    res.json({
      success: true,
      message: '批量更新阅读进度成功'
    });
  } catch (error) {
    console.error("批量更新阅读进度失败:", error);
    res.status(500).json({
      success: false,
      message: '批量更新阅读进度失败'
    });
  }
});

// 清除阅读进度
router.delete("/progress", async (req, res) => {
  const authHeader = req.headers.authorization;

  console.log(`[清除阅读进度] 收到请求`);

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    // 创建空数据
    const emptyData = {};
    
    // 写入文件
    await writeReadingProgressData(username_2, emptyData);
    
    console.log(`[清除阅读进度] 用户: ${username_2}, 清除成功`);
    
    res.json({
      success: true,
      message: '阅读进度已清除'
    });
  } catch (error) {
    console.error("清除阅读进度失败:", error);
    res.status(500).json({
      success: false,
      message: '清除阅读进度失败'
    });
  }
});

module.exports = router;
// wordRoutes.js - 单词相关路由模块
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

// ==================== Peppa学习数据同步 ====================
router.post("/sync_peppa_learning", async (req, res) => {
  // 1. 获取基础参数
  const authHeader =
    req.headers.authorization ||
    (req.body.headers && req.body.headers.Authorization);
  const { type, learningData } = req.body; // 修改参数名

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  // 2. 解析身份
  const decoded = token_decode(authHeader);
  const username_2 = decoded.username;

  if (!username_2) {
    return res.json({ flag: 0, message: "用户信息不存在" });
  }

  // 3. 路径获取工具
  const getPath = (fileName) =>
    path.join(__dirname, "../", "resource/person_name", username_2, fileName);

  // --- 内部万能写入函数 ---
  const smartWrite = async (filePath, data) => {
    let content;
    if (filePath.endsWith(".json")) {
      content = JSON.stringify(data, null, 2);
    } else {
      content = `module.exports = ${JSON.stringify(data, null, 2)};`;
    }
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    return fs.promises.writeFile(filePath, content, "utf8");
  };

  // --- 内部万能读取函数 ---
  const smartRead = async (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return null;

      const raw = fs.readFileSync(filePath, "utf8").trim();
      if (!raw) return null;

      if (raw.startsWith("[") || raw.startsWith("{")) {
        return JSON.parse(raw);
      } else {
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      }
    } catch (e) {
      console.error("读取失败:", e.message);
      return null;
    }
  };

  try {
    // 专门为Peppa学习数据创建文件
    const filePath = getPath("sentence_pepa.json");
    console.log("Peppa学习数据同步操作类型--->",filePath);
    // --- 分支 0: 获取Peppa学习数据 ---
    if (type === "get_peppa_data") {
      const data = await smartRead(filePath);
      return res.json({
        flag: 1,
        content: data || {
          understoodSentences: [],
          difficultSentences: [],
          timestamp: Date.now(),
          lastUpdate: new Date().toISOString(),
        },
      });
    }

    // --- 分支 A: Peppa学习数据同步 ---
    if (type === "sync_peppa_progress") {
      // 合并现有数据（如果存在）
      let existingData = (await smartRead(filePath)) || {};

      const newData = {
        ...existingData,
        ...learningData,
        lastSyncTime: new Date().toISOString(),
        syncCount: (existingData.syncCount || 0) + 1,
      };

      await smartWrite(filePath, newData);
      console.log(`[Peppa学习数据同步成功] 用户: ${username_2}`);

      return res.json({
        flag: 1,
        message: "Peppa学习数据同步成功",
        content: newData,
      });
    }

    // --- 分支 B: 重置Peppa学习数据 ---
    if (type === "reset_peppa_data") {
      const defaultData = {
        understoodSentences: [],
        difficultSentences: [],
        timestamp: Date.now(),
        lastUpdate: new Date().toISOString(),
        resetCount: 1,
      };

      await smartWrite(filePath, defaultData);

      return res.json({
        flag: 1,
        message: "Peppa学习数据已重置",
        content: defaultData,
      });
    }

    res.status(400).json({ flag: 0, message: "未知的Peppa学习数据操作类型" });
  } catch (err) {
    console.error("Peppa学习数据操作失败:", err);
    res.status(500).json({ flag: 0, message: "服务器内部错误" });
  }
});

module.exports = router;

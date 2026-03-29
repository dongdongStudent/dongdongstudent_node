// wordRoutes.js - 单词相关路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

// 导入翻译工具
const { handleTranslation_word } = require("../tool/weisimin.js");

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

// 辅助函数：根据类型获取文件名
function getFileNameByType(type) {
  const fileNameMap = {
    // 默认类型
    master: "word_master.json",

    // API_CONFIG中的类型
    reading: "word_reading_study.json",
    pepa: "word_pepa_study.json",
    textbook: "word_textbook_study.json",
    gre: "word_gre_master.json",

    // 数字类型（动态）
    1: "word_1_master.json",
    2: "word_2_master.json",
    3: "word_3_master.json",
    4: "word_4_master.json",
    5: "word_5_master.json",
  };

  if (fileNameMap[type]) {
    return fileNameMap[type];
  } else if (!isNaN(type) && type.trim() !== "") {
    return `word_${type}_master.json`;
  } else {
    return `word_${type}_master.json`;
  }
}

// 通用读取函数
const readWordData = async (username_2, wordType) => {
  const fileName = getFileNameByType(wordType);

  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    username_2,
    fileName
  );

  const dirPath = path.dirname(filePath);
  // console.log("12333", filePath);

  // 1. 检查目录是否存在，不存在则创建
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });

  }

  // 2. 检查文件是否存在，不存在则创建
  if (!fs.existsSync(filePath)) {


    // 创建默认的JSON数据
    const defaultData = [];

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");

    return defaultData;
  }

  // 3. 消除 require 缓存 (如果该文件曾经被作为模块加载)
  try {
    const resolvedPath = require.resolve(filePath);
    if (require.cache[resolvedPath]) {
      delete require.cache[resolvedPath];
    }
  } catch (e) {
    // 路径未被加载过则忽略
  }

  // 4. 强制从磁盘直接读取原始字符串
  const rawData = fs.readFileSync(filePath, "utf8").trim();

  let data = [];
  if (rawData) {
    // 处理可能的 JS 格式兼容性
    if (rawData.startsWith("module.exports")) {
      const jsonPart = rawData
        .replace(/module\.exports\s*=\s*/, "")
        .replace(/;$/, "");
      data = JSON.parse(jsonPart);
    } else {
      data = JSON.parse(rawData);
    }
  }

  console.log(
    `[获取数据] 用户: ${username_2}, 类型: ${wordType}, 实时读取成功`
  );
  return data;
};

// 通用写入函数
const writeWordData = async (username_2, wordType, data) => {
  const fileName = getFileNameByType(wordType);
  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    username_2,
    fileName
  );

  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[写入数据] 用户: ${username_2}, 类型: ${wordType}, 写入成功`);

  return data;
};

// 通用单词获取路由
router.get("/get_words/:type?", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;
  const wordType = req.params.type || "master";

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ flag: 0, message: "用户信息不存在" });
    }

    const data = await readWordData(username_2, wordType);
    return res.json(data);
  } catch (err) {
    console.error(`[获取数据失败] 类型: ${wordType}`, err);

    try {
      const decoded = token_decode(authHeader);
      const username_2 = decoded.username;

      const fileName = getFileNameByType(wordType);
      const filePath = path.join(
        __dirname,
        "../..",
        "resource/person_name",
        username_2,
        fileName
      );

      const dirPath = path.dirname(filePath);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const defaultData = [];
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");

      console.log(
        `[获取数据] 用户: ${username_2}, 类型: ${wordType}, 读取失败，创建新文件成功`
      );
      return res.json(defaultData);
    } catch (writeErr) {
      console.error("创建新文件失败:", writeErr);
      return res
        .status(500)
        .json({ flag: 0, message: "服务器解析最新数据失败且无法创建新文件" });
    }
  }
});

// 向后兼容的读取路由
router.get("/get_reading_words", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ flag: 0, message: "用户信息不存在" });
    }

    const data = await readWordData(username_2, "reading");
    return res.json(data);
  } catch (err) {
    console.error(`[获取数据失败] 类型: reading`, err);
    return res.status(500).json({ flag: 0, message: "服务器解析最新数据失败" });
  }
});

router.get("/get_pepa_words", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ flag: 0, message: "用户信息不存在" });
    }

    const data = await readWordData(username_2, "pepa");

    return res.json(data);
  } catch (err) {
    console.error(`[获取数据失败] 类型: pepa`, err);
    return res.status(500).json({ flag: 0, message: "服务器解析最新数据失败" });
  }
});

router.get("/get_textbook_words", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ flag: 0, message: "用户信息不存在" });
    }

    const data = await readWordData(username_2, "textbook");
    return res.json(data);
  } catch (err) {
    console.error(`[获取数据失败] 类型: textbook`, err);
    return res.status(500).json({ flag: 0, message: "服务器解析最新数据失败" });
  }
});

router.get("/get_gre_words", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ flag: 0, message: "用户信息不存在" });
    }

    const data = await readWordData(username_2, "gre");
    return res.json(data);
  } catch (err) {
    console.error(`[获取数据失败] 类型: gre`, err);
    return res.status(500).json({ flag: 0, message: "服务器解析最新数据失败" });
  }
});

// 通用更新处理函数
const handleUpdateWords = async (req, res, wordType) => {
  // 1. 获取基础参数
  const authHeader =
    req.headers.authorization ||
    (req.body.headers && req.body.headers.Authorization);
  const { type, word, vocabularyData } = req.body;

  console.log(`收到请求操作类型---> ${type}, 词库类型: ${wordType}`);

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  // 2. 解析身份
  const decoded = token_decode(authHeader);
  const username_2 = decoded.username;

  if (!username_2) {
    return res.json({ flag: 0, message: "用户信息不存在" });
  }

  try {
    // --- 分支 0: 获取初始化数据 ---
    if (type === "get_data") {
      const data = await readWordData(username_2, wordType);
      return sendResponse(res, 1, "获取数据成功", data);
    }

    // --- 分支 A: 练习进度全量同步 ---
    if (type === "sync_progress") {
      await writeWordData(username_2, wordType, vocabularyData);
      console.log(`[同步成功] 用户: ${username_2}, 类型: ${wordType}`);
      return sendResponse(res, 1, "进度同步成功", vocabularyData);
    }

    // --- 分支 B: 单词增删操作 ---
    if (type === "add" || type === "delete") {
      let data = await readWordData(username_2, wordType);
      console.log("读取的数据:", data);

      // 修复：确保data是数组
      // 如果data不是数组，说明是对象格式，需要转换
      if (!Array.isArray(data)) {
        console.log("数据不是数组，开始转换...");
        // 检查是否是对象格式
        if (typeof data === "object" && data !== null) {
          // 检查是否是 { words: { ... } } 格式
          if (data.words && typeof data.words === "object") {
            // 转换为数组
            data = Object.entries(data.words).map(([wordKey, wordData]) => ({
              word: wordKey,
              ...wordData,
            }));
            console.log("从{words: {...}}格式转换为数组:", data);
          } else if (data.words && Array.isArray(data.words)) {
            // 如果是 { words: [...] } 但words是数组
            data = data.words;
            console.log("从{words: [...]}格式提取数组:", data);
          } else if (
            Object.keys(data).length > 0 &&
            typeof Object.values(data)[0] === "object"
          ) {
            // 直接是 { word1: {...}, word2: {...} } 格式
            data = Object.entries(data).map(([wordKey, wordData]) => ({
              word: wordKey,
              ...wordData,
            }));
            console.log("从对象格式转换为数组:", data);
          } else {
            // 其他情况，初始化为空数组
            data = [];
            console.log("初始化数据为空数组");
          }
        } else {
          // 如果不是对象，初始化为空数组
          data = [];
          console.log("数据不是对象，初始化空数组");
        }
      } else {

      }

      const index = data.findIndex((item) => item.word === word);

      if (type === "add") {
        if (index !== -1) return sendResponse(res, 1, "单词已存在");

        let translation = "待翻译";
        try {
          // 使用 handleTranslation_word 进行翻译
          translation = await handleTranslation_word(word);

        } catch (e) {
          console.error(`[翻译失败] 单词: ${word}, 错误:`, e);
          // 翻译失败时保留"待翻译"
        }

        data.push({
          word: word,
          translation: translation,
          status: {
            listening: false,
            reading: false,
            translation: false,
            pronunciation: false,
          },
        });

        // 检查是否需要转换回原始格式
        // 这里需要根据 readWordData 的实际返回格式决定保存格式
        const dataToSave = data; // 如果readWordData返回数组，直接保存数组

        await writeWordData(username_2, wordType, dataToSave);


        return sendResponse(res, 1, "写入成功", data);
      }

      if (type === "delete") {
        if (index === -1) return sendResponse(res, 1, "单词不存在");
        data.splice(index, 1);

        // 检查是否需要转换回原始格式
        const dataToSave = data; // 如果readWordData返回数组，直接保存数组

        await writeWordData(username_2, wordType, dataToSave);
        console.log(
          `[删除成功] 用户: ${username_2}, 类型: ${wordType}, 单词: ${word}`
        );
        return sendResponse(res, 1, "删除成功", data);
      }
    }

    return res.status(400).json({ flag: 0, message: "未知的操作类型" });
  } catch (err) {
    console.error("操作失败:", err);
    return res.status(500).json({
      flag: 0,
      message: "服务器内部错误",
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// 通用更新路由
router.post("/update_words/:type?", async (req, res) => {
  const wordType = req.params.type || "master";
  return handleUpdateWords(req, res, wordType);
});

// 向后兼容的更新路由
router.post("/update_reading_words", async (req, res) => {
  return handleUpdateWords(req, res, "reading");
});

router.post("/update_pepa_words", async (req, res) => {
  return handleUpdateWords(req, res, "pepa");
});

router.post("/update_textbook_words", async (req, res) => {
  return handleUpdateWords(req, res, "textbook");
});

router.post("/update_gre_words", async (req, res) => {
  return handleUpdateWords(req, res, "gre");
});

router.get("/get_word_review/:type?", async (req, res) => {
  // 强制不缓存
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;
  let type = req.params.type; // 获取路径参数

  if (!authHeader) {
    return res.status(401).json({ error: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.status(401).json({ error: "用户信息不存在" });
    }

    // 确定文件名
    let fileName, filePath;

    fileName = type.endsWith(".json") ? type : type + ".json";

    // 构建文件路径
    filePath = path.join(
      __dirname,
      "../..",
      "resource/person_name",
      username_2,
      fileName
    );

    console.log(`[文件请求] 用户: ${username_2}, 文件: ${fileName}`);
    console.log('333',filePath)

    // 创建用户目录（如果不存在）
    const userDir = path.dirname(filePath);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
      console.log(`[创建目录] 用户: ${username_2}, 目录: ${userDir}`);
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.log(`[文件不存在] 用户: ${username_2}, 文件: ${fileName}`);

      try {
        // 创建空 JSON 文件
        const initialData = {};
        fs.writeFileSync(
          filePath,
          JSON.stringify(initialData, null, 2),
          "utf8"
        );
        console.log(`[创建文件] 用户: ${username_2}, 文件: ${fileName} 已创建`);

        // 返回空对象
        return res.status(201).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            message: "文件已自动创建",
          },
        });
      } catch (createErr) {
        console.error(
          `[创建失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`,
          createErr
        );
        return res.status(500).json({
          error: "文件创建失败",
          message: "无法创建新文件",
          file: fileName,
          user: username_2,
        });
      }
    }

    // 文件存在，读取内容
    try {
      const rawData = fs.readFileSync(filePath, "utf8").trim();

      if (!rawData) {
        console.log(`[空文件] 用户: ${username_2}, 文件: ${fileName}`);

        // 如果是空文件，写入初始数据
        const initialData = {};
        fs.writeFileSync(
          filePath,
          JSON.stringify(initialData, null, 2),
          "utf8"
        );

        return res.status(200).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            updated: new Date().toISOString(),
            created: new Date().toISOString(),
            warning: "文件为空，已重新初始化",
          },
        });
      }

      // 解析 JSON
      const data = JSON.parse(rawData);
      console.log(
        `[返回数据] 用户: ${username_2}, 文件: ${fileName}, 获取成功`
      );

      // 直接返回解析后的数据
      return res.json(data);
    } catch (parseErr) {
      console.error(
        `[解析失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`,
        parseErr
      );

      // 如果 JSON 解析失败，尝试修复文件
      try {
        console.log(`[尝试修复] 用户: ${username_2}, 文件: ${fileName}`);
        const initialData = {};
        fs.writeFileSync(
          filePath,
          JSON.stringify(initialData, null, 2),
          "utf8"
        );

        return res.status(200).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            warning: "原文件格式错误，已重新初始化",
          },
        });
      } catch (recoveryErr) {
        console.error(
          `[修复失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`,
          recoveryErr
        );
        return res.status(500).json({
          error: "文件解析失败且无法修复",
          message: "文件格式不正确或已损坏",
          file: fileName,
          user: username_2,
        });
      }
    }
  } catch (err) {
    console.error("获取数据失败:", err);
    return res.status(500).json({ error: "服务器错误" });
  }
});

module.exports = router;

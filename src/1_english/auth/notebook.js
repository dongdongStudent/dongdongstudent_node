// notebook.js - 笔记本相关路由模块
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
  res.json({ success: flag, message, content });
};

// 获取用户笔记本文件夹路径
const getNotebookPath = (username_2) => {
  return path.join(
    __dirname,
    "../",
    "resource/person_name",
    username_2,
    "notebook"
  );
};

// 读取笔记本数据
const readNotebookData = async (username_2) => {
  const notebookPath = getNotebookPath(username_2);
  const filePath = path.join(notebookPath, "notebook.json");
  const dirPath = path.dirname(filePath);

  // 1. 检查目录是否存在，不存在则创建
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[获取数据] 用户: ${username_2}, 创建笔记本目录: ${dirPath}`);
  }

  // 2. 检查文件是否存在，不存在则创建
  if (!fs.existsSync(filePath)) {
    console.log(
      `[获取数据] 用户: ${username_2}, 笔记本文件不存在，创建新文件`,
      filePath
    );

    // 创建默认的JSON数据
    const defaultData = [];

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
    return defaultData;
  }

  // 3. 消除 require 缓存
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
      console.error(
        `[解析失败] 用户: ${username_2}, 文件内容:`,
        rawData.substring(0, 200)
      );
      data = [];
    }
  }

  console.log(
    `[获取数据] 用户: ${username_2}, 笔记本读取成功，共 ${data.length} 条笔记`
  );
  return data;
};

// 写入笔记本数据
const writeNotebookData = async (username_2, data) => {
  const notebookPath = getNotebookPath(username_2);
  const filePath = path.join(notebookPath, "notebook.json");
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(
    `[写入数据] 用户: ${username_2}, 笔记本写入成功，共 ${data.length} 条笔记`
  );

  return data;
};

// 获取所有笔记
router.get("/notes", async (req, res) => {
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

    const data = await readNotebookData(username_2);
    return res.json({
      success: true,
      data: data,
      message: "获取笔记成功",
    });
  } catch (err) {
    console.error(`[获取笔记失败]`, err);

    try {
      const decoded = token_decode(authHeader);
      const username_2 = decoded.username;
      const notebookPath = getNotebookPath(username_2);
      const filePath = path.join(notebookPath, "notebook.json");

      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const defaultData = [];
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");

      console.log(
        `[获取数据] 用户: ${username_2}, 笔记本读取失败，创建新文件成功`
      );
      return res.json({
        success: true,
        data: defaultData,
        message: "获取笔记成功",
      });
    } catch (writeErr) {
      console.error("创建新文件失败:", writeErr);
      return res.status(500).json({
        success: false,
        message: "服务器解析最新数据失败且无法创建新文件",
      });
    }
  }
});

// 搜索笔记
router.get("/notes/search", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { query, page = 1, limit = 20 } = req.query;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    const allNotes = await readNotebookData(username_2);
    let filteredNotes = allNotes;

    // 关键词搜索
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase();
      filteredNotes = allNotes.filter((note) => {
        const contentMatch =
          note.content && note.content.toLowerCase().includes(searchTerm);
        const titleMatch =
          note.videoContext?.videoTitle &&
          note.videoContext.videoTitle.toLowerCase().includes(searchTerm);
        const wordMatch =
          note.videoContext?.word &&
          note.videoContext.word.toLowerCase().includes(searchTerm);
        const subtitleMatch =
          note.videoContext?.subtitle &&
          note.videoContext.subtitle.toLowerCase().includes(searchTerm);

        return contentMatch || titleMatch || wordMatch || subtitleMatch;
      });
    }

    // 分页处理
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedNotes = filteredNotes.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: {
        notes: paginatedNotes,
        pagination: {
          total: filteredNotes.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(filteredNotes.length / parseInt(limit)),
        },
      },
      message: "搜索成功",
    });
  } catch (error) {
    console.error("搜索笔记失败:", error);
    res.status(500).json({
      success: false,
      message: "搜索失败",
    });
  }
});

// 创建新笔记
router.post("/notes", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { content, videoContext } = req.body;

  console.log(`[创建笔记] 收到请求:`, {
    content: content ? content.substring(0, 50) + "..." : "空内容",
    videoContext,
  });

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  if (!content || !content.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "笔记内容不能为空" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    // 读取现有数据
    const existingData = await readNotebookData(username_2);

    // 生成唯一ID（简单的时间戳 + 随机数）
    const generateId = () => {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    const newNote = {
      _id: generateId(),
      userId: username_2,
      content: content.trim(),
      videoContext: videoContext || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
      wordCount: content.trim().split(/\s+/).length,
    };

    // 添加到数组开头（最新在最前）
    existingData.unshift(newNote);

    // 写入文件
    await writeNotebookData(username_2, existingData);

    console.log(`[创建笔记] 用户: ${username_2}, 创建成功，ID: ${newNote._id}`);

    res.json({
      success: true,
      data: newNote,
      message: "笔记保存成功",
    });
  } catch (error) {
    console.error("保存笔记失败:", error);
    res.status(500).json({
      success: false,
      message: "保存笔记失败",
    });
  }
});

// 删除笔记（软删除）
router.delete("/notes/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  const noteId = req.params.id;

  console.log(`[删除笔记] 收到请求，笔记ID: ${noteId}`);

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
    const existingData = await readNotebookData(username_2);

    // 查找笔记索引
    const noteIndex = existingData.findIndex((note) => note._id === noteId);

    if (noteIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "笔记不存在或无权限删除",
      });
    }

    // 软删除：标记为删除
    existingData[noteIndex].isDeleted = true;
    existingData[noteIndex].deletedAt = new Date().toISOString();

    // 写入文件
    await writeNotebookData(username_2, existingData);

    console.log(`[删除笔记] 用户: ${username_2}, 删除成功，ID: ${noteId}`);

    res.json({
      success: true,
      message: "笔记已删除",
    });
  } catch (error) {
    console.error("删除笔记失败:", error);
    res.status(500).json({
      success: false,
      message: "删除笔记失败",
    });
  }
});

// 获取笔记详情
router.get("/notes/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  const noteId = req.params.id;

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
    const existingData = await readNotebookData(username_2);

    // 查找笔记
    const note = existingData.find(
      (item) => item._id === noteId && item.isDeleted === false
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "笔记不存在",
      });
    }

    res.json({
      success: true,
      data: note,
      message: "获取笔记详情成功",
    });
  } catch (error) {
    console.error("获取笔记详情失败:", error);
    res.status(500).json({
      success: false,
      message: "获取笔记详情失败",
    });
  }
});

// 更新笔记
router.put("/notes/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  const noteId = req.params.id;
  const { content } = req.body;

  console.log(`[更新笔记] 收到请求，笔记ID: ${noteId}`);

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "未提供 token" });
  }

  if (!content || !content.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "笔记内容不能为空" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      return res.json({ success: false, message: "用户信息不存在" });
    }

    // 读取现有数据
    const existingData = await readNotebookData(username_2);

    // 查找笔记索引
    const noteIndex = existingData.findIndex(
      (note) => note._id === noteId && note.isDeleted === false
    );

    if (noteIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "笔记不存在或无权限修改",
      });
    }

    // 更新笔记内容
    existingData[noteIndex].content = content.trim();
    existingData[noteIndex].updatedAt = new Date().toISOString();
    existingData[noteIndex].wordCount = content.trim().split(/\s+/).length;

    // 写入文件
    await writeNotebookData(username_2, existingData);

    console.log(`[更新笔记] 用户: ${username_2}, 更新成功，ID: ${noteId}`);

    res.json({
      success: true,
      message: "笔记更新成功",
    });
  } catch (error) {
    console.error("更新笔记失败:", error);
    res.status(500).json({
      success: false,
      message: "更新笔记失败",
    });
  }
});

module.exports = router;

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

router.post("/update_me_word_index", async (req, res) => {
  
  try {
    // 1. 获取基础参数
    const authHeader =
      req.headers.authorization ||
      (req.body.headers && req.body.headers.Authorization);
    const { type, word, wordData, words, target } = req.body;

    console.log(
      "收到请求操作类型--->",
      type,
      "目标文件:",
      target || "me_word_index"
    );

    if (!authHeader) {
      return sendResponse(res, 0, "未提供 token");
    }

    // 2. 解析身份
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username_2;

    if (!username_2) {
      return sendResponse(res, 0, "用户信息不存在");
    }

    // 3. 根据 target 确定文件路径
    const getPath = (fileName) => {
      console.log('target:', target)
      const finalFileName = target && target !== "me_word_index" ? target : "me_word_index";
      
      return path.join(
        __dirname,
        "../..",
        "resource/person_name",
        username_2,
        finalFileName + ".json"
      );
    };

    // 文件路径
    const filePath = getPath();

    // 4. 智能读取函数
    const smartRead = async (filePath) => {
      console.log('111111111111', filePath)
      if (!fs.existsSync(filePath)) { // 
        const fileName = path.basename(filePath, ".json");
        if (!isNaN(fileName) && fileName !== "") {
          return [];
        }
        return {  };
      }

      try {
        const raw = fs.readFileSync(filePath, "utf8").trim();
        if (!raw) {
          throw new Error("文件为空");
        }
        return JSON.parse(raw);
      } catch (e) {
        console.error("读取失败，初始化为空数据:", e.message);
        const fileName = path.basename(filePath, ".json");
        if (!isNaN(fileName) && fileName !== "") {
          return [];
        }
        return { words: {} };
      }
    };

    // 5. 智能写入函数
    const smartWrite = async (filePath, data) => {
      const content = JSON.stringify(data, null, 2);
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      return fs.promises.writeFile(filePath, content, "utf8");
    };

    // 6. 获取目标文件路径（支持target参数）
    const getTargetFilePath = () => {
      if (target && target !== "me_word_index") {
        return path.join(
          __dirname,
          "../..",
          "resource/person_name",
          username_2,
          target + ".json"
        );
      }
      return filePath;
    };

    // 7. 通用操作函数 - 根据type分发
    const handleOperation = async (operationType) => {
      const targetFilePath = getTargetFilePath();
      let data = await smartRead(targetFilePath);
      const fileName = path.basename(targetFilePath, ".json");

      // 记录日志
      console.log(`[${operationType}] 用户: ${username_2}, 文件: ${fileName}, 单词: ${word || '批量操作'}`);

      switch (operationType) {
        case 'add':
          return handleAdd(data, fileName, targetFilePath);
        case 'update':
          return handleUpdate(data, fileName, targetFilePath);
        case 'delete':
          return handleDelete(data, fileName, targetFilePath);
        case 'reset_stats':
          return handleResetStats(data, fileName, targetFilePath);
        case 'increment_correct':
          return handleIncrementCorrect(data, fileName, targetFilePath);
        case 'increment_wrong':
          return handleIncrementWrong(data, fileName, targetFilePath);
        case 'increment':
          return handleIncrement(data, fileName, targetFilePath);
        case 'batch_add':
          return handleBatchAdd(data, fileName, targetFilePath);
        case 'batch_delete':
          return handleBatchDelete(data, fileName, targetFilePath);
        case 'batch_update':
          return handleBatchUpdate(data, fileName, targetFilePath);
        default:
          throw new Error('未知的操作类型');
      }
    };

    // 8. 解析单词数据为对象的辅助函数
    const parseWordDataToObject = (wordData) => {
      if (!wordData) {
        return {
          chinese: "",
          pass: false,
          extraction_count: 0,
          correct_count: 0,
          wrong_count: 0,
          time: null,
        };
      }

      if (typeof wordData === "object" && wordData !== null) {
        return {
          chinese: wordData.chinese || "",
          pass: Boolean(wordData.pass),
          extraction_count: wordData.extraction_count || 0,
          correct_count: wordData.correct_count || 0,
          wrong_count: wordData.wrong_count || 0,
          time: wordData.time || null,
        };
      }

      if (typeof wordData === "string") {
        if (wordData.includes("|")) {
          const parts = wordData.split("|");
          if (parts.length >= 5) {
            return {
              chinese: parts[0],
              pass: parts[1] === "true",
              extraction_count: parseInt(parts[2]) || 0,
              correct_count: parseInt(parts[3]) || 0,
              wrong_count: parseInt(parts[4]) || 0,
              time: parts.length >= 6 ? parts[5] || null : null,
            };
          } else if (parts.length >= 2) {
            return {
              chinese: parts[0],
              pass: parts[1] === "true",
              extraction_count: parts.length >= 3 ? parseInt(parts[2]) || 0 : 0,
              correct_count: 0,
              wrong_count: 0,
              time: parts.length >= 4 ? parts[3] || null : null,
            };
          }
        }
        return {
          chinese: wordData,
          pass: false,
          extraction_count: 0,
          correct_count: 0,
          wrong_count: 0,
          time: null,
        };
      }

      return {
        chinese: String(wordData),
        pass: false,
        extraction_count: 0,
        correct_count: 0,
        wrong_count: 0,
        time: null,
      };
    };

    // 9. 获取单词数据的通用函数
    const getWordContainer = (data, word) => {
      // 标准格式: {words: {...word: data}}
      if (data.words && data.words[word] !== undefined) {
        return { container: data.words, wordData: data.words[word] };
      }
      // 直接对象格式: {word: data}
      if (data[word] !== undefined) {
        return { container: data, wordData: data[word] };
      }
      // 数组格式: [{word: "xxx", data: {...}}]
      if (Array.isArray(data)) {
        const item = data.find(item => item.word === word || (item.data && item.data.word === word));
        if (item) {
          return { container: data, wordData: item.data || item, index: data.indexOf(item) };
        }
      }
      return null;
    };

    // 10. 更新单词数据的通用函数
    const updateWordData = (container, word, newData, index = -1) => {
      if (index >= 0 && Array.isArray(container)) {
        container[index] = { word, data: newData };
      } else if (container.words) {
        // 标准格式
        container.words[word] = newData;
      } else {
        // 直接对象格式
        container[word] = newData;
      }
    };

    // 11. 处理添加操作
    const handleAdd = async (data, fileName, filePath) => {
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      const existing = getWordContainer(data, word);
      if (existing) {
        return sendResponse(res, 0, "单词已存在");
      }

      const parsedWordData = parseWordDataToObject(wordData);
      if (!parsedWordData.time) {
        parsedWordData.time = new Date().toISOString();
      }

      // 根据文件格式添加单词
      if (data.words !== undefined) {
        // 标准格式
        if (!data.words) data.words = {};
        data.words[word] = parsedWordData;
      } else if (Array.isArray(data)) {
        // 数组格式
        data.push({ word, data: parsedWordData });
      } else {
        // 直接对象格式
        data[word] = parsedWordData;
      }

      await smartWrite(filePath, data);
      
      return sendResponse(res, 1, "添加成功", {
        word: word,
        wordData: parsedWordData,
      });
    };

    // 12. 处理更新操作
    const handleUpdate = async (data, fileName, filePath) => {
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      const existing = getWordContainer(data, word);
      if (!existing) {
        return sendResponse(res, 0, "单词不存在");
      }

      const existingData = parseWordDataToObject(existing.wordData);
      const newData = parseWordDataToObject(wordData);

      // 合并数据，保留未提供的字段
      const mergedData = {
        chinese: newData.chinese || existingData.chinese,
        pass: newData.pass !== undefined ? newData.pass : existingData.pass,
        extraction_count: newData.extraction_count !== undefined ? newData.extraction_count : existingData.extraction_count,
        correct_count: newData.correct_count !== undefined ? newData.correct_count : existingData.correct_count,
        wrong_count: newData.wrong_count !== undefined ? newData.wrong_count : existingData.wrong_count,
        time: newData.time || existingData.time || new Date().toISOString(),
      };

      updateWordData(existing.container, word, mergedData, existing.index);
      await smartWrite(filePath, data);

      return sendResponse(res, 1, "更新成功", {
        word: word,
        wordData: mergedData,
      });
    };

    // 13. 处理删除操作
    const handleDelete = async (data, fileName, filePath) => {
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      const existing = getWordContainer(data, word);
      if (!existing) {
        return sendResponse(res, 0, "单词不存在");
      }

      if (existing.index >= 0 && Array.isArray(existing.container)) {
        // 从数组中删除
        existing.container.splice(existing.index, 1);
      } else if (data.words && data.words[word]) {
        // 从标准格式中删除
        delete data.words[word];
      } else {
        // 从直接对象中删除
        delete data[word];
      }

      await smartWrite(filePath, data);

      return sendResponse(res, 1, "删除成功", {
        word: word,
      });
    };

    // 14. 处理重置统计操作（与add模式一致）
    const handleResetStats = async (data, fileName, filePath) => {
      console.log('重置统计', word)
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      const existing = getWordContainer(data, word);
      if (!existing) {
        return sendResponse(res, 0, "单词不存在");
      }

      const existingData = parseWordDataToObject(existing.wordData);

      // 重置统计
      const resetData = {
        ...existingData,
        correct_count: 0,
        wrong_count: 0,
        extraction_count: 0,
        time: new Date().toISOString(),
      };

      updateWordData(existing.container, word, resetData, existing.index);
      await smartWrite(filePath, data);

      return sendResponse(res, 1, "统计重置成功", {
        word: word,
        wordData: resetData,
        file: fileName,
      });
    };

    // 15. 处理增加正确次数
    const handleIncrementCorrect = async (data, fileName, filePath) => {
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      const existing = getWordContainer(data, word);
      if (!existing) {
        return sendResponse(res, 0, "单词不存在");
      }

      const existingData = parseWordDataToObject(existing.wordData);
      const updatedData = {
        ...existingData,
        correct_count: (existingData.correct_count || 0) + 1,
        time: new Date().toISOString(),
      };

      updateWordData(existing.container, word, updatedData, existing.index);
      await smartWrite(filePath, data);

      return sendResponse(res, 1, "增加正确次数成功", {
        word: word,
        wordData: updatedData,
      });
    };

    // 16. 处理增加错误次数
    const handleIncrementWrong = async (data, fileName, filePath) => {
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      const existing = getWordContainer(data, word);
      if (!existing) {
        return sendResponse(res, 0, "单词不存在");
      }

      const existingData = parseWordDataToObject(existing.wordData);
      const updatedData = {
        ...existingData,
        wrong_count: (existingData.wrong_count || 0) + 1,
        time: new Date().toISOString(),
      };

      updateWordData(existing.container, word, updatedData, existing.index);
      await smartWrite(filePath, data);

      return sendResponse(res, 1, "增加错误次数成功", {
        word: word,
        wordData: updatedData,
      });
    };

    // 17. 处理增加抽取次数
    const handleIncrement = async (data, fileName, filePath) => {
      if (!word) {
        return sendResponse(res, 0, "需要单词参数");
      }

      let existing = getWordContainer(data, word);
      let wordDataToUpdate;

      if (existing) {
        const existingData = parseWordDataToObject(existing.wordData);
        wordDataToUpdate = {
          ...existingData,
          extraction_count: (existingData.extraction_count || 0) + 1,
          time: new Date().toISOString(),
        };
      } else {
        // 单词不存在，创建新记录
        wordDataToUpdate = {
          chinese: wordData?.chinese || "",
          pass: false,
          extraction_count: 1,
          correct_count: 0,
          wrong_count: 0,
          time: new Date().toISOString(),
        };
        
        // 添加到数据中
        if (data.words !== undefined) {
          if (!data.words) data.words = {};
          data.words[word] = wordDataToUpdate;
        } else if (Array.isArray(data)) {
          data.push({ word, data: wordDataToUpdate });
        } else {
          data[word] = wordDataToUpdate;
        }
        
        await smartWrite(filePath, data);
        return sendResponse(res, 1, "新增单词并增加抽取次数", {
          word: word,
          wordData: wordDataToUpdate,
        });
      }

      updateWordData(existing.container, word, wordDataToUpdate, existing.index);
      await smartWrite(filePath, data);

      return sendResponse(res, 1, "增加抽取次数成功", {
        word: word,
        wordData: wordDataToUpdate,
      });
    };

    // 18. 处理批量添加
    const handleBatchAdd = async (data, fileName, filePath) => {
      const wordList = wordData;
      if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
        return sendResponse(res, 0, "没有提供有效的单词列表");
      }

      let addedCount = 0;

      for (const item of wordList) {
        if (item.word) {
          const existing = getWordContainer(data, item.word);
          if (!existing) {
            const parsedWordData = parseWordDataToObject(item);
            parsedWordData.time = parsedWordData.time || new Date().toISOString();
            
            // 根据文件格式添加
            if (data.words !== undefined) {
              if (!data.words) data.words = {};
              data.words[item.word] = parsedWordData;
            } else if (Array.isArray(data)) {
              data.push({ word: item.word, data: parsedWordData });
            } else {
              data[item.word] = parsedWordData;
            }
            addedCount++;
          }
        }
      }

      await smartWrite(filePath, data);

      return sendResponse(res, 1, "批量添加成功", {
        addedCount: addedCount,
        total: wordList.length,
      });
    };

    // 19. 处理批量删除
    const handleBatchDelete = async (data, fileName, filePath) => {
      const wordList = wordData;
      if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
        return sendResponse(res, 0, "没有提供有效的单词列表");
      }

      let deletedCount = 0;

      for (const wordToDelete of wordList) {
        const existing = getWordContainer(data, wordToDelete);
        if (existing) {
          if (existing.index >= 0 && Array.isArray(existing.container)) {
            existing.container.splice(existing.index, 1);
          } else if (data.words && data.words[wordToDelete]) {
            delete data.words[wordToDelete];
          } else {
            delete data[wordToDelete];
          }
          deletedCount++;
        }
      }

      await smartWrite(filePath, data);

      return sendResponse(res, 1, "批量删除成功", {
        deletedCount: deletedCount,
        total: wordList.length,
      });
    };

    // 20. 处理批量更新
    const handleBatchUpdate = async (data, fileName, filePath) => {
      const { words: wordList, action } = wordData || {};
      if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
        return sendResponse(res, 0, "没有提供有效的单词列表");
      }

      let updatedCount = 0;

      for (const item of wordList) {
        if (item.word) {
          const existing = getWordContainer(data, item.word);
          if (existing) {
            const existingData = parseWordDataToObject(existing.wordData);
            let updatedData = { ...existingData };
            updatedData.time = new Date().toISOString();

            if (action === "mark_mastered") {
              updatedData.pass = true;
            } else if (action === "mark_unmastered") {
              updatedData.pass = false;
            } else if (action === "update_stats") {
              if (item.correct_count !== undefined) {
                updatedData.correct_count = parseInt(item.correct_count);
              }
              if (item.wrong_count !== undefined) {
                updatedData.wrong_count = parseInt(item.wrong_count);
              }
            }

            updateWordData(existing.container, item.word, updatedData, existing.index);
            updatedCount++;
          }
        }
      }

      await smartWrite(filePath, data);

      return sendResponse(res, 1, "批量操作成功", {
        updatedCount: updatedCount,
        action: action,
      });
    };

    // 21. 执行操作
    return await handleOperation(type);

  } catch (err) {
    console.error("操作失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

// 获取单词相关数据（支持 word_pepa.json 和 word_book.json）
router.get("/me_word_index/:type?", async (req, res) => {
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
    const username_2 = decoded.username_2;

    if (!username_2) {
      return res.status(401).json({ error: "用户信息不存在" });
    }

    // 确定文件名
    let fileName, filePath;

    if (!type) {
      // 默认获取 me_word_index.json
      fileName = "me_word_index.json";
    } else {
      // 确保以 .json 结尾
      fileName = type.endsWith(".json") ? type : type + ".json";
    }

    // 构建文件路径
    filePath = path.join(
      __dirname,
      "../..",
      "resource/person_name",
      username_2,
      fileName
    );

    console.log(`[文件请求] 用户: ${username_2}, 文件: ${fileName}`);

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
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
        console.log(`[创建文件] 用户: ${username_2}, 文件: ${fileName} 已创建`);
        
        // 返回空对象
        return res.status(201).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            message: "文件已自动创建"
          }
        });
      } catch (createErr) {
        console.error(`[创建失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, createErr);
        return res.status(500).json({ 
          error: "文件创建失败",
          message: "无法创建新文件",
          file: fileName,
          user: username_2
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
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
        
        return res.status(200).json({ 
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            updated: new Date().toISOString(),
            created: new Date().toISOString(),
            warning: "文件为空，已重新初始化"
          }
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
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
        
        return res.status(200).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            warning: "原文件格式错误，已重新初始化"
          }
        });
      } catch (recoveryErr) {
        console.error(`[修复失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, recoveryErr);
        return res.status(500).json({ 
          error: "文件解析失败且无法修复",
          message: "文件格式不正确或已损坏",
          file: fileName,
          user: username_2
        });
      }
    }
  } catch (err) {
    console.error("获取数据失败:", err);
    return res.status(500).json({ error: "服务器错误" });
  }
});

module.exports = router;

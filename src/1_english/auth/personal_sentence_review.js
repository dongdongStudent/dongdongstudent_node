// personal_sentence_review.js - 句子复习相关路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

// 配置文件常量
const BANK_CONFIG = {
  statsFile: "stats.json",
  sentencesFile: "sentences.json",
  favoritesFile: "favorites.json"
};

// 获取学生统计文件路径的函数
const getStudentStatsPath = (username) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "personal_sentence_review",
    BANK_CONFIG.statsFile
  );
};

// 获取学生句子文件路径的函数
const getStudentSentencesPath = (username, filename = BANK_CONFIG.sentencesFile) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "personal_sentence_review",
    filename
  );
};

// 获取学生文件夹路径的函数
const getStudentFolderPath = (username) => {
  return path.join(
    __dirname,
    "../",
    "resource",
    "person_name",
    username,
    "personal_sentence_review"
  );
};

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

/**
 * 更新句子复习数据
 * POST /update_sentence_review
 * 支持 type: add, update, delete, reset_stats, increment_correct, increment_wrong, increment, 
 *          batch_add, batch_delete, mark_mastered, mark_unmastered, update_last_answer
 */
router.post("/update_sentence_review", async (req, res) => {
  try {
    // 1. 获取基础参数
    const authHeader =
      req.headers.authorization ||
      (req.body.headers && req.body.headers.Authorization);
    const { type, sentence, sentenceData, sentences, target = "sentences" } = req.body;

    console.log("\n========== [句子更新请求] ==========");
    console.log(`时间: ${new Date().toLocaleString()}`);
    console.log(`操作类型: ${type}`);
    console.log(`目标文件: ${target}`);

    if (!authHeader) {
      console.log("❌ 错误: 未提供 token");
      return sendResponse(res, 0, "未提供 token");
    }

    // 2. 解析身份
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      console.log("❌ 错误: 用户信息不存在");
      return sendResponse(res, 0, "用户信息不存在");
    }

    console.log(`用户: ${username_2}`);

    // 3. 文件路径 - 使用正确的路径格式
    const fileName = target.endsWith('.json') ? target : target + '.json';
    const filePath = getStudentSentencesPath(username_2, fileName);

    console.log(`📁 文件路径: ${filePath}`);

    // 4. 智能读取函数
    const smartRead = async (filePath) => {
      console.log(`\n--- 读取文件 ---`);
      console.log(`检查文件是否存在: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 文件不存在，返回空数据 { sentences: {} }`);
        return { sentences: {} };
      }

      try {
        console.log(`📖 读取文件内容...`);
        const raw = fs.readFileSync(filePath, "utf8").trim();
        console.log(`读取到 ${raw.length} 字节`);
        
        if (!raw) {
          console.log(`⚠️ 文件为空，返回空数据 { sentences: {} }`);
          return { sentences: {} };
        }
        
        const data = JSON.parse(raw);
        const sentenceCount = data.sentences ? Object.keys(data.sentences).length : 0;
        console.log(`✅ 解析成功，包含 ${sentenceCount} 个句子`);
        return data;
      } catch (e) {
        console.error(`❌ 读取失败:`, e.message);
        return { sentences: {} };
      }
    };

    // 5. 智能写入函数
    const smartWrite = async (filePath, data) => {
      console.log(`\n--- 写入文件 ---`);
      console.log(`目标路径: ${filePath}`);
      
      const content = JSON.stringify(data, null, 2);
      const dirPath = path.dirname(filePath);
      
      if (!fs.existsSync(dirPath)) {
        console.log(`📁 创建目录: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      console.log(`💾 写入 ${content.length} 字节`);
      await fs.promises.writeFile(filePath, content, "utf8");
      console.log(`✅ 写入成功`);
    };

    // 6. 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      console.log(`📁 创建目录: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    } else {
      console.log(`📁 目录已存在: ${dirPath}`);
    }

    // 7. 通用操作函数 - 根据type分发
    const handleOperation = async (operationType) => {
      console.log(`\n--- 执行操作: ${operationType} ---`);
      let data = await smartRead(filePath);

      switch (operationType) {
        case "add":
          return handleAdd(data);
        case "update":
          return handleUpdate(data);
        case "delete":
          return handleDelete(data);
        case "reset_stats":
          return handleResetStats(data);
        case "increment_correct":
          return handleIncrementCorrect(data);
        case "increment_wrong":
          return handleIncrementWrong(data);
        case "increment":
          return handleIncrement(data);
        case "batch_add":
          return handleBatchAdd(data);
        case "batch_delete":
          return handleBatchDelete(data);
        case "mark_mastered":
          return handleMarkMastered(data);
        case "mark_unmastered":
          return handleMarkUnmastered(data);
        case "update_last_answer":
          return handleUpdateLastAnswer(data);
        default:
          throw new Error("未知的操作类型");
      }
    };

    // 8. 解析句子数据为对象的辅助函数
    const parseSentenceDataToObject = (sentenceData) => {
      if (!sentenceData) {
        return {
          chinese: "",
          text: "",
          pass: false,
          extraction_count: 0,
          correct_count: 0,
          wrong_count: 0,
          last_answer_time: null,
          time: null,
        };
      }

      if (typeof sentenceData === "object" && sentenceData !== null) {
        return {
          chinese: sentenceData.chinese || "",
          text: sentenceData.text || "",
          pass: Boolean(sentenceData.pass),
          extraction_count: sentenceData.extraction_count || 0,
          correct_count: sentenceData.correct_count || 0,
          wrong_count: sentenceData.wrong_count || 0,
          last_answer_time: sentenceData.last_answer_time || null,
          time: sentenceData.time || null,
        };
      }

      if (typeof sentenceData === "string") {
        // 支持格式: "英文|中文|pass|extraction_count|correct_count|wrong_count|last_answer_time|time"
        if (sentenceData.includes("|")) {
          const parts = sentenceData.split("|");
          if (parts.length >= 2) {
            return {
              text: parts[0],
              chinese: parts[1] || "",
              pass: parts.length >= 3 ? parts[2] === "true" : false,
              extraction_count: parts.length >= 4 ? parseInt(parts[3]) || 0 : 0,
              correct_count: parts.length >= 5 ? parseInt(parts[4]) || 0 : 0,
              wrong_count: parts.length >= 6 ? parseInt(parts[5]) || 0 : 0,
              last_answer_time: parts.length >= 7 ? parts[6] || null : null,
              time: parts.length >= 8 ? parts[7] || null : null,
            };
          }
        }
        return {
          text: sentenceData,
          chinese: "",
          pass: false,
          extraction_count: 0,
          correct_count: 0,
          wrong_count: 0,
          last_answer_time: null,
          time: null,
        };
      }

      return {
        text: String(sentenceData),
        chinese: "",
        pass: false,
        extraction_count: 0,
        correct_count: 0,
        wrong_count: 0,
        last_answer_time: null,
        time: null,
      };
    };

    // 9. 获取句子数据的通用函数
    const getSentenceContainer = (data, sentenceId) => {
      if (data.sentences && data.sentences[sentenceId] !== undefined) {
        return { container: data.sentences, sentenceData: data.sentences[sentenceId] };
      }
      if (data[sentenceId] !== undefined) {
        return { container: data, sentenceData: data[sentenceId] };
      }
      if (Array.isArray(data)) {
        const item = data.find(
          (item) => item.id === sentenceId || (item.data && item.data.id === sentenceId)
        );
        if (item) {
          return {
            container: data,
            sentenceData: item.data || item,
            index: data.indexOf(item),
          };
        }
      }
      return null;
    };

    // 10. 更新句子数据的通用函数
    const updateSentenceData = (container, sentenceId, newData, index = -1) => {
      if (index >= 0 && Array.isArray(container)) {
        container[index] = { id: sentenceId, data: newData };
      } else if (container.sentences) {
        container.sentences[sentenceId] = newData;
      } else {
        container[sentenceId] = newData;
      }
    };

    // 11. 生成句子ID
    const generateSentenceId = (text) => {
      if (!text) return "sentence_" + Date.now();
      const cleanText = text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      return cleanText + "_" + Date.now();
    };

    // 12. 处理添加操作
    const handleAdd = async (data) => {
      console.log(`\n--- 添加句子 ---`);
      
      if (!sentenceData || (!sentenceData.text && !sentenceData.chinese)) {
        console.log(`❌ 错误: 需要句子数据`);
        return sendResponse(res, 0, "需要句子数据");
      }

      const sentenceId = sentenceData.id || generateSentenceId(sentenceData.text);
      console.log(`句子ID: ${sentenceId}`);
      console.log(`句子内容:`, sentenceData);

      const existing = getSentenceContainer(data, sentenceId);
      if (existing) {
        console.log(`❌ 错误: 句子已存在`);
        return sendResponse(res, 0, "句子已存在");
      }

      const parsedData = parseSentenceDataToObject(sentenceData);
      if (!parsedData.time) {
        parsedData.time = new Date().toISOString();
      }
      parsedData.id = sentenceId;

      if (!data.sentences) data.sentences = {};
      data.sentences[sentenceId] = parsedData;

      await smartWrite(filePath, data);
      console.log(`✅ 添加成功`);

      return sendResponse(res, 1, "添加成功", {
        id: sentenceId,
        sentenceData: parsedData,
      });
    };

    // 13. 处理更新操作
    const handleUpdate = async (data) => {
      console.log(`\n--- 更新句子 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      console.log(`原数据:`, existing.sentenceData);
      console.log(`新数据:`, sentenceData);

      const existingData = parseSentenceDataToObject(existing.sentenceData);
      const newData = parseSentenceDataToObject(sentenceData);

      const mergedData = {
        ...existingData,
        chinese: newData.chinese || existingData.chinese,
        text: newData.text || existingData.text,
        pass: newData.pass !== undefined ? newData.pass : existingData.pass,
        extraction_count:
          newData.extraction_count !== undefined
            ? newData.extraction_count
            : existingData.extraction_count,
        correct_count:
          newData.correct_count !== undefined
            ? newData.correct_count
            : existingData.correct_count,
        wrong_count:
          newData.wrong_count !== undefined
            ? newData.wrong_count
            : existingData.wrong_count,
        last_answer_time: newData.last_answer_time || existingData.last_answer_time || null,
        time: newData.time || existingData.time || new Date().toISOString(),
      };

      updateSentenceData(existing.container, sentence, mergedData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 更新成功`);
      return sendResponse(res, 1, "更新成功", {
        id: sentence,
        sentenceData: mergedData,
      });
    };

    // 14. 处理删除操作
    const handleDelete = async (data) => {
      console.log(`\n--- 删除句子 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      delete data.sentences[sentence];
      await smartWrite(filePath, data);

      console.log(`✅ 删除成功`);
      return sendResponse(res, 1, "删除成功", {
        id: sentence,
      });
    };

    // 15. 处理重置统计操作
    const handleResetStats = async (data) => {
      console.log(`\n--- 重置统计 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      const existingData = parseSentenceDataToObject(existing.sentenceData);

      const resetData = {
        ...existingData,
        correct_count: 0,
        wrong_count: 0,
        extraction_count: 0,
        last_answer_time: null,
        time: new Date().toISOString(),
      };

      updateSentenceData(existing.container, sentence, resetData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 重置成功`);
      return sendResponse(res, 1, "统计重置成功", {
        id: sentence,
        sentenceData: resetData,
      });
    };

    // 16. 处理增加正确次数
    const handleIncrementCorrect = async (data) => {
      console.log(`\n--- 增加正确次数 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      const existingData = parseSentenceDataToObject(existing.sentenceData);
      const updatedData = {
        ...existingData,
        correct_count: (existingData.correct_count || 0) + 1,
        time: new Date().toISOString(),
      };

      updateSentenceData(existing.container, sentence, updatedData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 增加成功，当前正确次数: ${updatedData.correct_count}`);
      return sendResponse(res, 1, "增加正确次数成功", {
        id: sentence,
        sentenceData: updatedData,
      });
    };

    // 17. 处理增加错误次数
    const handleIncrementWrong = async (data) => {
      console.log(`\n--- 增加错误次数 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      const existingData = parseSentenceDataToObject(existing.sentenceData);
      const updatedData = {
        ...existingData,
        wrong_count: (existingData.wrong_count || 0) + 1,
        time: new Date().toISOString(),
      };

      updateSentenceData(existing.container, sentence, updatedData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 增加成功，当前错误次数: ${updatedData.wrong_count}`);
      return sendResponse(res, 1, "增加错误次数成功", {
        id: sentence,
        sentenceData: updatedData,
      });
    };

    // 18. 处理增加抽取次数
    const handleIncrement = async (data) => {
      console.log(`\n--- 增加抽取次数 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      let existing = getSentenceContainer(data, sentence);
      let sentenceDataToUpdate;

      if (existing) {
        console.log(`句子存在，增加抽取次数`);
        const existingData = parseSentenceDataToObject(existing.sentenceData);
        sentenceDataToUpdate = {
          ...existingData,
          extraction_count: (existingData.extraction_count || 0) + 1,
          time: new Date().toISOString(),
        };
        console.log(`当前抽取次数: ${sentenceDataToUpdate.extraction_count}`);
      } else {
        console.log(`句子不存在，创建新记录`);
        sentenceDataToUpdate = {
          text: sentenceData?.text || "",
          chinese: sentenceData?.chinese || "",
          pass: false,
          extraction_count: 1,
          correct_count: 0,
          wrong_count: 0,
          last_answer_time: null,
          time: new Date().toISOString(),
        };

        if (!data.sentences) data.sentences = {};
        data.sentences[sentence] = sentenceDataToUpdate;

        await smartWrite(filePath, data);
        console.log(`✅ 新增句子并增加抽取次数成功`);
        return sendResponse(res, 1, "新增句子并增加抽取次数", {
          id: sentence,
          sentenceData: sentenceDataToUpdate,
        });
      }

      updateSentenceData(existing.container, sentence, sentenceDataToUpdate, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 增加抽取次数成功`);
      return sendResponse(res, 1, "增加抽取次数成功", {
        id: sentence,
        sentenceData: sentenceDataToUpdate,
      });
    };

    // 19. 处理标记为已掌握
    const handleMarkMastered = async (data) => {
      console.log(`\n--- 标记为已掌握 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      const existingData = parseSentenceDataToObject(existing.sentenceData);
      const updatedData = {
        ...existingData,
        pass: true,
        time: new Date().toISOString(),
      };

      updateSentenceData(existing.container, sentence, updatedData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 标记成功，当前状态: 已掌握`);
      return sendResponse(res, 1, "标记为已掌握成功", {
        id: sentence,
        sentenceData: updatedData,
      });
    };

    // 20. 处理标记为未掌握
    const handleMarkUnmastered = async (data) => {
      console.log(`\n--- 标记为未掌握 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      const existingData = parseSentenceDataToObject(existing.sentenceData);
      const updatedData = {
        ...existingData,
        pass: false,
        time: new Date().toISOString(),
      };

      updateSentenceData(existing.container, sentence, updatedData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 标记成功，当前状态: 未掌握`);
      return sendResponse(res, 1, "标记为未掌握成功", {
        id: sentence,
        sentenceData: updatedData,
      });
    };

    // 21. 处理更新最新回答时间
    const handleUpdateLastAnswer = async (data) => {
      console.log(`\n--- 更新最新回答时间 ---`);
      console.log(`句子ID: ${sentence}`);

      if (!sentence) {
        console.log(`❌ 错误: 需要句子ID`);
        return sendResponse(res, 0, "需要句子ID");
      }

      const existing = getSentenceContainer(data, sentence);
      if (!existing) {
        console.log(`❌ 错误: 句子不存在`);
        return sendResponse(res, 0, "句子不存在");
      }

      const existingData = parseSentenceDataToObject(existing.sentenceData);
      const now = new Date().toISOString();
      
      const updatedData = {
        ...existingData,
        last_answer_time: now,
        time: now,
      };

      updateSentenceData(existing.container, sentence, updatedData, existing.index);
      await smartWrite(filePath, data);

      console.log(`✅ 最新回答时间更新成功: ${now}`);
      return sendResponse(res, 1, "最新回答时间更新成功", {
        id: sentence,
        sentenceData: updatedData,
      });
    };

    // 22. 处理批量添加
    const handleBatchAdd = async (data) => {
      console.log(`\n--- 批量添加句子 ---`);
      
      const sentenceList = sentences;
      if (!sentenceList || !Array.isArray(sentenceList) || sentenceList.length === 0) {
        console.log(`❌ 错误: 没有提供有效的句子列表`);
        return sendResponse(res, 0, "没有提供有效的句子列表");
      }

      console.log(`待添加句子数量: ${sentenceList.length}`);

      let addedCount = 0;
      const addedIds = [];

      for (const item of sentenceList) {
        if (item.text || item.chinese) {
          const sentenceId = item.id || generateSentenceId(item.text);
          const existing = getSentenceContainer(data, sentenceId);
          
          if (!existing) {
            const parsedData = parseSentenceDataToObject(item);
            parsedData.time = parsedData.time || new Date().toISOString();
            parsedData.id = sentenceId;

            if (!data.sentences) data.sentences = {};
            data.sentences[sentenceId] = parsedData;
            
            addedCount++;
            addedIds.push(sentenceId);
            console.log(`  ✅ 添加: ${sentenceId}`);
          } else {
            console.log(`  ⚠️ 已存在: ${sentenceId}`);
          }
        }
      }

      await smartWrite(filePath, data);

      console.log(`✅ 批量添加完成，成功添加 ${addedCount}/${sentenceList.length} 个句子`);
      return sendResponse(res, 1, "批量添加成功", {
        addedCount: addedCount,
        total: sentenceList.length,
        ids: addedIds,
      });
    };

    // 23. 处理批量删除
    const handleBatchDelete = async (data) => {
      console.log(`\n--- 批量删除句子 ---`);
      
      const sentenceList = sentences;
      if (!sentenceList || !Array.isArray(sentenceList) || sentenceList.length === 0) {
        console.log(`❌ 错误: 没有提供有效的句子ID列表`);
        return sendResponse(res, 0, "没有提供有效的句子ID列表");
      }

      console.log(`待删除句子ID数量: ${sentenceList.length}`);

      let deletedCount = 0;

      for (const sentenceId of sentenceList) {
        if (data.sentences && data.sentences[sentenceId]) {
          delete data.sentences[sentenceId];
          deletedCount++;
          console.log(`  ✅ 删除: ${sentenceId}`);
        } else {
          console.log(`  ⚠️ 不存在: ${sentenceId}`);
        }
      }

      await smartWrite(filePath, data);

      console.log(`✅ 批量删除完成，成功删除 ${deletedCount}/${sentenceList.length} 个句子`);
      return sendResponse(res, 1, "批量删除成功", {
        deletedCount: deletedCount,
        total: sentenceList.length,
      });
    };

    // 24. 执行操作
    console.log(`\n=== 开始执行操作 ===`);
    const result = await handleOperation(type);
    console.log(`=== 操作完成 ===\n`);
    return result;
    
  } catch (err) {
    console.error("\n❌ 操作失败:", err);
    return sendResponse(res, 0, "服务器内部错误");
  }
});

/**
 * 获取句子相关数据
 * GET /get_sentence_review/:filename?
 * 从 personal_sentence_review 文件夹中读取文件
 */
router.get("/get_sentence_review/:filename?", async (req, res) => {
  // 强制不缓存
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authHeader = req.headers.authorization;
  let filename = req.params.filename || "sentences";

  console.log("\n========== [获取句子数据] ==========");
  console.log(`时间: ${new Date().toLocaleString()}`);

  if (!authHeader) {
    console.log("❌ 错误: 未提供 token");
    return res.status(401).json({ error: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      console.log("❌ 错误: 用户信息不存在");
      return res.status(401).json({ error: "用户信息不存在" });
    }

    console.log(`用户: ${username_2}`);
    console.log(`请求文件: ${filename}`);

    // 确定文件名
    let fileName = filename.endsWith(".json") ? filename : filename + ".json";

    // 构建文件路径 - 使用正确的路径格式
    const filePath = getStudentSentencesPath(username_2, fileName);

    console.log(`📁 文件路径: ${filePath}`);

    // 确保 personal_sentence_review 目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      console.log(`📁 创建目录: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    } else {
      console.log(`📁 目录已存在: ${dirPath}`);
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ 文件不存在: ${filePath}`);

      try {
        // 创建空 JSON 文件
        const initialData = { sentences: {} };
        console.log(`📝 创建空文件，写入初始数据`);
        fs.writeFileSync(
          filePath,
          JSON.stringify(initialData, null, 2),
          "utf8"
        );
        console.log(`✅ 文件已创建: ${filePath}`);

        return res.status(201).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            message: "文件已自动创建",
            path: `personal_sentence_review/${fileName}`
          },
        });
      } catch (createErr) {
        console.error(`❌ 文件创建失败:`, createErr);
        return res.status(500).json({
          error: "文件创建失败",
          message: "无法创建新文件",
          file: fileName,
          folder: "personal_sentence_review",
          user: username_2,
        });
      }
    }

    // 文件存在，读取内容
    try {
      console.log(`📖 读取文件内容...`);
      const rawData = fs.readFileSync(filePath, "utf8").trim();
      console.log(`读取到 ${rawData.length} 字节`);

      if (!rawData) {
        console.log(`⚠️ 文件为空，重新初始化`);

        const initialData = { sentences: {} };
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
            path: `personal_sentence_review/${fileName}`
          },
        });
      }

      const data = JSON.parse(rawData);
      const sentenceCount = data.sentences ? Object.keys(data.sentences).length : 0;
      console.log(`✅ 解析成功，包含 ${sentenceCount} 个句子`);

      return res.json({
        ...data,
        meta: {
          ...(data.meta || {}),
          path: `personal_sentence_review/${fileName}`,
          accessed: new Date().toISOString()
        }
      });
    } catch (parseErr) {
      console.error(`❌ 解析失败:`, parseErr);

      try {
        console.log(`🔧 尝试修复文件...`);
        const initialData = { sentences: {} };
        fs.writeFileSync(
          filePath,
          JSON.stringify(initialData, null, 2),
          "utf8"
        );
        console.log(`✅ 文件已修复`);

        return res.status(200).json({
          ...initialData,
          meta: {
            count: 0,
            version: 1,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            warning: "原文件格式错误，已重新初始化",
            path: `personal_sentence_review/${fileName}`
          },
        });
      } catch (recoveryErr) {
        console.error(`❌ 修复失败:`, recoveryErr);
        return res.status(500).json({
          error: "文件解析失败且无法修复",
          message: "文件格式不正确或已损坏",
          file: fileName,
          folder: "personal_sentence_review",
          user: username_2,
        });
      }
    }
  } catch (err) {
    console.error("❌ 获取数据失败:", err);
    return res.status(500).json({ error: "服务器错误" });
  }
});

/**
 * 获取用户 personal_sentence_review 文件夹中的所有文件列表
 * GET /get_sentence_files
 */
router.get("/get_sentence_files", async (req, res) => {
  const authHeader = req.headers.authorization;

  console.log("\n========== [获取文件列表] ==========");
  console.log(`时间: ${new Date().toLocaleString()}`);

  if (!authHeader) {
    console.log("❌ 错误: 未提供 token");
    return res.status(401).json({ error: "未提供 token" });
  }

  try {
    const decoded = token_decode(authHeader);
    const username_2 = decoded.username;

    if (!username_2) {
      console.log("❌ 错误: 用户信息不存在");
      return res.status(401).json({ error: "用户信息不存在" });
    }

    console.log(`用户: ${username_2}`);

    const folderPath = getStudentFolderPath(username_2);

    console.log(`📁 文件夹路径: ${folderPath}`);

    // 添加自动创建文件夹的逻辑
    if (!fs.existsSync(folderPath)) {
      console.log(`📁 文件夹不存在，正在创建...`);
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`✅ 文件夹已创建: ${folderPath}`);
    }

    let files = [];
    if (fs.existsSync(folderPath)) {
      files = fs.readdirSync(folderPath).filter(file => file.endsWith('.json'));
      console.log(`📄 找到 ${files.length} 个JSON文件:`);
      files.forEach(file => console.log(`  - ${file}`));
    }
    
    return res.json({
      flag: 1,
      message: "获取成功",
      content: {
        folder: "personal_sentence_review",
        files: files,
        count: files.length
      }
    });
  } catch (err) {
    console.error("❌ 获取文件列表失败:", err);
    return res.status(500).json({ 
      flag: 0, 
      message: "服务器错误", 
      content: { files: [] } 
    });
  }
});

/**
 * 健康检查
 */
router.get("/health", (req, res) => {
  console.log("\n========== [健康检查] ==========");
  console.log(`时间: ${new Date().toLocaleString()}`);
  console.log("✅ 服务正常");
  
  res.json({ 
    flag: 1, 
    message: "句子复习服务正常运行", 
    content: { 
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      folder: "personal_sentence_review"
    } 
  });
});

module.exports = router;
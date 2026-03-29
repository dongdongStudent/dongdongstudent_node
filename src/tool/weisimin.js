const fs = require("fs");
const db = require("./t-db.js"); // 导入数据库操作模块
const { fetchTranslation, textToSpeech } = require("./baidu_translate.js");

// 1 文字-数据库
async function handleTranslation_sentence(sentence,name) {
  // 翻译句子,没有则翻译并保存到数据库
  if (!sentence) {
    return "";
  }

  try {
    const results = await db.query(
      "SELECT translate_sentence FROM translate_sentence_index WHERE sentence = ?",
      [sentence],
      name
    );

    if (results.length > 0) {
      return results[0].translate_sentence; // 返回已有翻译
    } else {
      const a = await fetchTranslation(sentence); // 调用翻译 API
      const b = a.result.trans_result[0].dst; // 获取翻译结果
      console.log('-------------------------------------------------调用百度翻译API成功句子','color: red; font-weight: bold;');
      // 插入翻译到数据库，使用 ON DUPLICATE KEY UPDATE
      await db.query(
        "INSERT INTO translate_sentence_index (sentence, translate_sentence) VALUES (?, ?) ON DUPLICATE KEY UPDATE translate_sentence = VALUES(translate_sentence)",
        [sentence, b],
        name
      );

      return b; // 返回新翻译
    }
  } catch (error) {
    console.error('处理翻译时发生错误:', error);
    // throw error; // 重新抛出错误以便外部处理
  }
}
const callQueue = []; // 存储待处理的调用
let isProcessing = false; // 标记是否正在处理

async function handleTranslation_word(word, name) {
  if (!word) {
    return "";
  }

  // 将当前调用添加到队列
  callQueue.push({ word, name });

  // 如果当前没有正在处理的调用，开始处理队列
  if (!isProcessing) {
    isProcessing = true;
    await processQueue();
  }

  // 等待队列处理完成并返回翻译结果
  return await getTranslationResult(word);
}

async function processQueue() {
  while (callQueue.length > 0) {
    const { word, name } = callQueue.shift(); // 从队列中取出第一个调用
    try {
      const results = await db.query("SELECT translate_word FROM translate_word_index WHERE word = ?", [word], name);

      if (results.length > 0) {
        // 如果有结果，存储翻译结果
        translationResults[word] = results[0].translate_word; // 假设 translationResults 是一个全局对象
      } else {
        console.log('----------调用百度翻译API成功单词');
        
        const a = await fetchTranslation(word);
        const b = a.result.trans_result[0].dst; // 获取翻译结果
        await db.query(
          "INSERT INTO translate_word_index (word, translate_word) VALUES (?, ?) ON DUPLICATE KEY UPDATE translate_word = VALUES(translate_word)",
          [word, b],
          name
        );
        translationResults[word] = b; // 存储翻译结果
      }
    } catch (error) {
      console.error('翻译错误:', error);
    }

    // 等待一段时间再处理下一个调用
    await new Promise(resolve => setTimeout(resolve, 100)); // 设置等待时间，例如 100 毫秒
  }

  isProcessing = false; // 处理完毕，标记为未处理状态
}

// 用于存储翻译结果的对象
const translationResults = {};

// 获取翻译结果
async function getTranslationResult(word) {
  // 等待队列处理完成
  while (callQueue.length > 0 || isProcessing) {
    await new Promise(resolve => setTimeout(resolve, 50)); // 等待队列处理
  }
  return translationResults[word] || ""; // 返回翻译结果，如果没有则返回空字符串
}

module.exports = {
  handleTranslation_sentence,
  handleTranslation_word,
};

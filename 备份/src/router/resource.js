// 描述：用户路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken"); // 导入生成Token字符串的包
const axios = require("axios");
const {
  handleTranslation_word,
  handleTranslation_sentence,
} = require("../tool/weisimin.js");
const { textToAudio } = require("../tool/baidu_chinese.js");
const crypto = require("crypto");
const youdaoTTS = require("../tool/youdao_traslate.js");
const { log } = require("console");
const ORCTesseract = require("../tool/ORCTesseract.js");
const db = require("../tool/t-db.js"); // 导入数据库操作模块

// 公共函数
const getVideoFiles = (directory) => {
  // 获取目录下所有视频文件
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        return reject(err);
      }

      // 过滤出视频文件
      const videoExtensions = [".mp4", ".avi", ".mkv", ".mov"]; // 根据需要添加其他视频格式
      const videoFiles = files.filter((file) =>
        videoExtensions.includes(path.extname(file).toLowerCase())
      );

      resolve(videoFiles);
    });
  });
};
const handleError = (res, error) => {
  // 统一的错误处理函数
  console.error("发生错误:", error.message); // 打印错误信息
  res.status(500).send({
    flag: 0,
    content: error.message || "发生了一个未知错误",
  });
};
function token_decode(userinfo) {
  // 解析token字符串，获取用户基本信息
  token = userinfo;

  token = token.replace(/Bearer /g, "");

  secret_key = "new_secret_key";

  decoded_token = jwt.decode(token, secret_key, (algorithms = ["HS256"]));

  return decoded_token;
}


// '/resource/common/translate_word'
router.get("/translate_word_index", async (req, res) => {
  // 获取翻译词典
  try {
    const path_file = path.join(
      __dirname,
      "../..",
      `resource/common/text/translate_word.js`
    ); // 设置保存路径
    let my_movies = require(path_file); // 读取数据

    res.json({
      flag: 1,
      message: "获取翻译词典成功",
      content: my_movies[0],
    });
  } catch (err) {
    console.error("Error while traversing directory", err);
    res.status(500).send("Error while traversing directory");
  }
});

// 1_1. 文本-数据库-翻译
router.get("/translate_word", async (req, res) => {
  let word = req.headers.content;
  // 先判断word是否为空
  if (!word) {
    res.json({
      flag: 0,
      message: "翻译内容不能为空",
      content: "",
    });
    return;
  }
  // 先判断word为单词还是句子
  if (word.includes(" ") && /[\.\?\!]/.test(word)) {
    let translation = await handleTranslation_sentence(word, "name_sentence");
    // 这里可以处理translation，例如发送给客户端
    res.json({
      flag: 1,
      message: "翻译成功",
      content: translation,
    });
    return;
  } else {
    let translation = await handleTranslation_word(word, "name_word");

    // 这里可以处理translation，例如发送给客户端
    res.json({
      flag: 1,
      message: "翻译成功",
      content: translation,
    });
    return;
  }
});

// 更新单词翻译
router.post("/update_word_translation", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { word, translation } = req.body;

  // 验证必要参数
  if (!word || !translation) {
    return res.json({
      flag: 0,
      message: "缺少必要参数",
      content: null,
    });
  }

  // 验证 token
  if (!authHeader) {
    return res.status(401).json({
      flag: 0,
      message: "未提供 token",
    });
  }

  try {
    // 解析 token 获取用户名
    const username_2 = token_decode(authHeader).username_2;
    if (!username_2) {
      return res.json({
        flag: 0,
        message: "用户信息不存在",
        content: null,
      });
    }

    // 定义可能的单词文件路径
    const wordFiles = [
      "teacher_word_index.js",
      "unfamily_word_index.js",
      "me_word_index.js",
    ];

    let updatedInFile = false;
    let updatedInDB = false;
    let updatedData = null;

    // 1. 先更新 MySQL 数据库
    try {
      // 更新数据库中的翻译 - 使用和 handleTranslation_word 相同的数据库名
      const dbResult = await db.query(
        "UPDATE translate_word_index SET translate_word = ? WHERE word = ?",
        [translation, word],
        "name_word" // 使用和翻译函数相同的数据库名
      );

      // 检查是否成功更新了数据库
      if (dbResult && dbResult.affectedRows > 0) {
        updatedInDB = true;
        console.log(`数据库成功更新单词 "${word}" 的翻译`);
      } else {
        console.log(`数据库中没有找到单词 "${word}"，尝试插入新记录`);

        // 如果没有找到，尝试插入新记录
        try {
          await db.query(
            "INSERT INTO translate_word_index (word, translate_word) VALUES (?, ?) ON DUPLICATE KEY UPDATE translate_word = VALUES(translate_word)",
            [word, translation],
            "name_word" // 使用和翻译函数相同的数据库名
          );
          updatedInDB = true;
          console.log(`数据库插入新单词 "${word}" 的翻译`);
        } catch (insertError) {
          console.error("插入数据库失败:", insertError);
        }
      }
    } catch (dbError) {
      console.error("更新数据库失败:", dbError);
    }

    // 2. 遍历所有可能的单词文件
    for (const fileName of wordFiles) {
      const filePath = path.join(
        __dirname,
        "../..",
        "resource/person_name",
        username_2,
        fileName
      );

      // 检查文件是否存在
      if (fs.existsSync(filePath)) {
        try {
          // 清除缓存并读取文件
          delete require.cache[require.resolve(filePath)];
          let wordData = require(filePath);

          // 查找并更新单词翻译
          const wordIndex = wordData.findIndex((item) => item.word === word);
          if (wordIndex !== -1) {
            // 更新翻译
            wordData[wordIndex].translate = translation;
            updatedData = wordData;

            // 写入文件
            fs.writeFileSync(
              filePath,
              `module.exports = ${JSON.stringify(wordData, null, 2)};`
            );
            console.log(
              `文件系统成功更新单词 "${word}" 的翻译在文件 ${fileName}`
            );
            updatedInFile = true;

            // 找到并更新后跳出循环
            break;
          }
        } catch (error) {
          console.error(`处理文件 ${fileName} 时出错:`, error);
          // 继续处理下一个文件
        }
      }
    }

    // 返回结果
    if (updatedInFile || updatedInDB) {
      res.json({
        flag: 1,
        message: "翻译更新成功",
        content: {
          updatedInDatabase: updatedInDB,
          updatedInFileSystem: updatedInFile,
          data: updatedData,
        },
      });
    } else {
      res.json({
        flag: 0,
        message: "未找到该单词",
        content: null,
      });
    }
  } catch (error) {
    console.error("更新单词翻译时出错:", error);
    res.json({
      flag: 0,
      message: "服务器错误",
      content: null,
    });
  }
});

// 2. 音频
const truncateTerm = (term, maxLength = 20) => {
  // 截取字符串
  if (term.length <= maxLength) {
    return term;
  }
  const prefix = term.substring(0, maxLength / 2);
  const suffix = term.substring(term.length - maxLength / 2);
  return `${prefix}...${suffix}`;
};

const generateUniqueName = (term, maxLength = 20) => {
  // 生成唯一文件名
  const truncatedTerm = truncateTerm(term, maxLength);
  const hash = crypto
    .createHash("md5")
    .update(term)
    .digest("hex")
    .substring(0, 6);
  return `${truncatedTerm}_${hash}`;
};
async function youdao_audio(word_or_sentence, mp3_name) {
  // 消去mp3_name点后缀.mp3
  let term = mp3_name.replace(".mp3", "");

  // const audioUrl = `http://dict.youdao.com/dictvoice?audio=${term}&type=1`;
  const audioUrl = `https://dict.youdao.com/dictvoice?type=0&audio=${term}`;

  // 先判断term的长度是否超过window限制
  if (term.length > 256) {
    term = generateUniqueName(term, 20); // 生成唯一文件名
  }
  const audioFilePath = path.join(
    __dirname,
    `../../resource/common/audio/${word_or_sentence}`,
    `${term}.mp3`
  ); // 音频文件路径

  // 限制句子的长度
  if (term.length > 1700) {
    console.error("句子长度超过限制:", term.length);
    return;
  }

  try {
    // 调用函数
    console.log("111", term);

    // 示例调用
    try {
      const savedPath = await youdaoTTS(term, audioFilePath);
      console.log("音频文件保存路径:", savedPath);
    } catch (error) {
      console.error("处理过程中发生错误:", error.message);
    }

    // 保存音频文件
    try {
      await fs.promises.access(audioFilePath, fs.constants.F_OK);
      console.log("文件已存在:");
    } catch (error) {
      // await fs.promises.writeFile(audioFilePath, Buffer.from(response.data)); // 使用Buffer.from
      console.log("保存音频文件失误:", audioFilePath);
    }
  } catch (error) {
    console.error("请求音频失败:");
  }
}
router.get("/translate_mp3", async (req, res) => {
  // 如果req.headers.content为空，则返回错误信息
  if (!req.headers.content) {
    return res.json({
      flag: 1,
      message: "翻译内容不能为空",
      content: null,
    });
  }
  
  // 1. 解析token
  let word = req.headers.content.trim();
  // ... 处理word格式的代码
  
  const isSentence = word.includes(" ") || /[\.\?\!]/.test(word);
  const word_or_sentence = isSentence ? "sentence" : "word";
  
  try {
    let word_1 = "";
    let path_file = "";
    
    if (word.length > 256) {
      word_1 = generateUniqueName(word, 20);
      path_file = path.join(
        __dirname,
        "../..",
        isSentence
          ? `resource/common/audio/sentence/${word_1}.mp3`
          : `resource/common/audio/word/${word}.mp3`
      );
    } else {
      word_1 = word;
      path_file = path.join(
        __dirname,
        "../..",
        isSentence
          ? `resource/common/audio/sentence/${word_1}.mp3`
          : `resource/common/audio/word/${word}.mp3`
      );
    }
    
    // ✅ 修复：使用 promise 包装 res.download
    const downloadFile = () => {
      return new Promise((resolve, reject) => {
        res.download(path_file, `${word}.mp3`, async (err) => {
          if (err) {
            // 文件不存在，尝试生成
            try {
              await youdao_audio(word_or_sentence, word);
              // 重新尝试下载
              res.download(path_file, `${word}.mp3`, (err2) => {
                if (err2) {
                  reject(new Error("音频文件未找到"));
                } else {
                  resolve();
                }
              });
            } catch (genError) {
              reject(genError);
            }
          } else {
            resolve();
          }
        });
      });
    };
    
    await downloadFile();
    
  } catch (error) {
    console.error("处理下载时发生错误:", error);
    // ✅ 确保只发送一次错误响应
    if (!res.headersSent) {
      res.status(500).json({ 
        flag: 0,
        message: error.message || "服务器错误" 
      });
    }
  }
});
router.get("/translate_chinese_mp3", async (req, res) => {
  // ✅ 使用统一的响应发送函数
  const sendResponse = (data, status = 200) => {
    if (!res.headersSent) {
      res.status(status).json(data);
    }
  };
  
  let word = req.query.word.trim();
  
  if (!word) {
    return sendResponse({
      flag: 1,
      message: "翻译内容不能为空",
      content: null,
    }, 400);
  }
  
  // ... 处理word格式的代码
  
  try {
    const file_name = generateFileName(word_name);
    const word_or_sentence = isSentence ? "sentence_chinese" : "word_chinese";
    const path_file = path.join(
      __dirname,
      "../..",
      `resource/common/audio/${word_or_sentence}/${file_name}.mp3`
    );
    
    // ✅ 修复：使用 promise 包装文件处理逻辑
    if (fs.existsSync(path_file)) {
      // 文件存在，直接下载
      res.download(path_file, (err) => {
        if (err && !res.headersSent) {
          console.error("下载失败:", err);
          sendResponse({ 
            flag: 0, 
            message: '文件下载失败' 
          }, 500);
        }
      });
    } else {
      // 文件不存在，生成并下载
      try {
        const state = await textToAudio(word);
        
        // 写入文件
        await fs.promises.writeFile(path_file, state);
        console.log("音频文件已保存为", path_file);
        
        // 下载文件
        res.download(path_file, (err) => {
          if (err && !res.headersSent) {
            console.error("下载失败:", err);
            sendResponse({ 
              flag: 0, 
              message: '文件下载失败' 
            }, 500);
          }
        });
      } catch (error) {
        console.error("生成音频失败:", error);
        if (!res.headersSent) {
          sendResponse({ 
            flag: 0, 
            message: '生成音频失败' 
          }, 500);
        }
      }
    }
  } catch (error) {
    console.error("处理下载时发生错误:", error);
    if (!res.headersSent) {
      sendResponse({ 
        flag: 0, 
        message: error.message || "服务器错误" 
      }, 500);
    }
  }
});

// 获取视频目录
router.post("/video_list", (req, res) => {
  // 1.解析token
  const authHeader = req.body.headers.Authorization;

  // 2. 验证 token
  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "/video_list,未提供 token",
    });
  }

  // 3. 解析 token
  const username_2 = token_decode(authHeader).username_2;
  // 4. 解析token
  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    username_2,
    "video"
  );

  // 读取目录下所有视频文件
  getVideoFiles(filePath)
    .then((videoFiles) => {
      res.json({
        flag: 1,
        content: videoFiles,
      });
    })
    .catch((err) => {
      console.error(err);
      handleError(res, err);
    });
});

// sss结构数据
const getWords = (req, res, fileName) => {
  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    fileName
  );

  console.log("1111", filePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "配置文件不存在",
        content: null,
      });
    }

    try {
      // 先清理缓存
      delete require.cache[require.resolve(filePath)];
      let js = require(filePath); // 读取数据
      res.json({
        flag: 1,
        message: "获取文件成功",
        content: js,
      });
    } catch (e) {
      handleError(res, e);
    }
  });
};
router.get("/ess_template", (req, res) => {
  getWords(req, res, "sss_template.js");
});
router.get("/template", (req, res) => {
  // 1. 解析token
  let js_name = req.query.js_name; // 从查询参数获取

  let path = `${js_name}`;
  console.log("请求的视频名称:", path);
  getWords(req, res, js_name);
});

// 4. 给目录，返回目录下的图片数量
router.get("/get_image_count", (req, res) => {
  const relativePath = req.query.path; // 从查询参数获取相对路径
  console.log("请求的路径:", relativePath);

  const pathFile = path.join(__dirname, "../..", relativePath); // 生成绝对路径

  console.log("绝对路径:", pathFile);

  // 检查路径是否有效
  if (!relativePath) {
    return res.status(400).json({ flag: 0, error: "路径参数缺失" });
  }

  // 检查目录是否存在
  if (!fs.existsSync(pathFile)) {
    return res.status(404).json({ flag: 0, error: "目录不存在" });
  }

  try {
    // 查询该目录下的图片数量
    const files = fs.readdirSync(pathFile);
    const count = files.filter((file) => {
      return /\.(jpg|jpeg|png|gif)$/i.test(file); // 过滤图片文件
    }).length;

    console.log("图片数量:", count);

    // 返回图片数量
    res.json({
      flag: 1,
      message: "获取图片数量成功",
      content: count,
    });
  } catch (error) {
    console.error("读取目录时出错:", error);
    res.status(500).json({ flag: 0, error: "读取目录时发生错误" });
  }
});

router.get("/get_md", (req, res) => {
  console.log("测试");

  // 1. 解析token
  const authHeader = req.headers.authorization;
  let video_name = req.query.video_name; // 从查询参数获取
  let server_address = req.query.server_address;

  // 如果 authHeader、video_name、server_address 中的其中一个为空, 就返回
  if (!authHeader || !video_name || !server_address) {
    return res.status(400).send({
      flag: 0,
      message: "缺少必要参数",
    });
  }

  // 2. 验证 token
  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "/server/personal/video_path,未提供 token",
    });
  }

  // 3. 解析 token
  const username_2 = token_decode(authHeader).username_2;

  // 4. 解析文件路径
  const filePath = path.join(__dirname, "../..", video_name);
  console.log("解析文件路径", filePath);

  // 5. 检查文件是否存在并读取内容
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "文件不存在",
      });
    }
    console.log("视频文件存在");

    // 读取文件内容
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        return res.status(500).send({
          flag: 0,
          message: "读取文件失败",
        });
      }
      // 返回文件内容
      res.send({
        flag: 1,
        message: "文件读取成功",
        content: data,
      });
    });
  });
});

// 5. 保存md文件
router.post("/save_md", (req, res) => {
  const authHeader = req.body.headers.Authorization;
  const file_path = req.body.headers.file_path; // 获取文件路径
  const content = req.body.headers.content; // 获取笔记内容

  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "未提供 token",
    });
  }

  const username_2 = token_decode(authHeader).username_2;
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }
  const filePath = path.join(
    __dirname,
    "../..",
    file_path // 确保文件名是 notebook.md
  );
  console.log("保存笔记路径:", filePath);

  // 使用 fs.writeFile 保存笔记内容
  fs.writeFile(filePath, content, { flag: "w" }, (err) => {
    if (err) {
      return res.status(500).json({
        flag: 0,
        message: "保存笔记失败",
        content: null,
      });
    }

    res.json({
      flag: 1,
      message: "笔记保存成功",
      content: content, // 返回保存的内容
    });
  });
});

// 6. 保存图片
router.post("/save_image", (req, res) => {
  const authHeader = req.body.headers.Authorization;
  const file_path = req.body.headers.file_path; // 获取文件路径
  const content = req.body.headers.content; // 获取图片内容

  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "未提供 token",
    });
  }

  const username_2 = token_decode(authHeader).username_2;
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }

  const filePath = path.join(
    __dirname,
    "../..",
    file_path // 确保文件名是 test.png
  );

  // 提取 Base64 数据
  const base64Data = content.replace(/^data:image\/jpeg;base64,/, ""); // 去掉前缀
  const buffer = Buffer.from(base64Data, "base64"); // 将 Base64 转换为 Buffer

  // 使用 fs.writeFile 保存图片内容
  fs.writeFile(filePath, buffer, { flag: "w" }, (err) => {
    if (err) {
      return res.status(500).json({
        flag: 0,
        message: "保存图片失败",
        content: null,
      });
    }

    res.json({
      flag: 1,
      message: "图片保存成功",
      content: content, // 返回保存的内容
    });
  });
});

// 6. 图片识别英文
router.post("/orc_image_en", async (req, res) => {
  const authHeader = req.body.headers.Authorization;
  const content = req.body.headers.content; // 获取图片内容

  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "未提供 token",
    });
  }

  //   ===== 新增OCR识别逻辑 =====
  const ocr = new ORCTesseract();

  try {
    // 1. 初始化OCR引擎
    await ocr.init("eng", {
      charWhitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?()'\"",
      pageSegMode: 6,
    });

    // 2. 将Base64转为Buffer
    const base64Data = content.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // 3. 识别图像
    const text = await ocr.recognize(imageBuffer);
    console.log("识别结果:", text);

    return res.json({ flag: 1, text: text });
  } catch (error) {
    console.error("OCR处理失败:", error);
    return res.status(500).json({
      flag: 0,
      message: "识别失败",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    // 5. 确保资源释放
    try {
      await ocr.terminate();
    } catch (terminateError) {
      console.error("释放OCR资源失败:", terminateError);
    }
  }
});

// 7. 返回目录
router.get("/get_file_name", (req, res) => {
  // 1. 解析token
  const authHeader = req.headers.authorization;
  let video_name = req.query.path; // 从查询参数获取

  // 如果 authHeader、video_name、server_address 中的其中一个为空, 就返回
  if (!authHeader || !video_name) {
    return res.status(400).send({
      flag: 0,
      message: "缺少必要参数",
    });
  }

  // 2. 验证 token
  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "/server/personal/video_path,未提供 token",
    });
  }

  // 4. 解析文件目录路径
  const dirPath = path.join(__dirname, "../..", video_name);
  console.log("解析目录路径", dirPath);

  // 5. 检查目录是否存在并读取内容
  fs.stat(dirPath, (err, stats) => {
    if (err || !stats.isDirectory()) {
      return res.json({
        flag: 0,
        message: "目录不存在",
      });
    }

    // 读取目录内容
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        return res.status(500).send({
          flag: 0,
          message: "读取目录失败",
        });
      }

      // 筛选出所有 .md 文件
      const mdFiles = files.filter((file) => file.endsWith(".md"));

      // 返回 .md 文件名数组
      res.send({
        flag: 1,
        message: "文件读取成功",
        content: mdFiles,
      });
    });
  });
});

module.exports = router;

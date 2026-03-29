// 描述：用户路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken"); // 导入生成Token字符串的包
const { handleTranslation_word } = require("../tool/weisimin.js");
// 导入单词路由模块 - 添加这行
const wordRouter = require("./personal_word_review.js");
const wordStudyRouter = require("./personal_word_study.js");

// 使用单词路由模块 - 添加这行
router.use("/", wordRouter);
router.use("/", wordStudyRouter);

// 公共函数
const handleError = (res, error) => {
  // 统一的错误处理函数
  // 统一的错误处理函数
  console.error("发生错误:", error.message, error); // 打印错误信息
  // res.status(500).send({
  //   flag: 0,
  //   content: error.message || "发生了一个未知错误",
  // });
  res.json({
    flag: 0,
    message: "崩溃",
    content: null,
  });
};
function token_decode(userinfo) {
  // 解析token字符串，获取用户基本信息
  token = userinfo;

  token = token.replace(/Bearer /g, "");

  secret_key = "new_secret_key";

  decoded_token = jwt.decode(token, secret_key, (algorithms = ["HS256"]));
  // console.log('解析token字符串，获取用户基本信息', decoded_token);

  return decoded_token;
}
async function traverseDirectory(dirPath) {
  // 递归遍历目录
  let regex = /\.a$/g;
  const result = dirPath.match(regex);
  if (result) return;

  const files = await fs.readdir(dirPath);
  const children = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        return {
          label: file,
          key: filePath,
          children: await traverseDirectory(filePath),
        };
      } else {
        return {
          label: file,
          key: filePath,
        };
      }
    })
  );

  return children;
}

// 1. 文本-js
router.get("/progress", (req, res) => {
  // 返回个人信息的js(学习进度:知识点)
  // 1. 解析token
  const authHeader = req.headers.authorization;

  // 2. 验证 token
  if (!authHeader) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }

  // 3. 解析 token
  const username_2 = token_decode(authHeader).username_2;
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }
  // 4. 解析文件路径
  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    username_2,
    "progress.js"
  );

  // 5. 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "配置文件不存在",
        content: null,
      });
    }
    // 6. 使用require加载文件内容
    try {
      // 清除缓存
      delete require.cache[require.resolve(filePath)];
      let js = require(filePath); // 读取数据

      // 7. 返回config.js的内容
      res.json({
        flag: 1,
        message: "获取文件成功",
        content: js, // 返回1.js的内容
      });
    } catch (e) {
      handleError(res, err);
    }
  });
});
const sendResponse = (res, flag, message, content = null) => {
  res.json({ flag, message, content });
};

// --------------------- 个人生涯单词 ----------


router.post("/down_word_unfamiliarity_weight", async (req, res) => {
  // 降低权重
  // 1. 解析token
  const authHeader = req.body.headers.Authorization;
  const word = req.body.headers.content;

  // 2. 验证 token
  if (!authHeader) {
    return sendResponse(res, 0, "未提供 token");
  }

  // 3. 解析 token
  let username_2;
  try {
    username_2 = token_decode(authHeader).username_2;
  } catch (error) {
    return sendResponse(res, 0, "无效的 token");
  }

  // 4. 解析文件路径
  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    username_2,
    "me_word_index.js"
  );

  // 5. 检查文件是否存在
  fs.stat(filePath, async (err, stats) => {
    if (err || !stats.isFile()) {
      return sendResponse(res, 0, "配置文件不存在");
    }

    try {
      let data = require(filePath); // 读取数据

      // 先判断是否存在该单词
      const wordIndex = data.findIndex((item) => item.word === word);

      if (wordIndex !== -1) {
        // 存在该单词,更新单词的次数
        data[wordIndex].click_num -= 1;
      } else {
        // 不存在该单词,新增单词
        const translation = await handleTranslation_word(word);
        data.push({
          word: word,
          translate: translation,
          click_num: 1,
        });
      }

      // 6. 写入文件
      fs.writeFile(
        filePath,
        `module.exports = ${JSON.stringify(data)};`,
        (err) => {
          if (err) {
            console.error("写入文件失败", err);
            return sendResponse(res, 0, "写入文件失败");
          }
          sendResponse(res, 1, "写入文件成功", data);
        }
      );
    } catch (err) {
      console.error("处理请求时出错:", err);
      sendResponse(res, 0, "处理请求失败");
    }
  });
});

// 读取文件并返回数据
const readDataFromFile = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const data = require(filePath);
      resolve(data);
    } catch (error) {
      reject(error);
    }
  });
};
// 写入数据到文件
const writeDataToFile = (filePath, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      filePath,
      `module.exports = ${JSON.stringify(data)};`,
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};
// 处理单词的添加和删除
const handleWordOperation = async (req, res, operation, fileName) => {
  const authHeader = req.body.headers.Authorization;
  const word = req.body.headers.content;

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
    "resource/person_name",
    username_2,
    fileName
  );

  fs.stat(filePath, async (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "配置文件不存在",
        content: null,
      });
    }

    try {
      let data = await readDataFromFile(filePath);
      const index = data.findIndex((item) => item.word === word);

      if (operation === "add") {
        if (index !== -1) {
          return res.json({
            flag: 1,
            message: "单词已存在",
            content: null,
          });
        } else {
          let translation = await handleTranslation_word(word);
          const newWord = { word: word, translate: translation };
          data.push(newWord);
          await writeDataToFile(filePath, data);
          return res.json({
            flag: 1,
            message: "写入文件成功",
            content: data,
          });
        }
      } else if (operation === "delete") {
        if (index !== -1) {
          data.splice(index, 1);
          await writeDataToFile(filePath, data);
          return res.json({
            flag: 1,
            message: "写入文件成功",
            content: data,
          });
        } else {
          return res.json({
            flag: 1,
            message: "单词不存在",
            content: null,
          });
        }
      }
    } catch (err) {
      handleError(res, err);
    }
  });
};
// 获取单词
const getWords = (req, res, fileName) => {
  const authHeader = req.headers.authorization;

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
    "resource/person_name",
    username_2,
    fileName
  );

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "配置文件不存在",
        content: null,
      });
    }

    try {
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
// 单词-个人-获取
router.get("/unfamily_word_index", (req, res) => {
  getWords(req, res, "unfamily_word_index.js");
});
// 单词-个人-删除
router.post("/del_unfamily_word_index", (req, res) => {
  handleWordOperation(req, res, "delete", "unfamily_word_index.js");
});
// 单词-个人-添加
router.post("/add_unfamily_word_index", (req, res) => {
  handleWordOperation(req, res, "add", "unfamily_word_index.js");
});
// 单词-老师-获取
router.get("/teacher_word_index", (req, res) => {
  getWords(req, res, "teacher_word_index.js");
});
// 单词-老师-删除
router.post("/del_teacher_word_index", (req, res) => {
  handleWordOperation(req, res, "delete", "teacher_word_index.js");
});
// 单词-老师-添加
router.post("/add_teacher_word_index", (req, res) => {
  handleWordOperation(req, res, "add", "teacher_word_index.js");
});

router.post("/update_words", async (req, res) => {
  // 1. 获取基础参数
  const authHeader =
    req.headers.authorization ||
    (req.body.headers && req.body.headers.Authorization);
  const { type, word, vocabularyData } = req.body;

  console.log("收到请求操作类型--->", type);

  if (!authHeader) {
    return res.status(401).json({ flag: 0, message: "未提供 token" });
  }

  // 2. 解析身份
  const decoded = token_decode(authHeader);
  const username_2 = decoded.username_2;

  if (!username_2) {
    return res.json({ flag: 0, message: "用户信息不存在" });
  }

  // 3. 路径获取工具
  const getPath = (fileName) =>
    path.join(__dirname, "../..", "resource/person_name", username_2, fileName);

  // --- 内部万能写入函数：确保 .json 是纯净数据 ---
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

  // --- 内部万能读取函数：增加空文件容错 ---
  const smartRead = async (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return []; // 防止 Unexpected end of JSON input

      const raw = fs.readFileSync(filePath, "utf8").trim();
      if (!raw) return [];

      if (raw.startsWith("[") || raw.startsWith("{")) {
        return JSON.parse(raw);
      } else {
        // 如果是 JS 格式
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      }
    } catch (e) {
      console.error("读取失败，初始化为空数组:", e.message);
      return [];
    }
  };

  try {
    // 核心：所有操作统一指向 .json 文件
    const filePath = getPath("word_master.json");

    // --- 分支 0: 获取初始化数据 ---
    if (type === "get_data") {
      const data = await smartRead(filePath);
      return res.json({ flag: 1, content: data });
    }

    // --- 分支 A: 练习进度全量同步 ---
    if (type === "sync_progress") {
      await smartWrite(filePath, vocabularyData);
      console.log(`[同步成功] 用户: ${username_2}`);
      return res.json({
        flag: 1,
        message: "进度同步成功",
        content: vocabularyData,
      });
    }

    // --- 分支 B: 单词增删操作 ---
    if (type === "add" || type === "delete") {
      let data = await smartRead(filePath);
      const index = data.findIndex((item) => item.word === word);

      if (type === "add") {
        if (index !== -1) return res.json({ flag: 1, message: "单词已存在" });

        let translation = "待翻译";
        try {
          translation = await handleTranslation_word(word);
        } catch (e) {
          console.error("翻译失败:", e);
        }

        // 【核心修改】：统一存为前端所需的结构
        data.push({
          word: word,
          translation: translation, // 使用 translation 而非 translate
          status: {
            listening: false,
            reading: false,
            translation: false,
          },
        });

        await smartWrite(filePath, data);
        // 备份一份 JS 格式供其他模块使用
        // await smartWrite(getPath("word_master.js"), data);

        return res.json({ flag: 1, message: "写入成功", content: data });
      }

      if (type === "delete") {
        if (index === -1) return res.json({ flag: 1, message: "单词不存在" });
        data.splice(index, 1);
        await smartWrite(filePath, data);
        await smartWrite(getPath("word_master.js"), data);
        return res.json({ flag: 1, message: "删除成功", content: data });
      }
    }

    res.status(400).json({ flag: 0, message: "未知的操作类型" });
  } catch (err) {
    console.error("操作失败:", err);
    res.status(500).json({ flag: 0, message: "服务器内部错误" });
  }
});





// -------------------------------------------------------------


// 语文单词-获取
router.get("/chinese_words", (req, res) => {
  getWords(req, res, "chinese_words.js");
});
// 语文单词-删除
router.post("/del_chinese_word", (req, res) => {
  handleWordOperation(req, res, "delete", "chinese_words.js");
});
// 语文单词-添加
router.post("/add_chinese_word", (req, res) => {
  handleWordOperation(req, res, "add", "chinese_words.js");
});

// 用户-名字 -------------------用户
router.get("/name", (req, res) => {
  // 1. 解析token
  const authHeader = req.headers.authorization;

  // 2. 验证 token
  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "/progress_save,未提供 token",
    });
  }

  // 3. 解析 token
  const username_2 = token_decode(authHeader).username_2;
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }

  res.json({
    flag: 1,
    content: username_2,
  });
});

// 2. 视频-src-返回视频的静态源 URL
router.get("/video_path", (req, res) => {
  // 1. 解析token
  const authHeader = req.headers.authorization;
  let video_name = req.query.video_name; // 从查询参数获取
  let server_address = req.query.server_address;

  // 2. 验证 token
  if (!authHeader) {
    return res.status(401).send({
      flag: 0,
      message: "/server/personal/video_path,未提供 token",
    });
  }

  // 3. 解析 token
  const username_2 = token_decode(authHeader).username_2;
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }
  let filePath = "";
  let flg = 0;

  // 如果 video_name 包含 '/common/'
  if (video_name.includes("/common/")) {
    filePath = path.join(__dirname, "../..", video_name);
    flg = 1;
  } else {
    filePath = path.join(
      __dirname,
      "../..",
      "resource/person_name",
      username_2,
      "video",
      video_name
    );
    flg = 2;
  }

  console.log("333", filePath);

  // 5. 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "视频文件不存在",
      });
    }

    // 6. 根据不同的 flg 返回不同的内容
    let videoSrc;
    if (flg === 1) {
      // 对于包含 '/common/' 的路径
      videoSrc = server_address + `${video_name}`;

      res.json({
        flag: 1,
        content: {
          src: videoSrc, // 返回静态视频源的 URL
          message: "成功获取公共视频",
        },
      });
    } else {
      // 对于不包含 '/common/' 的路径
      videoSrc =
        server_address +
        `/resource/person_name/${username_2}/video/${video_name}`;
      res.json({
        flag: 1,
        content: {
          src: videoSrc, // 返回静态视频源的 URL
          message: "成功获取个人视频",
        },
      });
    }
  });
});
router.get("/video_subtitle_path", (req, res) => {
  const authHeader = req.headers.authorization;
  const video_name = req.query.video_name; // 从查询参数获取

  // 验证 token
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
  let filePath = "";

  // 根据 video_name 确定文件路径
  if (video_name.includes("/common/")) {
    filePath = path.join(__dirname, "../..", video_name, "a.srt");
  } else {
    filePath = path.join(
      __dirname,
      "../..",
      "resource/person_name",
      username_2,
      "video",
      video_name
    );
  }
  console.log("1111", filePath);
  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "SRT 文件不存在",
      });
    }

    // 读取 SRT 文件内容
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        return res.status(500).json({
          flag: 0,
          message: "读取 SRT 文件失败",
        });
      }

      res.json({
        flag: 1,
        content: data,
      });
      return;
    });
  });
});

// 3. 图片

// 4. 音频

// 列出目录
router.get("/list", async (req, res) => {
  const dirPath = path.join(__dirname, "../book/");
  try {
    const filesAndDirs = await traverseDirectory(dirPath);
    res.json(filesAndDirs);
  } catch (err) {
    handleError(res, err);
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
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }
  // 4. 解析token
  const filePath = path.join(
    __dirname,
    "../..",
    "resource/person_name",
    "video_progress.js"
  );

  // 5. 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err) {
      return res.json({
        flag: 0,
        message: "配置文件不存在",
        content: null,
      });
    }
    try {
      // 清除缓存
      delete require.cache[require.resolve(filePath)];
      let js = require(filePath); // 读取数据

      // 7. 返回config.js的内容
      res.json({
        flag: 1,
        message: "获取文件成功",
        content: js, // 返回1.js的内容
      });
    } catch (e) {
      handleError(res, err);
    }
  });
});

// --------------------- 笔记本 ---------------------
router.get("/notebook_path", (req, res) => {
  // 1. 解析token
  const authHeader = req.headers.authorization;

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
    "resource/person_name",
    username_2,
    "notebook.md"
  );

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "配置文件不存在",
        content: null,
      });
    }

    // 读取 Markdown 文件
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        return res.status(500).json({
          flag: 0,
          message: "读取文件失败",
          content: null,
        });
      }

      res.json({
        flag: 1,
        message: "获取文件成功",
        content: data, // 返回文件内容
      });
    });
  });
});
router.post("/save_notebook", (req, res) => {
  const authHeader = req.body.headers.Authorization;
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
    "resource/person_name",
    username_2,
    "notebook.md" // 确保文件名是 notebook.md
  );

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

// ==================== 阅读进度相关接口 ====================

// 保存阅读进度
router.post("/save_reading_progress", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      flag: 0,
      message: "未提供 token",
    });
  }

  const username_2 = token_decode(authHeader).username_2;
  console.log("1111", username_2);
  if (!username_2) {
    return res.json({
      flag: 0,
      message: "配置文件不存在",
      content: null,
    });
  }

  try {
    const {
      video_src,
      current_time,
      current_sub_index,
      current_subtitle,
      total_subtitles,
      timestamp,
    } = req.body;

    // 验证必要字段
    if (!video_src || current_time === undefined) {
      return res.json({
        flag: 0,
        message: "缺少必要参数",
        content: null,
      });
    }

    const filePath = path.join(
      __dirname,
      "../..",
      "resource/person_name",
      username_2,
      "video_reading_progress.js"
    );

    // 读取现有的阅读进度数据
    let progressData = [];
    try {
      if (fs.existsSync(filePath)) {
        delete require.cache[require.resolve(filePath)];
        progressData = require(filePath);
      }
    } catch (error) {
      // 如果文件不存在或格式错误，初始化为空数组
      progressData = [];
    }

    // 查找是否已存在该视频的进度记录
    const existingIndex = progressData.findIndex(
      (item) => item.video_src === video_src
    );

    const newProgress = {
      video_src,
      current_time: parseFloat(current_time),
      current_sub_index: parseInt(current_sub_index) || 0,
      current_subtitle: current_subtitle || "",
      total_subtitles: parseInt(total_subtitles) || 0,
      timestamp: timestamp || new Date().toISOString(),
      update_time: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      // 更新现有记录
      progressData[existingIndex] = newProgress;
    } else {
      // 添加新记录
      progressData.push(newProgress);
    }

    // 只保留最新的10条记录
    if (progressData.length > 10) {
      progressData = progressData.slice(-10);
    }

    // 写入文件
    fs.writeFile(
      filePath,
      `module.exports = ${JSON.stringify(progressData, null, 2)};`,
      (err) => {
        if (err) {
          console.error("写入阅读进度文件失败:", err);
          return res.json({
            flag: 0,
            message: "保存失败",
            content: null,
          });
        }

        res.json({
          flag: 1,
          message: "进度保存成功",
          content: newProgress,
        });
      }
    );
  } catch (error) {
    console.error("保存阅读进度时出错:", error);
    res.json({
      flag: 0,
      message: "服务器错误",
      content: null,
    });
  }
});

// 获取最新阅读进度
router.get("/get_reading_progress", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
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
    "resource/person_name",
    username_2,
    "video_reading_progress.js"
  );

  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "暂无阅读记录",
        content: null,
      });
    }

    try {
      delete require.cache[require.resolve(filePath)];
      const progressData = require(filePath);

      if (!progressData || progressData.length === 0) {
        return res.json({
          flag: 0,
          message: "暂无阅读记录",
          content: null,
        });
      }

      // 返回最新的进度记录（按时间倒序）
      const sortedProgress = progressData.sort(
        (a, b) =>
          new Date(b.update_time || b.timestamp) -
          new Date(a.update_time || a.timestamp)
      );

      res.json({
        flag: 1,
        message: "获取进度成功",
        content: sortedProgress[0], // 返回最新的记录
      });
    } catch (error) {
      console.error("读取阅读进度文件时出错:", error);
      res.json({
        flag: 0,
        message: "读取失败",
        content: null,
      });
    }
  });
});

// 获取阅读历史记录
router.get("/get_reading_history", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
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
    "resource/person_name",
    username_2,
    "video_reading_progress.js"
  );

  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "暂无阅读记录",
        content: [],
      });
    }

    try {
      delete require.cache[require.resolve(filePath)];
      const progressData = require(filePath);

      if (!progressData || progressData.length === 0) {
        return res.json({
          flag: 0,
          message: "暂无阅读记录",
          content: [],
        });
      }

      // 按时间倒序排列
      const sortedHistory = progressData.sort(
        (a, b) =>
          new Date(b.update_time || b.timestamp) -
          new Date(a.update_time || a.timestamp)
      );

      res.json({
        flag: 1,
        message: "获取历史记录成功",
        content: sortedHistory,
      });
    } catch (error) {
      console.error("读取阅读历史记录时出错:", error);
      res.json({
        flag: 0,
        message: "读取失败",
        content: [],
      });
    }
  });
});

// 删除特定视频的阅读进度
router.post("/delete_reading_progress", (req, res) => {
  const authHeader = req.headers.authorization;
  const { video_src } = req.body;

  if (!authHeader) {
    return res.status(401).json({
      flag: 0,
      message: "未提供 token",
    });
  }

  if (!video_src) {
    return res.json({
      flag: 0,
      message: "缺少视频路径参数",
      content: null,
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
    "resource/person_name",
    username_2,
    "video_reading_progress.js"
  );

  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.json({
        flag: 0,
        message: "暂无阅读记录",
        content: null,
      });
    }

    try {
      delete require.cache[require.resolve(filePath)];
      let progressData = require(filePath);

      // 过滤掉要删除的视频记录
      const filteredData = progressData.filter(
        (item) => item.video_src !== video_src
      );

      // 如果数据有变化，写入文件
      if (filteredData.length !== progressData.length) {
        fs.writeFile(
          filePath,
          `module.exports = ${JSON.stringify(filteredData, null, 2)};`,
          (err) => {
            if (err) {
              console.error("删除阅读进度时写入文件失败:", err);
              return res.json({
                flag: 0,
                message: "删除失败",
                content: null,
              });
            }

            res.json({
              flag: 1,
              message: "删除成功",
              content: filteredData,
            });
          }
        );
      } else {
        res.json({
          flag: 0,
          message: "未找到对应的阅读记录",
          content: null,
        });
      }
    } catch (error) {
      console.error("删除阅读进度时出错:", error);
      res.json({
        flag: 0,
        message: "服务器错误",
        content: null,
      });
    }
  });
});

module.exports = router;

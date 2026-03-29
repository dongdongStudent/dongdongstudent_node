// wordRoutes.js - 单词相关路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
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

// --------------------- 个人生涯单词 ---------------------

// GET /server/personal/me_word_index 相关接口
router.get("/me_word_index/:type?", async (req, res) => {
    // 强制浏览器和代理不缓存此接口
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const authHeader = req.headers.authorization;
    const type = req.params.type; // 获取路径参数，可能是 "word_pepa.json", "word_book.json" 或 undefined

    if (!authHeader) {
        return sendResponse(res, 0, "未提供 token");
    }

    try {
        const decoded = token_decode(authHeader);
        const username_2 = decoded.username_2;

        if (!username_2) {
            return sendResponse(res, 0, "用户信息不存在");
        }

        // 确定要读取的文件
        let fileName, filePath;

        if (type === "word_pepa.json") {
            fileName = "word_pepa.json";
            filePath = path.join(
                __dirname,
                "../..",
                "resource/person_name",
                username_2,
                "word_pepa.json"
            );
        } else if (type === "word_book.json") {
            fileName = "word_book.json";
            filePath = path.join(
                __dirname,
                "../..",
                "resource/person_name",
                username_2,
                "word_book.json"
            );
        } else {
            // 原始逻辑：返回 me_word_index.json
            fileName = "me_word_index.json";
            filePath = path.join(
                __dirname,
                "../..",
                "resource/person_name",
                username_2,
                "me_word_index.json"
            );
        }

        console.log(`[文件请求] 用户: ${username_2}, 文件: ${fileName}`);

        // 1. 创建用户目录（如果不存在）
        const userDir = path.dirname(filePath);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
            console.log(`[创建目录] 用户: ${username_2}, 目录: ${userDir}`);
        }

        // 2. 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.log(`[文件不存在] 用户: ${username_2}, 文件: ${fileName}`);

            let defaultData;

            // 根据文件类型返回不同的默认数据
            if (type === "word_pepa.json") {
                // word_pepa.json 的默认数据 - 根据您的需求设计数据结构
                defaultData = {
                    pepa_list: [],
                    meta: {
                        count: 0,
                        version: 1,
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                    }
                };
                console.log(`[创建默认数据] 用户: ${username_2}, 文件: ${fileName}, 类型: PEPA数据`);
            } else if (type === "word_book.json") {
                // word_book.json 的默认数据 - 根据您的需求设计数据结构
                defaultData = {
                    books: [],
                    current_book: null,
                    meta: {
                        count: 0,
                        version: 1,
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                    }
                };
                console.log(`[创建默认数据] 用户: ${username_2}, 文件: ${fileName}, 类型: 单词书数据`);
            } else {
                // 原始逻辑：me_word_index.json 的默认数据
                defaultData = {
                    words: {},
                    meta: {
                        count: 0,
                        version: 1,
                        updated: new Date().toISOString(),
                        created: new Date().toISOString(),
                    },
                };
                console.log(`[创建默认数据] 用户: ${username_2}, 文件: ${fileName}, 类型: 单词索引`);
            }

            // 立即创建文件
            try {
                await fs.promises.writeFile(
                    filePath,
                    JSON.stringify(defaultData, null, 2),
                    "utf8"
                );
                console.log(`[文件创建成功] 用户: ${username_2}, 文件: ${fileName}`);

                // 对于 word_pepa.json 和 word_book.json，使用直接返回 JSON 格式
                if (type === "word_pepa.json" || type === "word_book.json") {
                    return res.json(defaultData); // 直接返回 JSON
                }

                // 对于 me_word_index.json，使用原来的响应格式
                return sendResponse(res, 1, `获取成功（已创建默认文件: ${fileName}）`, defaultData);
            } catch (writeErr) {
                console.error(`[文件创建失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, writeErr);

                // 即使创建失败，也返回默认数据
                if (type === "word_pepa.json" || type === "word_book.json") {
                    return res.json(defaultData); // 直接返回 JSON
                }

                const errorData = {
                    words: {},
                    meta: {
                        count: 0,
                        version: 1,
                        updated: new Date().toISOString(),
                        error: "文件创建失败",
                    },
                };
                return sendResponse(res, 1, `获取成功（已创建默认数据: ${fileName}）`, errorData);
            }
        }

        // 3. 文件存在，读取内容
        // 消除 require 缓存 (以防万一该文件被其他地方 require 过)
        try {
            const resolvedPath = require.resolve(filePath);
            if (require.cache[resolvedPath]) {
                delete require.cache[resolvedPath];
            }
        } catch (e) {
            // 路径未被加载过则忽略
        }

        // 4. 强制从磁盘读取最新内容
        const rawData = fs.readFileSync(filePath, "utf8").trim();

        // 对于 word_pepa.json 和 word_book.json，直接返回解析后的 JSON
        if (type === "word_pepa.json" || type === "word_book.json") {
            try {
                if (!rawData) {
                    console.log(`[空文件] 用户: ${username_2}, 文件: ${fileName}, 内容为空`);

                    // 返回对应文件的默认空数据
                    let emptyData;
                    if (type === "word_pepa.json") {
                        emptyData = {
                            pepa_list: [],
                            meta: {
                                count: 0,
                                version: 1,
                                created: new Date().toISOString(),
                                updated: new Date().toISOString(),
                            }
                        };
                    } else {
                        emptyData = {
                            books: [],
                            current_book: null,
                            meta: {
                                count: 0,
                                version: 1,
                                created: new Date().toISOString(),
                                updated: new Date().toISOString(),
                            }
                        };
                    }
                    return res.json(emptyData);
                }

                const data = JSON.parse(rawData);
                console.log(`[返回数据] 用户: ${username_2}, 文件: ${fileName}, 数据获取成功`);

                // 确保数据格式正确
                if (type === "word_pepa.json") {
                    if (!data.pepa_list || !Array.isArray(data.pepa_list)) {
                        console.warn(`[格式修复] 用户: ${username_2}, 文件: ${fileName} 格式不正确，进行修复`);
                        const fixedData = {
                            pepa_list: Array.isArray(data) ? data : [],
                            meta: data.meta || {
                                count: Array.isArray(data) ? data.length : 0,
                                version: 1,
                                updated: new Date().toISOString(),
                            }
                        };

                        // 保存修复后的格式
                        try {
                            await fs.promises.writeFile(
                                filePath,
                                JSON.stringify(fixedData, null, 2),
                                "utf8"
                            );
                            console.log(`[格式修复] 用户: ${username_2}, 文件: ${fileName} 已修复格式`);
                        } catch (writeErr) {
                            console.error(`[修复失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, writeErr);
                        }

                        return res.json(fixedData);
                    }
                } else if (type === "word_book.json") {
                    if (!data.books || !Array.isArray(data.books)) {
                        console.warn(`[格式修复] 用户: ${username_2}, 文件: ${fileName} 格式不正确，进行修复`);
                        const fixedData = {
                            books: Array.isArray(data) ? data : [],
                            current_book: data.current_book || null,
                            meta: data.meta || {
                                count: Array.isArray(data) ? data.length : 0,
                                version: 1,
                                updated: new Date().toISOString(),
                            }
                        };

                        // 保存修复后的格式
                        try {
                            await fs.promises.writeFile(
                                filePath,
                                JSON.stringify(fixedData, null, 2),
                                "utf8"
                            );
                            console.log(`[格式修复] 用户: ${username_2}, 文件: ${fileName} 已修复格式`);
                        } catch (writeErr) {
                            console.error(`[修复失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, writeErr);
                        }

                        return res.json(fixedData);
                    }
                }

                return res.json(data);
            } catch (parseErr) {
                console.error(`[解析失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, parseErr);

                // 解析失败时创建新的默认数据
                let newData;
                if (type === "word_pepa.json") {
                    newData = {
                        pepa_list: [],
                        meta: {
                            count: 0,
                            version: 1,
                            created: new Date().toISOString(),
                            updated: new Date().toISOString(),
                            error: "原文件解析失败，已创建新文件",
                        }
                    };
                } else {
                    newData = {
                        books: [],
                        current_book: null,
                        meta: {
                            count: 0,
                            version: 1,
                            created: new Date().toISOString(),
                            updated: new Date().toISOString(),
                            error: "原文件解析失败，已创建新文件",
                        }
                    };
                }

                // 创建新文件
                try {
                    await fs.promises.writeFile(
                        filePath,
                        JSON.stringify(newData, null, 2),
                        "utf8"
                    );
                    console.log(`[文件修复] 用户: ${username_2}, 文件: ${fileName}, 已创建新文件`);
                } catch (writeErr) {
                    console.error(`[修复失败] 用户: ${username_2}, 文件: ${fileName}, 错误:`, writeErr);
                }

                return res.json(newData);
            }
        }

        // 5. 原始逻辑：处理 me_word_index.json
        let data;
        if (rawData) {
            try {
                // 处理 module.exports 格式（兼容旧格式）
                if (rawData.startsWith("module.exports")) {
                    const jsonPart = rawData
                        .replace(/module\.exports\s*=\s*/, "")
                        .replace(/;$/, "");
                    const jsArray = JSON.parse(jsonPart);

                    // 将数组格式转换为新的对象格式
                    const words = {};
                    if (Array.isArray(jsArray)) {
                        jsArray.forEach((item) => {
                            if (item && item.word) {
                                words[item.word] = item.translate || "";
                            }
                        });
                    }

                    data = {
                        words: words,
                        meta: {
                            count: Object.keys(words).length,
                            version: 1,
                            updated: new Date().toISOString(),
                            source: "js_converted",
                        },
                    };

                    // 转换成功后保存为新格式
                    try {
                        await fs.promises.writeFile(
                            filePath,
                            JSON.stringify(data, null, 2),
                            "utf8"
                        );
                        console.log(`[格式转换] 用户: ${username_2}, JS格式已转换为JSON格式`);
                    } catch (writeErr) {
                        console.error(`[转换失败] 用户: ${username_2}, 错误:`, writeErr);
                    }
                } else {
                    // 解析 JSON 格式
                    data = JSON.parse(rawData);

                    // 确保数据格式正确
                    if (!data.words || typeof data.words !== "object") {
                        console.log(`[格式修复] 用户: ${username_2}, 修复数据格式`);
                        data = {
                            words: data.words || {},
                            meta: {
                                count: data.meta?.count || Object.keys(data.words || {}).length,
                                version: data.meta?.version || 1,
                                updated: data.meta?.updated || new Date().toISOString(),
                            },
                        };

                        // 保存修复后的格式
                        try {
                            await fs.promises.writeFile(
                                filePath,
                                JSON.stringify(data, null, 2),
                                "utf8"
                            );
                            console.log(`[格式修复保存] 用户: ${username_2}, 已保存修复后的格式`);
                        } catch (writeErr) {
                            console.error(`[修复保存失败] 用户: ${username_2}, 错误:`, writeErr);
                        }
                    }
                }

                // 确保 meta 字段存在
                if (!data.meta) {
                    data.meta = {
                        count: Object.keys(data.words || {}).length,
                        version: 1,
                        updated: new Date().toISOString(),
                    };

                    // 保存添加了meta的数据
                    try {
                        await fs.promises.writeFile(
                            filePath,
                            JSON.stringify(data, null, 2),
                            "utf8"
                        );
                        console.log(`[添加meta] 用户: ${username_2}, 已添加meta字段`);
                    } catch (writeErr) {
                        console.error(`[添加meta失败] 用户: ${username_2}, 错误:`, writeErr);
                    }
                }

                // 确保 count 是最新的
                const currentCount = Object.keys(data.words || {}).length;
                if (data.meta.count !== currentCount) {
                    data.meta.count = currentCount;
                    data.meta.updated = new Date().toISOString();

                    // 保存更新count的数据
                    try {
                        await fs.promises.writeFile(
                            filePath,
                            JSON.stringify(data, null, 2),
                            "utf8"
                        );
                        console.log(`[更新count] 用户: ${username_2}, count: ${currentCount}`);
                    } catch (writeErr) {
                        console.error(`[更新count失败] 用户: ${username_2}, 错误:`, writeErr);
                    }
                }
            } catch (parseErr) {
                console.error(`[解析失败] 用户: ${username_2}, 错误:`, parseErr);

                // 解析失败时创建新数据
                data = {
                    words: {},
                    meta: {
                        count: 0,
                        version: 1,
                        updated: new Date().toISOString(),
                        error: "原文件解析失败，已创建新文件",
                    },
                };

                // 创建新文件
                try {
                    await fs.promises.writeFile(
                        filePath,
                        JSON.stringify(data, null, 2),
                        "utf8"
                    );
                    console.log(`[文件修复] 用户: ${username_2}, 已创建新文件`);
                } catch (writeErr) {
                    console.error(`[修复失败] 用户: ${username_2}, 错误:`, writeErr);
                }
            }
        } else {
            // 文件为空，重新创建
            console.log(`[空文件] 用户: ${username_2}, 文件内容为空，重新创建`);
            data = {
                words: {},
                meta: {
                    count: 0,
                    version: 1,
                    updated: new Date().toISOString(),
                    created: new Date().toISOString(),
                },
            };

            try {
                await fs.promises.writeFile(
                    filePath,
                    JSON.stringify(data, null, 2),
                    "utf8"
                );
                console.log(`[重建文件] 用户: ${username_2}, 已重建空文件`);
            } catch (writeErr) {
                console.error(`[重建失败] 用户: ${username_2}, 错误:`, writeErr);
            }
        }

        console.log(`[获取数据] 用户: ${username_2}, 单词数: ${data.meta.count}`);

        // 使用 sendResponse 函数返回
        return sendResponse(res, 1, "获取成功", data);
    } catch (err) {
        console.error("获取单词数据失败:", err);

        // 即使错误也返回一个基本结构，确保前端不会崩溃
        const errorData = {
            words: {},
            meta: {
                count: 0,
                version: 1,
                updated: new Date().toISOString(),
                error: "服务器错误",
            },
        };

        // 如果是 word_pepa.json 或 word_book.json，返回对应的空数据结构
        if (type === "word_pepa.json") {
            return res.json({
                pepa_list: [],
                meta: {
                    count: 0,
                    version: 1,
                    updated: new Date().toISOString(),
                    error: "服务器错误",
                }
            });
        } else if (type === "word_book.json") {
            return res.json({
                books: [],
                current_book: null,
                meta: {
                    count: 0,
                    version: 1,
                    updated: new Date().toISOString(),
                    error: "服务器错误",
                }
            });
        }

        return sendResponse(res, 0, "服务器解析最新数据失败", errorData);
    }
});

// POST /server/personal/add_me_word_index - 添加单词（旧接口，兼容性保留）
router.post("/add_me_word_index", async (req, res) => {
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
                data[wordIndex].click_num += 1;
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

// POST /server/personal/update_me_word_index - 更新单词索引（新接口，功能更全面）
router.post("/update_me_word_index", async (req, res) => {
    try {
        // 1. 获取基础参数
        const authHeader =
            req.headers.authorization ||
            (req.body.headers && req.body.headers.Authorization);
        const { type, word, wordData, words } = req.body;

        console.log("收到请求操作类型--->", type);

        if (!authHeader) {
            return sendResponse(res, 0, "未提供 token");
        }

        // 2. 解析身份
        const decoded = token_decode(authHeader);
        const username_2 = decoded.username_2;

        if (!username_2) {
            return sendResponse(res, 0, "用户信息不存在");
        }

        // 3. 路径获取工具
        const getPath = (fileName) =>
            path.join(
                __dirname,
                "../..",
                "resource/person_name",
                username_2,
                fileName
            );

        // --- 内部万能写入函数 ---
        const smartWrite = async (filePath, data) => {
            const content = JSON.stringify(data, null, 2);
            const dirPath = path.dirname(filePath);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
            return fs.promises.writeFile(filePath, content, "utf8");
        };

        // --- 内部万能读取函数 ---
        const smartRead = async (filePath) => {
            if (!fs.existsSync(filePath)) {
                return {
                    words: {},
                    meta: {
                        count: 0,
                        version: 3,
                        updated: new Date().toISOString(),
                        stats: {
                            total_correct: 0,
                            total_wrong: 0,
                            accuracy_rate: 0,
                            total_mastered: 0,
                            total_unmastered: 0,
                            average_mastery: 0
                        }
                    },
                };
            }

            try {
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    return {
                        words: {},
                        meta: {
                            count: 0,
                            version: 3,
                            updated: new Date().toISOString(),
                            stats: {
                                total_correct: 0,
                                total_wrong: 0,
                                accuracy_rate: 0,
                                total_mastered: 0,
                                total_unmastered: 0,
                                average_mastery: 0
                            }
                        },
                    };
                }

                const raw = fs.readFileSync(filePath, "utf8").trim();
                if (!raw) {
                    return {
                        words: {},
                        meta: {
                            count: 0,
                            version: 3,
                            updated: new Date().toISOString(),
                            stats: {
                                total_correct: 0,
                                total_wrong: 0,
                                accuracy_rate: 0,
                                total_mastered: 0,
                                total_unmastered: 0,
                                average_mastery: 0
                            }
                        },
                    };
                }

                const data = JSON.parse(raw);
                
                // 如果是从旧版本升级，确保meta.stats存在
                if (!data.meta) {
                    data.meta = {
                        version: 3,
                        updated: new Date().toISOString(),
                        stats: {
                            total_correct: 0,
                            total_wrong: 0,
                            accuracy_rate: 0,
                            total_mastered: 0,
                            total_unmastered: 0,
                            average_mastery: 0
                        }
                    };
                }
                
                // 确保版本号更新到3
                data.meta.version = 3;
                
                // 确保stats对象存在所有字段
                if (!data.meta.stats) {
                    data.meta.stats = {
                        total_correct: 0,
                        total_wrong: 0,
                        accuracy_rate: 0,
                        total_mastered: 0,
                        total_unmastered: 0,
                        average_mastery: 0
                    };
                }
                
                // 确保有所有必要的stats字段
                data.meta.stats = {
                    total_correct: data.meta.stats.total_correct || 0,
                    total_wrong: data.meta.stats.total_wrong || 0,
                    accuracy_rate: data.meta.stats.accuracy_rate || 0,
                    total_mastered: data.meta.stats.total_mastered || 0,
                    total_unmastered: data.meta.stats.total_unmastered || 0,
                    average_mastery: data.meta.stats.average_mastery || 0
                };

                return data;
            } catch (e) {
                console.error("读取失败，初始化为空数据:", e.message);
                return {
                    words: {},
                    meta: {
                        count: 0,
                        version: 3,
                        updated: new Date().toISOString(),
                        stats: {
                            total_correct: 0,
                            total_wrong: 0,
                            accuracy_rate: 0,
                            total_mastered: 0,
                            total_unmastered: 0,
                            average_mastery: 0
                        }
                    },
                };
            }
        };

        // 更新meta统计信息的函数
        const updateMetaStats = (data) => {
            const words = data.words;
            const wordEntries = Object.entries(words);
            
            let total_correct = 0;
            let total_wrong = 0;
            let total_mastered = 0;
            let total_unmastered = 0;
            
            wordEntries.forEach(([word, wordData]) => {
                // 确保单词数据有正确的字段
                const wordObj = typeof wordData === 'object' ? wordData : parseWordDataToObject(wordData);
                
                total_correct += (wordObj.correct_count || 0);
                total_wrong += (wordObj.wrong_count || 0);
                
                if (wordObj.pass === true) {
                    total_mastered++;
                } else {
                    total_unmastered++;
                }
            });
            
            const total_tests = total_correct + total_wrong;
            const accuracy_rate = total_tests > 0 ? Math.round((total_correct / total_tests) * 10000) / 100 : 0;
            const total_words = wordEntries.length;
            const average_mastery = total_words > 0 ? Math.round((total_mastered / total_words) * 10000) / 100 : 0;
            
            data.meta.stats = {
                total_correct,
                total_wrong,
                accuracy_rate,
                total_mastered,
                total_unmastered,
                average_mastery
            };
            
            data.meta.count = total_words;
            data.meta.updated = new Date().toISOString();
            
            return data;
        };

        // 解析单词数据为对象（兼容旧格式）
        const parseWordDataToObject = (wordData) => {
            if (!wordData) {
                return {
                    chinese: '',
                    pass: false,
                    extraction_count: 0,
                    correct_count: 0,
                    wrong_count: 0,
                    time: null
                };
            }

            // 如果是对象格式（新格式）
            if (typeof wordData === 'object' && wordData !== null) {
                return {
                    chinese: wordData.chinese || '',
                    pass: Boolean(wordData.pass),
                    extraction_count: wordData.extraction_count || 0,
                    correct_count: wordData.correct_count || 0,
                    wrong_count: wordData.wrong_count || 0,
                    time: wordData.time || null
                };
            }

            // 如果是字符串格式（兼容旧格式）
            if (typeof wordData === 'string') {
                if (wordData.includes('|')) {
                    const parts = wordData.split('|');
                    
                    // 检查是否是带正确/错误次数的格式
                    if (parts.length >= 5) {
                        // 新格式: 中文|true|抽取次数|正确次数|错误次数|时间
                        return {
                            chinese: parts[0],
                            pass: parts[1] === 'true',
                            extraction_count: parseInt(parts[2]) || 0,
                            correct_count: parseInt(parts[3]) || 0,
                            wrong_count: parseInt(parts[4]) || 0,
                            time: parts.length >= 6 ? parts[5] || null : null
                        };
                    } else if (parts.length >= 2) {
                        // 旧格式: 中文|true|抽取次数|时间
                        return {
                            chinese: parts[0],
                            pass: parts[1] === 'true',
                            extraction_count: parts.length >= 3 ? parseInt(parts[2]) || 0 : 0,
                            correct_count: 0,
                            wrong_count: 0,
                            time: parts.length >= 4 ? parts[3] || null : null
                        };
                    }
                }
                
                // 普通字符串，作为中文释义
                return {
                    chinese: wordData,
                    pass: false,
                    extraction_count: 0,
                    correct_count: 0,
                    wrong_count: 0,
                    time: null
                };
            }

            // 其他情况
            return {
                chinese: String(wordData),
                pass: false,
                extraction_count: 0,
                correct_count: 0,
                wrong_count: 0,
                time: null
            };
        };

        // 文件路径
        const filePath = getPath("me_word_index.json");

        // --- 分支 0: 获取数据 ---
        if (type === "get_data") {
            const data = await smartRead(filePath);
            return sendResponse(res, 1, "获取成功", data);
        }

        // --- 分支 A: 批量更新所有单词 ---
        if (type === "sync_all") {
            if (!words || typeof words !== "object") {
                return sendResponse(res, 0, "没有提供有效的单词数据");
            }

            // 确保每个单词都有正确的字段
            const normalizedWords = {};
            Object.entries(words).forEach(([word, wordData]) => {
                normalizedWords[word] = parseWordDataToObject(wordData);
            });

            const dataToSave = {
                words: normalizedWords,
                meta: {
                    version: 3,
                    updated: new Date().toISOString(),
                    stats: {
                        total_correct: 0,
                        total_wrong: 0,
                        accuracy_rate: 0,
                        total_mastered: 0,
                        total_unmastered: 0,
                        average_mastery: 0
                    }
                }
            };

            // 更新统计信息
            updateMetaStats(dataToSave);
            
            await smartWrite(filePath, dataToSave);
            console.log(
                `[同步成功] 用户: ${username_2}, 单词数: ${dataToSave.meta.count}`
            );

            return sendResponse(res, 1, "批量同步成功", dataToSave);
        }

        // --- 分支 B: 添加单词 ---
        if (type === "add") {
            console.log('11', word)
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            // 检查单词是否已存在
            if (data.words[word]) {
                console.log('单词已存在')
                return sendResponse(res, 0, "单词已存在");
            }
            console.log('233')
            // 解析wordData参数
            const parsedWordData = parseWordDataToObject(wordData);
            
            // 确保有时间
            if (!parsedWordData.time) {
                parsedWordData.time = new Date().toISOString();
            }

            // 添加单词
            data.words[word] = parsedWordData;

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(
                `[添加成功] 用户: ${username_2}, 单词: ${word}, 数据:`,
                parsedWordData
            );

            return sendResponse(res, 1, "添加成功", {
                word: word,
                wordData: data.words[word],
                count: data.meta.count,
            });
        }

        // --- 分支 C: 更新单词 ---
        if (type === "update") {
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            if (!data.words[word]) {
                return sendResponse(res, 0, "单词不存在");
            }

            // 解析wordData参数
            let parsedWordData;
            const existingData = parseWordDataToObject(data.words[word]);

            // 如果wordData是对象格式
            if (wordData && typeof wordData === "object" && wordData !== null) {
                // 合并现有数据和新数据
                parsedWordData = {
                    chinese: wordData.chinese !== undefined ? wordData.chinese : existingData.chinese,
                    pass: wordData.pass !== undefined ? Boolean(wordData.pass) : existingData.pass,
                    extraction_count: wordData.extraction_count !== undefined 
                        ? parseInt(wordData.extraction_count) 
                        : existingData.extraction_count,
                    correct_count: wordData.correct_count !== undefined 
                        ? parseInt(wordData.correct_count) 
                        : existingData.correct_count,
                    wrong_count: wordData.wrong_count !== undefined 
                        ? parseInt(wordData.wrong_count) 
                        : existingData.wrong_count,
                    time: wordData.time !== undefined ? wordData.time : existingData.time
                };
            }
            // 如果wordData是字符串格式
            else if (wordData && typeof wordData === "string") {
                const newData = parseWordDataToObject(wordData);
                // 只更新提供的字段
                parsedWordData = {
                    chinese: newData.chinese !== '' ? newData.chinese : existingData.chinese,
                    pass: newData.pass !== existingData.pass ? newData.pass : existingData.pass,
                    extraction_count: newData.extraction_count !== existingData.extraction_count ? newData.extraction_count : existingData.extraction_count,
                    correct_count: newData.correct_count !== existingData.correct_count ? newData.correct_count : existingData.correct_count,
                    wrong_count: newData.wrong_count !== existingData.wrong_count ? newData.wrong_count : existingData.wrong_count,
                    time: newData.time || existingData.time
                };
            }
            // 如果没有提供wordData，保持原数据
            else {
                parsedWordData = existingData;
            }

            // 如果没有时间，添加当前时间
            if (!parsedWordData.time) {
                parsedWordData.time = new Date().toISOString();
            }

            // 更新单词数据
            data.words[word] = parsedWordData;

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[更新成功] 用户: ${username_2}, 单词: ${word}, 数据:`, parsedWordData);

            return sendResponse(res, 1, "更新成功", {
                word: word,
                wordData: data.words[word],
            });
        }

        // --- 分支 D: 删除单词 ---
        if (type === "delete") {
            console.log('删除单词:', word);
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            if (!data.words[word]) {
                return sendResponse(res, 0, "单词不存在");
            }

            // 删除单词
            delete data.words[word];

            // 更新元数据
            data.meta.count = Object.keys(data.words).length;
            data.meta.updated = new Date().toISOString();
            
            // 更新统计信息
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[删除成功] 用户: ${username_2}, 单词: ${word}`);

            return sendResponse(res, 1, "删除成功", {
                word: word,
                count: data.meta.count,
            });
        }

        // --- 分支 E: 增加点击次数（增量操作）---
        if (type === "increment") {
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            // 如果单词不存在，添加它
            if (!data.words[word]) {
                let parsedWordData;
                
                if (wordData && typeof wordData === "string" && wordData.includes("|")) {
                    const parts = wordData.split("|");
                    if (parts.length >= 2) {
                        parsedWordData = {
                            chinese: parts[0],
                            pass: parts[1] === "true",
                            extraction_count: 1,
                            correct_count: 0,
                            wrong_count: 0,
                            time: new Date().toISOString()
                        };
                    } else {
                        parsedWordData = { 
                            chinese: wordData || "",
                            pass: false,
                            extraction_count: 1,
                            correct_count: 0,
                            wrong_count: 0,
                            time: new Date().toISOString()
                        };
                    }
                } else if (wordData && typeof wordData === "object" && wordData !== null) {
                    parsedWordData = {
                        chinese: wordData.chinese || "",
                        pass: wordData.pass === true,
                        extraction_count: 1,
                        correct_count: 0,
                        wrong_count: 0,
                        time: new Date().toISOString()
                    };
                } else {
                    parsedWordData = { 
                        chinese: "",
                        pass: false,
                        extraction_count: 1,
                        correct_count: 0,
                        wrong_count: 0,
                        time: new Date().toISOString()
                    };
                }
                
                data.words[word] = parsedWordData;
                console.log(`[新增单词] 用户: ${username_2}, 单词: ${word}`);
            } else {
                // 单词已存在，增加提取次数
                const existingData = parseWordDataToObject(data.words[word]);
                let newData;
                
                // 确保是对象格式
                newData = {
                    chinese: existingData.chinese || "",
                    pass: existingData.pass === true,
                    extraction_count: (parseInt(existingData.extraction_count) || 0) + 1,
                    correct_count: existingData.correct_count || 0,
                    wrong_count: existingData.wrong_count || 0,
                    time: new Date().toISOString()
                };
                
                data.words[word] = newData;
            }

            // 更新元数据
            data.meta.count = Object.keys(data.words).length;
            data.meta.updated = new Date().toISOString();
            
            // 更新统计信息
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[点击记录] 用户: ${username_2}, 单词: ${word}`);

            return sendResponse(res, 1, "记录成功", {
                word: word,
                wordData: data.words[word],
                count: data.meta.count,
            });
        }

        // --- 分支 F: 更新正确/错误次数 ---
        if (type === "update_stats") {
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            const { correct_count: newCorrect, wrong_count: newWrong } = wordData || {};

            let data = await smartRead(filePath);

            if (!data.words[word]) {
                return sendResponse(res, 0, "单词不存在");
            }

            const existingData = parseWordDataToObject(data.words[word]);
            
            // 更新统计
            existingData.correct_count = newCorrect !== undefined ? parseInt(newCorrect) : existingData.correct_count;
            existingData.wrong_count = newWrong !== undefined ? parseInt(newWrong) : existingData.wrong_count;
            existingData.time = new Date().toISOString(); // 更新时间

            // 保存回数据
            data.words[word] = existingData;

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[更新统计] 用户: ${username_2}, 单词: ${word}, 正确: ${existingData.correct_count}, 错误: ${existingData.wrong_count}`);

            return sendResponse(res, 1, "统计更新成功", {
                word: word,
                wordData: data.words[word],
            });
        }

        // --- 分支 G: 增加正确次数 ---
        if (type === "increment_correct") {
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            if (!data.words[word]) {
                return sendResponse(res, 0, "单词不存在");
            }

            const existingData = parseWordDataToObject(data.words[word]);
            
            // 增加正确次数
            existingData.correct_count = (existingData.correct_count || 0) + 1;
            existingData.time = new Date().toISOString();

            // 保存回数据
            data.words[word] = existingData;

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[增加正确] 用户: ${username_2}, 单词: ${word}, 正确次数: ${existingData.correct_count}`);

            return sendResponse(res, 1, "增加正确次数成功", {
                word: word,
                wordData: data.words[word],
            });
        }

        // --- 分支 H: 增加错误次数 ---
        if (type === "increment_wrong") {
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            if (!data.words[word]) {
                return sendResponse(res, 0, "单词不存在");
            }

            const existingData = parseWordDataToObject(data.words[word]);
            
            // 增加错误次数
            existingData.wrong_count = (existingData.wrong_count || 0) + 1;
            existingData.time = new Date().toISOString();

            // 保存回数据
            data.words[word] = existingData;

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[增加错误] 用户: ${username_2}, 单词: ${word}, 错误次数: ${existingData.wrong_count}`);

            return sendResponse(res, 1, "增加错误次数成功", {
                word: word,
                wordData: data.words[word],
            });
        }

        // --- 分支 I: 批量操作 ---
        if (type === "batch_update") {
            const { words: wordList, action } = wordData || {};
            
            if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
                return sendResponse(res, 0, "没有提供有效的单词列表");
            }

            if (!action || !['mark_mastered', 'mark_unmastered', 'update_stats'].includes(action)) {
                return sendResponse(res, 0, "无效的批量操作类型");
            }

            let data = await smartRead(filePath);
            let updatedCount = 0;

            wordList.forEach(item => {
                if (data.words[item.word]) {
                    const existingData = parseWordDataToObject(data.words[item.word]);
                    let updatedData = { ...existingData };
                    updatedData.time = new Date().toISOString();

                    if (action === 'mark_mastered') {
                        updatedData.pass = true;
                    } else if (action === 'mark_unmastered') {
                        updatedData.pass = false;
                    } else if (action === 'update_stats') {
                        if (item.correct_count !== undefined) {
                            updatedData.correct_count = parseInt(item.correct_count);
                        }
                        if (item.wrong_count !== undefined) {
                            updatedData.wrong_count = parseInt(item.wrong_count);
                        }
                    }

                    data.words[item.word] = updatedData;
                    updatedCount++;
                }
            });

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[批量操作] 用户: ${username_2}, 操作: ${action}, 更新单词数: ${updatedCount}`);

            return sendResponse(res, 1, "批量操作成功", {
                updatedCount: updatedCount,
                action: action
            });
        }

        // --- 分支 J: 批量删除 ---
        if (type === "batch_delete") {
            const wordList = wordData; // 期望是单词数组
            
            if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
                return sendResponse(res, 0, "没有提供有效的单词列表");
            }

            let data = await smartRead(filePath);
            let deletedCount = 0;

            wordList.forEach(word => {
                if (data.words[word]) {
                    delete data.words[word];
                    deletedCount++;
                }
            });

            // 更新元数据
            data.meta.count = Object.keys(data.words).length;
            data.meta.updated = new Date().toISOString();
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[批量删除] 用户: ${username_2}, 删除单词数: ${deletedCount}`);

            return sendResponse(res, 1, "批量删除成功", {
                deletedCount: deletedCount
            });
        }

        // --- 分支 K: 批量添加 ---
        if (type === "batch_add") {
            const wordList = wordData; // 期望是 [{word: "apple", chinese: "苹果", pass: false}, ...]
            
            if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
                return sendResponse(res, 0, "没有提供有效的单词列表");
            }

            let data = await smartRead(filePath);
            let addedCount = 0;

            wordList.forEach(item => {
                if (item.word && !data.words[item.word]) {
                    data.words[item.word] = {
                        chinese: item.chinese || '',
                        pass: item.pass === true,
                        extraction_count: 0,
                        correct_count: 0,
                        wrong_count: 0,
                        time: new Date().toISOString()
                    };
                    addedCount++;
                }
            });

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[批量添加] 用户: ${username_2}, 添加单词数: ${addedCount}`);

            return sendResponse(res, 1, "批量添加成功", {
                addedCount: addedCount
            });
        }

        // --- 分支 L: 重置单词统计 ---
        if (type === "reset_stats") {
            if (!word) {
                return sendResponse(res, 0, "需要单词参数");
            }

            let data = await smartRead(filePath);

            if (!data.words[word]) {
                return sendResponse(res, 0, "单词不存在");
            }

            const existingData = parseWordDataToObject(data.words[word]);
            
            // 重置统计
            existingData.correct_count = 0;
            existingData.wrong_count = 0;
            existingData.time = new Date().toISOString();

            // 保存回数据
            data.words[word] = existingData;

            // 更新元数据
            data = updateMetaStats(data);

            await smartWrite(filePath, data);
            console.log(`[重置统计] 用户: ${username_2}, 单词: ${word}`);

            return sendResponse(res, 1, "统计重置成功", {
                word: word,
                wordData: data.words[word],
            });
        }

        // 未知的操作类型
        sendResponse(res, 0, "未知的操作类型");
    } catch (err) {
        console.error("操作失败:", err);
        sendResponse(res, 0, "服务器内部错误");
    }
});

module.exports = router;
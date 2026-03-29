// 描述：用户路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken"); // 导入生成Token字符串的包
const multer = require('multer');// 自定义存储配置

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
const handleError = (res, error) => { // 统一的错误处理函数
    // 统一的错误处理函数
    console.error("发生错误:", error.message, error); // 打印错误信息
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

// --------------------- 学生列表 ----------
router.get("/student_info_list", (req, res) => {
    const directoryPath = path.resolve(__dirname, "../../resource/person_name");

    // 读取目录中的文件
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return handleError(res, err);
        }

        // 过滤出文件夹
        const folderPromises = files.map(file => {
            return new Promise((resolve) => {
                const filePath = path.join(directoryPath, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        console.error(`获取文件状态失败: ${filePath}`, err);
                        return resolve(null); // 处理错误，但继续
                    }
                    // 如果是目录，则返回文件夹信息
                    if (stats.isDirectory()) {
                        resolve({
                            name: file,
                            path: filePath // 文件夹的完整路径
                        });
                    } else {
                        resolve(null); // 不是目录，返回 null
                    }
                });
            });
        });

        // 等待所有文件夹的状态检查完成
        Promise.all(folderPromises)
            .then(folders => {
                // 过滤掉 null 值
                const folderList = folders.filter(folder => folder !== null);

                res.json({
                    flag: 1,
                    message: "获取文件夹成功",
                    content: folderList,
                });
            })
            .catch(err => {
                handleError(res, err);
            });
    });
});

//--------------------- 读取progress.js ----------
const getWords = (req, res, fileName) => {
    const filePath = path.join(
        __dirname,
        "../..",
        "resource/person_name",
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
router.get("/progress_template", (req, res) => {
    getWords(req, res, "progress_template.js");
});
// 更新progress.js
router.post("/update_student_progress", (req, res) => {
    // 1. 解析请求体
    const content = req.body.headers.content;
    const currentUser = req.body.headers.currentUser;

    // 2. 保存文件
    const filePath = path.join(
        __dirname,
        "../..",
        "resource/person_name",
        currentUser,
        "progress.js"
    );


    fs.writeFile(filePath, `module.exports = ${JSON.stringify(content)};`, (err) => {
        if (err) {
            return handleError(res, err);
        }

        res.json({
            flag: 1,
            message: "保存文件成功",
            content: null,
        });
    });

});

// ------------- 新建用户 ----------
router.post("/create_student_progress", (req, res) => {
    // 1. 解析请求体
    const content = req.body.headers.content;
    console.log('111',content);
    // 新建用户
    const directoryPath = path.resolve(__dirname, "../../resource/person_name");
    
    // 创建文件夹
    fs.mkdir(path.join(directoryPath, content.name), { recursive: true }, (err) => {
        if (err) {
            return handleError(res, err);
        }

        // 写入文件
        const filePath = path.join(directoryPath, content.name, "progress.js");
        
        fs.writeFile(filePath, `module.exports = ${JSON.stringify(content.progress)};`, (err) => {
            if (err) {
                return handleError(res, err);
            }

            // 复制文件
            const filesToCopy = [
                "me_word_index.js",
                "notebook.md",
                "teacher_word_index.js",
                "unfamily_word_index.js"
            ];

            const copyPromises = filesToCopy.map(fileName => {
                return new Promise((resolve, reject) => {
                    const sourceFilePath = path.join(directoryPath, fileName);
                    const destinationFilePath = path.join(directoryPath, content.name, fileName);

                    fs.copyFile(sourceFilePath, destinationFilePath, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    });
                });
            });

            // 等待所有文件复制完成
            Promise.all(copyPromises)
                .then(() => {
                    res.json({
                        flag: 1,
                        message: "创建用户成功",
                        content: null,
                    });
                })
                .catch(err => {
                    handleError(res, err);
                });
        });
    });
});

// ------------- 获取学习信息 ----------
router.get("/student_progress", (req, res) => {
    // 1. 解析token
    let video_name = req.query.video_name; // 从查询参数获取
    const filePath = video_name + '/progress.js'

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return res.json({
                flag: 0,
                message: "配置文件不存在",
                content: null,
            });
        }

        try {
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

});
// ------------- 接受上传视频 ----------
const storage = multer.diskStorage({
    // 设置文件上传目录
    destination: (req, file, cb) => {
        const directoryPath = path.resolve(__dirname, "../../resource/person_name", req.headers.file_path, "video");
        fs.mkdir(directoryPath, { recursive: true }, (err) => {
            if (err) return cb(err);
            cb(null, directoryPath);
        });
    },
    // 设置文件名
    filename: (req, file, cb) => {
        cb(null, req.headers.video_name); // 固定文件名
    }
});
// 设置文件大小限制为500MB
const upload = multer({ 
    storage: storage
});
router.post('/upload_video', upload.single('video'), (req, res) => {
    console.log('上传视频');
    
    const videoFile = req.file;

    if (videoFile) {
        res.json({ flag: 1, content: '视频上传成功' });
    } else {
        res.json({ flag: 0, content: '没有上传文件' });
    }
});
// 删除视频
router.post('/delete_video', (req, res) => {
    const video_name = req.body.headers.video_name;
    const personal_file_path = req.body.headers.personal_file_path;
    const filePath = path.join(
        __dirname,
        "../..",
        "resource/person_name",
        personal_file_path,
        "video",
        video_name
    );

    fs.unlink(filePath, (err) => {
        if (err) {
            return res.json({
                flag: 0,
                message: "删除视频失败",
                content: null,
            });
        }

        res.json({
            flag: 1,
            message: "删除视频成功",
            content: null,
        });
    });
});


module.exports = router;

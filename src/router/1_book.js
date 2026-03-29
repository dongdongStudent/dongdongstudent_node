// 描述：用户路由模块
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require('fs');
const fsPromises = fs.promises; // 确保 fsPromises 被正确导入

// 递归遍历目录
async function traverseDirectory(dirPath) {
  let regex = /\.a$/g;
  const result = dirPath.match(regex);
  if (result) return;

  const files = await fs.readdir(dirPath);
  const children = await Promise.all(files.map(async (file) => {
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
  }));

  return children;
}

// 列出目录
router.get("/list", async (req, res) => {
  const dirPath = path.join(__dirname, "../book/");
  console.log("/list", dirPath);
  try {
    const filesAndDirs = await traverseDirectory(dirPath);
    res.json(filesAndDirs);
  } catch (err) {
    console.error("Error while traversing directory", err);
    res.status(500).send("Error while traversing directory");
  }
});

// 返回目录
router.get("/weisimin", (req, res) => {
  const filePath = path.join(__dirname, '../..', 'resource_2/13.声闻地.pdf');
  console.log('/weisimin11', filePath);
  // 先判断文件是否存在
  fs.access(filePath, (err) => {
    if (err) {
      console.error('文件不存在', err);
      res.status(404).send('文件不存在');
    } else {
      console.log('文件存在');
      res.sendFile(filePath);
    }
  });
});

router.get("*", async (req, res) => {
  console.log('return video content');

  // 直接使用 req.url，确保它是相对于 resource 目录的路径
  let url = path.join(__dirname, '../..', 'resource', req.url); // 使用 '..' 来回到上一级目录
  url = url.replace(/\/$/, ''); // 去掉最后的/

  try {
    // 检查文件是否存在
    await fsPromises.access(url); // 确保文件存在

    // 设置响应头
    res.setHeader('Content-Type', 'video/mp4'); // 根据视频格式设置正确的 MIME 类型
    res.setHeader('Content-Disposition', 'inline'); // 允许在浏览器中直接播放

    // 创建可读流并返回视频文件
    const videoStream = fs.createReadStream(url); // 从 fs 模块中创建可读流
    videoStream.pipe(res); // 将视频流管道传输到响应

    // 处理流的错误
    videoStream.on('error', (streamError) => {
      handleError(res, streamError); // 处理流错误
    });
  } catch (error) {
    handleError(res, error); // 调用统一的错误处理函数
  }
});

// 统一的错误处理函数
const handleError = (res, error) => {
  console.error('发生错误:', error.message); // 打印错误信息
  res.status(500).send({
    flag: 0,
    content: error.message || "发生了一个未知错误"
  });
};

module.exports = router;
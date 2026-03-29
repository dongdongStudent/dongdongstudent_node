const express = require('express');
const app = express();
const path = require('path');
const userRouter = require("./src/router/2_user.js");
const G_personal = require("./src/router/personal.js");
const english = require("./src/1_english/auth/user_auth_routes.js");
const resource = require("./src/router/resource.js");
const bodyParser = require("body-parser");
const cors = require("cors");
const rateLimit = require('express-rate-limit');

const logger = (req, res, next) => {
  console.log('---------', `${req.method} ${req.url} - IP: ${req.ip}`);
  next();
};

// 全局安全头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// 静态资源限流
const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200, // 每个IP最多200个请求
  message: '请求过于频繁，请稍后再试',
  skipSuccessfulRequests: true
});

// 增强的安全检查
const secureStatic = (req, res, next) => {
  const url = req.url;
  const clientIp = req.headers['x-forwarded-for'] || req.ip;
  
  // 检测路径遍历
  const pathTraversalRegex = /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c|\.\.%2f|%2e%2e\/)/i;
  
  // 检测敏感文件和目录
  const sensitiveRegex = /\.(env|git|aws|docker|secrets|config|toml|yml|yaml|tfvars|log|sql|bak|backup)$|credentials|proc\/self|etc\/passwd|root\/\.|home\/.*?\/\./i;
  
  if (pathTraversalRegex.test(url) || sensitiveRegex.test(url)) {
    console.error(`[安全告警] 阻断恶意访问 - IP: ${clientIp}, URL: ${req.url}, 时间: ${new Date().toISOString()}`);
    
    // 记录到专门的安全日志文件
    const fs = require('fs');
    const logEntry = `${new Date().toISOString()} - IP: ${clientIp} - URL: ${req.url}\n`;
    fs.appendFileSync('security.log', logEntry);
    
    return res.status(403).send('Forbidden');
  }
  next();
};

app.use(logger);
app.use(cors());

// 限制上传文件大小
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// 安全的静态文件服务
app.use('/server/resource/', 
  staticLimiter, 
  secureStatic, 
  express.static(path.join(__dirname, '/resource/'), {
    dotfiles: 'ignore',
    index: false,
    fallthrough: true,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      // 文件名安全检查
      const filename = path.basename(filePath);
      if (filename.startsWith('.') || 
          /\.(env|git|aws|secrets|credentials|config|log|sql|bak)$/i.test(filename)) {
        throw new Error('Access denied');
      }
    }
}));

// 新增的静态路由：用于直接访问 src 目录下的资源
app.use('/server/src/1_english/resource/',
  staticLimiter,
  secureStatic,
  express.static(path.join(__dirname, 'src/1_english/resource/'), {
    dotfiles: 'ignore',
    index: false,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 可根据需要调整缓存时间
      // 可以添加与原有路由类似的文件安全检查
      const filename = path.basename(filePath);
      if (filename.startsWith('.') ||
          /\.(env|git|aws|secrets|credentials|config|log|sql|bak)$/i.test(filename)) {
        throw new Error('Access denied');
      }
    }
}));
app.use('/server/resource/', resource);
app.use("/server/api/", userRouter); 
app.use("/server/personal/", G_personal);
app.use("/server/english/", english);

// 404 处理
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(3001, () => {
  console.log('Server is running on port 3001');
  console.log('安全防护已启用 - 静态资源目录:', path.join(__dirname, '/resource/'));
});
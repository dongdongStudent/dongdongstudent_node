const Tesseract = require('tesseract.js');
const path = require('path');

class ORCTesseract {
  constructor() {
    this.worker = null;
    this.initialized = false;
  }

  /**
   * 初始化OCR引擎
   * @param {string} [lang='eng'] - 语言代码
   * @param {object} [options={}] - 配置选项
   * @param {string} [options.langPath] - 自定义语言数据路径
   * @param {string} [options.corePath] - 自定义WASM路径
   * @param {boolean} [options.preserveSpaces=true] - 是否保留空格
   */
  async init(lang = 'eng', options = {}) {
    if (this.initialized) {
      console.warn('OCR engine already initialized');
      return;
    }

    try {
      const workerOptions = {
        // logger: info => console.debug('[Tesseract]', info),
        errorHandler: err => console.error('[Tesseract]', err),
        ...(options.langPath && { langPath: options.langPath }),
        ...(options.corePath && { corePath: options.corePath })
      };

      this.worker = await Tesseract.createWorker(workerOptions);
      
      // 加载语言包
      await this.worker.loadLanguage(lang);
      await this.worker.initialize(lang);

      // 关键配置：保留所有空格字符
      const params = {
        tessedit_pageseg_mode: options.pageSegMode || 6,
        tessedit_char_whitelist: 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' + 
          ' .,!?()\'"\t\n', // 包含空格、制表符和换行符
        preserve_interword_spaces: '1', // 保留单词间空格
        tessedit_preserve_minimal_spaces: '1' // 保留最小空格
      };

      await this.worker.setParameters(params);
      this.initialized = true;

    } catch (error) {
      console.error('OCR初始化失败:', error);
      await this.terminate();
      throw error;
    }
  }

  /**
   * 识别图像中的文本（保留原始空格）
   * @param {Buffer|string} image - 图像Buffer或Base64字符串
   * @returns {Promise<string>} 包含原始空格的识别结果
   */
  async recognize(image) {
    if (!this.initialized) {
      throw new Error('请先调用init()初始化引擎');
    }

    try {
      // 统一处理输入格式
      let imageBuffer;
      if (Buffer.isBuffer(image)) {
        imageBuffer = image;
      } else if (typeof image === 'string') {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        throw new Error('不支持的图像格式');
      }

      // 执行OCR识别
      const { data } = await this.worker.recognize(imageBuffer);
      
      // 后处理：保留所有空白字符
      return data.text
        .replace(/\r\n/g, '\n') // 统一换行符
        .replace(/\s+/g, ' ');  // 合并连续空格

    } catch (error) {
      console.error('OCR识别失败:', error);
      throw error;
    }
  }

  /**
   * 释放资源
   */
  async terminate() {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        console.error('释放OCR资源失败:', error);
      } finally {
        this.worker = null;
        this.initialized = false;
      }
    }
  }

  // 析构函数别名
  async destroy() {
    await this.terminate();
  }
}

module.exports = ORCTesseract;
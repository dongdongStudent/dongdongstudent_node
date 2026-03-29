const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const uuid = require('uuid');

// 您的应用ID
const APP_KEY = '1a4f361bb84afdf2';
// 您的应用密钥
const APP_SECRET = '6aoaG69EcG6J2hneHO0QEChFTUaqv7Cx';

/**
 * 网易有道智云语音合成服务
 * @param {string} text 待合成的文本
 * @param {string} savePath 音频保存路径
 * @param {string} voiceName 发言人名称（可选）
 * @param {string} format 音频格式（可选）
 * @returns {Promise<string>} 返回保存的文件路径
 */
async function youdaoTTS(text, savePath, voiceName = 'youxiaomei', format = 'mp3') {
    function addAuthParams(params) {
        const q = params.q || params.img;
        const salt = uuid.v1();
        const curtime = Math.floor(Date.now() / 1000).toString();
        const sign = calculateSign(q, salt, curtime);

        params.appKey = APP_KEY;
        params.salt = salt;
        params.curtime = curtime;
        params.signType = 'v3';
        params.sign = sign;
    }

    function calculateSign(q, salt, curtime) {
        const strSrc = APP_KEY + getInput(q) + salt + curtime + APP_SECRET;
        return encrypt(strSrc);
    }

    function encrypt(strSrc) {
        return crypto.createHash('sha256').update(strSrc).digest('hex');
    }

    function getInput(input) {
        if (!input) return input;
        const inputLen = input.length;
        return inputLen <= 20
            ? input
            : input.substring(0, 10) + inputLen + input.substring(inputLen - 10);
    }

    async function doCall(url, headers, data, method) {
        const config = {
            method,
            url,
            headers,
            data: new URLSearchParams(data).toString(),
            responseType: 'arraybuffer',
        };
        return await axios(config);
    }

    function saveFile(res) {
        const contentType = res.headers['content-type'];
        if (contentType.includes('audio')) {
            fs.writeFileSync(savePath, res.data);
            console.log('文件保存成功，路径:', savePath);
            return savePath; // 返回保存的文件路径
        } else {
            console.log('请求失败，错误信息:', Buffer.from(res.data).toString('utf-8'));
            throw new Error('音频请求失败');
        }
    }

    const data = { q: text, voiceName, format };
    addAuthParams(data);
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    try {
        const res = await doCall('https://openapi.youdao.com/ttsapi', headers, data, 'post');
        return saveFile(res); // 返回保存的文件路径
    } catch (error) {
        console.error('请求失败:', error.response ? error.response.data : error.message);
        throw error; // 抛出错误以便外部捕获
    }
}

// 导出函数
module.exports = youdaoTTS;

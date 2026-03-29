const axios = require('axios');

const AK = "BLsf92iDJ9sDbpNkTNWgZWB8";
const SK = "6XdyFNfdGDbTP4fZYRjSncHAFi9loPFM";

const getAccessToken = async () => {
    const response = await axios.post(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`);
    return response.data.access_token;
};

const textToAudio = async (text) => {
    try {
        const token = await getAccessToken();
        const response = await axios.post('https://tsn.baidu.com/text2audio', null, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': '*/*'
            },
            params: {
                'tex': text,
                'tok': token,
                'cuid': 'JrBMZsM64X82TWmlz8cgIXzbkOPVZlRn',
                'ctp': '1',
                'lan': 'zh',
                'spd': '5',
                'pit': '5',
                'vol': '5',
                'per': '5118',
                'aue': '3'
            },
            responseType: 'arraybuffer' // 处理音频数据
        });

        return response.data; // 返回音频数据
    } catch (error) {
        console.error(error);
        throw new Error('Error generating audio'); // 抛出错误
    }
};

module.exports = { textToAudio };
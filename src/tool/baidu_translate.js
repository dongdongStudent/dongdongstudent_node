// 副.js
const API_KEY = "VwPV3wHofYPY2ZFZqzt9aZBY";
const SECRET_KEY = "o08DKCTsRc0oGCR2CCI5wMywPNlkSWqR";

const getAccessToken = async () => {
    const url = "https://aip.baidubce.com/oauth/2.0/token";
    const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: API_KEY,
        client_secret: SECRET_KEY
    });

    const fetch = (await import('node-fetch')).default; // 动态导入 node-fetch
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();
    return data.access_token || null;
};

// 百度翻译API
const fetchTranslation = async (text) => {
    console.log('调用百度翻译 API');
    const accessToken = await getAccessToken();
    if (accessToken) {
        const fetch = (await import('node-fetch')).default; // 动态导入
        const url = `https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1?access_token=${accessToken}`;
        const payload = {
            from: "en",
            to: "zh",
            q: text
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        return data;
    }
};

// 百度语音合成API
const textToSpeech = async (text) => {
    const fetch = (await import('node-fetch')).default; // 动态导入
    const API_KEY = "J8vZg0yhYPMFmJpE5JU0D3xo"; // 替换为你的API Key
    const SECRET_KEY = "5K5PeNHM1x0vPJqio71FBuXeGx4PGqq5"; // 替换为你的Secret Key
    console.log('调用百度语音合成 API');

    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error('获取 Access Token 失败');
    }

    const fetchAudio = async (text) => {
        const url = "https://tsn.baidu.com/text2audio";
        const params = new URLSearchParams({
            tex: text,
            lan: 'zh',
            cuid: '123456PYTHON',
            ctp: 1,
            tok: accessToken,
            vol: 5,
            per: 5118,
            aue: 3
        });

        const response = await fetch(`${url}?${params}`);
        const contentType = response.headers.get('Content-Type');

        if (contentType === 'audio/mp3') {
            const audioBlob = await response.blob();
            return URL.createObjectURL(audioBlob);
        } else {
            const errorText = await response.text();
            console.error("语音合成失败，返回内容:", errorText);
            return null;
        }
    };

    if (text) {
        return await fetchAudio(text);
    }
    return null;
};

// 导出函数
module.exports = { fetchTranslation, textToSpeech };
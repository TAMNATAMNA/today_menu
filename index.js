const axios = require('axios');
const querystring = require('querystring');

module.exports = async (req, res) => {
    // 1. 슬랙 인증용 challenge 응답 (슬랙 연결 시 필수)
    if (req.body && req.body.challenge) {
        return res.status(200).send(req.body.challenge);
    }

    // 2. 명령어 요청 처리 (POST만 허용)
    if (req.method !== 'POST') {
        return res.status(200).send("Server is running");
    }

    // 비동기로 처리하기 위해 즉시 응답
    res.status(200).json({
        response_type: 'in_channel',
        text: "🔍 맛집을 찾고 있습니다..."
    });

    try {
        const bodyData = typeof req.body === 'string' ? querystring.parse(req.body) : req.body;
        const responseUrl = bodyData.response_url;
        const text = bodyData.text || "";

        // 로직 수행 (카카오 API 호출 등)
        await axios.post(responseUrl, {
            response_type: 'in_channel',
            text: `검색어 '${text}'에 대한 결과입니다.`
        });
    } catch (err) {
        console.error(err);
    }
};

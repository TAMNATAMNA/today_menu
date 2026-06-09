const axios = require('axios');
const querystring = require('querystring');

module.exports = async (req, res) => {
    // 1. 요청이 오면 무조건 로그를 찍습니다.
    console.log("--- 슬랙 요청 수신 성공 ---");
    console.log("Method:", req.method);
    console.log("Body:", req.body);

    // 2. 슬랙 인증용 challenge 응답 (필수)
    if (req.body && req.body.challenge) {
        console.log("슬랙 인증 요청 확인됨:", req.body.challenge);
        return res.status(200).send(req.body.challenge);
    }

    // 3. 슬랙 명령어 응답 (3초 타임아웃 방지)
    try {
        const bodyData = typeof req.body === 'string' ? querystring.parse(req.body) : req.body;
        
        // 슬랙에 즉시 응답 (이게 없으면 '앱이 반응하지 않습니다' 뜸)
        res.status(200).json({
            response_type: 'in_channel',
            text: "✅ 서버가 요청을 접수했습니다. 맛집을 찾는 중..."
        });

        // 4. 배경에서 실제 카카오 API 호출 (비동기 처리)
        const text = bodyData.text || "맛집";
        console.log("검색어:", text);
        
        // 여기에 카카오 로직 추가 예정
        
    } catch (err) {
        console.error("에러 발생:", err);
        return res.status(500).send("Server Error");
    }
};

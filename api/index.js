const axios = require('axios');
const querystring = require('querystring');

const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', err => reject(err));
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send("Vercel 서버 정상 작동 중");
    }

    // 1. [핵심 교정] 슬랙이 신호를 던지자마자 3초 타임아웃으로 안 죽게 즉시 200 OK와 대기 메시지를 먼저 보냅니다.
    // 이렇게 하면 슬랙 화면에 "앱이 반응하지 않는다"는 에러가 절대로 뜨지 않습니다.
    res.status(200).json({
        response_type: 'in_channel',
        text: "🔍 카카오 맵에서 실시간 맛집을 탐색하고 있습니다. 잠시만 기다려주세요!"
    });

    // 2. 슬랙한테 대답은 먼저 해줬으니, 이제 서버 백그라운드에서 카카오 연동을 여유롭게 처리합니다.
    try {
        const rawBody = await getRawBody(req);
        const bodyData = querystring.parse(rawBody);
        
        const fullText = bodyData && bodyData.text ? bodyData.text.trim() : '';
        const responseUrl = bodyData && bodyData.response_url ? bodyData.response_url : '';

        // 기본 위치 설정 (가산디지털단지 인근)
        let x = "126.880213191175"; 
        let y = "37.4850160418061";  
        let locationName = "기본 설정 위치";
        
        let foodCategory = ""; 
        let searchKeyword = "맛집";

        if (fullText) {
            const categories = ['한식', '일식', '중식', '양식', '카페', '디저트', '고기', '치킨'];
            let cleanLocationText = fullText;

            for (const cat of categories) {
                if (fullText.includes(cat)) {
                    foodCategory = cat;
                    searchKeyword = cat;
                    cleanLocationText = cleanLocationText.replace(cat, '').trim();
                    break;
                }
            }

            if (cleanLocationText) {
                const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cleanLocationText)}`;
                const searchResponse = await axios.get(kakaoSearchUrl, {
                    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
                });

                if (searchResponse.data.documents && searchResponse.data.documents.length > 0) {
                    const firstResult = searchResponse.data.documents[0];
                    x = firstResult.x;
                    y = firstResult.y;
                    locationName = firstResult.place_name || cleanLocationText;
                }
            }
        }

        const categoryGroupCode = (foodCategory === '카페' || foodCategory === '디저트') ? 'CE7' : 'FD6';
        const kakaoTargetUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchKeyword)}&category_group_code=${categoryGroupCode}&x=${x}&y=${y}&radius=2000&sort=distance`;

        const response = await axios.get(kakaoTargetUrl, {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
        });

        const places = response.data.documents;

        if (!places || places.length === 0) {
            if (responseUrl) {
                await axios.post(responseUrl, {
                    response_type: 'in_channel',
                    text: `📍 *[${locationName}]* 주변에 원하시는 *[${searchKeyword}]* 결과를 찾지 못했습니다.`
                });
            }
            return;
        }

        const shuffled = places.sort(() => 0.5 - Math.random());
        const selectedPlaces = shuffled.slice(0, 3);

        let attachments = selectedPlaces.map(place => {
            return {
                color: '#36a64f',
                title: place.place_name,
                title_link: place.place_url,
                text: `🗂️ 분류: ${place.category_name.split(' > ').pop()}\n📞 전화번호: ${place.phone || '없음'}\n📍 주소: ${place.road_address_name || place.address_name}`
            };
        });

        const titleText = foodCategory 
            ? `🍔 *[${locationName}]* 주변 추천하는 *[${foodCategory}]* 리스트입니다!`
            : `🍔 *[${locationName}]* 주변 추천 맛집 리스트입니다!`;

        // 3. 진짜 카카오에서 긁어온 맛집 리스트를 슬랙 창에 최종 업데이트(전송) 합니다.
        if (responseUrl) {
            await axios.post(responseUrl, {
                response_type: 'in_channel',
                text: titleText,
                attachments: attachments
            });
        }

    } catch (error) {
        console.error("에러 발생:", error.message);
        // 백그라운드 연산 중 에러가 나면 슬랙방에 에러를 따로 뿌려줍니다.
        const bodyData = querystring.parse(await getRawBody(req).catch(() => ''));
        const responseUrl = bodyData && bodyData.response_url ? bodyData.response_url : '';
        if (responseUrl) {
            axios.post(responseUrl, {
                response_type: 'in_channel',
                text: `🚨 봇 내부 연산 에러 발생: ${error.message}`
            }).catch(() => {});
        }
    }
};

const axios = require('axios');
const querystring = require('querystring');

const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';

// 1. 함수를 명확하게 밖으로 정의합니다.
async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', err => reject(err));
    });
}

// 2. 이제 module.exports 안에서 getRawBody를 마음껏 부를 수 있습니다.
module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(200).send("정상");

    res.status(200).json({
        response_type: 'in_channel',
        text: "🔍 맛집 탐색 중... 잠시만 기다려주세요!"
    });

    try {
        const rawBody = await getRawBody(req); // 이제 에러 안 납니다!
        const bodyData = querystring.parse(rawBody);
        const fullText = (bodyData.text || '').trim();
        const responseUrl = bodyData.response_url;

        const categories = ['한식', '일식', '중식', '양식', '카페', '디저트', '고기', '치킨'];
        let foodCategory = "";
        let searchKeyword = "맛집";
        let locationText = fullText;

        for (const cat of categories) {
            if (fullText.includes(cat)) {
                foodCategory = cat;
                searchKeyword = cat;
                locationText = fullText.replace(cat, '').trim();
                break;
            }
        }

        let x = "126.880213191175"; 
        let y = "37.4850160418061";  
        let locationName = "가산디지털단지";

        if (locationText && locationText.length > 0) {
            const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(locationText)}`;
            const searchResponse = await axios.get(kakaoSearchUrl, {
                headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
            });

            if (searchResponse.data.documents && searchResponse.data.documents.length > 0) {
                const first = searchResponse.data.documents[0];
                x = first.x;
                y = first.y;
                locationName = first.place_name;
            }
        }

        const categoryGroupCode = (foodCategory === '카페' || foodCategory === '디저트') ? 'CE7' : 'FD6';
        const response = await axios.get(`https://dapi.kakao.com/v2/local/search/keyword.json`, {
            params: { query: searchKeyword, category_group_code: categoryGroupCode, x: x, y: y, radius: 1000, sort: 'distance' },
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
        });

        const places = response.data.documents;
        if (!places || places.length === 0) {
            await axios.post(responseUrl, { text: `📍 *[${locationName}]* 주변에 원하시는 *[${searchKeyword}]* 결과를 찾지 못했습니다.` });
            return;
        }

        const selected = places.sort(() => 0.5 - Math.random()).slice(0, 3);
        const attachments = selected.map(p => ({
            color: '#36a64f',
            title: p.place_name,
            title_link: p.place_url,
            text: `📍 주소: ${p.road_address_name || p.address_name}\n📞 전화번호: ${p.phone || '없음'}`
        }));

        await axios.post(responseUrl, {
            response_type: 'in_channel',
            text: `🍔 *[${locationName}]* 주변 추천 ${foodCategory || ''} 맛집 리스트입니다!`,
            attachments: attachments
        });

    } catch (error) {
        console.error("최종 에러:", error);
    }
};

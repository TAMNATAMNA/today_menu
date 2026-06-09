const axios = require('axios');
const querystring = require('querystring');

const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';

async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', err => reject(err));
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(200).send("정상");

    try {
        const rawBody = await getRawBody(req);
        const bodyData = querystring.parse(rawBody);
        const fullText = (bodyData.text || '').trim();

        const categories = ['한식', '일식', '중식', '양식', '카페', '디저트', '고기', '치킨', '피자', '족발', '소고기', '갈비', '회', '참치'];
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

        let x = "126.880014"; 
        let y = "37.484960";  
        let locationName = "내 집";

        if (locationText && locationText.length > 0) {
            const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(locationText)}`;
            const searchResponse = await axios.get(kakaoSearchUrl, {
                headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
            });

            if (searchResponse.data.documents && searchResponse.data.documents.length > 0) {
                const first = searchResponse.data.documents[0];
                x = first.x;
                y = first.y;
                locationName = first.place_name || locationText;
            }
        }

        const categoryGroupCode = (foodCategory === '카페' || foodCategory === '디저트') ? 'CE7' : 'FD6';
        const response = await axios.get(`https://dapi.kakao.com/v2/local/search/keyword.json`, {
            params: { query: searchKeyword, category_group_code: categoryGroupCode, x: x, y: y, radius: 1000, sort: 'distance' },
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
        });

        const places = response.data.documents;
        if (!places || places.length === 0) {
            return res.status(200).json({ response_type: 'in_channel', text: `📍 *[${locationName}]* 주변에 원하시는 *[${searchKeyword}]* 결과를 찾지 못했습니다.` });
        }

        const selected = places.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        // 형님이 요청하신 형식으로 정확히 구성했습니다
        const attachments = selected.map(p => ({
            color: '#36a64f',
            title: p.place_name,
            title_link: p.place_url, // 클릭 시 링크 연결
            text: `🗂️ 분류: ${p.category_name.split(' > ').pop()}\n📞 전화번호: ${p.phone || '없음'}\n📍 주소: ${p.road_address_name || p.address_name}`
        }));

        return res.status(200).json({
            response_type: 'in_channel',
            text: `🍔 *[${locationName}]* 주변 추천 ${foodCategory || ''} 맛집 리스트입니다!`,
            attachments: attachments
        });

    } catch (error) {
        console.error("최종 에러:", error);
        return res.status(200).json({ text: `🚨 에러 발생: ${error.message}` });
    }
};

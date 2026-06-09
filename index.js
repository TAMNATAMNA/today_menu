const axios = require('axios');
const querystring = require('querystring');
const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';

async function getRawBody(req) {
    let body = '';
    for await (const chunk of req) {
        body += chunk;
    }
    return body;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send("Vercel 서버 정상 작동 중");
    }

    res.status(200).json({
        response_type: 'in_channel',
        text: "🔍 카카오 지도에서 맛집을 탐색하고 있습니다. 잠시 기다려주세요!"
    });

    try {
        const rawBody = await getRawBody(req);
        const bodyData = querystring.parse(rawBody);
        const fullText = bodyData.text ? bodyData.text.trim() : '';
        const responseUrl = bodyData.response_url;

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
                const searchResponse = await axios.get(kakaoSearchUrl, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
                if (searchResponse.data.documents.length > 0) {
                    const firstResult = searchResponse.data.documents[0];
                    x = firstResult.x;
                    y = firstResult.y;
                    locationName = firstResult.place_name;
                }
            }
        }

        const categoryGroupCode = (foodCategory === '카페' || foodCategory === '디저트') ? 'CE7' : 'FD6';
        const kakaoTargetUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchKeyword)}&category_group_code=${categoryGroupCode}&x=${x}&y=${y}&radius=2000&sort=distance`;
        
        const response = await axios.get(kakaoTargetUrl, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        const places = response.data.documents;

        if (places.length === 0) {
            await axios.post(responseUrl, { response_type: 'in_channel', text: "해당 위치에 맛집이 없습니다." });
            return;
        }

        const shuffled = places.sort(() => 0.5 - Math.random());
        const selectedPlaces = shuffled.slice(0, 3);
        const attachments = selectedPlaces.map(place => ({
            color: '#36a64f',
            title: place.place_name,
            title_link: place.place_url,
            text: `📍 주소: ${place.road_address_name || place.address_name}\n📞 전화번호: ${place.phone || '없음'}`
        }));

        await axios.post(responseUrl, {
            response_type: 'in_channel',
            text: `🍔 *[${locationName}]* 주변 맛집 리스트입니다!`,
            attachments: attachments
        });

    } catch (error) {
        console.error("에러발생:", error.message);
    }
};

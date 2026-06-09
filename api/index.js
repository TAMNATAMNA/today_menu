const axios = require('axios');
const querystring = require('querystring');

const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';

// ... (getRawBody 함수는 그대로 사용) ...

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(200).send("OK");

    // 슬랙 응답 지연 방지 (200 OK)
    res.status(200).json({
        response_type: 'in_channel',
        text: "🔍 맛집 탐색 중... 잠시만 기다려주세요!"
    });

    try {
        const rawBody = await getRawBody(req);
        const bodyData = querystring.parse(rawBody);
        const fullText = (bodyData.text || '').trim();
        const responseUrl = bodyData.response_url;

        // 1. 카테고리 추출
        const categories = ['한식', '일식', '중식', '양식', '카페', '디저트', '고기', '치킨'];
        let foodCategory = "";
        let searchKeyword = "맛집";
        let locationText = fullText; // 위치 검색용 텍스트

        for (const cat of categories) {
            if (fullText.includes(cat)) {
                foodCategory = cat;
                searchKeyword = cat;
                // 위치 텍스트에서 카테고리 단어 제거 (깔끔하게 위치명만 추출)
                locationText = fullText.replace(cat, '').trim();
                break;
            }
        }

        // 2. 위치 좌표 가져오기 (사용자가 지역을 입력했으면 그곳 좌표, 아니면 기본 가산디지털단지)
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

        // 3. 맛집 검색 (최종)
        const categoryGroupCode = (foodCategory === '카페' || foodCategory === '디저트') ? 'CE7' : 'FD6';
        const kakaoTargetUrl = `https://dapi.kakao.com/v2/local/search/keyword.json`;
        
        const response = await axios.get(kakaoTargetUrl, {
            params: {
                query: searchKeyword,
                category_group_code: categoryGroupCode,
                x: x,
                y: y,
                radius: 1000,
                sort: 'distance'
            },
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
        });

        const places = response.data.documents;
        if (!places || places.length === 0) {
            await axios.post(responseUrl, { text: `📍 *[${locationName}]* 주변에 원하시는 *[${searchKeyword}]* 결과를 찾지 못했습니다.` });
            return;
        }

        // 결과 랜덤 3개 추출 후 전송
        const selectedPlaces = places.sort(() => 0.5 - Math.random()).slice(0, 3);
        const attachments = selectedPlaces.map(p => ({
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

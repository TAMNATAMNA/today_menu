const axios = require('axios');

const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 슬랙에서 입력받은 전체 텍스트 (예: "강남역 맛집", "판교역로 235 한식")
    const fullText = req.body.text ? req.body.text.trim() : '가산디지털단지 맛집';

    try {
        // 카카오 키워드 검색 API 호출
        // 텍스트를 그대로 넘기면 카카오 API가 지역명, 주소, 키워드를 알아서 분석합니다.
        const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(fullText)}`;
        
        const response = await axios.get(kakaoSearchUrl, {
            headers: {
                Authorization: `KakaoAK ${KAKAO_API_KEY}`
            }
        });

        const places = response.data.documents;

        if (!places || places.length === 0) {
            return res.status(200).json({
                response_type: 'in_channel',
                text: `🔍 '${fullText}'에 대한 검색 결과가 없습니다. 다른 지역이나 키워드로 검색해 보세요!`
            });
        }

        // 결과 중 랜덤 3개 추출
        const shuffled = places.sort(() => 0.5 - Math.random());
        const selectedPlaces = shuffled.slice(0, 3);

        const attachments = selectedPlaces.map(place => {
            return {
                color: '#36a64f',
                title: place.place_name,
                title_link: place.place_url,
                text: `🗂️ 분류: ${place.category_name.split(' > ').pop()}\n📞 전화번호: ${place.phone || '없음'}\n📍 주소: ${place.road_address_name || place.address_name}`
            };
        });

        return res.status(200).json({
            response_type: 'in_channel',
            text: `🍔 '${fullText}' 검색 결과입니다!`,
            attachments: attachments
        });

    } catch (error) {
        console.error(error);
        return res.status(200).json({
            response_type: 'in_channel',
            text: '🚨 검색 중 에러가 발생했습니다. 잠시 후 다시 시도해 주세요.'
        });
    }
};

const axios = require('axios');

// 카카오 REST API 키 설정
const KAKAO_API_KEY = '15854ca337f7a2f630d72b3cdcbd87be';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 슬랙에서 사용자가 입력한 전체 텍스트
    const fullText = req.body.text ? req.body.text.trim() : '';

    // 기본 위치 설정 (가산디지털단지 인근)
    let x = "126.880213191175"; 
    let y = "37.4850160418061";  
    let locationName = "기본 설정 위치";
    



    
    // 음식 종류 키워드 세팅
    let foodCategory = ""; 
    let searchKeyword = "맛집"; // 기본 검색어

    try {
        if (fullText) {
            // 처리할 음식 카테고리 리스트
            const categories = ['한식', '일식', '중식', '양식', '카페', '디저트', '고기', '치킨'];
            let cleanLocationText = fullText;

            // 사용자가 입력한 글자에서 음식 종류 키워드가 있는지 확인하고 발라냅니다.
            categories.forEach(cat => {
                if (fullText.includes(cat)) {
                    foodCategory = cat;
                    searchKeyword = cat; // 카카오 API에 넘길 검색어로 지정
                    // 전체 텍스트에서 음식 종류 글자를 지워서 순수 "지역명"만 추출합니다.
                    cleanLocationText = cleanLocationText.replace(cat, '').trim();
                }
            });

            // 음식 종류를 빼고 남은 글자(지역명)가 있다면 그 지역의 위경도를 찾습니다.
            if (cleanLocationText) {
                const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cleanLocationText)}`;
                
                const searchResponse = await axios.get(kakaoSearchUrl, {
                    headers: {
                        Authorization: `KakaoAK ${KAKAO_API_KEY}`
                    }
                });

                if (searchResponse.data.documents && searchResponse.data.documents.length > 0) {
                    const firstResult = searchResponse.data.documents[0];
                    x = firstResult.x;
                    y = firstResult.y;
                    locationName = firstResult.place_name || cleanLocationText;
                } else {
                    return res.status(200).json({
                        response_type: 'in_channel',
                        text: `🔍 '${cleanLocationText}' 주변 주소를 찾지 못했어요. 오타가 없는지 확인해 주세요!`
                    });
                }
            }
        }

        // 최종 위도/경도 주변에서 검색을 진행합니다.
        const categoryGroupCode = (foodCategory === '카페' || foodCategory === '디저트') ? 'CE7' : 'FD6';
        const kakaoTargetUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchKeyword)}&category_group_code=${categoryGroupCode}&x=${x}&y=${y}&radius=2000&sort=distance`;

        const response = await axios.get(kakaoTargetUrl, {
            headers: {
                Authorization: `KakaoAK ${KAKAO_API_KEY}`
            }
        });

        const places = response.data.documents;

        if (!places || places.length === 0) {
            return res.status(200).json({
                response_type: 'in_channel',
                text: `📍 *[${locationName}]* 주변에 원하시는 *[${searchKeyword}]* 관련 맛집을 찾지 못했습니다.`
            });
        }

        // 검색된 결과 중 랜덤으로 3개 추출
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
            ? `🍔 *[${locationName}]* 주변 추천하는 *[${foodCategory}]* 맛집 리스트입니다!`
            : `🍔 *[${locationName}]* 주변 추천 맛집 리스트입니다!`;

        return res.status(200).json({
            response_type: 'in_channel',
            text: titleText,
            attachments: attachments
        });

    } catch (error) {
        console.error(error);
        return res.status(200).json({
            response_type: 'in_channel',
            text: '🚨 맛집을 검색하는 도중 에러가 발생했습니다. 잠시 후 다시 시도해 주세요.'
        });
    }
};

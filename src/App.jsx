import { useState, useEffect, useRef } from "react";

const NC=["#FF6B6B","#4ECDC4","#FFE66D","#A8E6CF","#DDA0DD","#87CEEB","#F4A460","#98D8C8","#FF8C94","#91EAE4"];
function rNick(){
  const a=["익명의","지나가는","심심한","배고픈","졸린","행복한","호기심많은","조용한","카페인","느긋한"];
  const b=["고양이","펭귄","여행자","독서가","커피러버","산책러","몽상가","탐험가","코알라","수달"];
  return a[Math.floor(Math.random()*a.length)]+b[Math.floor(Math.random()*b.length)];
}
function fPeople(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i);return Math.abs(h%13)+1}
function fMsgs(p){
  const t=["여기 자리 있나요?","오늘 사람 많네요","와이파이 비번 아시는 분?","분위기 좋다 ㅎㅎ","근처 맛집 추천 좀요","콘센트 자리 있어요?","여기 처음인데 추천메뉴?","에어컨 좀 세요 ㅋㅋ","화장실 어딘가요?","오늘 웨이팅 있나요?","여기 단체석 되나요?","주차 어디에 하셨어요?","2층이 더 조용해요","테라스 자리 좋아요","아 배고프다","노트북 작업하기 좋아요","여기 디저트 맛있음","사장님이 친절해요"];
  const c=Math.abs(p.charCodeAt(0)%4)+2,m=[];
  for(let i=0;i<c;i++)m.push({id:`m-${p}-${i}`,nick:rNick(),text:t[(p.charCodeAt(i%p.length)+i*7)%t.length],time:`${(i+1)*3}분 전`,color:NC[(p.charCodeAt(0)+i)%NC.length]});
  return m;
}

// ── 서울 주요 지역 인기 장소 데이터 ──
const AREA_DATA = {
  "강남역": {lat:37.4979,lng:127.0276,places:[
    {n:"스타벅스 강남역점",c:"카페",i:"☕"},{n:"블루보틀 삼성역점",c:"카페",i:"☕"},{n:"투썸플레이스 강남중앙점",c:"카페",i:"☕"},
    {n:"교보문고 강남점",c:"서점",i:"📚"},{n:"CGV 강남",c:"영화관",i:"🎬"},{n:"올리브영 강남역점",c:"매장",i:"🛍️"},
    {n:"이디야커피 강남역점",c:"카페",i:"☕"},{n:"역전할머니맥주 강남점",c:"음식점",i:"🍺"},{n:"고기리막국수 강남점",c:"음식점",i:"🍽️"},
    {n:"위워크 강남역",c:"코워킹",i:"💼"},{n:"패스트파이브 강남역점",c:"코워킹",i:"💼"},{n:"GS25 강남역삼거리점",c:"편의점",i:"🏪"},
    {n:"CU 강남역점",c:"편의점",i:"🏪"},{n:"맥도날드 강남점",c:"패스트푸드",i:"🍔"},{n:"본죽 강남역점",c:"음식점",i:"🍽️"},
    {n:"셰이크쉑 강남점",c:"패스트푸드",i:"🍔"},{n:"메가커피 강남역점",c:"카페",i:"☕"},{n:"할리스 강남역점",c:"카페",i:"☕"},
    {n:"다이소 강남역점",c:"매장",i:"🛍️"},{n:"버거킹 강남역점",c:"패스트푸드",i:"🍔"}
  ]},
  "홍대입구": {lat:37.5563,lng:126.9236,places:[
    {n:"카페 연남동223",c:"카페",i:"☕"},{n:"스타벅스 홍대입구역점",c:"카페",i:"☕"},{n:"알베르 홍대점",c:"카페",i:"☕"},
    {n:"AK&홍대",c:"쇼핑몰",i:"🛍️"},{n:"CGV 홍대",c:"영화관",i:"🎬"},{n:"땀땀 홍대점",c:"음식점",i:"🍽️"},
    {n:"롤링홀",c:"공연장",i:"🎵"},{n:"KT&G 상상마당",c:"문화공간",i:"🎭"},{n:"무신사 스탠다드 홍대",c:"매장",i:"👕"},
    {n:"라인프렌즈 홍대 플래그십",c:"매장",i:"🛍️"},{n:"오오기 홍대점",c:"음식점",i:"🍽️"},{n:"이디야 홍대걷고싶은거리점",c:"카페",i:"☕"},
    {n:"홍대 놀이터",c:"광장",i:"📍"},{n:"어반플랜트 홍대점",c:"카페",i:"☕"},{n:"GS25 홍대입구역점",c:"편의점",i:"🏪"},
    {n:"CU 홍대정문점",c:"편의점",i:"🏪"},{n:"다이소 홍대점",c:"매장",i:"🛍️"},{n:"서브웨이 홍대입구역점",c:"패스트푸드",i:"🍔"},
    {n:"젠틀몬스터 홍대",c:"매장",i:"🛍️"},{n:"카카오프렌즈 홍대 플래그십",c:"매장",i:"🛍️"}
  ]},
  "성수동": {lat:37.5445,lng:127.0557,places:[
    {n:"대림창고갤러리",c:"갤러리",i:"🎨"},{n:"블루보틀 성수점",c:"카페",i:"☕"},{n:"카페 할아버지공장",c:"카페",i:"☕"},
    {n:"어니언 성수점",c:"카페",i:"☕"},{n:"성수연방",c:"복합문화",i:"🏢"},{n:"서울숲 갤러리아포레",c:"쇼핑몰",i:"🛍️"},
    {n:"센터커피 성수점",c:"카페",i:"☕"},{n:"아우어베이커리 성수점",c:"베이커리",i:"🥐"},{n:"디앤디파트먼트 서울",c:"매장",i:"🛍️"},
    {n:"무신사 스탠다드 성수",c:"매장",i:"👕"},{n:"서울숲",c:"공원",i:"🌳"},{n:"헤이그라운드 성수",c:"코워킹",i:"💼"},
    {n:"카페 봇",c:"카페",i:"☕"},{n:"성수 수제화거리",c:"거리",i:"📍"},{n:"GS25 성수역점",c:"편의점",i:"🏪"},
    {n:"CU 성수이로점",c:"편의점",i:"🏪"},{n:"피크닉 성수점",c:"카페",i:"☕"},{n:"점프밀라노 성수",c:"매장",i:"🛍️"},
    {n:"할리스 성수역점",c:"카페",i:"☕"},{n:"이솝 성수점",c:"매장",i:"🛍️"}
  ]},
  "잠실": {lat:37.5133,lng:127.1001,places:[
    {n:"롯데월드타워 서울스카이",c:"관광",i:"🏙️"},{n:"롯데월드몰",c:"쇼핑몰",i:"🛍️"},{n:"롯데월드 어드벤처",c:"놀이공원",i:"🎢"},
    {n:"석촌호수 카페거리",c:"거리",i:"☕"},{n:"스타벅스 잠실역점",c:"카페",i:"☕"},{n:"CGV 롯데월드타워",c:"영화관",i:"🎬"},
    {n:"잠실야구장",c:"스포츠",i:"⚾"},{n:"올림픽공원",c:"공원",i:"🌳"},{n:"교보문고 잠실점",c:"서점",i:"📚"},
    {n:"송리단길 맛집거리",c:"거리",i:"🍽️"},{n:"이디야 잠실역점",c:"카페",i:"☕"},{n:"메가커피 잠실점",c:"카페",i:"☕"},
    {n:"위워크 잠실",c:"코워킹",i:"💼"},{n:"GS25 잠실역점",c:"편의점",i:"🏪"},{n:"투썸플레이스 잠실롯데점",c:"카페",i:"☕"},
    {n:"다이소 잠실역점",c:"매장",i:"🛍️"},{n:"맘스터치 잠실점",c:"패스트푸드",i:"🍔"},{n:"빽다방 잠실역점",c:"카페",i:"☕"},
    {n:"석촌호수 동호",c:"공원",i:"🌳"},{n:"CU 잠실새내역점",c:"편의점",i:"🏪"}
  ]},
  "여의도": {lat:37.5219,lng:126.9245,places:[
    {n:"더현대 서울",c:"백화점",i:"🛍️"},{n:"IFC몰",c:"쇼핑몰",i:"🛍️"},{n:"CGV 여의도",c:"영화관",i:"🎬"},
    {n:"여의도 한강공원",c:"공원",i:"🌳"},{n:"스타벅스 IFC몰점",c:"카페",i:"☕"},{n:"블루보틀 여의도점",c:"카페",i:"☕"},
    {n:"여의도공원",c:"공원",i:"🌳"},{n:"63빌딩",c:"관광",i:"🏙️"},{n:"글래드 여의도",c:"호텔",i:"🏨"},
    {n:"패스트파이브 여의도점",c:"코워킹",i:"💼"},{n:"위워크 여의도",c:"코워킹",i:"💼"},{n:"교보문고 여의도점",c:"서점",i:"📚"},
    {n:"이디야 여의도역점",c:"카페",i:"☕"},{n:"GS25 여의도역점",c:"편의점",i:"🏪"},{n:"CU 여의도공원점",c:"편의점",i:"🏪"},
    {n:"투썸플레이스 여의도점",c:"카페",i:"☕"},{n:"할리스 여의도점",c:"카페",i:"☕"},{n:"맥도날드 IFC점",c:"패스트푸드",i:"🍔"},
    {n:"여의나루역 카페거리",c:"거리",i:"☕"},{n:"올리브영 여의도점",c:"매장",i:"🛍️"}
  ]},
  "이태원": {lat:37.5345,lng:126.9946,places:[
    {n:"경리단길 메인스트리트",c:"거리",i:"📍"},{n:"부다스벨리",c:"음식점",i:"🍽️"},{n:"리나스 이태원",c:"카페",i:"☕"},
    {n:"크래프트한스 이태원",c:"펍",i:"🍺"},{n:"이태원앤틱가구거리",c:"거리",i:"📍"},{n:"그랜드하얏트 서울",c:"호텔",i:"🏨"},
    {n:"용산공예관",c:"문화공간",i:"🎭"},{n:"플레이타운 이태원",c:"카페",i:"☕"},{n:"올리브영 이태원점",c:"매장",i:"🛍️"},
    {n:"스타벅스 이태원역점",c:"카페",i:"☕"},{n:"맥도날드 이태원점",c:"패스트푸드",i:"🍔"},{n:"GS25 이태원역점",c:"편의점",i:"🏪"},
    {n:"CU 이태원중앙점",c:"편의점",i:"🏪"},{n:"이태원 세계음식거리",c:"거리",i:"🍽️"},{n:"핫독 이태원점",c:"음식점",i:"🍽️"},
    {n:"빈스빈스 이태원",c:"카페",i:"☕"},{n:"라운지엑스 이태원",c:"바",i:"🍸"},{n:"파머스테이블 이태원",c:"음식점",i:"🍽️"},
    {n:"남산타워 올라가는길",c:"관광",i:"🏔️"},{n:"이태원 자유시장",c:"시장",i:"🛒"}
  ]},
  "신촌": {lat:37.5550,lng:126.9366,places:[
    {n:"연세대학교 정문",c:"대학",i:"🎓"},{n:"현대백화점 신촌점",c:"백화점",i:"🛍️"},{n:"이화여대 정문앞거리",c:"거리",i:"📍"},
    {n:"스타벅스 신촌점",c:"카페",i:"☕"},{n:"연세로 거리",c:"거리",i:"📍"},{n:"CGV 신촌아트레온",c:"영화관",i:"🎬"},
    {n:"이디야 신촌역점",c:"카페",i:"☕"},{n:"메가커피 신촌점",c:"카페",i:"☕"},{n:"명물거리 맛집골목",c:"거리",i:"🍽️"},
    {n:"GS25 신촌역점",c:"편의점",i:"🏪"},{n:"CU 신촌기차역점",c:"편의점",i:"🏪"},{n:"투썸플레이스 신촌점",c:"카페",i:"☕"},
    {n:"빽다방 신촌점",c:"카페",i:"☕"},{n:"서브웨이 신촌역점",c:"패스트푸드",i:"🍔"},{n:"올리브영 신촌점",c:"매장",i:"🛍️"},
    {n:"다이소 신촌점",c:"매장",i:"🛍️"},{n:"할리스 신촌점",c:"카페",i:"☕"},{n:"맥도날드 신촌점",c:"패스트푸드",i:"🍔"},
    {n:"아비코 신촌점",c:"음식점",i:"🍽️"},{n:"연세대 학생회관",c:"대학",i:"🎓"}
  ]},
  "건대입구": {lat:37.5404,lng:127.0694,places:[
    {n:"커먼그라운드",c:"쇼핑몰",i:"🛍️"},{n:"스타시티몰",c:"쇼핑몰",i:"🛍️"},{n:"롯데시네마 건대입구",c:"영화관",i:"🎬"},
    {n:"스타벅스 건대입구점",c:"카페",i:"☕"},{n:"건국대학교 정문",c:"대학",i:"🎓"},{n:"건대 먹자골목",c:"거리",i:"🍽️"},
    {n:"메가커피 건대입구점",c:"카페",i:"☕"},{n:"이디야 건대입구역점",c:"카페",i:"☕"},{n:"GS25 건대입구역점",c:"편의점",i:"🏪"},
    {n:"CU 건대입구점",c:"편의점",i:"🏪"},{n:"올리브영 건대점",c:"매장",i:"🛍️"},{n:"투썸플레이스 건대점",c:"카페",i:"☕"},
    {n:"빽다방 건대입구점",c:"카페",i:"☕"},{n:"맥도날드 건대점",c:"패스트푸드",i:"🍔"},{n:"할리스 건대입구점",c:"카페",i:"☕"},
    {n:"다이소 건대입구점",c:"매장",i:"🛍️"},{n:"건대 로데오거리",c:"거리",i:"📍"},{n:"엔젤리너스 건대점",c:"카페",i:"☕"},
    {n:"건대 양꼬치거리",c:"거리",i:"🍽️"},{n:"서브웨이 건대입구역점",c:"패스트푸드",i:"🍔"}
  ]},
  "합정": {lat:37.5496,lng:126.9139,places:[
    {n:"메세나폴리스몰",c:"쇼핑몰",i:"🛍️"},{n:"스타벅스 합정역점",c:"카페",i:"☕"},{n:"어니언 합정점",c:"카페",i:"☕"},
    {n:"CJ올리브마켓 합정점",c:"마트",i:"🛒"},{n:"합정역 카페거리",c:"거리",i:"☕"},{n:"이디야 합정역점",c:"카페",i:"☕"},
    {n:"GS25 합정역점",c:"편의점",i:"🏪"},{n:"CU 합정역점",c:"편의점",i:"🏪"},{n:"메가커피 합정점",c:"카페",i:"☕"},
    {n:"롯데시네마 합정",c:"영화관",i:"🎬"},{n:"올리브영 합정역점",c:"매장",i:"🛍️"},{n:"투썸플레이스 합정점",c:"카페",i:"☕"},
    {n:"당인리발전소",c:"문화공간",i:"🎭"},{n:"합정 카페골목",c:"거리",i:"☕"},{n:"서브웨이 합정역점",c:"패스트푸드",i:"🍔"},
    {n:"다이소 합정역점",c:"매장",i:"🛍️"},{n:"카페 어반소스",c:"카페",i:"☕"},{n:"홀리카우 합정점",c:"음식점",i:"🍽️"},
    {n:"합정 맛집거리",c:"거리",i:"🍽️"},{n:"빽다방 합정역점",c:"카페",i:"☕"}
  ]},
  "망원동": {lat:37.5564,lng:126.9087,places:[
    {n:"망원시장",c:"시장",i:"🛒"},{n:"망원한강공원",c:"공원",i:"🌳"},{n:"카페 레이어드 망원점",c:"카페",i:"☕"},
    {n:"스타벅스 망원역점",c:"카페",i:"☕"},{n:"이디야 망원역점",c:"카페",i:"☕"},{n:"메가커피 망원점",c:"카페",i:"☕"},
    {n:"GS25 망원역점",c:"편의점",i:"🏪"},{n:"CU 망원동점",c:"편의점",i:"🏪"},{n:"올리브영 망원역점",c:"매장",i:"🛍️"},
    {n:"망리단길 메인거리",c:"거리",i:"📍"},{n:"카페 콤마 망원",c:"카페",i:"☕"},{n:"프릳츠 망원점",c:"카페",i:"☕"},
    {n:"망원동 빵집거리",c:"거리",i:"🥐"},{n:"베이커리 밀도 망원",c:"베이커리",i:"🥐"},{n:"다이소 망원역점",c:"매장",i:"🛍️"},
    {n:"빽다방 망원역점",c:"카페",i:"☕"},{n:"투썸플레이스 망원점",c:"카페",i:"☕"},{n:"서브웨이 망원역점",c:"패스트푸드",i:"🍔"},
    {n:"망원동 맛집골목",c:"거리",i:"🍽️"},{n:"할리스 망원역점",c:"카페",i:"☕"}
  ]},
  "연남동": {lat:37.5660,lng:126.9255,places:[
    {n:"연남동 경의선숲길",c:"공원",i:"🌳"},{n:"카페 연남동223-14",c:"카페",i:"☕"},{n:"연남방앗간",c:"음식점",i:"🍽️"},
    {n:"스타벅스 연남점",c:"카페",i:"☕"},{n:"이디야 연남동점",c:"카페",i:"☕"},{n:"카페 레이어드 연남점",c:"카페",i:"☕"},
    {n:"GS25 연남동점",c:"편의점",i:"🏪"},{n:"CU 연남동점",c:"편의점",i:"🏪"},{n:"연트럴파크 산책로",c:"공원",i:"🌳"},
    {n:"올리브영 연남점",c:"매장",i:"🛍️"},{n:"메가커피 연남점",c:"카페",i:"☕"},{n:"연남동 세계음식거리",c:"거리",i:"🍽️"},
    {n:"빽다방 연남동점",c:"카페",i:"☕"},{n:"투썸플레이스 연남점",c:"카페",i:"☕"},{n:"연남동 소품샵거리",c:"거리",i:"🛍️"},
    {n:"다이소 연남동점",c:"매장",i:"🛍️"},{n:"서브웨이 연남점",c:"패스트푸드",i:"🍔"},{n:"연남동 브런치카페",c:"카페",i:"☕"},
    {n:"연남동 와인바거리",c:"거리",i:"🍷"},{n:"할리스 연남점",c:"카페",i:"☕"}
  ]},
  "을지로": {lat:37.5660,lng:126.9910,places:[
    {n:"을지로3가 노가리골목",c:"거리",i:"🍺"},{n:"세운상가",c:"복합상가",i:"🏢"},{n:"을지다락",c:"카페",i:"☕"},
    {n:"카페 챕터원",c:"카페",i:"☕"},{n:"호텔스 을지로",c:"바",i:"🍸"},{n:"을지OB베어 본점",c:"호프",i:"🍺"},
    {n:"을지로 인쇄골목",c:"거리",i:"📍"},{n:"스타벅스 을지로입구역점",c:"카페",i:"☕"},{n:"GS25 을지로3가역점",c:"편의점",i:"🏪"},
    {n:"CU 을지로점",c:"편의점",i:"🏪"},{n:"이디야 을지로점",c:"카페",i:"☕"},{n:"커피한약방",c:"카페",i:"☕"},
    {n:"을지로 철공소거리",c:"거리",i:"📍"},{n:"메가커피 을지로점",c:"카페",i:"☕"},{n:"을지면옥",c:"음식점",i:"🍽️"},
    {n:"양미옥 을지로점",c:"음식점",i:"🍽️"},{n:"을지다방",c:"카페",i:"☕"},{n:"올리브영 을지로점",c:"매장",i:"🛍️"},
    {n:"을지로 힙거리",c:"거리",i:"📍"},{n:"투썸플레이스 을지로점",c:"카페",i:"☕"}
  ]},
  "종로": {lat:37.5704,lng:126.9831,places:[
    {n:"광화문광장",c:"광장",i:"📍"},{n:"교보문고 광화문점",c:"서점",i:"📚"},{n:"인사동 쌈지길",c:"문화공간",i:"🎭"},
    {n:"북촌한옥마을",c:"관광",i:"🏘️"},{n:"익선동 한옥거리",c:"거리",i:"📍"},{n:"종로 피맛골",c:"거리",i:"🍽️"},
    {n:"스타벅스 광화문점",c:"카페",i:"☕"},{n:"탑골공원",c:"공원",i:"🌳"},{n:"GS25 종로3가역점",c:"편의점",i:"🏪"},
    {n:"CU 종로점",c:"편의점",i:"🏪"},{n:"이디야 종로3가점",c:"카페",i:"☕"},{n:"메가커피 종로점",c:"카페",i:"☕"},
    {n:"을지로입구역 롯데영플라자",c:"쇼핑몰",i:"🛍️"},{n:"종묘공원",c:"공원",i:"🌳"},{n:"인사동 전통찻집거리",c:"거리",i:"🍵"},
    {n:"올리브영 종로점",c:"매장",i:"🛍️"},{n:"낙원상가",c:"상가",i:"🎵"},{n:"서브웨이 종로점",c:"패스트푸드",i:"🍔"},
    {n:"투썸플레이스 광화문점",c:"카페",i:"☕"},{n:"세종문화회관",c:"문화공간",i:"🎭"}
  ]},
  "삼성역": {lat:37.5088,lng:127.0631,places:[
    {n:"코엑스몰",c:"쇼핑몰",i:"🛍️"},{n:"코엑스 별마당도서관",c:"도서관",i:"📚"},{n:"코엑스 아쿠아리움",c:"관광",i:"🐠"},
    {n:"메가박스 코엑스",c:"영화관",i:"🎬"},{n:"현대백화점 무역센터점",c:"백화점",i:"🛍️"},{n:"스타벅스 삼성역점",c:"카페",i:"☕"},
    {n:"파르나스타워",c:"오피스",i:"🏢"},{n:"위워크 삼성",c:"코워킹",i:"💼"},{n:"인터콘티넨탈 서울 코엑스",c:"호텔",i:"🏨"},
    {n:"봉은사",c:"사찰",i:"⛩️"},{n:"GS25 삼성역점",c:"편의점",i:"🏪"},{n:"CU 코엑스점",c:"편의점",i:"🏪"},
    {n:"이디야 삼성역점",c:"카페",i:"☕"},{n:"메가커피 삼성역점",c:"카페",i:"☕"},{n:"투썸플레이스 코엑스점",c:"카페",i:"☕"},
    {n:"올리브영 삼성역점",c:"매장",i:"🛍️"},{n:"맥도날드 코엑스점",c:"패스트푸드",i:"🍔"},{n:"서브웨이 코엑스점",c:"패스트푸드",i:"🍔"},
    {n:"다이소 코엑스점",c:"매장",i:"🛍️"},{n:"할리스 삼성역점",c:"카페",i:"☕"}
  ]},
  "판교": {lat:37.3948,lng:127.1112,places:[
    {n:"판교 테크노밸리",c:"오피스",i:"🏢"},{n:"네이버 1784",c:"오피스",i:"🏢"},{n:"카카오 판교오피스",c:"오피스",i:"🏢"},
    {n:"현대백화점 판교점",c:"백화점",i:"🛍️"},{n:"알파돔시티",c:"복합몰",i:"🛍️"},{n:"스타벅스 판교역점",c:"카페",i:"☕"},
    {n:"블루보틀 판교점",c:"카페",i:"☕"},{n:"CGV 판교",c:"영화관",i:"🎬"},{n:"이디야 판교역점",c:"카페",i:"☕"},
    {n:"메가커피 판교점",c:"카페",i:"☕"},{n:"GS25 판교역점",c:"편의점",i:"🏪"},{n:"CU 판교테크노밸리점",c:"편의점",i:"🏪"},
    {n:"위워크 판교",c:"코워킹",i:"💼"},{n:"패스트파이브 판교점",c:"코워킹",i:"💼"},{n:"투썸플레이스 판교점",c:"카페",i:"☕"},
    {n:"올리브영 판교점",c:"매장",i:"🛍️"},{n:"서브웨이 판교역점",c:"패스트푸드",i:"🍔"},{n:"맥도날드 판교점",c:"패스트푸드",i:"🍔"},
    {n:"다이소 판교점",c:"매장",i:"🛍️"},{n:"할리스 판교역점",c:"카페",i:"☕"}
  ]},
  "역삼동": {lat:37.5007,lng:127.0365,places:[
    {n:"마루180",c:"코워킹",i:"💼"},{n:"구글캠퍼스 서울",c:"코워킹",i:"💼"},{n:"팁스타운",c:"코워킹",i:"💼"},
    {n:"스타벅스 역삼역점",c:"카페",i:"☕"},{n:"블루보틀 역삼점",c:"카페",i:"☕"},{n:"GS타워",c:"오피스",i:"🏢"},
    {n:"이디야 역삼역점",c:"카페",i:"☕"},{n:"메가커피 역삼점",c:"카페",i:"☕"},{n:"GS25 역삼역점",c:"편의점",i:"🏪"},
    {n:"CU 역삼동점",c:"편의점",i:"🏪"},{n:"위워크 역삼",c:"코워킹",i:"💼"},{n:"패스트파이브 역삼점",c:"코워킹",i:"💼"},
    {n:"투썸플레이스 역삼역점",c:"카페",i:"☕"},{n:"올리브영 역삼역점",c:"매장",i:"🛍️"},{n:"맥도날드 역삼점",c:"패스트푸드",i:"🍔"},
    {n:"서브웨이 역삼역점",c:"패스트푸드",i:"🍔"},{n:"할리스 역삼역점",c:"카페",i:"☕"},{n:"다이소 역삼점",c:"매장",i:"🛍️"},
    {n:"역삼 먹자골목",c:"거리",i:"🍽️"},{n:"빽다방 역삼역점",c:"카페",i:"☕"}
  ]},
};

const AREAS = Object.entries(AREA_DATA).map(([name, d]) => ({ name, lat: d.lat, lng: d.lng }));

export default function App(){
  const [screen,setScreen]=useState("area");
  const [areaName,setAreaName]=useState("");
  const [places,setPlaces]=useState([]);
  const [selPlace,setSelPlace]=useState(null);
  const [msgs,setMsgs]=useState([]);
  const [inp,setInp]=useState("");
  const [myNick]=useState(rNick);
  const [myColor]=useState(()=>NC[Math.floor(Math.random()*NC.length)]);
  const [gpsStatus,setGpsStatus]=useState("idle");
  const [filter,setFilter]=useState("전체");
  const endRef=useRef(null);
  const inpRef=useRef(null);

  const pickArea=(name)=>{
    const data=AREA_DATA[name];
    if(!data)return;
    setAreaName(name);
    const ps=data.places.map((p,i)=>({
      id:`${name}-${i}`,name:p.n,category:p.c,icon:p.i,
      distLabel:`${Math.round(Math.random()*250+10)}m`,
      people:fPeople(p.n),
    }));
    setPlaces(ps);
    setFilter("전체");
    setScreen("places");
  };

  const tryGPS=()=>{
    if(!navigator.geolocation){setGpsStatus("failed");return}
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos=>{
        const {latitude:lat,longitude:lng}=pos.coords;
        let closest=AREAS[0],minD=Infinity;
        for(const a of AREAS){const d=Math.sqrt((a.lat-lat)**2+(a.lng-lng)**2);if(d<minD){minD=d;closest=a;}}
        setGpsStatus("success");
        pickArea(closest.name);
      },
      ()=>setGpsStatus("failed"),
      {enableHighAccuracy:true,timeout:10000}
    );
  };

  const enter=(p)=>{setSelPlace(p);setMsgs(fMsgs(p.name));setScreen("chat")};
  const send=()=>{if(!inp.trim())return;setMsgs(prev=>[{id:Date.now(),nick:myNick,text:inp.trim(),time:"방금",color:myColor,isMe:true},...prev]);setInp("");inpRef.current?.focus()};
  const kd=(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs]);

  const cats=["전체",...new Set(places.map(p=>p.category))];
  const filtered=filter==="전체"?places:places.filter(p=>p.category===filter);

  return(
    <div style={S.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.5);opacity:0}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes ripple{0%{box-shadow:0 0 0 0 rgba(255,107,107,.3)}100%{box-shadow:0 0 0 20px rgba(255,107,107,0)}}
        @keyframes dotBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes msgSlide{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
        input:focus{outline:none}::placeholder{color:#555}
        .pc{transition:all .15s ease}.pc:active{transform:scale(.97);background:#1a1a1a!important}
        .ab{transition:all .12s ease}.ab:active{transform:scale(.95);opacity:.7}
        .sb{transition:all .15s ease}.sb:active{transform:scale(.9)}
        ::-webkit-scrollbar{display:none}
      `}</style>

      {/* AREA SELECT */}
      {screen==="area"&&(
        <div style={{height:"100%",display:"flex",flexDirection:"column",background:"radial-gradient(circle at 50% 15%,#1a1210 0%,#0a0a0a 60%)",animation:"fadeIn .5s ease"}}>
          <div style={{padding:"40px 24px 16px",textAlign:"center"}}>
            <div style={S.logoMark}><div style={S.logoDot}/><div style={{...S.logoRing,animation:"pulse 1.5s ease-in-out infinite"}}/></div>
            <h1 style={S.logoText}>here.</h1>
            <p style={{fontSize:13,color:"#555",marginTop:4,letterSpacing:.5}}>지금, 여기 있는 사람들</p>
          </div>
          <div style={{padding:"0 20px 12px"}}>
            <button className="ab" onClick={tryGPS} style={{...S.gpsBtn,...(gpsStatus==="loading"?{opacity:.6}:{})}}>
              <span style={{fontSize:18}}>{gpsStatus==="loading"?"⏳":gpsStatus==="failed"?"⚠️":"📡"}</span>
              <span style={{flex:1,textAlign:"left"}}>{gpsStatus==="loading"?"위치 확인 중...":gpsStatus==="failed"?"GPS 사용 불가 — 아래에서 선택":"현재 위치로 찾기"}</span>
              <span style={{color:"#444"}}>→</span>
            </button>
          </div>
          <div style={{padding:"0 20px 6px"}}><p style={{fontSize:12,color:"#444",fontWeight:500}}>어디 계세요?</p></div>
          <div style={{flex:1,overflowY:"auto",padding:"0 20px 32px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {AREAS.map((a,i)=>(
                <button key={a.name} className="ab" style={{...S.areaCard,animationDelay:`${i*.025}s`}} onClick={()=>pickArea(a.name)}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PLACES */}
      {screen==="places"&&(
        <div style={{...S.screen,animation:"fadeIn .3s ease"}}>
          <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <button className="ab" onClick={()=>{setScreen("area");setGpsStatus("idle")}} style={{background:"none",border:"none",color:"#666",fontSize:12,cursor:"pointer",padding:"0 0 6px",fontFamily:"'Noto Sans KR',sans-serif"}}>← 지역 변경</button>
              <p style={{fontSize:12,color:"#FF6B6B",fontWeight:500,marginBottom:2}}>📍 {areaName}</p>
              <h2 style={{fontSize:24,fontWeight:700,color:"#fff"}}>주변 공간</h2>
              <p style={{fontSize:11,color:"#555",marginTop:2}}>{filtered.length}개 장소</p>
            </div>
            <div style={S.badge}><div style={{width:8,height:8,borderRadius:"50%",background:myColor}}/><span style={{fontSize:10,color:"#888"}}>{myNick}</span></div>
          </div>
          {/* Filter chips */}
          <div style={{padding:"10px 20px 4px",display:"flex",gap:6,overflowX:"auto",flexShrink:0}}>
            {cats.map(c=>(
              <button key={c} className="ab" onClick={()=>setFilter(c)} style={{padding:"5px 12px",borderRadius:16,border:filter===c?"1px solid #FF6B6B":"1px solid #222",background:filter===c?"#1a1212":"#111",color:filter===c?"#FF6B6B":"#888",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Noto Sans KR',sans-serif",flexShrink:0}}>{c}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px 16px"}}>
            {filtered.map((p,i)=>(
              <div key={p.id} className="pc" style={{...S.card,animationDelay:`${i*.04}s`}} onClick={()=>enter(p)}>
                <div style={S.cardIcon}>{p.icon}</div>
                <div style={{flex:1,marginLeft:12}}>
                  <div style={{fontSize:14,fontWeight:600,color:"#e8e8e8",marginBottom:3}}>{p.name}</div>
                  <div style={{display:"flex",gap:8}}><span style={{fontSize:11,color:"#666"}}>{p.category}</span><span style={{fontSize:11,color:"#555",fontWeight:300}}>{p.distLabel}</span></div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",position:"relative",minWidth:36}}>
                  <div style={{fontSize:16,fontWeight:700,color:"#FF6B6B",fontFamily:"'Space Mono',monospace"}}>{p.people}</div>
                  <div style={{fontSize:9,color:"#555",marginTop:-2}}>명</div>
                  {p.people>=7&&<div style={S.hotDot}/>}
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:"10px 20px 24px",textAlign:"center"}}><p style={{fontSize:12,color:"#444"}}>대화는 24시간 후 사라져요 💨</p></div>
        </div>
      )}

      {/* CHAT */}
      {screen==="chat"&&selPlace&&(
        <div style={S.screen}>
          <div style={{padding:"20px 16px 12px",display:"flex",alignItems:"center",borderBottom:"1px solid #151515",background:"rgba(10,10,10,.95)"}}>
            <button style={{background:"none",border:"none",color:"#FF6B6B",fontSize:22,cursor:"pointer",padding:"4px 12px 4px 0",fontFamily:"'Space Mono',monospace"}} onClick={()=>setScreen("places")}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8e8e8"}}>{selPlace.icon} {selPlace.name}</div>
              <div style={{fontSize:12,color:"#666",display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#4ECDC4",display:"inline-block",animation:"pulse 2s ease-in-out infinite"}}/>
                <span>{selPlace.people+1}명 접속 중 · {selPlace.distLabel}</span>
              </div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{textAlign:"center",padding:"12px 16px",background:"#111",borderRadius:12,fontSize:12,color:"#555",marginBottom:8,border:"1px solid #1a1a1a"}}><p>🔒 이 공간에 있는 사람만 참여할 수 있어요</p><p style={{marginTop:4,opacity:.5}}>대화는 자정에 사라집니다</p></div>
            {[...msgs].reverse().map(m=>(
              <div key={m.id} style={{maxWidth:"82%",...(m.isMe?{alignSelf:"flex-end"}:{}),animation:m.isMe?"msgSlide .2s ease":"none"}}>
                <div style={{display:"flex",alignItems:"center",fontSize:12,color:"#666",marginBottom:3,fontWeight:500,...(m.isMe?{justifyContent:"flex-end"}:{})}}>
                  {!m.isMe&&<><span style={{width:6,height:6,borderRadius:"50%",background:m.color,marginRight:6,flexShrink:0}}/>{m.nick}</>}
                  {m.isMe&&<>{m.nick}<span style={{width:6,height:6,borderRadius:"50%",background:m.color,marginLeft:6,flexShrink:0}}/></>}
                </div>
                <div style={{background:m.isMe?"#1a1212":"#151515",padding:"10px 14px",borderRadius:m.isMe?"14px 4px 14px 14px":"4px 14px 14px 14px",fontSize:14,lineHeight:1.5,color:"#d8d8d8",border:m.isMe?"1px solid #2a1a1a":"1px solid #1e1e1e"}}>{m.text}</div>
                <div style={{fontSize:10,color:"#444",marginTop:3,...(m.isMe?{textAlign:"right"}:{paddingLeft:2})}}>{m.time}</div>
              </div>
            ))}
            <div ref={endRef}/>
          </div>
          <div style={{padding:"10px 12px 24px",display:"flex",gap:8,alignItems:"center",borderTop:"1px solid #151515",background:"#0a0a0a"}}>
            <input ref={inpRef} style={S.input} placeholder="메시지를 입력하세요..." value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={kd}/>
            <button className="sb" style={{...S.sendBtn,opacity:inp.trim()?1:.3}} onClick={send}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

const S={
  container:{width:"100%",maxWidth:430,margin:"0 auto",height:"100vh",maxHeight:780,background:"#0a0a0a",fontFamily:"'Noto Sans KR',sans-serif",color:"#e8e8e8",position:"relative",overflow:"hidden",borderRadius:16,border:"1px solid #1a1a1a"},
  screen:{height:"100%",display:"flex",flexDirection:"column",background:"#0a0a0a"},
  logoMark:{position:"relative",width:52,height:52,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center"},
  logoDot:{width:14,height:14,borderRadius:"50%",background:"#FF6B6B",boxShadow:"0 0 20px rgba(255,107,107,.5)"},
  logoRing:{position:"absolute",width:38,height:38,borderRadius:"50%",border:"2px solid rgba(255,107,107,.3)"},
  logoText:{fontFamily:"'Space Mono',monospace",fontSize:34,fontWeight:700,color:"#fff",letterSpacing:-2},
  gpsBtn:{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:"#151515",border:"1px solid #222",borderRadius:14,color:"#e0e0e0",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"},
  areaCard:{padding:"14px 8px",background:"#111",border:"1px solid #1a1a1a",borderRadius:12,cursor:"pointer",textAlign:"center",fontFamily:"'Noto Sans KR',sans-serif",animation:"slideUp .3s ease both",fontSize:14,fontWeight:600,color:"#e0e0e0"},
  badge:{display:"flex",alignItems:"center",gap:6,background:"#151515",padding:"5px 10px",borderRadius:20,border:"1px solid #222",marginTop:4},
  card:{display:"flex",alignItems:"center",padding:"12px 14px",background:"#111",borderRadius:14,marginBottom:7,cursor:"pointer",border:"1px solid #1a1a1a",animation:"slideUp .35s ease both"},
  cardIcon:{fontSize:24,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",background:"#1a1a1a",borderRadius:12,flexShrink:0},
  hotDot:{position:"absolute",top:-2,right:0,width:6,height:6,borderRadius:"50%",background:"#FF6B6B",animation:"ripple 1.5s ease-in-out infinite"},
  input:{flex:1,background:"#151515",border:"1px solid #222",borderRadius:22,padding:"12px 18px",fontSize:14,color:"#e8e8e8",fontFamily:"'Noto Sans KR',sans-serif"},
  sendBtn:{width:40,height:40,borderRadius:"50%",background:"#FF6B6B",border:"none",color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Space Mono',monospace"},
};

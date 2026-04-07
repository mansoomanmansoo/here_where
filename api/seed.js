// 일회성 시드 데이터 삽입
// 호출: /api/seed?secret=luck2024
export const config = { regions: ['icn1'], maxDuration: 30 }

import { createClient } from '@supabase/supabase-js'

const SECRET = 'luck2024'

const GLOBAL_MESSAGES = [
  { nick: '행운의 펭귄', color: '#4ecdc4', text: '이 앱 완전 유용하다ㅋㅋ 주변 명당 다 나오네', minsAgo: 320 },
  { nick: '조용한 탐험가', color: '#ff6b6b', text: '저 지난주에 5등 당첨됐어요!! 5000원ㅋㅋ 그래도 맞은 거잖아요', minsAgo: 298 },
  { nick: '설레는 고양이', color: '#ffe66d', text: '명당에서 사면 진짜 더 잘 맞나요? 아니면 그냥 심리적인 건지', minsAgo: 276 },
  { nick: '빠른 수달', color: '#a8e6cf', text: '1218회 당첨번호 3 28 31 32 42 45 였죠? 하나도 안 맞았어요ㅠ', minsAgo: 261 },
  { nick: '느긋한 작업러', color: '#dda0dd', text: '번호 생성기로 뽑았는데 왠지 이번엔 느낌이 좋아요 ㅎㅎ', minsAgo: 247 },
  { nick: '야행성 코알라', color: '#87ceeb', text: '저는 매주 자동으로 사는데 언젠간 되겠죠 뭐 10년째 같은 말 하고 있음ㅋ', minsAgo: 235 },
  { nick: '익명의 산책러', color: '#f4a460', text: '강남쪽에 명당 있는 거 보이는데 실제로 가보신 분 있어요?', minsAgo: 220 },
  { nick: '행운의 펭귄', color: '#4ecdc4', text: '저 거기 가봤는데 사람 꽤 많던데요 줄 서서 사는 분들도 계셨어요', minsAgo: 215 },
  { nick: '지나가는 여행자', color: '#98d8c8', text: '오늘 퇴근하고 복권 사러 가야겠다 이번엔 진짜 예감이 다름', minsAgo: 198 },
  { nick: '설레는 고양이', color: '#ffe66d', text: '1등이 22억이 넘는다고요?? 그거 당첨되면 진짜 인생 바뀌겠다', minsAgo: 184 },
  { nick: '조용한 탐험가', color: '#ff6b6b', text: '저 친구가 3등 당첨된 적 있는데 150만원이라고 하더라고요. 그것도 부럽..', minsAgo: 171 },
  { nick: '느긋한 작업러', color: '#dda0dd', text: '여기 지도에서 핀 색깔 다른 게 명당이죠? 금색 왕관 달린 거요', minsAgo: 159 },
  { nick: '빠른 수달', color: '#a8e6cf', text: '맞아요 왕관 달린 건 이번 회차 1등 나온 곳이에요', minsAgo: 154 },
  { nick: '야행성 코알라', color: '#87ceeb', text: '아 그래서 지도에 표시되는 거구나. 이거 완전 꿀 기능이다', minsAgo: 142 },
  { nick: '익명의 산책러', color: '#f4a460', text: '근처에 명당이 없어서 슬프다ㅠ 지방은 상대적으로 적은 것 같아요', minsAgo: 130 },
  { nick: '행운의 펭귄', color: '#4ecdc4', text: '저도 번호 생성기 써봤는데 애니메이션이 귀엽네요ㅋㅋ', minsAgo: 118 },
  { nick: '지나가는 여행자', color: '#98d8c8', text: '매주 사는데 가장 힘든 건 기다리는 거 같아요. 토요일 저녁이 제일 설렘', minsAgo: 104 },
  { nick: '설레는 고양이', color: '#ffe66d', text: '맞아요ㅋㅋ 토요일 8시 45분 이후로 결과 보는 그 짧은 순간', minsAgo: 96 },
  { nick: '조용한 탐험가', color: '#ff6b6b', text: '저는 당첨되면 제일 먼저 부모님한테 드릴 거예요', minsAgo: 83 },
  { nick: '느긋한 작업러', color: '#dda0dd', text: '저도요ㅠㅠ 그냥 생각만 해도 눈물날 것 같음', minsAgo: 75 },
  { nick: '빠른 수달', color: '#a8e6cf', text: '이번 1219회는 꼭 한 장이라도 사야겠다', minsAgo: 62 },
  { nick: '야행성 코알라', color: '#87ceeb', text: '저는 오늘 앱에서 번호 뽑아서 그대로 살 거예요. 운명에 맡기는 거죠 ㅎ', minsAgo: 51 },
  { nick: '익명의 산책러', color: '#f4a460', text: '다들 이번 주 행운 가져가세요!! 여기서 같이 기원해봐요', minsAgo: 38 },
  { nick: '행운의 펭귄', color: '#4ecdc4', text: '굿럭굿럭🍀 다같이 한 번씩은 당첨되는 주가 되길', minsAgo: 24 },
  { nick: '지나가는 여행자', color: '#98d8c8', text: '오늘도 한 장. 꿈은 공짜니까요ㅎㅎ', minsAgo: 11 },
  { nick: '설레는 고양이', color: '#ffe66d', text: '명당은 멀리 있지 않다... 이 말 진짜 맞는 것 같아요', minsAgo: 4 },
]

export default async function handler(req, res) {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: '인증 필요' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_KEY
  )

  const now = Date.now()

  // ── 방문자 시드 (오늘 하루 자연스럽게 분산) ──
  // 오전 7시부터 현재까지 80명
  const visitRows = []
  const todayStart = new Date()
  todayStart.setHours(7, 0, 0, 0)
  const totalMinutes = Math.floor((now - todayStart.getTime()) / 60000)

  for (let i = 0; i < 80; i++) {
    const minsAgo = Math.floor(Math.random() * Math.max(totalMinutes, 1))
    visitRows.push({ visited_at: new Date(now - minsAgo * 60000).toISOString() })
  }
  const { error: visitErr } = await supabase.from('visits').insert(visitRows)

  // ── 전체 채팅 시드 ──
  const msgRows = GLOBAL_MESSAGES.map(m => ({
    place_id: 'global::all',
    nick: m.nick,
    color: m.color,
    text: m.text,
    type: 'message',
    created_at: new Date(now - m.minsAgo * 60000).toISOString(),
  }))
  const { error: msgErr } = await supabase.from('messages').insert(msgRows)

  return res.status(200).json({
    visits: visitErr ? visitErr.message : `${visitRows.length}개 삽입`,
    messages: msgErr ? msgErr.message : `${msgRows.length}개 삽입`,
  })
}

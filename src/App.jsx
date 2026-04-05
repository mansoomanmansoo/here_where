import React, { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from './lib/supabase'

// ── Constants ──────────────────────────────────────────────
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#dda0dd', '#87ceeb', '#f4a460', '#98d8c8']
const VIBE_OPTIONS = ['한산해요', '보통이에요', '혼잡해요']
const QUICK_UPDATES_BY_CATEGORY = {
  '카페':       ['자리 있어요', '자리 없어요', '콘센트 있어요', '와이파이 빨라요', '웨이팅 있어요', '조용해요', '시끄러워요', '주문 밀려요'],
  '패스트푸드': ['자리 있어요', '자리 없어요', '웨이팅 있어요', '빠르게 나와요', '혼잡해요'],
  '공원':       ['사람 많아요', '한산해요', '자리 넉넉해요', '그늘 있어요', '날씨 좋아요'],
  '쇼핑몰':     ['웨이팅 있어요', '한산해요', '주차 여유 있어요', '푸드코트 혼잡해요', '에스컬레이터 막혀요'],
  '백화점':     ['웨이팅 있어요', '한산해요', '세일 중이에요', '주차 혼잡해요', '푸드코트 기다려요'],
  '코워킹':     ['자리 있어요', '자리 없어요', '조용해요', '사람 많아요', '와이파이 빨라요'],
  '문화공간':   ['입장 대기 있어요', '한산해요', '전시 볼만해요', '사람 많아요'],
  '광장':       ['공연 중이에요', '한산해요', '사람 많아요', '날씨 좋아요'],
  '갤러리':     ['한산해요', '사람 많아요', '웨이팅 있어요', '전시 좋아요'],
  '서점':       ['조용해요', '사람 많아요', '자리 있어요'],
  '오피스':     ['로비 혼잡해요', '카페 자리 있어요', '조용해요'],
  '매장':       ['웨이팅 있어요', '한산해요', '피팅룸 기다려요', '신상 나왔어요'],
  '스포츠':     ['경기 중이에요', '매진됐어요', '입장 대기 있어요', '주변 혼잡해요'],
}
const QUICK_UPDATES_DEFAULT = ['자리 있어요', '웨이팅 있어요', '한산해요', '혼잡해요', '추천해요']
const BANNED_WORDS = ['광고', '홍보', '카톡', '텔레그램', '연락처', '전화번호']
const RATE_LIMIT_MS = 8000
const MAX_MSG_LEN = 160
const TTL_MS = 24 * 60 * 60 * 1000

const AREA_DATA = {
  강남역: {
    lat: 37.4979, lng: 127.0276,
    places: [
      { n: '스타벅스 강남역점', c: '카페', i: '☕', preview: '노트북 작업 비중이 높고 회전이 빠른 편' },
      { n: '교보문고 강남점', c: '서점', i: '📚', preview: '약속 전 잠깐 머무르기 좋은 정적 공간' },
      { n: '패스트파이브 강남역점', c: '코워킹', i: '💼', preview: '업무/미팅 유저가 많은 공간' },
      { n: '맥도날드 강남점', c: '패스트푸드', i: '🍔', preview: '회전율이 높고 짧은 체류에 적합' },
    ],
  },
  성수동: {
    lat: 37.5445, lng: 127.0557,
    places: [
      { n: '대림창고갤러리', c: '갤러리', i: '🎨', preview: '사람 구경하기 좋은 인기 스팟' },
      { n: '블루보틀 성수점', c: '카페', i: '☕', preview: '짧은 작업 + 커피 수요가 많은 곳' },
      { n: '서울숲', c: '공원', i: '🌳', preview: '산책 동선이 자연스럽게 이어지는 곳' },
      { n: '무신사 스탠다드 성수', c: '매장', i: '🛍️', preview: '쇼핑 동선 공유에 적합' },
    ],
  },
  여의도: {
    lat: 37.5219, lng: 126.9245,
    places: [
      { n: '더현대 서울', c: '백화점', i: '🛍️', preview: '주말 체류가 길고 인파가 많음' },
      { n: '여의도 한강공원', c: '공원', i: '🌳', preview: '산책과 피크닉 실시간 정보 수요가 큼' },
      { n: '스타벅스 IFC몰점', c: '카페', i: '☕', preview: '평일 점심 이후 혼잡도가 높음' },
      { n: '패스트파이브 여의도점', c: '코워킹', i: '💼', preview: '업무형 커뮤니티에 적합' },
    ],
  },
  홍대입구: {
    lat: 37.5563, lng: 126.9236,
    places: [
      { n: 'AK&홍대', c: '쇼핑몰', i: '🛍️', preview: '약속 대기/합류 지점으로 자주 쓰임' },
      { n: '상상마당', c: '문화공간', i: '🎭', preview: '행사/전시 정보 공유 수요가 큼' },
      { n: '스타벅스 홍대입구역점', c: '카페', i: '☕', preview: '회전율 높고 자리 문의가 많음' },
      { n: '홍대 놀이터', c: '광장', i: '📍', preview: '길거리 공연/모임 분위기 공유에 적합' },
    ],
  },
  잠실: {
    lat: 37.5133, lng: 127.1001,
    places: [
      { n: '롯데월드몰', c: '쇼핑몰', i: '🛍️', preview: '층별 혼잡도와 식당 웨이팅 공유용' },
      { n: '석촌호수', c: '공원', i: '🌳', preview: '데이트/산책 사용자 비중이 큼' },
      { n: '스타벅스 잠실역점', c: '카페', i: '☕', preview: '짧은 미팅/대기 수요가 높음' },
      { n: '잠실야구장', c: '스포츠', i: '⚾', preview: '경기 전후 유저가 몰리는 곳' },
    ],
  },
  판교: {
    lat: 37.3948, lng: 127.1112,
    places: [
      { n: '네이버 1784', c: '오피스', i: '🏢', preview: '업무형/테크 사용자 대화에 적합' },
      { n: '현대백화점 판교점', c: '백화점', i: '🛍️', preview: '가족 단위 유동 인구가 많음' },
      { n: '블루보틀 판교점', c: '카페', i: '☕', preview: '짧은 집중 작업에 적합' },
      { n: '위워크 판교', c: '코워킹', i: '💼', preview: '업무/네트워킹 수요가 높음' },
    ],
  },
  강동: {
    lat: 37.5301, lng: 127.1238,
    places: [
      { n: '롯데백화점 강동점', c: '백화점', i: '🛍️', preview: '천호역 직결, 강동 최대 쇼핑 허브' },
      { n: '천호역 먹자골목', c: '먹자골목', i: '🍜', preview: '다양한 식당이 밀집한 강동 대표 먹거리 거리' },
      { n: '암사한강공원', c: '공원', i: '🌳', preview: '한강변 산책과 피크닉 명소, 주말 인파 많음' },
      { n: '강동아트센터', c: '문화공간', i: '🎭', preview: '공연·전시 상시 운영, 문화생활 수요 높음' },
      { n: '고덕천 산책로', c: '공원', i: '🚶', preview: '고덕동 주민 산책 코스, 조용한 하천변' },
      { n: '이마트 천호점', c: '쇼핑몰', i: '🛒', preview: '생필품·식품 중심, 주말 장보기 수요 집중' },
      { n: '스타벅스 강동구청역점', c: '카페', i: '☕', preview: '강동구청 인근 직장인 수요가 높은 카페' },
      { n: '명일근린공원', c: '공원', i: '🌿', preview: '명일동 조용한 숲 공원, 가족 단위 방문 많음' },
    ],
  },
}

const AREAS = Object.entries(AREA_DATA).map(([name, v]) => ({ name, lat: v.lat, lng: v.lng }))

// ── Utilities ──────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function randomNick() {
  const a = ['익명의', '조용한', '지나가는', '호기심많은', '배고픈', '느긋한', '빠른', '카페인', '야행성', '따뜻한']
  const b = ['고양이', '수달', '펭귄', '여행자', '작업러', '산책러', '탐험가', '메모광', '아기상어', '코알라']
  return `${pick(a)} ${pick(b)}`
}

function relativeTime(ts) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

function placeId(areaName, placeName) {
  return `${areaName}::${placeName}`
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const r = 6371e3
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2
  return r * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function stableRand(seed, min, max) {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (Math.imul(33, h) ^ seed.charCodeAt(i)) >>> 0
  return min + (h % (max - min + 1))
}

function getIdentity() {
  try {
    const s = sessionStorage.getItem('here_id')
    if (s) return JSON.parse(s)
  } catch {}
  const id = { nick: randomNick(), color: pick(COLORS) }
  try { sessionStorage.setItem('here_id', JSON.stringify(id)) } catch {}
  return id
}

function ttlDate() {
  return new Date(Date.now() - TTL_MS).toISOString()
}

// ── App ────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('area')
  const [areaName, setAreaName] = useState('')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [messages, setMessages] = useState([])
  const [updates, setUpdates] = useState([])
  const [vibeVotes, setVibeVotes] = useState({})
  const [summaries, setSummaries] = useState({})
  const [messageInput, setMessageInput] = useState('')
  const [notice, setNotice] = useState('')
  const [gpsState, setGpsState] = useState('idle')
  const [locationInfo, setLocationInfo] = useState(null)
  const [lastSentAt, setLastSentAt] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [myVibe, setMyVibe] = useState('')
  const [loading, setLoading] = useState(false)

  const identity = useMemo(() => getIdentity(), [])
  const { nick: myNick, color: myColor } = identity
  const endRef = useRef(null)
  const realtimeRef = useRef(null)

  // ── Toast ──
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  // ── Scroll to bottom ──
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Cooldown countdown ──
  useEffect(() => {
    if (!lastSentAt) return
    const update = () => setCooldownLeft(Math.max(0, Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSentAt)) / 1000)))
    update()
    const t = setInterval(update, 500)
    return () => clearInterval(t)
  }, [lastSentAt])

  // ── Load summaries when area chosen ──
  useEffect(() => {
    if (!areaName) return
    loadSummaries(areaName)
  }, [areaName])

  // ── Subscribe to place on enter ──
  useEffect(() => {
    if (!selectedPlace) return

    loadPlaceData(selectedPlace.id)

    realtimeRef.current = supabase
      .channel(`room:${selectedPlace.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `place_id=eq.${selectedPlace.id}` },
        ({ new: msg }) => {
          if (new Date(msg.created_at).getTime() < Date.now() - TTL_MS) return
          if (msg.nick === myNick) return // 이미 optimistic update로 추가됨
          if (msg.type === 'update') {
            setUpdates((prev) => [msg, ...prev].slice(0, 8))
          } else {
            setMessages((prev) => [...prev, msg])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vibe_votes', filter: `place_id=eq.${selectedPlace.id}` },
        ({ new: vote }) => {
          setVibeVotes((prev) => ({ ...prev, [vote.label]: (prev[vote.label] || 0) + 1 }))
        }
      )
      .subscribe()

    return () => {
      realtimeRef.current?.unsubscribe()
    }
  }, [selectedPlace, myNick])

  // ── Deep link ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const area = params.get('area')
    const place = params.get('place')
    if (area && AREA_DATA[area]) {
      setAreaName(area)
      if (place) {
        const found = AREA_DATA[area].places.find((p) => p.n === place)
        if (found) {
          setSelectedPlace({ id: placeId(area, found.n), name: found.n, category: found.c, icon: found.i, preview: found.preview })
          setScreen('chat')
          return
        }
      }
      setScreen('places')
    }
  }, [])

  // ── Data fetching ──
  async function loadSummaries(area) {
    const ids = AREA_DATA[area].places.map((p) => placeId(area, p.n))
    try {
      const [{ data: msgs }, { data: votes }] = await Promise.all([
        supabase.from('messages').select('place_id, text, type, created_at').in('place_id', ids).gt('created_at', ttlDate()).order('created_at', { ascending: false }),
        supabase.from('vibe_votes').select('place_id, label').in('place_id', ids).gt('created_at', ttlDate()),
      ])

      const result = {}
      ids.forEach((pid) => {
        const pidMsgs = (msgs || []).filter((m) => m.place_id === pid && m.type === 'message')
        const pidVotes = (votes || []).filter((v) => v.place_id === pid)
        const voteCounts = {}
        pidVotes.forEach((v) => { voteCounts[v.label] = (voteCounts[v.label] || 0) + 1 })
        const topVibe = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
        result[pid] = {
          msgCount: pidMsgs.length,
          lastMsg: pidMsgs[0]?.text || null,
          topVibe,
          activity: pidMsgs.length + pidVotes.length,
        }
      })
      setSummaries(result)
    } catch {}
  }

  async function loadPlaceData(pid) {
    setLoading(true)
    try {
      const [{ data: msgs }, { data: votes }] = await Promise.all([
        supabase.from('messages').select('*').eq('place_id', pid).gt('created_at', ttlDate()).order('created_at', { ascending: true }),
        supabase.from('vibe_votes').select('label').eq('place_id', pid).gt('created_at', ttlDate()),
      ])
      setMessages((msgs || []).filter((m) => m.type === 'message'))
      setUpdates((msgs || []).filter((m) => m.type === 'update').reverse().slice(0, 8))
      const counts = {}
      ;(votes || []).forEach((v) => { counts[v.label] = (counts[v.label] || 0) + 1 })
      setVibeVotes(counts)
    } catch {
      setNotice('데이터를 불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }

  // ── Actions ──
  function chooseArea(name) {
    setAreaName(name)
    setScreen('places')
  }

  function tryGPS() {
    if (!navigator.geolocation) { setNotice('GPS를 사용할 수 없어요.'); return }
    setGpsState('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        let nearest = AREAS[0], min = Infinity
        for (const area of AREAS) {
          const d = distanceMeters(latitude, longitude, area.lat, area.lng)
          if (d < min) { min = d; nearest = area }
        }
        setLocationInfo({ latitude, longitude, nearest: nearest.name, distance: Math.round(min) })
        setGpsState('success')
        chooseArea(nearest.name)
        setNotice(`${nearest.name} 근처로 입장했어요.`)
      },
      () => { setGpsState('failed'); setNotice('위치를 가져오지 못했어요. 지역을 직접 선택해 주세요.') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function enterPlace(place) {
    setMessages([])
    setUpdates([])
    setVibeVotes({})
    setMyVibe('')
    setMessageInput('')
    setSelectedPlace(place)
    setScreen('chat')
  }

  async function send(text, type = 'message') {
    const trimmed = text.trim().slice(0, MAX_MSG_LEN)
    if (!trimmed) { setNotice('내용을 입력해 주세요.'); return }
    if (BANNED_WORDS.some((w) => trimmed.includes(w))) { setNotice('금칙어가 포함되어 있어요.'); return }
    if (Date.now() - lastSentAt < RATE_LIMIT_MS) { setNotice(`${cooldownLeft}초 후에 전송할 수 있어요.`); return }

    const msg = { place_id: selectedPlace.id, nick: myNick, color: myColor, text: trimmed, type }

    // Optimistic update
    if (type === 'message') {
      setMessages((prev) => [...prev, { ...msg, id: 'tmp-' + Date.now(), created_at: new Date().toISOString() }])
      setMessageInput('')
    } else {
      setUpdates((prev) => [{ ...msg, id: 'tmp-' + Date.now(), created_at: new Date().toISOString() }, ...prev].slice(0, 8))
      setNotice('현장 정보가 반영됐어요.')
    }

    setLastSentAt(Date.now())
    const { error } = await supabase.from('messages').insert(msg)
    if (error) {
      setNotice('전송에 실패했어요.')
      if (type === 'message') setMessages((prev) => prev.filter((m) => !m.id.startsWith('tmp-')))
    }
  }

  async function voteVibe(label) {
    if (!selectedPlace || myVibe) return
    setMyVibe(label)
    setVibeVotes((prev) => ({ ...prev, [label]: (prev[label] || 0) + 1 }))
    const { error } = await supabase.from('vibe_votes').insert({ place_id: selectedPlace.id, label })
    if (error) {
      setMyVibe('')
      setVibeVotes((prev) => ({ ...prev, [label]: Math.max(0, (prev[label] || 1) - 1) }))
      setNotice('투표에 실패했어요.')
    }
  }

  function shareRoom() {
    const url = `${window.location.origin}${window.location.pathname}?area=${encodeURIComponent(areaName)}&place=${encodeURIComponent(selectedPlace.name)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setNotice('공유 링크를 복사했어요.')
  }

  // ── Derived ──
  const sortedPlaces = useMemo(() => {
    if (!areaName) return []
    return AREA_DATA[areaName].places
      .map((p) => {
        const pid = placeId(areaName, p.n)
        return { id: pid, name: p.n, category: p.c, icon: p.i, preview: p.preview, ...(summaries[pid] || {}) }
      })
      .sort((a, b) => (b.activity || 0) - (a.activity || 0))
  }, [areaName, summaries])

  const totalVotes = Object.values(vibeVotes).reduce((a, b) => a + b, 0)

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="app-shell">
      <div className="phone-frame">
        {notice && <div className="toast">{notice}</div>}

        {/* ── AREA SCREEN ── */}
        {screen === 'area' && (
          <section className="screen fade-in">
            <div className="hero">
              <div className="logo-badge">●</div>
              <h1>here.</h1>
              <p>지금 이 장소, 진짜 어때?</p>
            </div>

            <div className="panel sticky-panel">
              <button
                className="primary-btn"
                style={{ width: '100%', marginBottom: 10 }}
                onClick={tryGPS}
                disabled={gpsState === 'loading'}
              >
                {gpsState === 'loading' ? '위치 확인 중...' : gpsState === 'success' ? '위치 인식 완료 ✓' : '📍 현재 위치로 시작'}
              </button>
              <div className="helper-row">
                <span>내 익명 닉네임</span>
                <strong style={{ color: myColor }}>{myNick}</strong>
              </div>
              {locationInfo && (
                <div className="mini-note">
                  <strong>{locationInfo.nearest}</strong> 근처 · 약 {locationInfo.distance.toLocaleString()}m
                </div>
              )}
            </div>

            <div className="section-title"><span>지역 선택</span></div>
            <div className="grid-cards">
              {AREAS.map((area) => (
                <button key={area.name} className="area-card" onClick={() => chooseArea(area.name)}>
                  <div>{area.name}</div>
                  <small>{AREA_DATA[area.name].places.length}개 공간</small>
                </button>
              ))}
            </div>

            <div className="panel" style={{ marginTop: 8, textAlign: 'center', padding: '14px 16px' }}>
              <p style={{ margin: 0, color: '#9a9ea9', fontSize: 13 }}>
                지금 여기 있는 사람들의 실시간 현장 정보.<br />
                익명으로 한 줄 남기고, 같이 공유해요.
              </p>
            </div>
          </section>
        )}

        {/* ── PLACES SCREEN ── */}
        {screen === 'places' && (
          <section className="screen fade-in">
            <div className="top-bar">
              <button className="ghost-link" onClick={() => setScreen('area')}>← 지역 변경</button>
              <span className="status-chip"><i style={{ background: myColor }} /> {myNick}</span>
            </div>

            <div className="title-block">
              <span className="eyebrow">📍 {areaName}</span>
              <h2>지금 어때요?</h2>
              <p>실시간으로 현장 분위기를 확인하세요.</p>
            </div>

            <div className="list-stack">
              {sortedPlaces.map((place) => (
                <button key={place.id} className="place-card" onClick={() => enterPlace(place)}>
                  <div className="place-main">
                    <div className="place-icon">{place.icon}</div>
                    <div className="place-copy">
                      <div className="place-head">
                        <strong>{place.name}</strong>
                        {place.topVibe && <span className="mini-tag">{place.topVibe}</span>}
                      </div>
                      {place.lastMsg
                        ? <p style={{ color: '#c8cdd8', fontStyle: 'italic' }}>"{place.lastMsg}"</p>
                        : <p>{place.preview}</p>
                      }
                      <div className="meta-row">
                        <span>{place.category}</span>
                        <span style={{ color: place.msgCount > 0 ? '#4ecdc4' : '#6b6f7a' }}>
                          {place.msgCount > 0 ? `💬 ${place.msgCount}개 대화 중` : '아직 조용해요'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── CHAT SCREEN ── */}
        {screen === 'chat' && selectedPlace && (
          <section className="screen fade-in">
            <div className="top-bar border-bottom">
              <button className="ghost-link" onClick={() => { setScreen('places'); loadSummaries(areaName) }}>← 목록</button>
              <button className="ghost-link" onClick={shareRoom}>공유</button>
            </div>

            <div className="title-block compact">
              <span className="eyebrow">{selectedPlace.icon} {selectedPlace.category}</span>
              <h2>{selectedPlace.name}</h2>
              <p>{selectedPlace.preview}</p>
            </div>

            {/* 분위기 투표 */}
            <div className="panel">
              <div className="section-title inner">
                <span>지금 어때요?</span>
                {totalVotes > 0 && <small style={{ color: '#9296a3' }}>{totalVotes}명 응답</small>}
              </div>
              <div className="chips-row" style={{ justifyContent: 'space-between' }}>
                {VIBE_OPTIONS.map((label) => {
                  const count = vibeVotes[label] || 0
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                  const isSelected = myVibe === label
                  return (
                    <button
                      key={label}
                      className={`chip vibe-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => voteVibe(label)}
                      disabled={!!myVibe}
                      style={{ flex: 1, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                    >
                      {totalVotes > 0 && (
                        <span
                          style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${pct}%`, background: 'rgba(255,107,107,0.12)',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      )}
                      <span style={{ position: 'relative' }}>
                        {label}
                        {totalVotes > 0 && <b style={{ marginLeft: 4 }}>{pct}%</b>}
                      </span>
                    </button>
                  )
                })}
              </div>
              {!myVibe && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b6f7a', textAlign: 'center' }}>탭해서 투표하기</p>}
            </div>

            {/* 한 줄 현장 정보 */}
            <div className="panel">
              <div className="section-title inner"><span>한 줄 현장 정보</span></div>
              <div className="chips-row wrap">
                {(QUICK_UPDATES_BY_CATEGORY[selectedPlace?.category] || QUICK_UPDATES_DEFAULT).map((label) => (
                  <button key={label} className="chip" onClick={() => send(label, 'update')}>{label}</button>
                ))}
              </div>
              {updates.length > 0 && (
                <div className="activity-feed" style={{ marginTop: 10 }}>
                  {updates.map((u) => (
                    <div key={u.id} className="activity-row">
                      <span className="dot" style={{ background: u.color }} />
                      <div>
                        <strong>{u.text}</strong>
                        <small>{u.nick} · {relativeTime(u.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 익명 대화 */}
            <div className="panel chat-panel">
              <div className="section-title inner">
                <span>익명 대화</span>
                <small style={{ color: '#9296a3' }}>24시간 후 자동 삭제</small>
              </div>

              {loading && <p style={{ textAlign: 'center', color: '#6b6f7a', padding: '20px 0' }}>불러오는 중...</p>}

              {!loading && messages.length === 0 && (
                <p style={{ textAlign: 'center', color: '#6b6f7a', padding: '20px 0', fontSize: 14 }}>
                  아직 아무도 없어요.<br />첫 번째로 분위기 알려주세요!
                </p>
              )}

              <div className="chat-messages">
                {messages.map((msg) => {
                  const isMe = msg.nick === myNick
                  return (
                    <div key={msg.id} className={`chat-row ${isMe ? 'chat-row--me' : 'chat-row--other'}`}>
                      {!isMe && (
                        <span className="chat-avatar" style={{ background: msg.color }} />
                      )}
                      <div className="chat-bubble-wrap">
                        {!isMe && <span className="chat-nick">{msg.nick}</span>}
                        <div className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--other'}`}>
                          {msg.text}
                        </div>
                        <span className="chat-time">{relativeTime(msg.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              <div className="input-area">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="지금 여기 분위기 어때요? 익명으로 남겨보세요."
                  maxLength={MAX_MSG_LEN}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      send(messageInput)
                    }
                  }}
                />
                <div className="input-footer">
                  <small>
                    {messageInput.length}/{MAX_MSG_LEN}
                    {cooldownLeft > 0 && <span style={{ color: '#ff8a8a', marginLeft: 6 }}>· {cooldownLeft}초</span>}
                  </small>
                  <button className="primary-btn" onClick={() => send(messageInput)} disabled={cooldownLeft > 0}>
                    보내기
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

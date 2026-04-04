import React, { useEffect, useMemo, useRef, useState } from 'react'

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#dda0dd', '#87ceeb', '#f4a460', '#98d8c8']
const STATUS_OPTIONS = ['자리 여유', '조용함', '작업하기 좋음', '대화 활발', '웨이팅 있음', '콘센트 적음']
const QUICK_UPDATES = ['자리 있어요', '웨이팅 10분+', '2층이 조용해요', '콘센트 있어요', '와이파이 느려요', '디저트 맛있어요']
const TOPIC_OPTIONS = ['카페', '맛집', '작업', '웨이팅', '분위기', '질문']
const BANNED_WORDS = ['광고', '홍보', '카톡', '텔레그램', '연락처', '전화번호', '도배']
const LIVE_TEMPLATES = [
  '자리 조금 생겼어요', '지금 꽤 조용해요', '사람 많아졌어요', '분위기 좋아요',
  '콘센트 자리 있어요', '웨이팅 줄었어요', '주문 금방 나와요', '2층 자리 있어요',
  '지금 꽤 혼잡해요', '에어컨 시원해요', '테라스 자리 남았어요',
]
const MESSAGE_TTL = 24 * 60 * 60 * 1000
const RATE_LIMIT_MS = 8000
const MAX_MSG_LEN = 160
const STORAGE_KEY = 'here_pro_v1'
const CHANNEL_NAME = 'here_live_channel'
const SIM_INTERVAL = 20000

const AREA_DATA = {
  강남역: {
    lat: 37.4979, lng: 127.0276,
    places: [
      { n: '스타벅스 강남역점', c: '카페', i: '☕', vibe: ['자리 여유', '작업하기 좋음'], preview: '노트북 작업 비중이 높고 회전이 빠른 편' },
      { n: '교보문고 강남점', c: '서점', i: '📚', vibe: ['조용함'], preview: '약속 전 잠깐 머무르기 좋은 정적 공간' },
      { n: '패스트파이브 강남역점', c: '코워킹', i: '💼', vibe: ['작업하기 좋음'], preview: '업무/미팅 유저가 많은 공간' },
      { n: '맥도날드 강남점', c: '패스트푸드', i: '🍔', vibe: ['대화 활발'], preview: '회전율이 높고 짧은 체류에 적합' },
    ],
  },
  성수동: {
    lat: 37.5445, lng: 127.0557,
    places: [
      { n: '대림창고갤러리', c: '갤러리', i: '🎨', vibe: ['대화 활발'], preview: '사람 구경하기 좋은 인기 스팟' },
      { n: '블루보틀 성수점', c: '카페', i: '☕', vibe: ['작업하기 좋음'], preview: '짧은 작업 + 커피 수요가 많은 곳' },
      { n: '서울숲', c: '공원', i: '🌳', vibe: ['자리 여유'], preview: '산책 동선이 자연스럽게 이어지는 곳' },
      { n: '무신사 스탠다드 성수', c: '매장', i: '🛍️', vibe: ['대화 활발'], preview: '쇼핑 동선 공유에 적합' },
    ],
  },
  여의도: {
    lat: 37.5219, lng: 126.9245,
    places: [
      { n: '더현대 서울', c: '백화점', i: '🛍️', vibe: ['대화 활발'], preview: '주말 체류가 길고 인파가 많음' },
      { n: '여의도 한강공원', c: '공원', i: '🌳', vibe: ['자리 여유'], preview: '산책과 피크닉 실시간 정보 수요가 큼' },
      { n: '스타벅스 IFC몰점', c: '카페', i: '☕', vibe: ['웨이팅 있음'], preview: '평일 점심 이후 혼잡도가 높음' },
      { n: '패스트파이브 여의도점', c: '코워킹', i: '💼', vibe: ['작업하기 좋음'], preview: '업무형 커뮤니티에 적합' },
    ],
  },
  홍대입구: {
    lat: 37.5563, lng: 126.9236,
    places: [
      { n: 'AK&홍대', c: '쇼핑몰', i: '🛍️', vibe: ['대화 활발'], preview: '약속 대기/합류 지점으로 자주 쓰임' },
      { n: '상상마당', c: '문화공간', i: '🎭', vibe: ['대화 활발'], preview: '행사/전시 정보 공유 수요가 큼' },
      { n: '스타벅스 홍대입구역점', c: '카페', i: '☕', vibe: ['웨이팅 있음'], preview: '회전율 높고 자리 문의가 많음' },
      { n: '홍대 놀이터', c: '광장', i: '📍', vibe: ['자리 여유'], preview: '길거리 공연/모임 분위기 공유에 적합' },
    ],
  },
  잠실: {
    lat: 37.5133, lng: 127.1001,
    places: [
      { n: '롯데월드몰', c: '쇼핑몰', i: '🛍️', vibe: ['대화 활발'], preview: '층별 혼잡도와 식당 웨이팅 공유용' },
      { n: '석촌호수', c: '공원', i: '🌳', vibe: ['자리 여유'], preview: '데이트/산책 사용자 비중이 큼' },
      { n: '스타벅스 잠실역점', c: '카페', i: '☕', vibe: ['웨이팅 있음'], preview: '짧은 미팅/대기 수요가 높음' },
      { n: '잠실야구장', c: '스포츠', i: '⚾', vibe: ['대화 활발'], preview: '경기 전후 유저가 몰리는 곳' },
    ],
  },
  판교: {
    lat: 37.3948, lng: 127.1112,
    places: [
      { n: '네이버 1784', c: '오피스', i: '🏢', vibe: ['작업하기 좋음'], preview: '업무형/테크 사용자 대화에 적합' },
      { n: '현대백화점 판교점', c: '백화점', i: '🛍️', vibe: ['대화 활발'], preview: '가족 단위 유동 인구가 많음' },
      { n: '블루보틀 판교점', c: '카페', i: '☕', vibe: ['조용함'], preview: '짧은 집중 작업에 적합' },
      { n: '위워크 판교', c: '코워킹', i: '💼', vibe: ['작업하기 좋음'], preview: '업무/네트워킹 수요가 높음' },
    ],
  },
}

const AREAS = Object.entries(AREA_DATA).map(([name, v]) => ({ name, lat: v.lat, lng: v.lng }))

const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => Date.now()
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Hash-based stable pseudo-random — prevents values from jumping on re-render
function stableRand(seed, min, max) {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (Math.imul(33, h) ^ seed.charCodeAt(i)) >>> 0
  return min + (h % (max - min + 1))
}

function randomNick() {
  const a = ['익명의', '조용한', '지나가는', '호기심많은', '배고픈', '느긋한', '빠른', '카페인', '야행성', '따뜻한']
  const b = ['고양이', '수달', '펭귄', '여행자', '작업러', '산책러', '탐험가', '메모광', '아기상어', '코알라']
  return `${pick(a)} ${pick(b)}`
}

function relativeTime(ts) {
  const diff = Math.max(1, Math.floor((now() - ts) / 1000))
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return cleanupStore(raw ? JSON.parse(raw) : {})
  } catch {
    return cleanupStore({})
  }
}

function cleanupStore(store) {
  const next = { ...store }
  Object.keys(next).forEach((roomId) => {
    const room = next[roomId] || {}
    next[roomId] = {
      ...room,
      messages: (room.messages || []).filter((m) => now() - m.createdAt < MESSAGE_TTL),
      updates: (room.updates || []).filter((u) => now() - u.createdAt < MESSAGE_TTL),
      vibeVotes: room.vibeVotes || {},
      reports: room.reports || [],
      analytics: room.analytics || defaultAnalytics(),
    }
  })
  return next
}

function persistStore(store) {
  const clean = cleanupStore(store)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  return clean
}

function defaultAnalytics() {
  return { views: 0, joins: 0, messageSent: 0, quickUpdates: 0, reactions: 0, shares: 0, reports: 0 }
}

function seedRoom(place, areaName, myNick, myColor) {
  const templates = [
    '여기 지금 자리 금방 나요', '2층이 더 조용해요', '와이파이는 괜찮은 편이에요',
    '주문은 조금 밀려요', '창가 쪽 분위기 좋아요', '혼자 작업하는 사람 많네요',
  ]
  const messages = Array.from({ length: rand(3, 5) }).map((_, idx) => ({
    id: uid(),
    nick: randomNick(),
    color: pick(COLORS),
    text: templates[idx % templates.length],
    createdAt: now() - rand(6, 90) * 60 * 1000,
    reactions: { '👍': rand(0, 4), '🔥': rand(0, 2), '도움돼요': rand(0, 3) },
    isSeed: true,
  }))
  const vibeVotes = Object.fromEntries(STATUS_OPTIONS.map((s) => [s, rand(0, 4)]))
  const updates = QUICK_UPDATES.slice(0, 3).map((label, idx) => ({
    id: uid(),
    label,
    createdAt: now() - rand(3, 100) * 60 * 1000,
    nick: idx === 0 ? myNick : randomNick(),
    color: idx === 0 ? myColor : pick(COLORS),
  }))
  return {
    messages,
    updates,
    vibeVotes,
    reports: [],
    analytics: {
      views: rand(20, 100), joins: rand(10, 40),
      messageSent: messages.length, quickUpdates: updates.length,
      reactions: rand(5, 25), shares: rand(0, 8), reports: 0,
    },
    questions: [
      { id: uid(), text: `${areaName}에서 지금 제일 조용한 곳 어디예요?`, topic: '질문', createdAt: now() - rand(60, 360) * 1000 },
      { id: uid(), text: `${place.n || place.name} 근처 식당 웨이팅 어떤가요?`, topic: '웨이팅', createdAt: now() - rand(60, 360) * 1000 },
    ],
  }
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

export default function App() {
  const [screen, setScreen] = useState('area')
  const [areaName, setAreaName] = useState('')
  const [filter, setFilter] = useState('전체')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [messageInput, setMessageInput] = useState('')
  const [questionInput, setQuestionInput] = useState('')
  const [notice, setNotice] = useState('')
  const [gpsState, setGpsState] = useState('idle') // idle | loading | success | failed
  const [locationInfo, setLocationInfo] = useState(null)
  const [store, setStore] = useState(() => getStore())
  const [myNick] = useState(randomNick)
  const [myColor] = useState(() => pick(COLORS))
  const [blockedNicks, setBlockedNicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('here_blocked_nicks') || '[]') }
    catch { return [] }
  })
  const [lastSentAt, setLastSentAt] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [showAdmin, setShowAdmin] = useState(false)
  const [statusSelected, setStatusSelected] = useState('')
  const [topicFilter, setTopicFilter] = useState('전체')
  const endRef = useRef(null)
  const channelRef = useRef(null)

  // ── Tab sync via BroadcastChannel ──
  useEffect(() => {
    channelRef.current = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null
    const ch = channelRef.current
    if (ch) ch.onmessage = (e) => { if (e.data?.type === 'STORE_UPDATE') setStore(getStore()) }
    return () => ch?.close()
  }, [])

  // ── Toast auto-dismiss ──
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])

  // ── Auto-scroll to latest message ──
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedPlace, store])

  // ── Persist blocked nicks ──
  useEffect(() => {
    localStorage.setItem('here_blocked_nicks', JSON.stringify(blockedNicks))
  }, [blockedNicks])

  // ── Cooldown countdown ──
  useEffect(() => {
    if (!lastSentAt) return
    const update = () => {
      const left = Math.max(0, Math.ceil((RATE_LIMIT_MS - (now() - lastSentAt)) / 1000))
      setCooldownLeft(left)
    }
    update()
    const t = setInterval(update, 500)
    return () => clearInterval(t)
  }, [lastSentAt])

  // ── Seed all rooms when area is chosen ──
  useEffect(() => {
    if (!areaName) return
    const areaPlaces = AREA_DATA[areaName]?.places || []
    const current = getStore()
    let updated = { ...current }
    let changed = false
    areaPlaces.forEach((p) => {
      const id = placeId(areaName, p.n)
      if (!updated[id]) {
        updated[id] = seedRoom(p, areaName, myNick, myColor)
        changed = true
      }
    })
    if (changed) setStore(persistStore(updated))
  }, [areaName, myNick, myColor])

  // ── Live simulation: add activity to a random room every SIM_INTERVAL ms ──
  useEffect(() => {
    if (!areaName) return
    const areaPlaces = AREA_DATA[areaName]?.places || []
    const tid = setInterval(() => {
      const p = pick(areaPlaces)
      const id = placeId(areaName, p.n)
      const current = getStore()
      if (!current[id]) return
      const msg = {
        id: uid(),
        nick: randomNick(),
        color: pick(COLORS),
        text: pick(LIVE_TEMPLATES),
        createdAt: now(),
        reactions: {},
        isSeed: true,
      }
      const room = current[id]
      const next = persistStore({
        ...current,
        [id]: {
          ...room,
          messages: [...(room.messages || []), msg],
          analytics: {
            ...defaultAnalytics(),
            ...(room.analytics || {}),
            messageSent: (room.analytics?.messageSent || 0) + 1,
          },
        },
      })
      setStore(next)
      channelRef.current?.postMessage({ type: 'STORE_UPDATE' })
    }, SIM_INTERVAL)
    return () => clearInterval(tid)
  }, [areaName])

  // ── Deep link / share URL handling ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const area = params.get('area')
    const place = params.get('place')
    if (area && AREA_DATA[area]) {
      setAreaName(area)
      if (place) {
        const found = AREA_DATA[area].places.find((p) => p.n === place)
        if (found) {
          setSelectedPlace({
            id: placeId(area, found.n),
            name: found.n,
            category: found.c,
            icon: found.i,
            preview: found.preview,
            vibe: found.vibe,
            distLabel: `${stableRand(found.n, 20, 280)}m`,
            activeUsers: stableRand(found.n + 'u', 5, 25),
            hotScore: stableRand(found.n + 'h', 10, 80),
          })
          setScreen('chat')
        } else {
          setScreen('places')
        }
      } else {
        setScreen('places')
      }
    }
  }, [])

  // ── Derived: places list ──
  const places = useMemo(() => {
    if (!areaName) return []
    return (AREA_DATA[areaName]?.places || []).map((p) => {
      const id = placeId(areaName, p.n)
      const room = store[id] || {}
      const traffic = (room.messages?.length || 0) + (room.updates?.length || 0)
      const hotScore = traffic + Object.values(room.vibeVotes || {}).reduce((a, b) => a + b, 0)
      const distM = locationInfo
        ? Math.round(distanceMeters(locationInfo.latitude, locationInfo.longitude, AREA_DATA[areaName].lat, AREA_DATA[areaName].lng) / 100) * 100 + stableRand(p.n, 10, 90)
        : stableRand(p.n, 50, 400)
      return {
        id,
        name: p.n,
        category: p.c,
        icon: p.i,
        preview: p.preview,
        vibe: p.vibe,
        distLabel: `${distM}m`,
        activeUsers: Math.max(1, Math.min(traffic + stableRand(p.n + 'u', 1, 5), 29)),
        hotScore,
        lastUpdate: Math.max(0, ...(room.messages || []).map((m) => m.createdAt), ...(room.updates || []).map((u) => u.createdAt)),
      }
    })
  }, [areaName, store, locationInfo])

  const categories = useMemo(() => ['전체', ...new Set(places.map((p) => p.category))], [places])
  const filteredPlaces = filter === '전체' ? places : places.filter((p) => p.category === filter)
  const liveRanking = useMemo(() => [...places].sort((a, b) => b.hotScore - a.hotScore).slice(0, 5), [places])

  const room = selectedPlace ? store[selectedPlace.id] || {} : null

  const visibleMessages = useMemo(() => {
    if (!selectedPlace || !room?.messages) return []
    return [...room.messages]
      .filter((m) => !blockedNicks.includes(m.nick))
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [room, selectedPlace, blockedNicks])

  const visibleUpdates = useMemo(() => {
    if (!selectedPlace || !room?.updates) return []
    return [...room.updates].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)
  }, [room, selectedPlace])

  const visibleQuestions = useMemo(() => {
    if (!selectedPlace || !room?.questions) return []
    return room.questions
      .filter((q) => topicFilter === '전체' || q.topic === topicFilter)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [room, selectedPlace, topicFilter])

  const adminRows = useMemo(() =>
    Object.entries(store)
      .map(([roomId, value]) => ({
        roomId,
        reports: value.reports?.length || 0,
        messages: value.messages?.length || 0,
        joins: value.analytics?.joins || 0,
        reactions: value.analytics?.reactions || 0,
        shares: value.analytics?.shares || 0,
      }))
      .sort((a, b) => b.messages - a.messages),
    [store])

  // ── Global hot ranking across all areas ──
  const globalRanking = useMemo(() => {
    return Object.keys(AREA_DATA)
      .flatMap((area) =>
        AREA_DATA[area].places.map((p) => {
          const id = placeId(area, p.n)
          const r = store[id]
          const hot = r
            ? (r.messages?.length || 0) + (r.updates?.length || 0) + Object.values(r.vibeVotes || {}).reduce((a, b) => a + b, 0)
            : 0
          return { area, name: p.n, icon: p.i, hot }
        })
      )
      .sort((a, b) => b.hot - a.hot)
      .slice(0, 6)
  }, [store])

  // ── Helpers ──
  function updateRoom(roomId, updater) {
    const current = getStore()
    const nextRoom = updater(current[roomId] || {})
    const next = persistStore({ ...current, [roomId]: nextRoom })
    setStore(next)
    channelRef.current?.postMessage({ type: 'STORE_UPDATE' })
  }

  function incrementAnalytics(roomData, key) {
    return {
      ...roomData,
      analytics: {
        ...defaultAnalytics(),
        ...(roomData.analytics || {}),
        [key]: (roomData.analytics?.[key] || 0) + 1,
      },
    }
  }

  function chooseArea(name) {
    setAreaName(name)
    setScreen('places')
    setFilter('전체')
  }

  function tryGPS() {
    if (!navigator.geolocation) {
      setGpsState('failed')
      setNotice('이 기기에서는 GPS를 사용할 수 없어요.')
      return
    }
    setGpsState('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        let nearest = AREAS[0]
        let min = Infinity
        for (const area of AREAS) {
          const d = distanceMeters(latitude, longitude, area.lat, area.lng)
          if (d < min) { min = d; nearest = area }
        }
        setLocationInfo({ latitude, longitude, nearest: nearest.name, distance: Math.round(min) })
        setGpsState('success')
        chooseArea(nearest.name)
        setNotice(`${nearest.name} 근처로 입장했어요.`)
      },
      () => {
        setGpsState('failed')
        setNotice('위치를 가져오지 못했어요. 지역을 직접 선택해 주세요.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function enterPlace(place) {
    const placeData = AREA_DATA[areaName]?.places.find((p) => p.n === place.name) || { n: place.name }
    updateRoom(place.id, (roomData) => {
      // seedRoom once, merge with existing data
      const seed = seedRoom(placeData, areaName, myNick, myColor)
      const merged = {
        ...seed,
        ...(roomData || {}),
        messages: roomData.messages?.length ? roomData.messages : seed.messages,
        updates: roomData.updates?.length ? roomData.updates : seed.updates,
        vibeVotes: roomData.vibeVotes && Object.keys(roomData.vibeVotes).length ? roomData.vibeVotes : seed.vibeVotes,
        reports: roomData.reports || [],
        questions: roomData.questions?.length ? roomData.questions : seed.questions,
      }
      return incrementAnalytics(merged, 'joins')
    })
    setSelectedPlace(place)
    setScreen('chat')
  }

  function sanitizeMessage(text) {
    const trimmed = text.trim().slice(0, MAX_MSG_LEN)
    if (!trimmed) return { ok: false, message: '메시지를 입력해 주세요.' }
    if (BANNED_WORDS.some((w) => trimmed.includes(w))) return { ok: false, message: '금칙어가 포함되어 있어요.' }
    if (now() - lastSentAt < RATE_LIMIT_MS) return { ok: false, message: `${cooldownLeft}초 후에 전송할 수 있어요.` }
    return { ok: true, value: trimmed }
  }

  function sendMessage() {
    if (!selectedPlace) return
    const check = sanitizeMessage(messageInput)
    if (!check.ok) { setNotice(check.message); return }
    const msg = { id: uid(), nick: myNick, color: myColor, text: check.value, createdAt: now(), reactions: {}, isMe: true }
    updateRoom(selectedPlace.id, (r) => incrementAnalytics({ ...r, messages: [...(r.messages || []), msg] }, 'messageSent'))
    setLastSentAt(now())
    setMessageInput('')
  }

  function addQuickUpdate(label) {
    if (!selectedPlace) return
    const item = { id: uid(), label, createdAt: now(), nick: myNick, color: myColor }
    updateRoom(selectedPlace.id, (r) => incrementAnalytics({ ...r, updates: [item, ...(r.updates || [])].slice(0, 16) }, 'quickUpdates'))
    setNotice('현장 정보가 반영됐어요.')
  }

  function voteVibe(label) {
    if (!selectedPlace) return
    setStatusSelected(label)
    updateRoom(selectedPlace.id, (r) => ({
      ...incrementAnalytics(r, 'views'),
      vibeVotes: { ...(r.vibeVotes || {}), [label]: (r.vibeVotes?.[label] || 0) + 1 },
    }))
  }

  function reactToMessage(messageId, emoji) {
    if (!selectedPlace) return
    updateRoom(selectedPlace.id, (r) => incrementAnalytics({
      ...r,
      messages: (r.messages || []).map((m) =>
        m.id === messageId ? { ...m, reactions: { ...(m.reactions || {}), [emoji]: (m.reactions?.[emoji] || 0) + 1 } } : m
      ),
    }, 'reactions'))
  }

  function reportMessage(message) {
    if (!selectedPlace) return
    updateRoom(selectedPlace.id, (r) => incrementAnalytics({
      ...r,
      reports: [{ id: uid(), messageId: message.id, text: message.text, nick: message.nick, createdAt: now() }, ...(r.reports || [])],
    }, 'reports'))
    setNotice('신고가 접수됐어요.')
  }

  function blockNick(nick) {
    if (blockedNicks.includes(nick) || nick === myNick) return
    setBlockedNicks((prev) => [...prev, nick])
    setNotice(`${nick}을(를) 차단했어요.`)
  }

  function unblockNick(nick) {
    setBlockedNicks((prev) => prev.filter((n) => n !== nick))
    setNotice(`${nick} 차단을 해제했어요.`)
  }

  function askQuestion() {
    if (!selectedPlace || !questionInput.trim()) { setNotice('질문을 입력해 주세요.'); return }
    const item = { id: uid(), text: questionInput.trim().slice(0, 90), topic: pick(TOPIC_OPTIONS), createdAt: now() }
    updateRoom(selectedPlace.id, (r) => ({ ...r, questions: [item, ...(r.questions || [])].slice(0, 20) }))
    setQuestionInput('')
    setNotice('질문이 등록됐어요.')
  }

  function shareRoom() {
    if (!selectedPlace) return
    const url = `${window.location.origin}${window.location.pathname}?area=${encodeURIComponent(areaName)}&place=${encodeURIComponent(selectedPlace.name)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    updateRoom(selectedPlace.id, (r) => incrementAnalytics(r, 'shares'))
    setNotice('공유 링크를 복사했어요.')
  }

  function removeMessage(messageId) {
    if (!selectedPlace) return
    updateRoom(selectedPlace.id, (r) => ({ ...r, messages: (r.messages || []).filter((m) => m.id !== messageId) }))
  }

  // ── Render ──
  return (
    <div className="app-shell">
      <div className="phone-frame">
        {notice && <div className="toast">{notice}</div>}

        {/* ────────────── AREA SCREEN ────────────── */}
        {screen === 'area' && (
          <section className="screen fade-in">
            <div className="hero">
              <div className="logo-badge">●</div>
              <h1>here.</h1>
              <p>지금, 여기 있는 사람들의 현장 정보와 익명 대화</p>
            </div>

            <div className="panel sticky-panel">
              <button
                className="primary-btn"
                style={{ width: '100%', marginBottom: 10 }}
                onClick={tryGPS}
                disabled={gpsState === 'loading'}
              >
                {gpsState === 'loading' ? '위치 확인 중...' : gpsState === 'success' ? '위치 인식 완료' : '현재 위치로 시작'}
              </button>
              <div className="helper-row">
                <span>익명 닉네임</span>
                <strong style={{ color: myColor }}>{myNick}</strong>
              </div>
              {locationInfo && (
                <div className="mini-note">
                  현재 위치 기준 <strong>{locationInfo.nearest}</strong>까지 약 {locationInfo.distance.toLocaleString()}m
                </div>
              )}
            </div>

            <div className="section-title">
              <span>지역 선택</span>
              <button className="ghost-link" onClick={() => setShowAdmin((v) => !v)}>
                {showAdmin ? '닫기' : '운영 보기'}
              </button>
            </div>
            <div className="grid-cards">
              {AREAS.map((area) => (
                <button key={area.name} className="area-card" onClick={() => chooseArea(area.name)}>
                  <div>{area.name}</div>
                  <small>{AREA_DATA[area.name].places.length}개 공간</small>
                </button>
              ))}
            </div>

            <div className="section-title"><span>실시간 인기 랭킹</span></div>
            <div className="panel">
              {globalRanking.map((item, idx) => (
                <div className="ranking-row" key={`${item.area}-${item.name}`}>
                  <span className="rank-num">#{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div>{item.icon} {item.name}</div>
                    <small>{item.area}</small>
                  </div>
                  {item.hot > 0 && <span className="mini-badge">HOT {item.hot}</span>}
                </div>
              ))}
            </div>

            {showAdmin && (
              <div className="panel admin-panel">
                <div className="section-title inner"><span>운영 대시보드</span></div>
                {adminRows.length === 0
                  ? <p className="muted">아직 운영 데이터가 없어요.</p>
                  : adminRows.map((row) => (
                    <div className="admin-row" key={row.roomId}>
                      <div>
                        <strong>{row.roomId.split('::')[1]}</strong>
                        <small>{row.roomId.split('::')[0]}</small>
                      </div>
                      <div className="admin-metrics">
                        <span>메시지 {row.messages}</span>
                        <span>신고 {row.reports}</span>
                        <span>입장 {row.joins}</span>
                        <span>리액션 {row.reactions}</span>
                      </div>
                    </div>
                  ))}
                {blockedNicks.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="section-title inner"><span>차단 목록 ({blockedNicks.length}명)</span></div>
                    {blockedNicks.map((nick) => (
                      <div key={nick} className="admin-row">
                        <span style={{ color: '#9296a3' }}>{nick}</span>
                        <button className="ghost-link" onClick={() => unblockNick(nick)}>해제</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ────────────── PLACES SCREEN ────────────── */}
        {screen === 'places' && (
          <section className="screen fade-in">
            <div className="top-bar">
              <button className="ghost-link" onClick={() => setScreen('area')}>← 지역 변경</button>
              <span className="status-chip">
                <i style={{ background: myColor }} /> {myNick}
              </span>
            </div>

            <div className="title-block">
              <span className="eyebrow">📍 {areaName}</span>
              <h2>주변 공간</h2>
              <p>실시간 분위기와 익명 대화를 미리 보고 들어가세요.</p>
            </div>

            <div className="chips-row">
              {categories.map((cat) => (
                <button key={cat} className={`chip ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>{cat}</button>
              ))}
            </div>

            <div className="panel">
              <div className="section-title inner"><span>이 지역 인기 공간</span></div>
              {liveRanking.map((p, idx) => (
                <div key={p.id} className="place-mini">
                  <span className="rank-num">#{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <strong>{p.icon} {p.name}</strong>
                    <small>{p.activeUsers}명 활동 중 · {p.lastUpdate ? relativeTime(p.lastUpdate) : '방금'}</small>
                  </div>
                  <span className="mini-badge">HOT {p.hotScore}</span>
                </div>
              ))}
            </div>

            <div className="list-stack">
              {filteredPlaces.map((place) => (
                <button key={place.id} className="place-card" onClick={() => enterPlace(place)}>
                  <div className="place-main">
                    <div className="place-icon">{place.icon}</div>
                    <div className="place-copy">
                      <div className="place-head">
                        <strong>{place.name}</strong>
                        <span>{place.distLabel}</span>
                      </div>
                      <p>{place.preview}</p>
                      <div className="tag-row">
                        {place.vibe.map((tag) => <span key={tag} className="mini-tag">{tag}</span>)}
                      </div>
                      <div className="meta-row">
                        <span>{place.category}</span>
                        <span>실시간 {place.activeUsers}명</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ────────────── CHAT SCREEN ────────────── */}
        {screen === 'chat' && selectedPlace && room && (
          <section className="screen fade-in">
            <div className="top-bar border-bottom">
              <button className="ghost-link" onClick={() => setScreen('places')}>← 목록</button>
              <button className="ghost-link" onClick={shareRoom}>공유 링크 복사</button>
            </div>

            <div className="title-block compact">
              <span className="eyebrow">{selectedPlace.icon} {selectedPlace.category}</span>
              <h2>{selectedPlace.name}</h2>
              <p>{selectedPlace.preview}</p>
            </div>

            <div className="panel hero-stats">
              <div className="stat-box"><strong>{visibleMessages.length}</strong><span>대화</span></div>
              <div className="stat-box"><strong>{visibleUpdates.length}</strong><span>현장 정보</span></div>
              <div className="stat-box">
                <strong>{Object.values(room.vibeVotes || {}).reduce((a, b) => a + b, 0)}</strong>
                <span>분위기 투표</span>
              </div>
            </div>

            {/* 분위기 투표 */}
            <div className="panel">
              <div className="section-title inner"><span>분위기 투표</span></div>
              <div className="chips-row wrap">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    className={`chip ${statusSelected === status ? 'active' : ''}`}
                    onClick={() => voteVibe(status)}
                  >
                    {status} <b>{room.vibeVotes?.[status] || 0}</b>
                  </button>
                ))}
              </div>
            </div>

            {/* 한 줄 현장 정보 */}
            <div className="panel">
              <div className="section-title inner"><span>한 줄 현장 정보</span></div>
              <div className="chips-row wrap">
                {QUICK_UPDATES.map((update) => (
                  <button key={update} className="chip" onClick={() => addQuickUpdate(update)}>{update}</button>
                ))}
              </div>
              {visibleUpdates.length > 0 && (
                <div className="activity-feed" style={{ marginTop: 10 }}>
                  {visibleUpdates.map((update) => (
                    <div key={update.id} className="activity-row">
                      <span className="dot" style={{ background: update.color }} />
                      <div>
                        <strong>{update.label}</strong>
                        <small>{update.nick} · {relativeTime(update.createdAt)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 오늘의 질문 */}
            <div className="panel">
              <div className="section-title inner"><span>오늘의 질문</span></div>
              <div className="input-row">
                <input
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="예: 지금 자리 나오는 속도 어때요?"
                  onKeyDown={(e) => { if (e.key === 'Enter') askQuestion() }}
                />
                <button className="secondary-btn" onClick={askQuestion}>등록</button>
              </div>
              <div className="chips-row wrap compact-row">
                {['전체', ...TOPIC_OPTIONS].map((topic) => (
                  <button key={topic} className={`chip ${topicFilter === topic ? 'active' : ''}`} onClick={() => setTopicFilter(topic)}>{topic}</button>
                ))}
              </div>
              {visibleQuestions.length > 0 && (
                <div className="question-list">
                  {visibleQuestions.map((q) => (
                    <div key={q.id} className="question-card">
                      <div className="meta-row">
                        <span className="mini-tag">{q.topic}</span>
                        <span>{relativeTime(q.createdAt)}</span>
                      </div>
                      <strong>{q.text}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 익명 대화 */}
            <div className="panel chat-panel">
              <div className="section-title inner"><span>익명 대화</span></div>
              <div className="message-list">
                {visibleMessages.map((message) => (
                  <div key={message.id} className={`message-card ${message.nick === myNick ? 'mine' : ''}`}>
                    <div className="message-head">
                      <div className="author-line">
                        <span className="dot" style={{ background: message.color }} />
                        {message.nick}
                        {message.nick === myNick && (
                          <span style={{ fontSize: 11, color: '#ff8a8a', marginLeft: 4 }}>나</span>
                        )}
                      </div>
                      <small>{relativeTime(message.createdAt)}</small>
                    </div>
                    <div className="message-body">{message.text}</div>
                    <div className="reaction-row">
                      {['👍', '🔥', '도움돼요'].map((emoji) => (
                        <button key={emoji} className="reaction-btn" onClick={() => reactToMessage(message.id, emoji)}>
                          {emoji} {message.reactions?.[emoji] || 0}
                        </button>
                      ))}
                    </div>
                    <div className="meta-actions">
                      {message.nick !== myNick && (
                        <>
                          <button className="ghost-link danger" onClick={() => reportMessage(message)}>신고</button>
                          <button className="ghost-link" onClick={() => blockNick(message.nick)}>차단</button>
                        </>
                      )}
                      {message.nick === myNick && (
                        <button className="ghost-link danger" onClick={() => removeMessage(message.id)}>삭제</button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="input-area">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="이 공간의 분위기나 정보를 남겨보세요. (Ctrl+Enter로 전송)"
                  maxLength={MAX_MSG_LEN}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                />
                <div className="input-footer">
                  <small>
                    {messageInput.length}/{MAX_MSG_LEN}
                    {cooldownLeft > 0 && (
                      <span style={{ color: '#ff8a8a', marginLeft: 6 }}>· {cooldownLeft}초 후 전송 가능</span>
                    )}
                  </small>
                  <button className="primary-btn" onClick={sendMessage} disabled={cooldownLeft > 0}>보내기</button>
                </div>
              </div>
            </div>

            {/* 운영/안전 */}
            <div className="panel admin-panel">
              <div className="section-title inner"><span>운영/안전</span></div>
              <div className="admin-grid">
                <div><strong>신고 누적</strong><small>{room.reports?.length || 0}건</small></div>
                <div><strong>차단 닉네임</strong><small>{blockedNicks.length}명</small></div>
                <div><strong>24시간 TTL</strong><small>자동 소멸</small></div>
              </div>
              {blockedNicks.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="section-title inner"><span>내 차단 목록</span></div>
                  {blockedNicks.map((nick) => (
                    <div key={nick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#9296a3' }}>{nick}</span>
                      <button className="ghost-link" onClick={() => unblockNick(nick)}>차단 해제</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

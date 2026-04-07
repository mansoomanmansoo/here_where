import React, { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from './lib/supabase'

// ── Constants ──────────────────────────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000
const RATE_LIMIT_MS = 8000
const MAX_MSG_LEN = 160
const BANNED_WORDS = ['광고', '홍보', '카톡', '텔레그램', '연락처', '전화번호']
const VIBE_OPTIONS = ['명당이에요', '그냥 그래요', '아직 안 나왔어요']
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#dda0dd', '#87ceeb', '#f4a460', '#98d8c8']

// ── Utilities ──────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function getIdentity() {
  try {
    const s = sessionStorage.getItem('luck_id')
    if (s) return JSON.parse(s)
  } catch {}
  const a = ['익명의', '조용한', '지나가는', '행운의', '느긋한', '빠른', '야행성', '설레는']
  const b = ['고양이', '수달', '펭귄', '여행자', '작업러', '산책러', '탐험가', '코알라']
  const id = { nick: `${pick(a)} ${pick(b)}`, color: pick(COLORS) }
  try { sessionStorage.setItem('luck_id', JSON.stringify(id)) } catch {}
  return id
}

function relativeTime(ts) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

const ttlDate = () => new Date(Date.now() - TTL_MS).toISOString()

// 이름 정규화 (공백·특수문자 제거, 소문자)
const normName = (s) => s.replace(/\s/g, '').toLowerCase()

// 당첨 데이터와 이름 매칭
function matchWinner(placeName, winnerMap) {
  const norm = normName(placeName)
  for (const [wName, wins] of Object.entries(winnerMap)) {
    const wNorm = normName(wName)
    if (norm.includes(wNorm) || wNorm.includes(norm)) return wins
  }
  return 0
}

// ── App ────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('map')
  const [kakaoReady, setKakaoReady] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [placeActivity, setPlaceActivity] = useState({})
  const [winnerMap, setWinnerMap] = useState({})       // { 상호: 당첨건수 }
  const [topWinners, setTopWinners] = useState([])     // 랭킹용 전체 목록
  const [thisWeekWinners, setThisWeekWinners] = useState([]) // 이번 회차 당첨점 [{name,addr,lat,lng}]
  const [thisWeekDrwNo, setThisWeekDrwNo] = useState(null)
  const [showRanking, setShowRanking] = useState(false)
  const [showLotto, setShowLotto] = useState(false)
  const [lottoResult, setLottoResult] = useState(null)
  const [lottoLoading, setLottoLoading] = useState(false)
  const [showGlobalChat, setShowGlobalChat] = useState(false)
  const [globalMessages, setGlobalMessages] = useState([])
  const [globalInput, setGlobalInput] = useState('')
  const [globalLoading, setGlobalLoading] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [genNumbers, setGenNumbers] = useState([])
  const [genAnimating, setGenAnimating] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [activePlace, setActivePlace] = useState(null)
  const [messages, setMessages] = useState([])
  const [vibeVotes, setVibeVotes] = useState({})
  const [messageInput, setMessageInput] = useState('')
  const [notice, setNotice] = useState('')
  const [lastSentAt, setLastSentAt] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [myVibe, setMyVibe] = useState('')
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [mapError, setMapError] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [roomCount, setRoomCount] = useState(0)

  const identity = useMemo(() => getIdentity(), [])
  const { nick: myNick, color: myColor } = identity

  const mapContainerRef   = useRef(null)
  const kakaoMapRef       = useRef(null)
  const overlaysRef       = useRef([])
  const realtimeRef       = useRef(null)
  const globalPresenceRef = useRef(null)
  const endRef            = useRef(null)

  // ── 전국 명당 데이터 로드 (lotto.agptedu.com, 주소 포함) ──
  useEffect(() => {
    fetch('/api/lottery-stores')
      .then(r => r.json())
      .then(json => {
        const rows = json.data || []
        // 이름 매칭용 맵
        const map = {}
        rows.forEach(r => { if (r.name) map[r.name] = r.wins })
        setWinnerMap(map)
        // 랭킹 (주소 있는 것 우선)
        setTopWinners(rows.filter(r => r.name).slice(0, 50))
      })
      .catch(() => {})
  }, [])

  // ── Kakao Maps SDK 동적 로드 ──
  useEffect(() => {
    if (window.kakao?.maps?.Map) { setKakaoReady(true); return }
    const key = import.meta.env.VITE_KAKAO_JS_KEY
    if (!key) { setMapError('카카오 API 키가 없습니다.'); return }
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`
    script.onload = () => {
      try { window.kakao.maps.load(() => setKakaoReady(true)) }
      catch (e) { setMapError('지도를 초기화하지 못했어요.') }
    }
    script.onerror = () => setMapError('카카오 지도를 불러오지 못했어요. 도메인 등록을 확인하세요.')
    document.head.appendChild(script)
  }, [])

  // ── 이번 회차 당첨점: fetch는 즉시, 지오코딩은 kakaoReady 후 ──
  const winnersRawRef = useRef(null)

  // fetch는 마운트 즉시 시작
  useEffect(() => {
    fetch('/api/lotto-winners')
      .then(r => r.json())
      .then(({ drwNo, stores }) => {
        if (!stores?.length) return
        setThisWeekDrwNo(drwNo)
        winnersRawRef.current = stores
        // kakaoReady면 바로 지오코딩
        if (window.kakao?.maps?.services?.Geocoder) geocodeWinners(stores)
      })
      .catch(() => {})
  }, [])

  // kakaoReady 됐을 때 데이터 이미 있으면 바로 지오코딩
  useEffect(() => {
    if (!kakaoReady || !winnersRawRef.current) return
    geocodeWinners(winnersRawRef.current)
  }, [kakaoReady])

  function geocodeWinners(stores) {
    const geocoder = new window.kakao.maps.services.Geocoder()
    const results = []
    let done = 0
    stores.forEach(({ name, addr }) => {
      geocoder.addressSearch(addr, (data, status) => {
        if (status === window.kakao.maps.services.Status.OK && data[0]) {
          results.push({ name, addr, lat: parseFloat(data[0].y), lng: parseFloat(data[0].x) })
        }
        done++
        if (done === stores.length) setThisWeekWinners([...results])
      })
    })
  }

  // ── 지도 초기화 ──
  useEffect(() => {
    if (!kakaoReady || !mapContainerRef.current || kakaoMapRef.current) return
    const { kakao } = window
    const map = new kakao.maps.Map(mapContainerRef.current, {
      center: new kakao.maps.LatLng(37.5665, 126.9780),
      level: 4,
    })
    kakaoMapRef.current = map
    kakao.maps.event.addListener(map, 'dragend', () => {
      const c = map.getCenter()
      searchNearby(c.getLat(), c.getLng())
    })
    kakao.maps.event.addListener(map, 'zoom_changed', () => {
      const c = map.getCenter()
      searchNearby(c.getLat(), c.getLng())
    })
    locateUser()
  }, [kakaoReady])

  // ── 핀 재렌더 ──
  useEffect(() => {
    if (kakaoMapRef.current && nearbyPlaces.length > 0) renderPins()
  }, [nearbyPlaces, placeActivity, winnerMap])

  // ── 이번 회차 당첨점 핀 ──
  const thisWeekOverlaysRef = useRef([])
  useEffect(() => {
    if (!kakaoReady || !kakaoMapRef.current || !thisWeekWinners.length) return
    const { kakao } = window
    thisWeekOverlaysRef.current.forEach(o => o.setMap(null))
    thisWeekOverlaysRef.current = []
    thisWeekWinners.forEach(({ name, lat, lng }) => {
      const div = document.createElement('div')
      div.className = 'map-pin map-pin--this-week'
      div.innerHTML = `<div class="pin-inner"><span class="pin-label">👑</span></div>`
      div.addEventListener('click', e => {
        e.stopPropagation()
        setNotice(`🏆 제${thisWeekDrwNo}회 1등 당첨점: ${name}`)
      })
      const overlay = new kakao.maps.CustomOverlay({
        map: kakaoMapRef.current,
        position: new kakao.maps.LatLng(lat, lng),
        content: div,
        yAnchor: 1.2,
        zIndex: 30,
      })
      thisWeekOverlaysRef.current.push(overlay)
    })
  }, [thisWeekWinners, kakaoReady])

  // ── 채팅방 Realtime 구독 ──
  useEffect(() => {
    if (!activePlace) return
    setRoomCount(0)
    loadChatData(activePlace.id)
    const ch = supabase.channel(`room:${activePlace.id}`)
    ch.on('presence', { event: 'sync' }, () => {
        setRoomCount(Object.keys(ch.presenceState()).length)
      })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `place_id=eq.${activePlace.id}` },
        ({ new: msg }) => {
          if (new Date(msg.created_at).getTime() < Date.now() - TTL_MS) return
          if (msg.nick === myNick) return
          if (msg.type === 'message') setMessages(p => [...p, msg])
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vibe_votes', filter: `place_id=eq.${activePlace.id}` },
        ({ new: v }) => setVibeVotes(p => ({ ...p, [v.label]: (p[v.label] || 0) + 1 })))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ nick: myNick })
      })
    realtimeRef.current = ch
    return () => ch.unsubscribe()
  }, [activePlace, myNick])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(t)
  }, [notice])
  useEffect(() => {
    if (!lastSentAt) return
    const u = () => setCooldownLeft(Math.max(0, Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSentAt)) / 1000)))
    u(); const t = setInterval(u, 500); return () => clearInterval(t)
  }, [lastSentAt])

  // ── 전체 접속자 Presence ──
  useEffect(() => {
    const ch = supabase.channel('global-presence')
    ch.on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(ch.presenceState()).length))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ nick: myNick })
      })
    globalPresenceRef.current = ch
    return () => ch.unsubscribe()
  }, [myNick])

  // ── GPS 위치 찾기 ──
  function locateUser() {
    if (!navigator.geolocation) { searchNearby(37.5665, 126.9780); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setGpsLoading(false)
        kakaoMapRef.current?.setCenter(new window.kakao.maps.LatLng(lat, lng))
        searchNearby(lat, lng)
      },
      () => { setGpsLoading(false); searchNearby(37.5665, 126.9780) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── 줌 레벨 → 검색 반경 ──
  function getSearchRadius() {
    const level = kakaoMapRef.current?.getLevel() || 4
    if (level <= 3) return 500
    if (level <= 4) return 1000
    if (level <= 5) return 2000
    if (level <= 6) return 4000
    if (level <= 7) return 7000
    return 12000
  }

  // ── 주변 복권 판매점 검색 (페이지네이션으로 최대 45개) ──
  function searchNearby(lat, lng) {
    const { kakao } = window
    if (!kakao?.maps?.services?.Places) return
    const ps = new kakao.maps.services.Places()
    const radius = getSearchRadius()
    const all = []

    function fetchPage(page) {
      ps.keywordSearch(
        '복권',
        (data, status, pagination) => {
          if (status === kakao.maps.services.Status.OK) {
            data.forEach(p => {
              all.push({
                id: `kakao::${p.id}`,
                kakaoId: p.id,
                name: p.place_name,
                address: p.road_address_name || p.address_name,
                lat: parseFloat(p.y),
                lng: parseFloat(p.x),
                distance: parseInt(p.distance) || 0,
              })
            })
            // 최대 3페이지(45개)까지 수집
            if (pagination.hasNextPage && page < 3) {
              fetchPage(page + 1)
              return
            }
          }
          const unique = Array.from(new Map(all.map(p => [p.kakaoId, p])).values())
            .sort((a, b) => a.distance - b.distance)
          setNearbyPlaces(unique)
          if (unique.length) loadActivityForPlaces(unique.map(p => p.id))
        },
        { location: new kakao.maps.LatLng(lat, lng), radius, size: 15, page, sort: kakao.maps.services.SortBy.DISTANCE }
      )
    }

    fetchPage(1)
  }

  // ── Supabase 활동량 조회 ──
  async function loadActivityForPlaces(placeIds) {
    if (!placeIds.length) return
    try {
      const { data } = await supabase
        .from('messages')
        .select('place_id, text, type, created_at')
        .in('place_id', placeIds)
        .gt('created_at', ttlDate())
        .order('created_at', { ascending: false })
      const activity = {}
      ;(data || []).forEach(msg => {
        if (!activity[msg.place_id]) activity[msg.place_id] = { count: 0, lastMsg: null }
        if (msg.type === 'message') {
          activity[msg.place_id].count++
          if (!activity[msg.place_id].lastMsg) activity[msg.place_id].lastMsg = msg.text
        }
      })
      setPlaceActivity(activity)
    } catch {}
  }

  // ── 핀 스타일 결정 ──
  function getPinStyle(place) {
    const wins = matchWinner(place.name, winnerMap)
    const activity = placeActivity[place.id]?.count || 0
    if (wins >= 3) return { level: 'legend', label: `🏆${wins}회`, zIndex: 20 }
    if (wins >= 1) return { level: 'winner', label: `🥇${wins}회`, zIndex: 15 }
    if (activity >= 5) return { level: 'hot', label: `🔥${activity}`, zIndex: 10 }
    if (activity >= 1) return { level: 'active', label: `💬${activity}`, zIndex: 5 }
    return { level: 'normal', label: '🎟', zIndex: 1 }
  }

  // ── 지도 핀 렌더링 ──
  function renderPins() {
    const { kakao } = window
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    nearbyPlaces.forEach(place => {
      const { level, label, zIndex } = getPinStyle(place)
      const div = document.createElement('div')
      div.className = `map-pin map-pin--${level}`
      div.innerHTML = `<div class="pin-inner"><span class="pin-label">${label}</span></div>`
      div.addEventListener('click', e => { e.stopPropagation(); setSelectedPlace(place) })

      const overlay = new kakao.maps.CustomOverlay({
        map: kakaoMapRef.current,
        position: new kakao.maps.LatLng(place.lat, place.lng),
        content: div,
        yAnchor: 1.2,
        zIndex,
      })
      overlaysRef.current.push(overlay)
    })
  }

  // ── 채팅 데이터 로드 ──
  async function loadChatData(pid) {
    setLoading(true)
    try {
      const [{ data: msgs }, { data: votes }] = await Promise.all([
        supabase.from('messages').select('*').eq('place_id', pid).gt('created_at', ttlDate()).order('created_at', { ascending: true }),
        supabase.from('vibe_votes').select('label').eq('place_id', pid).gt('created_at', ttlDate()),
      ])
      setMessages((msgs || []).filter(m => m.type === 'message'))
      const counts = {}
      ;(votes || []).forEach(v => { counts[v.label] = (counts[v.label] || 0) + 1 })
      setVibeVotes(counts)
    } catch { setNotice('데이터를 불러오지 못했어요.') }
    finally { setLoading(false) }
  }

  // ── 장소 입장 ──
  function enterPlace(place) {
    setMessages([]); setVibeVotes({})
    setMyVibe(''); setMessageInput('')
    setActivePlace(place); setSelectedPlace(null)
    setScreen('chat')
  }

  // ── 메시지 전송 ──
  async function send(text, type = 'message') {
    const trimmed = text.trim().slice(0, MAX_MSG_LEN)
    if (!trimmed) { setNotice('내용을 입력해 주세요.'); return }
    if (BANNED_WORDS.some(w => trimmed.includes(w))) { setNotice('금칙어가 포함되어 있어요.'); return }
    if (Date.now() - lastSentAt < RATE_LIMIT_MS) { setNotice(`${cooldownLeft}초 후에 전송할 수 있어요.`); return }

    const msg = { place_id: activePlace.id, nick: myNick, color: myColor, text: trimmed, type }
    if (type === 'message') {
      setMessages(p => [...p, { ...msg, id: 'tmp-' + Date.now(), created_at: new Date().toISOString() }])
      setMessageInput('')
    }
    setLastSentAt(Date.now())
    const { error } = await supabase.from('messages').insert(msg)
    if (error) {
      setNotice('전송에 실패했어요.')
      if (type === 'message') setMessages(p => p.filter(m => !m.id.startsWith('tmp-')))
    }
  }

  // ── 분위기 투표 ──
  async function voteVibe(label) {
    if (!activePlace || myVibe) return
    setMyVibe(label)
    setVibeVotes(p => ({ ...p, [label]: (p[label] || 0) + 1 }))
    const { error } = await supabase.from('vibe_votes').insert({ place_id: activePlace.id, label })
    if (error) { setMyVibe(''); setVibeVotes(p => ({ ...p, [label]: Math.max(0, (p[label] || 1) - 1) })) }
  }

  // ── 전체 채팅 ──
  const globalChatRef = useRef(null)
  const globalEndRef = useRef(null)

  async function openGlobalChat() {
    setShowGlobalChat(true)
    if (globalMessages.length > 0) return
    setGlobalLoading(true)
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('place_id', 'global::all')
        .gt('created_at', ttlDate())
        .order('created_at', { ascending: true })
      setGlobalMessages(data || [])
    } catch {}
    finally { setGlobalLoading(false) }
  }

  useEffect(() => {
    const ch = supabase.channel('global-chat')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'place_id=eq.global::all' },
        ({ new: msg }) => {
          if (new Date(msg.created_at).getTime() < Date.now() - TTL_MS) return
          if (msg.nick === myNick) return
          setGlobalMessages(p => [...p, msg])
        })
      .subscribe()
    return () => ch.unsubscribe()
  }, [myNick])

  useEffect(() => { globalEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [globalMessages])

  async function sendGlobal() {
    const trimmed = globalInput.trim().slice(0, MAX_MSG_LEN)
    if (!trimmed) return
    if (BANNED_WORDS.some(w => trimmed.includes(w))) { setNotice('금칙어가 포함되어 있어요.'); return }
    if (Date.now() - lastSentAt < RATE_LIMIT_MS) { setNotice(`${cooldownLeft}초 후 전송 가능해요.`); return }
    const msg = { place_id: 'global::all', nick: myNick, color: myColor, text: trimmed, type: 'message' }
    setGlobalMessages(p => [...p, { ...msg, id: 'tmp-' + Date.now(), created_at: new Date().toISOString() }])
    setGlobalInput('')
    setLastSentAt(Date.now())
    const { error } = await supabase.from('messages').insert(msg)
    if (error) setGlobalMessages(p => p.filter(m => !String(m.id).startsWith('tmp-')))
  }

  // ── 번호 생성기 ──
  function generateNumbers() {
    setGenAnimating(true)
    setGenNumbers([])
    let count = 0
    const interval = setInterval(() => {
      const pool = Array.from({ length: 45 }, (_, i) => i + 1)
      const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 6).sort((a, b) => a - b)
      setGenNumbers(shuffled)
      count++
      if (count >= 8) {
        clearInterval(interval)
        setGenAnimating(false)
      }
    }, 80)
  }

  const ballColor = (n) => {
    if (n <= 10) return '#fbc400'
    if (n <= 20) return '#69c8f2'
    if (n <= 30) return '#ff7272'
    if (n <= 40) return '#aaaaaa'
    return '#b0d840'
  }

  async function openLotto() {
    setShowLotto(true)
    if (lottoResult) return
    setLottoLoading(true)
    try {
      const r = await fetch('/api/lotto-result')
      const data = await r.json()
      if (data.error || !data.numbers) {
        console.error('lotto api error:', data)
        setLottoResult(null)
      } else {
        setLottoResult(data)
      }
    } catch (e) {
      console.error('lotto fetch error:', e)
      setLottoResult(null)
    } finally {
      setLottoLoading(false)
    }
  }

  function shareRoom() {
    const url = `${location.origin}${location.pathname}?place=${activePlace.kakaoId}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setNotice('공유 링크를 복사했어요.')
  }

  const totalVotes = Object.values(vibeVotes).reduce((a, b) => a + b, 0)

  // ── Render ──────────────────────────────────────────────
  return (
    <div className={`app-root app-root--${screen}`}>
      {notice && <div className="toast">{notice}</div>}

      {/* ── 지도 화면 ── */}
      <div className={`map-screen${screen === 'map' ? '' : ' map-screen--hidden'}`}>
        <div ref={mapContainerRef} className="kakao-map" />

        {/* 상단 오버레이 */}
        <div className="map-top">
          <div className="map-logo">goodluck<span className="logo-dot">.</span></div>
          <div className="map-top-right">
            {onlineCount > 0 && (
              <div className="online-badge">
                <span className="online-dot" />{onlineCount}명 접속 중
              </div>
            )}
            <button className="map-icon-btn" onClick={() => { setShowGenerator(true); if (!genNumbers.length) generateNumbers() }} title="번호 생성기">🎰</button>
            <button className="map-icon-btn" onClick={openGlobalChat} title="전체 대화">💬</button>
            <button className="map-icon-btn" onClick={openLotto} title="이번 주 당첨번호">🎱</button>
            <button className="map-icon-btn" onClick={() => setShowRanking(true)} title="전국 명당 랭킹">🏆</button>
            <button className="map-icon-btn" onClick={locateUser} disabled={gpsLoading}>
              {gpsLoading ? '⟳' : '📍'}
            </button>
          </div>
        </div>

        {/* 상태 메시지 */}
        {mapError && <div className="map-hint map-hint--error">⚠️ {mapError}</div>}
        {!kakaoReady && !mapError && <div className="map-hint">지도 불러오는 중...</div>}
        {nearbyPlaces.length === 0 && kakaoReady && !gpsLoading && !mapError && (
          <div className="map-hint">📍 위치 버튼을 눌러 주변 복권 판매점을 찾아보세요</div>
        )}
        {gpsLoading && <div className="map-hint">위치 확인 중...</div>}

        {/* 닉네임 배지 */}
        <div className="map-nick-badge" style={{ borderColor: myColor }}>
          <span className="dot" style={{ background: myColor }} />{myNick}
        </div>

        {/* 범례 */}
        {nearbyPlaces.length > 0 && (
          <div className="map-legend">
            {thisWeekDrwNo && <span className="legend-item"><span className="legend-dot legend-dot--this-week" />제{thisWeekDrwNo}회 1등</span>}
            <span className="legend-item"><span className="legend-dot legend-dot--legend" />명당(3회↑)</span>
            <span className="legend-item"><span className="legend-dot legend-dot--winner" />당첨 이력</span>
            <span className="legend-item"><span className="legend-dot legend-dot--normal" />일반</span>
          </div>
        )}

        {/* 바텀 시트 */}
        {selectedPlace && (() => {
          const wins = matchWinner(selectedPlace.name, winnerMap)
          const activity = placeActivity[selectedPlace.id]?.count || 0
          return (
            <div className="bottom-sheet" onClick={e => e.target === e.currentTarget && setSelectedPlace(null)}>
              <div className="bottom-sheet-inner">
                <div className="sheet-handle" onClick={() => setSelectedPlace(null)} />
                <div className="sheet-head">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {wins > 0 && (
                      <div className="winner-badge">🏆 1등 당첨 {wins}회 배출</div>
                    )}
                    <h3 className="sheet-name">{selectedPlace.name}</h3>
                    <p className="sheet-address">{selectedPlace.address}</p>
                  </div>
                  <div className="sheet-dist">{selectedPlace.distance}m</div>
                </div>

                {placeActivity[selectedPlace.id]?.lastMsg ? (
                  <div className="sheet-preview">
                    <span className="sheet-preview-dot" />
                    "{placeActivity[selectedPlace.id].lastMsg}"
                  </div>
                ) : (
                  <div className="sheet-preview sheet-preview--empty">
                    아직 아무도 없어요. 첫 번째로 남겨보세요!
                  </div>
                )}

                {activity > 0 && (
                  <div className="sheet-activity sheet-activity--active">
                    💬 {activity}명 대화 중
                  </div>
                )}

                <button className="sheet-enter-btn" onClick={() => enterPlace(selectedPlace)}>
                  들어가기
                </button>
              </div>
            </div>
          )
        })()}

        {/* 전국 명당 랭킹 패널 */}
        {showRanking && (
          <div className="ranking-overlay" onClick={e => e.target === e.currentTarget && setShowRanking(false)}>
            <div className="ranking-panel">
              <div className="ranking-header">
                <h3>🏆 전국 명당 랭킹</h3>
                <button className="ranking-close" onClick={() => setShowRanking(false)}>✕</button>
              </div>
              <div className="ranking-list">
                {topWinners.map((w, i) => (
                  <div key={w.addr || w.name} className="ranking-row" style={{ cursor: w.addr ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (!w.addr) return
                      setShowRanking(false)
                      const geocoder = new window.kakao.maps.services.Geocoder()
                      geocoder.addressSearch(w.addr, (data, status) => {
                        if (status === window.kakao.maps.services.Status.OK && data[0]) {
                          kakaoMapRef.current?.setCenter(new window.kakao.maps.LatLng(parseFloat(data[0].y), parseFloat(data[0].x)))
                          kakaoMapRef.current?.setLevel(3)
                        }
                      })
                    }}>
                    <span className={`ranking-num ${i < 3 ? 'ranking-num--top' : ''}`}>{i + 1}</span>
                    <div className="ranking-info">
                      <span className="ranking-name">{w.name}</span>
                      <span className="ranking-region">{w.region}</span>
                    </div>
                    <span className="ranking-wins">{w.wins > 0 ? `${w.wins}회` : '명당'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 당첨번호 패널 */}
        {showLotto && (
          <div className="ranking-overlay" onClick={e => e.target === e.currentTarget && setShowLotto(false)}>
            <div className="ranking-panel">
              <div className="ranking-header">
                <div>
                  <h3 style={{ margin: 0 }}>🎱 당첨번호 확인</h3>
                  {lottoResult && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9296a3' }}>
                      제{lottoResult.drwNo}회 · {lottoResult.drwDate}
                    </p>
                  )}
                </div>
                <button className="ranking-close" onClick={() => setShowLotto(false)}>✕</button>
              </div>

              <div style={{ padding: '20px 20px 32px' }}>
                {lottoLoading && (
                  <p style={{ textAlign: 'center', color: '#9296a3', padding: '20px 0' }}>불러오는 중...</p>
                )}
                {!lottoLoading && lottoResult && (() => {
                  return (
                    <>
                      {/* 번호 볼 */}
                      <div className="lotto-balls">
                        {lottoResult.numbers.map(n => (
                          <span key={n} className="lotto-ball" style={{ background: ballColor(n) }}>{n}</span>
                        ))}
                        <span className="lotto-plus">+</span>
                        <span className="lotto-ball lotto-ball--bonus" style={{ background: ballColor(lottoResult.bonus) }}>
                          {lottoResult.bonus}
                        </span>
                      </div>

                      <p style={{ fontSize: 12, color: '#9296a3', textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
                        보너스 번호 포함
                      </p>

                      {/* 이번 회차 1등 당첨점 리스트 */}
                      {thisWeekWinners.length > 0 && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#f4f4f5', marginBottom: 10 }}>
                            👑 제{thisWeekDrwNo}회 1등 당첨점 ({thisWeekWinners.length}곳)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {thisWeekWinners.map((w, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(138,43,226,0.1)', border: '1px solid rgba(180,100,255,0.25)', borderRadius: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>{w.name || '판매점'}</div>
                                  <div style={{ fontSize: 11, color: '#9296a3', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.addr}</div>
                                </div>
                                <button
                                  onClick={() => {
                                    setShowLotto(false)
                                    kakaoMapRef.current?.setCenter(new window.kakao.maps.LatLng(w.lat, w.lng))
                                    kakaoMapRef.current?.setLevel(3)
                                  }}
                                  style={{ flexShrink: 0, marginLeft: 8, background: 'rgba(138,43,226,0.7)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                                >
                                  지도보기
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {thisWeekWinners.length === 0 && (
                        <p style={{ fontSize: 12, color: '#555a66', textAlign: 'center' }}>당첨점 위치 로딩 중...</p>
                      )}
                    </>
                  )
                })()}
                {!lottoLoading && !lottoResult && (
                  <p style={{ textAlign: 'center', color: '#ff8a8a' }}>정보를 불러오지 못했어요.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 전체 자유대화창 */}
        {showGlobalChat && (
          <div className="ranking-overlay" onClick={e => e.target === e.currentTarget && setShowGlobalChat(false)}>
            <div className="ranking-panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              <div className="ranking-header">
                <div>
                  <h3 style={{ margin: 0 }}>💬 전체 자유대화</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9296a3' }}>전국 luck. 사용자와 대화해보세요</p>
                </div>
                <button className="ranking-close" onClick={() => setShowGlobalChat(false)}>✕</button>
              </div>

              <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0 }}>
                {globalLoading && (
                  <p style={{ textAlign: 'center', color: '#9296a3', padding: '20px 0' }}>불러오는 중...</p>
                )}
                {!globalLoading && globalMessages.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#6b6f7a', padding: '20px 0', fontSize: 14 }}>
                    아직 아무도 없어요.<br />첫 번째로 대화를 시작해보세요!
                  </p>
                )}
                {globalMessages.map(msg => {
                  const isMe = msg.nick === myNick
                  return (
                    <div key={msg.id} className={`chat-row ${isMe ? 'chat-row--me' : 'chat-row--other'}`}>
                      {!isMe && <span className="chat-avatar" style={{ background: msg.color }} />}
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
                <div ref={globalEndRef} />
              </div>

              <div className="input-area" style={{ borderTop: '1px solid #2a2d35', padding: '10px 16px' }}>
                <textarea
                  value={globalInput}
                  onChange={e => setGlobalInput(e.target.value)}
                  placeholder="모두에게 한마디 남겨보세요."
                  maxLength={MAX_MSG_LEN}
                  rows={2}
                  style={{ width: '100%', background: '#1a1d23', border: '1px solid #2e3138', borderRadius: 10, color: '#f4f4f5', padding: '8px 12px', fontSize: 14, resize: 'none', boxSizing: 'border-box' }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendGlobal() } }}
                />
                <div className="input-footer">
                  <small style={{ color: '#6b6f7a' }}>
                    {globalInput.length}/{MAX_MSG_LEN}
                    {cooldownLeft > 0 && <span style={{ color: '#ff8a8a', marginLeft: 6 }}>· {cooldownLeft}초</span>}
                  </small>
                  <button className="primary-btn" onClick={sendGlobal} disabled={cooldownLeft > 0 || !globalInput.trim()}>
                    보내기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 번호 생성기 */}
        {showGenerator && (
          <div className="ranking-overlay" onClick={e => e.target === e.currentTarget && setShowGenerator(false)}>
            <div className="ranking-panel">
              <div className="ranking-header">
                <h3>🎰 번호 생성기</h3>
                <button className="ranking-close" onClick={() => setShowGenerator(false)}>✕</button>
              </div>

              <div style={{ padding: '24px 20px 32px', textAlign: 'center' }}>
                <div className="lotto-balls" style={{ justifyContent: 'center', marginBottom: 24, minHeight: 52 }}>
                  {genNumbers.map((n, i) => (
                    <span key={i} className={`lotto-ball${genAnimating ? ' lotto-ball--spin' : ''}`} style={{ background: ballColor(n) }}>{n}</span>
                  ))}
                  {genNumbers.length === 0 && !genAnimating && (
                    <span style={{ color: '#6b6f7a', fontSize: 14 }}>번호를 생성해보세요</span>
                  )}
                </div>

                {genNumbers.length === 6 && !genAnimating && (
                  <p style={{ fontSize: 12, color: '#9296a3', marginBottom: 20 }}>
                    이 번호로 한 번 도전해보세요 🍀
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    className="primary-btn"
                    onClick={generateNumbers}
                    disabled={genAnimating}
                    style={{ minWidth: 120 }}
                  >
                    {genAnimating ? '생성 중...' : '번호 생성'}
                  </button>
                  {genNumbers.length === 6 && !genAnimating && (
                    <button
                      className="primary-btn"
                      style={{ minWidth: 80, background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}
                      onClick={() => {
                        navigator.clipboard?.writeText(genNumbers.join(', ')).catch(() => {})
                        setNotice('번호를 복사했어요!')
                      }}
                    >
                      복사
                    </button>
                  )}
                </div>

                <p style={{ marginTop: 28, fontSize: 11, color: '#444857' }}>
                  1~45 중 무작위 6개 추출 · 참고용
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 채팅 화면 ── */}
      {screen === 'chat' && activePlace && (() => {
        const wins = matchWinner(activePlace.name, winnerMap)
        return (
          <div className="app-shell">
            <div className="phone-frame">
              <div className="screen fade-in">
                <div className="top-bar border-bottom">
                  <button className="ghost-link" onClick={() => { setScreen('map'); loadActivityForPlaces(nearbyPlaces.map(p => p.id)) }}>
                    ← 지도
                  </button>
                  <button className="ghost-link" onClick={shareRoom}>공유</button>
                </div>

                <div className="title-block compact">
                  <span className="eyebrow">🎟 복권 판매점</span>
                  <h2>{activePlace.name}</h2>
                  <p style={{ fontSize: 12, color: '#9a9ea9', margin: 0 }}>{activePlace.address}</p>
                  {wins > 0 && (
                    <div className="chat-winner-badge">🏆 1등 당첨 {wins}회 배출 명당</div>
                  )}
                  {roomCount > 0 && (
                    <div className="room-online">
                      <span className="online-dot" />지금 {roomCount}명 여기 있어요
                    </div>
                  )}
                </div>

                {/* 분위기 투표 */}
                <div className="panel">
                  <div className="section-title inner">
                    <span>이 곳 어때요?</span>
                    {totalVotes > 0 && <small style={{ color: '#9296a3' }}>{totalVotes}명 응답</small>}
                  </div>
                  <div className="chips-row" style={{ justifyContent: 'space-between' }}>
                    {VIBE_OPTIONS.map(label => {
                      const count = vibeVotes[label] || 0
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                      return (
                        <button key={label}
                          className={`chip ${myVibe === label ? 'active' : ''}`}
                          onClick={() => voteVibe(label)}
                          disabled={!!myVibe}
                          style={{ flex: 1, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                        >
                          {totalVotes > 0 && (
                            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(255,215,0,0.15)', transition: 'width 0.4s' }} />
                          )}
                          <span style={{ position: 'relative' }}>
                            {label}{totalVotes > 0 && <b style={{ marginLeft: 4 }}>{pct}%</b>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {!myVibe && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b6f7a', textAlign: 'center' }}>탭해서 투표하기</p>}
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
                    {messages.map(msg => {
                      const isMe = msg.nick === myNick
                      return (
                        <div key={msg.id} className={`chat-row ${isMe ? 'chat-row--me' : 'chat-row--other'}`}>
                          {!isMe && <span className="chat-avatar" style={{ background: msg.color }} />}
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
                      onChange={e => setMessageInput(e.target.value)}
                      placeholder="이 판매점 정보 공유해요. 익명으로 남겨보세요."
                      maxLength={MAX_MSG_LEN}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(messageInput) } }}
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
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

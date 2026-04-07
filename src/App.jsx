import React, { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from './lib/supabase'

// ── Constants ──────────────────────────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000
const RATE_LIMIT_MS = 8000
const MAX_MSG_LEN = 160
const BANNED_WORDS = ['광고', '홍보', '카톡', '텔레그램', '연락처', '전화번호']
const VIBE_OPTIONS = ['명당이에요', '그냥 그래요', '아직 안 나왔어요']
const QUICK_UPDATES = ['줄 없어요', '줄 있어요', '용지 있어요', '마감 임박', '기계 정상', '기계 고장', '명당이에요']
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
  const [showRanking, setShowRanking] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [activePlace, setActivePlace] = useState(null)
  const [messages, setMessages] = useState([])
  const [updates, setUpdates] = useState([])
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

  // ── 전국 당첨점 데이터 로드 ──
  useEffect(() => {
    fetch('/api/lottery-stores?perPage=1000')
      .then(r => r.json())
      .then(json => {
        const rows = json.data || []
        const map = {}
        rows.forEach(r => {
          const name = r['상호']
          const wins = parseInt(r['1등 자동 당첨 건수']) || 0
          if (name) map[name] = (map[name] || 0) + wins
        })
        setWinnerMap(map)
        // 랭킹: 당첨 많은 순
        const sorted = Object.entries(map)
          .map(([name, wins]) => ({ name, wins, region: rows.find(r => r['상호'] === name)?.['지역'] || '' }))
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 50)
        setTopWinners(sorted)
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
    locateUser()
  }, [kakaoReady])

  // ── 핀 재렌더 (활동량 or 당첨 데이터 바뀔 때) ──
  useEffect(() => {
    if (kakaoMapRef.current && nearbyPlaces.length > 0) renderPins()
  }, [nearbyPlaces, placeActivity, winnerMap])

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
          if (msg.type === 'update') setUpdates(p => [msg, ...p].slice(0, 8))
          else setMessages(p => [...p, msg])
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

  // ── 주변 복권 판매점 검색 ──
  function searchNearby(lat, lng) {
    const { kakao } = window
    if (!kakao?.maps?.services?.Places) return
    const ps = new kakao.maps.services.Places()

    ps.keywordSearch(
      '복권',
      (data, status) => {
        if (status !== kakao.maps.services.Status.OK) {
          setNearbyPlaces([])
          return
        }
        const places = data.map(p => ({
          id: `kakao::${p.id}`,
          kakaoId: p.id,
          name: p.place_name,
          address: p.road_address_name || p.address_name,
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
          distance: parseInt(p.distance) || 0,
        }))
        setNearbyPlaces(places)
        if (places.length) loadActivityForPlaces(places.map(p => p.id))
      },
      { location: new kakao.maps.LatLng(lat, lng), radius: 1000, size: 15, sort: kakao.maps.services.SortBy.DISTANCE }
    )
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
      setUpdates((msgs || []).filter(m => m.type === 'update').reverse().slice(0, 8))
      const counts = {}
      ;(votes || []).forEach(v => { counts[v.label] = (counts[v.label] || 0) + 1 })
      setVibeVotes(counts)
    } catch { setNotice('데이터를 불러오지 못했어요.') }
    finally { setLoading(false) }
  }

  // ── 장소 입장 ──
  function enterPlace(place) {
    setMessages([]); setUpdates([]); setVibeVotes({})
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
    } else {
      setUpdates(p => [{ ...msg, id: 'tmp-' + Date.now(), created_at: new Date().toISOString() }, ...p].slice(0, 8))
      setNotice('정보가 반영됐어요.')
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
          <div className="map-logo">luck<span className="logo-dot">.</span></div>
          <div className="map-top-right">
            {onlineCount > 0 && (
              <div className="online-badge">
                <span className="online-dot" />{onlineCount}명 접속 중
              </div>
            )}
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
            <span className="legend-item"><span className="legend-dot legend-dot--legend" />명당(3회↑)</span>
            <span className="legend-item"><span className="legend-dot legend-dot--winner" />당첨 이력</span>
            <span className="legend-item"><span className="legend-dot legend-dot--hot" />커뮤니티 핫</span>
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
                  <div key={w.name} className="ranking-row">
                    <span className={`ranking-num ${i < 3 ? 'ranking-num--top' : ''}`}>{i + 1}</span>
                    <div className="ranking-info">
                      <span className="ranking-name">{w.name}</span>
                      <span className="ranking-region">{w.region}</span>
                    </div>
                    <span className="ranking-wins">{w.wins}회</span>
                  </div>
                ))}
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

                {/* 현장 정보 */}
                <div className="panel">
                  <div className="section-title inner"><span>현장 정보</span></div>
                  <div className="chips-row wrap">
                    {QUICK_UPDATES.map(label => (
                      <button key={label} className="chip" onClick={() => send(label, 'update')}>{label}</button>
                    ))}
                  </div>
                  {updates.length > 0 && (
                    <div className="activity-feed" style={{ marginTop: 10 }}>
                      {updates.map(u => (
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

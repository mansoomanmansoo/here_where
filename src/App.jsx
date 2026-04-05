import React, { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from './lib/supabase'

// ── Constants ──────────────────────────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000
const RATE_LIMIT_MS = 8000
const MAX_MSG_LEN = 160
const BANNED_WORDS = ['광고', '홍보', '카톡', '텔레그램', '연락처', '전화번호']
const VIBE_OPTIONS = ['한산해요', '보통이에요', '혼잡해요']
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#dda0dd', '#87ceeb', '#f4a460', '#98d8c8']

// 카카오 카테고리별 이모지 + 현장 정보 칩
const CATEGORY_MAP = {
  CE7: { emoji: '☕', updates: ['자리 있어요', '자리 없어요', '콘센트 있어요', '와이파이 빨라요', '웨이팅 있어요', '조용해요', '시끄러워요'] },
  FD6: { emoji: '🍜', updates: ['웨이팅 있어요', '웨이팅 없어요', '빠르게 나와요', '맛있어요', '혼잡해요', '자리 있어요'] },
  CT1: { emoji: '🎭', updates: ['입장 대기 있어요', '한산해요', '전시 볼만해요', '사람 많아요'] },
  AT4: { emoji: '📍', updates: ['사람 많아요', '한산해요', '날씨 좋아요', '포토스팟 있어요', '주차 어려워요'] },
  MT1: { emoji: '🛒', updates: ['혼잡해요', '한산해요', '주차 여유 있어요', '계산대 빨라요'] },
  SW8: { emoji: '🚇', updates: ['혼잡해요', '한산해요', '에스컬레이터 막혀요', '환승 복잡해요'] },
}
const DEFAULT_CAT = { emoji: '📌', updates: ['자리 있어요', '웨이팅 있어요', '한산해요', '혼잡해요'] }

// 활동량 → 레벨
const getLevel = (count) => {
  if (count === 0) return 'empty'
  if (count < 3)  return 'low'
  if (count < 10) return 'active'
  return 'hot'
}

// ── Utilities ──────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function getIdentity() {
  try {
    const s = sessionStorage.getItem('here_id')
    if (s) return JSON.parse(s)
  } catch {}
  const a = ['익명의', '조용한', '지나가는', '호기심많은', '배고픈', '느긋한', '빠른', '야행성']
  const b = ['고양이', '수달', '펭귄', '여행자', '작업러', '산책러', '탐험가', '코알라']
  const id = { nick: `${pick(a)} ${pick(b)}`, color: pick(COLORS) }
  try { sessionStorage.setItem('here_id', JSON.stringify(id)) } catch {}
  return id
}

function relativeTime(ts) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

const ttlDate = () => new Date(Date.now() - TTL_MS).toISOString()

// ── App ────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('map')       // 'map' | 'chat'
  const [kakaoReady, setKakaoReady] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [placeActivity, setPlaceActivity] = useState({})
  const [selectedPlace, setSelectedPlace] = useState(null) // 바텀시트
  const [activePlace, setActivePlace] = useState(null)     // 채팅방
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

  const identity = useMemo(() => getIdentity(), [])
  const { nick: myNick, color: myColor } = identity

  const mapContainerRef = useRef(null)
  const kakaoMapRef     = useRef(null)
  const overlaysRef     = useRef([])
  const realtimeRef     = useRef(null)
  const endRef          = useRef(null)

  // ── Kakao Maps SDK 동적 로드 ──
  useEffect(() => {
    if (window.kakao?.maps?.Map) { setKakaoReady(true); return }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_JS_KEY}&libraries=services&autoload=false`
    script.onload = () => window.kakao.maps.load(() => setKakaoReady(true))
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
    // 드래그 종료 시 해당 위치 재검색
    kakao.maps.event.addListener(map, 'dragend', () => {
      const c = map.getCenter()
      searchNearby(c.getLat(), c.getLng())
    })
    locateUser()
  }, [kakaoReady])

  // ── 핀 재렌더 ──
  useEffect(() => {
    if (kakaoMapRef.current && nearbyPlaces.length > 0) renderPins()
  }, [nearbyPlaces, placeActivity])

  // ── 채팅방 Realtime 구독 ──
  useEffect(() => {
    if (!activePlace) return
    loadChatData(activePlace.id)
    realtimeRef.current = supabase
      .channel(`room:${activePlace.id}`)
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
      .subscribe()
    return () => realtimeRef.current?.unsubscribe()
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

  // ── Kakao Places API로 주변 장소 검색 ──
  function searchNearby(lat, lng) {
    const { kakao } = window
    if (!kakao?.maps?.services?.Places) return
    const ps = new kakao.maps.services.Places()
    const categories = ['CE7', 'FD6', 'CT1', 'AT4']
    const all = []
    let done = 0

    categories.forEach((code) => {
      ps.categorySearch(
        code,
        (data, status) => {
          if (status === kakao.maps.services.Status.OK) {
            all.push(...data.map((p) => ({
              id: `kakao::${p.id}`,
              kakaoId: p.id,
              name: p.place_name,
              categoryCode: p.category_group_code,
              categoryName: p.category_group_name,
              address: p.road_address_name || p.address_name,
              lat: parseFloat(p.y),
              lng: parseFloat(p.x),
              distance: parseInt(p.distance) || 0,
            })))
          }
          done++
          if (done === categories.length) {
            const unique = Array.from(new Map(all.map(p => [p.kakaoId, p])).values())
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 40)
            setNearbyPlaces(unique)
            if (unique.length) loadActivityForPlaces(unique.map(p => p.id))
          }
        },
        { location: new kakao.maps.LatLng(lat, lng), radius: 500, size: 15, sort: kakao.maps.services.SortBy.DISTANCE }
      )
    })
  }

  // ── Supabase에서 각 장소 활동량 조회 ──
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
      ;(data || []).forEach((msg) => {
        if (!activity[msg.place_id]) activity[msg.place_id] = { count: 0, lastMsg: null }
        if (msg.type === 'message') {
          activity[msg.place_id].count++
          if (!activity[msg.place_id].lastMsg) activity[msg.place_id].lastMsg = msg.text
        }
      })
      setPlaceActivity(activity)
    } catch {}
  }

  // ── 지도 핀 렌더링 ──
  function renderPins() {
    const { kakao } = window
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    nearbyPlaces.forEach((place) => {
      const count = placeActivity[place.id]?.count || 0
      const level = getLevel(count)
      const { emoji } = CATEGORY_MAP[place.categoryCode] || DEFAULT_CAT

      const div = document.createElement('div')
      div.className = `map-pin map-pin--${level}`
      div.innerHTML = `
        <div class="pin-inner">
          <span class="pin-emoji">${emoji}</span>
          ${count > 0 ? `<span class="pin-count">${count > 99 ? '99+' : count}</span>` : ''}
        </div>
      `
      div.addEventListener('click', (e) => { e.stopPropagation(); setSelectedPlace(place) })

      const overlay = new kakao.maps.CustomOverlay({
        map: kakaoMapRef.current,
        position: new kakao.maps.LatLng(place.lat, place.lng),
        content: div,
        yAnchor: 1.2,
        zIndex: level === 'hot' ? 10 : level === 'active' ? 5 : 1,
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
      setNotice('현장 정보가 반영됐어요.')
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
  const catInfo = activePlace ? (CATEGORY_MAP[activePlace.categoryCode] || DEFAULT_CAT) : DEFAULT_CAT

  // ── Render ──────────────────────────────────────────────
  return (
    <div className={`app-root app-root--${screen}`}>
      {notice && <div className="toast">{notice}</div>}

      {/* ── 지도 화면 ── */}
      <div className={`map-screen${screen === 'map' ? '' : ' map-screen--hidden'}`}>
        <div ref={mapContainerRef} className="kakao-map" />

        {/* 상단 오버레이 */}
        <div className="map-top">
          <div className="map-logo">here.</div>
          <button className="map-gps-btn" onClick={locateUser} disabled={gpsLoading}>
            {gpsLoading ? '⟳' : '📍'}
          </button>
        </div>

        {/* 로딩/빈 상태 */}
        {nearbyPlaces.length === 0 && kakaoReady && !gpsLoading && (
          <div className="map-hint">📍 위치 버튼을 눌러 주변 장소를 불러오세요</div>
        )}
        {gpsLoading && (
          <div className="map-hint">위치 확인 중...</div>
        )}

        {/* 닉네임 배지 */}
        <div className="map-nick-badge" style={{ borderColor: myColor }}>
          <span className="dot" style={{ background: myColor }} />
          {myNick}
        </div>

        {/* 핀 범례 */}
        {nearbyPlaces.length > 0 && (
          <div className="map-legend">
            <span className="legend-item"><span className="legend-dot legend-dot--empty" />조용함</span>
            <span className="legend-item"><span className="legend-dot legend-dot--low" />대화 중</span>
            <span className="legend-item"><span className="legend-dot legend-dot--active" />활발</span>
            <span className="legend-item"><span className="legend-dot legend-dot--hot" />핫</span>
          </div>
        )}

        {/* 바텀 시트 */}
        {selectedPlace && (
          <div className="bottom-sheet" onClick={(e) => e.target === e.currentTarget && setSelectedPlace(null)}>
            <div className="bottom-sheet-inner">
              <div className="sheet-handle" onClick={() => setSelectedPlace(null)} />
              <div className="sheet-head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sheet-category">
                    {(CATEGORY_MAP[selectedPlace.categoryCode] || DEFAULT_CAT).emoji} {selectedPlace.categoryName}
                  </div>
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

              {(() => {
                const count = placeActivity[selectedPlace.id]?.count || 0
                const level = getLevel(count)
                const label = { empty: '조용함', low: `💬 ${count}명 대화 중`, active: `🔥 ${count}명 활발`, hot: `🔥🔥 ${count}명 지금 핫` }[level]
                return <div className={`sheet-activity sheet-activity--${level}`}>{label}</div>
              })()}

              <button className="sheet-enter-btn" onClick={() => enterPlace(selectedPlace)}>
                들어가기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 채팅 화면 ── */}
      {screen === 'chat' && activePlace && (
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
                <span className="eyebrow">{catInfo.emoji} {activePlace.categoryName}</span>
                <h2>{activePlace.name}</h2>
                <p style={{ fontSize: 12, color: '#9a9ea9', margin: 0 }}>{activePlace.address}</p>
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
                    return (
                      <button key={label}
                        className={`chip ${myVibe === label ? 'active' : ''}`}
                        onClick={() => voteVibe(label)}
                        disabled={!!myVibe}
                        style={{ flex: 1, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                      >
                        {totalVotes > 0 && (
                          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(255,107,107,0.12)', transition: 'width 0.4s' }} />
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

              {/* 한 줄 현장 정보 */}
              <div className="panel">
                <div className="section-title inner"><span>한 줄 현장 정보</span></div>
                <div className="chips-row wrap">
                  {catInfo.updates.map((label) => (
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
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="지금 여기 분위기 어때요? 익명으로 남겨보세요."
                    maxLength={MAX_MSG_LEN}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(messageInput) } }}
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
      )}
    </div>
  )
}

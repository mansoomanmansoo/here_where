// 일회성 명당 데이터 수집 → Supabase 저장
// 호출: /api/admin-collect?secret=luck2024
export const config = { regions: ['icn1'], maxDuration: 60 }

import { createClient } from '@supabase/supabase-js'

const SECRET = 'luck2024'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY
const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','경기','강원','충북','충남','전북','전남','경북','경남','제주']
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function fetchRegion(region) {
  const url = `https://lotto.agptedu.com/lotto-area-search/?addr=${encodeURIComponent(region)}`
  const r = await fetch(url, { headers: HEADERS })
  const html = await r.text()
  const stores = []
  const seen = new Set()

  // iw_title_text(이름) + addr= 링크(주소) 추출
  const blockRe = /<a\s+href="[^"]*[?&]addr=([^"#&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = blockRe.exec(html)) !== null) {
    const addr = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
    if (!addr || !addr.match(/특별시|광역시|\s[시군구]\s|\d+/)) continue
    const nameM = m[2].match(/class="iw_title_text"[^>]*>([\s\S]*?)<\//)
    const name = nameM ? nameM[1].replace(/<[^>]+>/g, '').trim() : ''
    const winsM = m[2].match(/(\d+)\s*회/)
    const wins = winsM ? parseInt(winsM[1]) : 0
    const key = addr
    if (seen.has(key)) continue
    seen.add(key)
    stores.push({ name, addr, region: addr.split(/\s/)[0] || region, wins, drw_no: null })
  }
  return stores
}

export default async function handler(req, res) {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: '인증 필요' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const log = []
  const all = []

  for (const region of REGIONS) {
    try {
      const stores = await fetchRegion(region)
      log.push(`${region}: ${stores.length}개`)
      all.push(...stores)
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      log.push(`${region}: 실패 (${e.message})`)
    }
  }

  // 중복 제거
  const seen = new Set()
  const unique = all.filter(s => {
    const key = s.addr || s.name
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 기존 삭제 후 재삽입
  await supabase.from('winner_stores').delete().neq('id', 0)

  let inserted = 0
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await supabase.from('winner_stores').insert(unique.slice(i, i + 100))
    if (!error) inserted += Math.min(100, unique.length - i)
  }

  return res.status(200).json({
    success: true,
    collected: unique.length,
    inserted,
    log,
    sample: unique.slice(0, 5),
  })
}

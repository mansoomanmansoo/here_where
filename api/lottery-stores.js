// 전국 명당 랭킹 (lotto.agptedu.com 지역별 TOP10)
export const config = { regions: ['icn1'] }

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','경기','강원','충북','충남','전북','전남','경북','경남','제주']
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function fetchRegion(region) {
  const r = await fetch(
    `https://lotto.agptedu.com/lotto-area-search/?addr=${encodeURIComponent(region)}`,
    { headers: HEADERS }
  )
  const html = await r.text()
  const stores = []
  const seen = new Set()

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1]
    const nameM = row.match(/class="shop-name"[^>]*>([\s\S]*?)<\/span>/)
    const winsM = row.match(/class="win-count"[^>]*>(\d+)/)
    if (!nameM || !winsM) continue
    const name = nameM[1].replace(/<[^>]+>/g, '').trim()
    const wins = parseInt(winsM[1])
    if (!name || seen.has(name)) continue
    seen.add(name)
    stores.push({ name, wins, region })
  }
  return stores
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const all = []
    const seen = new Set()

    for (const region of REGIONS) {
      const stores = await fetchRegion(region)
      stores.forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); all.push(s) }
      })
      await new Promise(r => setTimeout(r, 200))
    }

    all.sort((a, b) => b.wins - a.wins)

    if (all.length < 5) {
      // 파싱 실패 시 디버그
      const r2 = await fetch('https://lotto.agptedu.com/lotto-area-search/?addr=서울', { headers: HEADERS })
      const html = await r2.text()
      const idx = html.indexOf('shop-name')
      return res.status(200).json({ totalCount: 0, data: [], debug: html.slice(Math.max(0,idx-50), idx+300) })
    }

    return res.status(200).json({ totalCount: all.length, data: all })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

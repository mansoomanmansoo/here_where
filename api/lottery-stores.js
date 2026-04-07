// 전국 명당 랭킹 (lotto.agptedu.com 지역별 TOP10)
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const r = await fetch('https://lotto.agptedu.com/lotto-area-search/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    })
    const html = await r.text()

    const stores = []
    const seen = new Set()

    // shop-name + win-count 쌍 추출
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowM
    while ((rowM = rowRe.exec(html)) !== null) {
      const row = rowM[1]
      const nameMatch = row.match(/class="shop-name"[^>]*>([\s\S]*?)<\//)
      const winsMatch = row.match(/class="win-count"[^>]*>(\d+)/)
      // addr= 링크가 같은 행에 있으면 추출
      const addrMatch = row.match(/[?&]addr=([^"#&]+)/)

      if (!nameMatch) continue
      const name = nameMatch[1].replace(/<[^>]+>/g, '').trim()
      if (!name || seen.has(name)) continue

      const wins = winsMatch ? parseInt(winsMatch[1]) : 0
      const addr = addrMatch ? decodeURIComponent(addrMatch[1].replace(/\+/g, ' ')).trim() : ''
      const region = addr ? addr.split(' ')[0] : ''

      seen.add(name)
      stores.push({ name, wins, addr, region })
    }

    // iw_title_text 방식도 병행 (테이블 구조가 다를 경우 대비)
    if (stores.length < 10) {
      const blockRe = /class="iw_title_text"[^>]*>([\s\S]*?)<\/[\s\S]*?(\d+)\s*회/g
      let m
      while ((m = blockRe.exec(html)) !== null) {
        const name = m[1].replace(/<[^>]+>/g, '').trim()
        const wins = parseInt(m[2])
        if (name && !seen.has(name)) {
          seen.add(name)
          stores.push({ name, wins, addr: '', region: '' })
        }
      }
    }

    stores.sort((a, b) => b.wins - a.wins)

    // 파싱 결과가 너무 적으면 디버그 정보 포함
    if (stores.length < 5) {
      const snippet = html.slice(html.indexOf('shop-name') - 100, html.indexOf('shop-name') + 500)
      return res.status(200).json({ totalCount: stores.length, data: stores, debug: snippet })
    }

    return res.status(200).json({ totalCount: stores.length, data: stores })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

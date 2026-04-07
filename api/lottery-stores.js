// 전국 명당 랭킹 + 주소 (lotto.agptedu.com 지역별 TOP10 스크래핑)
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

    // addr= 링크에서 이름 + 주소 추출
    // <a href="...addr=ADDRESS..."><span class="iw_title_text">NAME</span>
    const stores = []
    const seen = new Set()

    const blockRe = /<a\s+href="[^"]*[?&]addr=([^"#&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = blockRe.exec(html)) !== null) {
      const addr = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
      if (!addr || seen.has(addr)) continue
      if (!addr.match(/특별시|광역시|도\s|시\s|구\s|\d+/)) continue

      // 이름: iw_title_text 클래스
      const nameMatch = m[2].match(/class="iw_title_text"[^>]*>([\s\S]*?)</)
      const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : ''

      // 당첨 횟수: 숫자 추출
      const winsMatch = m[2].match(/(\d+)\s*회/)
      const wins = winsMatch ? parseInt(winsMatch[1]) : 0

      // 지역 (주소 첫 단어)
      const region = addr.split(' ')[0]

      seen.add(addr)
      stores.push({ name, addr, region, wins })
    }

    // 당첨 횟수 내림차순 정렬
    stores.sort((a, b) => b.wins - a.wins)

    return res.status(200).json({ totalCount: stores.length, data: stores })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

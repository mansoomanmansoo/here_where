export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const r = await fetch('https://lotto.agptedu.com/lotto-area-search/?addr=서울', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    })
    const html = await r.text()

    // lotto-tbl 테이블 전체 추출
    const tblMatch = html.match(/<table[^>]*class="[^"]*lotto-tbl[^"]*"[^>]*>([\s\S]*?)<\/table>/)
    const tbl = tblMatch ? tblMatch[0].slice(0, 3000) : '테이블 없음'

    // shop-name 주변 컨텍스트
    const idx = html.indexOf('shop-name')
    const shopCtx = idx >= 0 ? html.slice(Math.max(0, idx - 100), idx + 400) : 'shop-name 없음'

    // win-count 주변 컨텍스트
    const idx2 = html.indexOf('win-count')
    const winCtx = idx2 >= 0 ? html.slice(Math.max(0, idx2 - 100), idx2 + 400) : 'win-count 없음'

    return res.status(200).json({ tbl, shopCtx, winCtx })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

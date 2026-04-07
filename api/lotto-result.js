// 로또 당첨번호 (lotto.agptedu.com 파싱)
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

    // 회차
    const drwMatch = html.match(/제\s*(\d+)\s*회/)
    const drwNo = drwMatch ? parseInt(drwMatch[1]) : null

    // 날짜
    const dateMatch = html.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
    const drwDate = dateMatch
      ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2,'0')}-${String(dateMatch[3]).padStart(2,'0')}`
      : null

    // 번호 (l-ball 클래스)
    const balls = [...html.matchAll(/class="l-ball[^"]*"[^>]*>(\d+)</g)].map(m => parseInt(m[1]))
    const numbers = balls.slice(0, 6)
    const bonus = balls[6] ?? null

    if (!drwNo || numbers.length < 6) {
      return res.status(500).json({ error: '파싱 실패', drwNo, balls })
    }

    return res.status(200).json({ drwNo, drwDate, numbers, bonus })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

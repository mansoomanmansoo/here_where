// 로또 당첨번호 + 이번 회차 1등 당첨점 (lotto.agptedu.com 스크레이핑)
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

    // ── 회차 & 날짜 ──
    const drwMatch = html.match(/제\s*(\d+)\s*회/)
    const dateMatch = html.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
    const drwNo = drwMatch ? parseInt(drwMatch[1]) : null
    const drwDate = dateMatch ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2,'0')}-${String(dateMatch[3]).padStart(2,'0')}` : null

    // ── 당첨번호 (l-ball 클래스) ──
    const ballMatches = [...html.matchAll(/class="l-ball[^"]*">(\d+)</g)]
    const balls = ballMatches.map(m => parseInt(m[1]))
    const numbers = balls.slice(0, 6)
    const bonus = balls[6] ?? null

    // ── 1등 당첨점 테이블 (상호명, 주소, 당첨구분) ──
    const winners = []
    // <tr> 행에서 td 값 추출
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let rowM
    while ((rowM = rowRe.exec(html)) !== null) {
      const cells = [...rowM[1].matchAll(tdRe)].map(m =>
        m[1].replace(/<[^>]+>/g, '').trim()
      )
      // 주소처럼 보이는 행 (시/도 포함, 4개 이상 셀)
      if (cells.length >= 3 && cells.some(c => c.match(/특별시|광역시|도\s|시\s|구\s/))) {
        const name = cells[0]
        const type = cells[1]
        const addr = cells.find(c => c.match(/특별시|광역시|도\s|시\s|구\s/)) || ''
        if (name && addr) winners.push({ name, type, addr })
      }
    }

    if (!drwNo || numbers.length < 6) {
      return res.status(500).json({ error: '파싱 실패', html: html.slice(0, 500) })
    }

    return res.status(200).json({ drwNo, drwDate, numbers, bonus, winners })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

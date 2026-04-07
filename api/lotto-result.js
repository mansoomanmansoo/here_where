// 동행복권 로또 당첨번호 (세션 쿠키 방식)
export const config = { regions: ['icn1'] }

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.dhlottery.co.kr/',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    // 1단계: 메인 페이지에서 세션 쿠키 + 최신 회차 획득
    const mainRes = await fetch('https://www.dhlottery.co.kr/common.do?method=main', { headers: HEADERS })
    const cookies = mainRes.headers.get('set-cookie') || ''
    const mainHtml = await mainRes.text()

    // 최신 회차 추출 (id="lottoDrwNo")
    const drwNoMatch = mainHtml.match(/id="lottoDrwNo">(\d+)</)
    let drwNo = drwNoMatch
      ? parseInt(drwNoMatch[1])
      : Math.floor((Date.now() - new Date('2002-12-07').getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

    // 2단계: 쿠키 들고 당첨번호 API 호출
    const apiRes = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`,
      { headers: { ...HEADERS, Cookie: cookies } }
    )
    const text = await apiRes.text()

    // JSON 파싱 시도
    let d
    try { d = JSON.parse(text) } catch {
      // 여전히 HTML이면 직전 회차 재시도
      const apiRes2 = await fetch(
        `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo - 1}`,
        { headers: { ...HEADERS, Cookie: cookies } }
      )
      const text2 = await apiRes2.text()
      try { d = JSON.parse(text2); drwNo = drwNo - 1 }
      catch { return res.status(500).json({ error: '파싱 실패', raw: text.slice(0, 200) }) }
    }

    if (d.returnValue !== 'success') {
      return res.status(500).json({ error: 'API returnValue 실패', d })
    }

    return res.status(200).json({
      drwNo: d.drwNo,
      drwDate: d.drwNoDate,
      numbers: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6],
      bonus: d.bnusNo,
      totSellAmt: d.totSellamnt,
      first: { winners: d.firstPrzwnerCo, prize: d.firstWinamnt },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

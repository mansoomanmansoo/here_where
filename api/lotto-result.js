// 동행복권 로또 당첨번호 프록시 (서울 리전 실행)
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // 최신 회차 자동 계산 (1회차: 2002-12-07, 매주 토요일)
  let drwNo = parseInt(req.query.drwNo)
  if (!drwNo) {
    drwNo = Math.floor((Date.now() - new Date('2002-12-07').getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  }

  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.dhlottery.co.kr/',
        'Accept': 'application/json, text/javascript, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    })
    const text = await res.status(200) // dummy
    const body = await r.text()
    return res.status(200).json({ debug: { status: r.status, drwNo, body: body.slice(0, 300) } })
  } catch (e) {
    return res.status(200).json({ debug: { error: e.message, drwNo } })
  }
}

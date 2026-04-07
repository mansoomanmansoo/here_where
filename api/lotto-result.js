// 동행복권 로또 당첨번호 프록시
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // 최신 회차 자동 계산 (1회차: 2002-12-07, 매주 토요일)
  let drwNo = parseInt(req.query.drwNo)
  if (!drwNo) {
    drwNo = Math.floor((Date.now() - new Date('2002-12-07').getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  }

  // 최신 회차 시도, 실패하면 전 회차
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(
        `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo - attempt}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      const d = await r.json()
      if (d.returnValue !== 'success') continue

      return res.status(200).json({
        drwNo: d.drwNo,
        drwNoDate: d.drwNoDate,
        numbers: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6],
        bonus: d.bnusNo,
        totSellAmt: d.totSellamnt,
        first: {
          winners: d.firstPrzwnerCo,
          prize: d.firstWinamnt,
        },
      })
    } catch (e) {
      continue
    }
  }

  return res.status(500).json({ error: '당첨 정보를 불러오지 못했어요.' })
}

// 동행복권 로또 당첨번호 + 등위별 당첨금 프록시
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // 회차 번호: 쿼리로 받거나, 최신 회차 자동 계산
  let drwNo = parseInt(req.query.drwNo)
  if (!drwNo) {
    // 1회차: 2002-12-07 기준, 매주 토요일
    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    drwNo = Math.floor((Date.now() - new Date('2002-12-07').getTime()) / msPerWeek) + 1
  }

  try {
    // 1등 정보 (JSON API)
    const r1 = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`
    )
    const basic = await r1.json()

    if (basic.returnValue !== 'success') {
      // 최신 회차가 아직 발표 전이면 전 회차 시도
      const r2 = await fetch(
        `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo - 1}`
      )
      const prev = await r2.json()
      if (prev.returnValue !== 'success') {
        return res.status(404).json({ error: '당첨 정보를 불러오지 못했어요.' })
      }
      return res.status(200).json(buildResult(prev))
    }

    // 2~5등 정보: HTML 페이지 파싱
    const htmlRes = await fetch(
      `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${basic.drwNo}`
    )
    const html = await htmlRes.text()
    const prizes = parseRanks(html)

    return res.status(200).json(buildResult(basic, prizes))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

function buildResult(d, prizes = []) {
  return {
    drwNo: d.drwNo,
    drwNoDate: d.drwNoDate,
    numbers: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6],
    bonus: d.bnusNo,
    totSellAmt: d.totSellamnt,
    ranks: [
      { rank: 1, winners: d.firstPrzwnerCo, prize: d.firstWinamnt },
      ...prizes,
    ],
  }
}

function parseRanks(html) {
  // <td> 파싱: 2~5등 당첨자 수와 당첨금 추출
  const ranks = []
  // 테이블 행 패턴: "2등", "3등" ... 숫자들
  const rowRe = /(\d)등.*?(\d[\d,]+)명.*?(\d[\d,]+)원/gs
  let m
  while ((m = rowRe.exec(html)) !== null) {
    const rank = parseInt(m[1])
    if (rank >= 2 && rank <= 5) {
      ranks.push({
        rank,
        winners: parseInt(m[2].replace(/,/g, '')),
        prize: parseInt(m[3].replace(/,/g, '')),
      })
    }
  }
  // 파싱 실패 시 빈 배열 반환 (1등만 표시)
  return ranks
}

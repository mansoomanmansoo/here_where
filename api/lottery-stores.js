// Vercel 서버리스 함수: data.go.kr 복권 1등 당첨점 API 프록시
// 데이터: 상호, 지역, 1등 자동 당첨 건수 (최신 2025년 기준)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const key = process.env.ODCLOUD_KEY
  if (!key) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' })
  }

  const { page = 1, perPage = 1000 } = req.query

  // 최신 데이터셋 (20250607 기준)
  // serviceKey는 인코딩 없이 그대로 전달 (data.go.kr 요구사항)
  const url =
    `https://api.odcloud.kr/api/15059963/v1/uddi:76bba8dc-16b6-4898-96af-e3c056854ec3` +
    `?serviceKey=${key}&page=${page}&perPage=${perPage}&returnType=JSON`

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': key }
    })
    const text = await response.text()
    if (!response.ok) {
      return res.status(response.status).json({ error: `upstream ${response.status}`, detail: text.slice(0, 300) })
    }
    const data = JSON.parse(text)
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

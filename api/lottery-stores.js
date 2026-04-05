// Vercel 서버리스 함수: data.go.kr 복권 당첨점 API 프록시
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const key = process.env.ODCLOUD_KEY
  if (!key) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' })
  }

  const { page = 1, perPage = 1000 } = req.query

  // data.go.kr 온라인복권 1등 당첨점 정보 (dataset 15059963)
  const url =
    `https://api.odcloud.kr/api/15059963/v1/uddi:3b404269-ede0-4b40-a1b5-b6e4f9a33e8c` +
    `?serviceKey=${encodeURIComponent(key)}&page=${page}&perPage=${perPage}&returnType=JSON`

  try {
    const response = await fetch(url)
    const text = await response.text()

    // 응답이 JSON인지 확인
    try {
      const data = JSON.parse(text)
      return res.status(200).json(data)
    } catch {
      // JSON 파싱 실패 시 원문 반환 (디버그용)
      return res.status(200).json({ raw: text.slice(0, 500), status: response.status })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

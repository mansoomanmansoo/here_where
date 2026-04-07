// 이번 회차 전국 1등 당첨점 목록 (lotto.agptedu.com)
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

    // 회차
    const drwMatch = html.match(/제\s*(\d+)\s*회/)
    const drwNo = drwMatch ? parseInt(drwMatch[1]) : null

    // 당첨점: iw_title_text(상호명) + iw_addr(주소) 쌍으로 추출
    const stores = []
    const blockRe = /<span class="iw_title_text">([\s\S]*?)<\/span>[\s\S]*?<div class="iw_addr">([\s\S]*?)<\/div>/g
    let m
    while ((m = blockRe.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').trim()
      const addr = m[2].replace(/<[^>]+>/g, '').trim()
      if (name && addr) stores.push({ name, addr })
    }

    // addr= 링크에서 주소 보완 (iw_addr 파싱 실패 시 대비)
    if (stores.length === 0) {
      const linkRe = /href="[^"]*[?&]addr=([^"#&]+)"/g
      const seen = new Set()
      while ((m = linkRe.exec(html)) !== null) {
        const addr = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
        if (addr && !seen.has(addr) && addr.match(/특별시|광역시|도\s|시\s|구\s/)) {
          seen.add(addr)
          stores.push({ name: '', addr })
        }
      }
    }

    return res.status(200).json({ drwNo, stores })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

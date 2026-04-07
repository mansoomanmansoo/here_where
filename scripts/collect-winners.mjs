import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wdhflcminrkswgnwdgul.supabase.co'
const SUPABASE_KEY = 'sb_publishable_n18c6QyoXbRzsrgPHyhmmw_IDBMCP6l'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','경기','강원','충북','충남','전북','전남','경북','경남','제주']

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function fetchRegion(region) {
  const url = `https://lotto.agptedu.com/lotto-area-search/?addr=${encodeURIComponent(region)}`
  const r = await fetch(url, { headers: HEADERS })
  const html = await r.text()

  const stores = []
  const seen = new Set()

  // shop-name + win-count 파싱
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1]
    const nameM = row.match(/class="shop-name"[^>]*>([\s\S]*?)<\//)
    const winsM = row.match(/class="win-count"[^>]*>(\d+)/)
    const addrM = row.match(/[?&]addr=([^"#&]+)/)
    if (!nameM) continue
    const name = nameM[1].replace(/<[^>]+>/g, '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    stores.push({
      name,
      wins: winsM ? parseInt(winsM[1]) : 0,
      addr: addrM ? decodeURIComponent(addrM[1].replace(/\+/g, ' ')).trim() : '',
      region,
    })
  }

  // iw_title_text 방식 병행
  const blockRe = /<a\s+href="[^"]*[?&]addr=([^"#&]+)[^"]*"[^>]*>[\s\S]*?class="iw_title_text"[^>]*>([\s\S]*?)<\//g
  while ((m = blockRe.exec(html)) !== null) {
    const addr = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
    const name = m[2].replace(/<[^>]+>/g, '').trim()
    if (!name || seen.has(name)) continue
    if (!addr.match(/특별시|광역시|도\s|시\s|구\s|\d+/)) continue
    seen.add(name)
    stores.push({ name, wins: 0, addr, region: addr.split(' ')[0] || region })
  }

  return stores
}

async function main() {
  console.log('🔍 전국 명당 데이터 수집 시작...\n')
  const all = []

  for (const region of REGIONS) {
    process.stdout.write(`  ${region} 수집 중... `)
    try {
      const stores = await fetchRegion(region)
      console.log(`${stores.length}개`)
      all.push(...stores)
    } catch (e) {
      console.log(`실패 (${e.message})`)
    }
    await new Promise(r => setTimeout(r, 500)) // 과부하 방지
  }

  // 중복 제거 (주소 기준)
  const seen = new Set()
  const unique = all.filter(s => {
    const key = s.addr || s.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`\n✅ 총 ${unique.length}개 수집 완료`)
  console.log('📦 Supabase에 저장 중...')

  // 기존 데이터 삭제 후 재삽입
  await supabase.from('winner_stores').delete().neq('id', 0)

  // 100개씩 배치 삽입
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    const { error } = await supabase.from('winner_stores').insert(batch)
    if (error) console.error('  삽입 오류:', error.message)
    else console.log(`  ${i + batch.length}/${unique.length} 저장됨`)
  }

  console.log('\n🎉 완료!')

  // 결과 샘플 출력
  const { data } = await supabase.from('winner_stores').select('*').order('wins', { ascending: false }).limit(5)
  console.log('\n📊 상위 5개:')
  data?.forEach((s, i) => console.log(`  ${i+1}. ${s.name} (${s.region}) - ${s.wins}회 | ${s.addr}`))
}

main().catch(console.error)

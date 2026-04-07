// Supabase winner_stores 테이블에서 명당 데이터 조회
export const config = { regions: ['icn1'] }

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60')

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_KEY
    )

    const { data, error } = await supabase
      .from('winner_stores')
      .select('name, wins, addr, region')
      .order('wins', { ascending: false })
      .limit(300)

    if (error) throw new Error(error.message)

    return res.status(200).json({ totalCount: data.length, data: data || [] })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

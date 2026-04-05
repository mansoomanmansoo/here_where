import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase 환경변수가 설정되지 않았습니다.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

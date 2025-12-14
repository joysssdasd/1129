import { createClient } from '@supabase/supabase-js'

// 🔐 从环境变量读取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ 缺少Supabase环境变量配置')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

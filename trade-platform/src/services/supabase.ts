import { createClient } from '@supabase/supabase-js'

// 🔐 生产环境配置 - ticket本地项目
const PROD_SUPABASE_URL = 'https://mgyelmyjeidlvmmmjkqi.supabase.co'
const PROD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neWVsbXlqZWlkbHZtbW1qa3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0MDYsImV4cCI6MjA3ODI3ODQwNn0.LUc3nUNM-0JkUyqmZSMBKU3JP8Vm8vvfF1UwMMPt62k'

// 优先使用环境变量，如果没有则使用生产环境配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PROD_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || PROD_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mgyelmyjeidlvmmmjkqi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neWVsbXlqZWlkbHZtbW1qa3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0MDYsImV4cCI6MjA3ODI3ODQwNn0.LUc3nUNM-0JkUyqmZSMBKU3JP8Vm8vvfF1UwMMPt62k'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

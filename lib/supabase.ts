import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Expose to window in development for console testing
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).__supabase = supabase
}

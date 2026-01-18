// lib/supabase-client.ts
// Singleton Supabase client to prevent "Multiple instances" warning

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton instance
let supabaseInstance: SupabaseClient | null = null

/**
 * Get or create a singleton Supabase client
 * This prevents the "Multiple GoTrueClient instances" warning
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.log('🔧 Creating new Supabase client instance')
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Don't persist auth sessions (we use wallet auth)
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  }
  
  return supabaseInstance
}

/**
 * Reset the singleton (use sparingly, mainly for testing)
 */
export function resetSupabaseClient() {
  supabaseInstance = null
}
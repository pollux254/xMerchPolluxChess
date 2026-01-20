// lib/supabase-client.ts
// Singleton Supabase client to prevent "Multiple instances" warning

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Singleton instances
let supabaseInstance: SupabaseClient | null = null
let supabaseAdminInstance: SupabaseClient | null = null

/**
 * Get or create a singleton Supabase client (ANON KEY - for public operations)
 * This prevents the "Multiple GoTrueClient instances" warning
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.log('🔧 Creating new Supabase client instance (anon)')
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
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
 * Get or create a singleton Supabase ADMIN client (SERVICE ROLE KEY - for protected operations)
 * Use this for API routes that need to bypass RLS or perform admin actions
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminInstance) {
    console.log('🔧 Creating new Supabase ADMIN client instance (service role)')
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  }
  
  return supabaseAdminInstance
}

/**
 * Reset the singleton (use sparingly, mainly for testing)
 */
export function resetSupabaseClient() {
  supabaseInstance = null
  supabaseAdminInstance = null
}
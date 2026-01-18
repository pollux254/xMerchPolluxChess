// lib/middleware/cleanup-expired.ts
// Middleware that runs cleanup on EVERY request to ensure timestamps are enforced

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Run timestamp-based cleanup
 * This should be called on EVERY API request to ensure stale data is cleaned up
 */
export async function cleanupExpired() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Call the database function that does all cleanup based on timestamps
    const { data, error } = await supabase.rpc('cleanup_all_expired')

    if (error) {
      console.error('❌ Cleanup error:', error)
      return { success: false, error }
    }

    if (data && data.length > 0) {
      const result = data[0]
      if (result.tournaments_cleaned > 0 || result.games_cleaned > 0) {
        console.log('🧹 Cleanup completed:', {
          tournaments: result.tournaments_cleaned,
          games: result.games_cleaned,
          players: result.players_refunded
        })
      }
    }

    return { success: true, data }
  } catch (err) {
    console.error('❌ Cleanup exception:', err)
    return { success: false, error: err }
  }
}

/**
 * Get tournament status based on SERVER TIME
 */
export async function getTournamentStatus(tournamentId: string) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.rpc('get_tournament_status', {
    tournament_id_param: tournamentId
  })

  if (error) {
    console.error('Error getting tournament status:', error)
    return null
  }

  return data?.[0] || null
}

/**
 * Get game time status based on SERVER TIME
 */
export async function getGameTimeStatus(gameId: string) {
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.rpc('get_game_time_status', {
    game_id_param: gameId
  })

  if (error) {
    console.error('Error getting game time status:', error)
    return null
  }

  return data?.[0] || null
}
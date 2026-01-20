import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// AUTOMATED CLEANUP (Called by Vercel Cron)
// ============================================
export async function GET(request: NextRequest) {
  try {
    // Security: Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cleanup] Unauthorized cron attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cleanup] 🧹 Starting automated cleanup job...')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Cleanup] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()
    const results = {
      expiredTournaments: 0,
      stalledGames: 0,
      cleanedPlayers: 0,
      archivedGames: 0,
      orphanedPlayers: 0,
      oldCancelledTournaments: 0
    }

    // ============================================
    // 1. Cancel expired WAITING tournaments
    // ============================================
    const { data: expiredTournaments } = await supabase
      .from('tournaments')
      .select('id, expires_at, created_at')
      .eq('status', 'waiting')

    if (expiredTournaments && expiredTournaments.length > 0) {
      for (const tournament of expiredTournaments) {
        const expiresAt = tournament.expires_at 
          ? new Date(tournament.expires_at).getTime()
          : new Date(tournament.created_at).getTime() + (10 * 60 * 1000)
        
        if (expiresAt <= now.getTime()) {
          // Cancel tournament
          await supabase
            .from('tournaments')
            .update({ 
              status: 'cancelled',
              cancelled_reason: 'Expired - not enough players joined in time',
              updated_at: now.toISOString()
            })
            .eq('id', tournament.id)

          // Remove players
          const { count } = await supabase
            .from('tournament_players')
            .delete()
            .eq('tournament_id', tournament.id)

          results.expiredTournaments++
          results.cleanedPlayers += count || 0

          console.log(`[Cleanup] ✅ Cancelled expired tournament: ${tournament.id} (${count} players removed)`)
        }
      }
    }

    // ============================================
    // 2. Cancel stalled games (no moves in 3 mins)
    // ============================================
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000)
    const { data: stalledGames } = await supabase
      .from('tournament_games')
      .select('id, game_state, created_at, tournament_id')
      .eq('status', 'in_progress')
      .lt('created_at', threeMinutesAgo.toISOString())

    if (stalledGames && stalledGames.length > 0) {
      for (const game of stalledGames) {
        const gameState = game.game_state as any
        const moveCount = gameState?.moveHistory?.length || 0
        
        // If no moves made and game older than 3 mins, cancel it
        if (moveCount === 0) {
          await supabase
            .from('tournament_games')
            .update({ 
              status: 'cancelled',
              result: 'first_move_timeout',
              updated_at: now.toISOString()
            })
            .eq('id', game.id)

          // Also cancel the tournament
          await supabase
            .from('tournaments')
            .update({ 
              status: 'cancelled',
              cancelled_reason: 'Game never started - first move timeout',
              updated_at: now.toISOString()
            })
            .eq('id', game.tournament_id)

          results.stalledGames++
          console.log(`[Cleanup] ✅ Cancelled stalled game: ${game.id}`)
        }
      }
    }

    // ============================================
    // 3. Archive old completed/cancelled games (7+ days)
    // ============================================
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const { count: archivedCount } = await supabase
      .from('tournament_games')
      .delete()
      .in('status', ['completed', 'cancelled'])
      .lt('created_at', sevenDaysAgo.toISOString())

    results.archivedGames = archivedCount || 0
    if (archivedCount) {
      console.log(`[Cleanup] ✅ Archived ${archivedCount} old games`)
    }

    // ============================================
    // 4. Remove orphaned players (tournament doesn't exist)
    // ============================================
    const { data: allPlayers } = await supabase
      .from('tournament_players')
      .select('id, tournament_id')

    if (allPlayers && allPlayers.length > 0) {
      for (const player of allPlayers) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('id')
          .eq('id', player.tournament_id)
          .maybeSingle()

        if (!tournament) {
          await supabase
            .from('tournament_players')
            .delete()
            .eq('id', player.id)
          
          results.orphanedPlayers++
        }
      }
      
      if (results.orphanedPlayers > 0) {
        console.log(`[Cleanup] ✅ Removed ${results.orphanedPlayers} orphaned players`)
      }
    }

    // ============================================
    // 5. Delete old cancelled tournaments (1+ hour ago)
    // ============================================
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const { count: deletedTournaments } = await supabase
      .from('tournaments')
      .delete()
      .eq('status', 'cancelled')
      .lt('updated_at', oneHourAgo.toISOString())

    results.oldCancelledTournaments = deletedTournaments || 0
    if (deletedTournaments) {
      console.log(`[Cleanup] ✅ Deleted ${deletedTournaments} old cancelled tournaments`)
    }

    // ============================================
    // Summary
    // ============================================
    console.log('[Cleanup] ✅ Automated cleanup completed:', results)

    return NextResponse.json({
      success: true,
      cleaned: results,
      timestamp: now.toISOString()
    })

  } catch (error: any) {
    console.error('[Cleanup] ❌ Automated cleanup error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// ============================================
// PLAYER-SPECIFIC CLEANUP (Called by frontend)
// ============================================
export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup] Starting player-specific cleanup...')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Cleanup] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { playerAddress } = body

    if (!playerAddress) {
      return NextResponse.json(
        { error: 'Missing player address' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ✅ Find WAITING and IN_PROGRESS tournaments older than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const { data: stuckTournaments, error: findError } = await supabase
      .from('tournament_players')
      .select(`
        tournament_id,
        joined_at,
        tournaments!inner (
          id,
          status,
          created_at,
          expires_at
        )
      `)
      .eq('player_address', playerAddress)
      .in('tournaments.status', ['waiting', 'in_progress'])
      .lt('joined_at', tenMinutesAgo.toISOString())

    if (findError) {
      console.error('[Cleanup] Error finding tournaments:', findError)
      return NextResponse.json(
        { error: 'Failed to find tournaments' },
        { status: 500 }
      )
    }

    // Also check for expired tournaments even if less than 10 mins old
    const { data: expiredForPlayer } = await supabase
      .from('tournament_players')
      .select(`
        tournament_id,
        tournaments!inner (
          id,
          status,
          expires_at,
          created_at
        )
      `)
      .eq('player_address', playerAddress)
      .in('tournaments.status', ['waiting', 'in_progress'])

    // Merge and deduplicate
    const allStuckTournaments = [...(stuckTournaments || []), ...(expiredForPlayer || [])]
    const uniqueTournaments = allStuckTournaments.filter((t, index, self) => 
      index === self.findIndex((t2) => t2.tournament_id === t.tournament_id)
    )

    // Filter to only truly expired/stuck tournaments
    const now = Date.now()
    const reallyStuck = uniqueTournaments.filter(entry => {
      const tournament = entry.tournaments as any
      const expiresAt = tournament?.expires_at 
        ? new Date(tournament.expires_at).getTime()
        : new Date(tournament.created_at).getTime() + (10 * 60 * 1000)
      
      // Either expired OR stuck for 10+ mins
      return expiresAt <= now || new Date(entry.joined_at).getTime() < tenMinutesAgo.getTime()
    })

    if (!reallyStuck || reallyStuck.length === 0) {
      console.log('[Cleanup] No stuck tournaments found for this player (good!)')
      return NextResponse.json({
        success: true,
        message: 'No cleanup needed',
        removed: 0
      })
    }

    console.log(`[Cleanup] Found ${reallyStuck.length} stuck tournament(s) for player`)
    
    const removedFrom: string[] = []

    for (const entry of reallyStuck) {
      const tournamentId = entry.tournament_id
      const tournament = entry.tournaments as any
      const status = tournament?.status || 'unknown'
      
      console.log(`[Cleanup] Removing player from stuck ${status} tournament ${tournamentId}`)

      const { error: deleteError } = await supabase
        .from('tournament_players')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('player_address', playerAddress)

      if (deleteError) {
        console.error(`[Cleanup] Error removing from ${tournamentId}:`, deleteError)
        continue
      }

      removedFrom.push(tournamentId)

      // Check if tournament is now empty
      const { count: remainingPlayers } = await supabase
        .from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)

      if (remainingPlayers === 0) {
        console.log(`[Cleanup] Cancelling empty tournament ${tournamentId}`)
        await supabase
          .from('tournaments')
          .update({
            status: 'cancelled',
            cancelled_reason: 'All players left tournament',
            updated_at: new Date().toISOString()
          })
          .eq('id', tournamentId)
      }
    }

    console.log(`[Cleanup] Success! Removed player from ${removedFrom.length} stuck tournament(s)`)
    
    return NextResponse.json({
      success: true,
      message: 'Cleaned up stuck tournaments',
      removed: removedFrom.length,
      tournamentIds: removedFrom
    })

  } catch (error: any) {
    console.error('[Cleanup] Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    )
  }
}
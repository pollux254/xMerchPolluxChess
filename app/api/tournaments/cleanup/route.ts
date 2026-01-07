import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Force remove player from ALL active tournaments
export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup] Starting player cleanup...')
    
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

    // Find all tournaments player is in (waiting or in-progress)
    const { data: playerInTournaments, error: findError } = await supabase
      .from('tournament_players')
      .select(`
        tournament_id,
        tournaments!inner (
          id,
          status
        )
      `)
      .eq('player_address', playerAddress)
      .in('tournaments.status', ['waiting', 'in_progress'])

    if (findError) {
      console.error('[Cleanup] Error finding tournaments:', findError)
      return NextResponse.json(
        { error: 'Failed to find tournaments' },
        { status: 500 }
      )
    }

    if (!playerInTournaments || playerInTournaments.length === 0) {
      console.log('[Cleanup] No active tournaments found for player')
      return NextResponse.json({
        success: true,
        message: 'No active tournaments',
        removed: 0
      })
    }

    console.log(`[Cleanup] Found ${playerInTournaments.length} tournament(s) for player`)

    const removedFrom: string[] = []

    // Remove player from each tournament
    for (const entry of playerInTournaments) {
      const tournamentId = entry.tournament_id
      const status = (entry as any).tournaments?.status

      console.log(`[Cleanup] Removing player from tournament ${tournamentId} (status: ${status})`)

      // Delete player record
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

      // If tournament is waiting, check if it should be cancelled
      if (status === 'waiting') {
        const { count: remainingPlayers, error: countError } = await supabase
          .from('tournament_players')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId)

        if (!countError && remainingPlayers === 0) {
          // No players left, cancel tournament
          console.log(`[Cleanup] Cancelling empty tournament ${tournamentId}`)
          await supabase
            .from('tournaments')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_reason: 'All players left'
            })
            .eq('id', tournamentId)
        }
      }
    }

    console.log(`[Cleanup] Success! Removed from ${removedFrom.length} tournament(s)`)

    return NextResponse.json({
      success: true,
      message: 'Player cleaned up from all tournaments',
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
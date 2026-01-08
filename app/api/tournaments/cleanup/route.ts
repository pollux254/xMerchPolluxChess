import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup] Starting smart cleanup...')
    
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
          created_at
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

    if (!stuckTournaments || stuckTournaments.length === 0) {
      console.log('[Cleanup] No stuck tournaments found (good!)')
      return NextResponse.json({
        success: true,
        message: 'No cleanup needed',
        removed: 0
      })
    }

    console.log(`[Cleanup] Found ${stuckTournaments.length} stuck tournament(s)`)
    
    const removedFrom: string[] = []

    for (const entry of stuckTournaments) {
      const tournamentId = entry.tournament_id
      const tournament = entry.tournaments as any
      const status = tournament?.status || 'unknown'
      
      console.log(`[Cleanup] Removing from stuck ${status} tournament ${tournamentId}`)

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
            cancelled_reason: 'All players left tournament'
          })
          .eq('id', tournamentId)
      }
    }

    console.log(`[Cleanup] Success! Removed from ${removedFrom.length} stuck tournament(s)`)
    
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
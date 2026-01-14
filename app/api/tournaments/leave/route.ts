import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    console.log('[Leave] Player leaving tournament...')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Leave] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { playerAddress, tournamentId } = body

    if (!playerAddress || !tournamentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[Leave] Removing ${playerAddress} from ${tournamentId}`)

    // Remove player from tournament
    const { error: deleteError } = await supabase
      .from('tournament_players')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('player_address', playerAddress)

    if (deleteError) {
      console.error('[Leave] Error removing player:', deleteError)
      return NextResponse.json(
        { error: 'Failed to leave tournament' },
        { status: 500 }
      )
    }

    // Check if tournament is now empty
    const { count: remainingPlayers } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    console.log(`[Leave] ${remainingPlayers || 0} players remaining`)

    // If empty, cancel the tournament
    if (remainingPlayers === 0) {
      console.log(`[Leave] Cancelling empty tournament ${tournamentId}`)
      
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          status: 'cancelled',
          cancelled_reason: 'All players left tournament'
        })
        .eq('id', tournamentId)

      if (updateError) {
        console.error('[Leave] Error cancelling tournament:', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Left tournament successfully',
      remainingPlayers: remainingPlayers || 0
    })

  } catch (error: any) {
    console.error('[Leave] Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    )
  }
}
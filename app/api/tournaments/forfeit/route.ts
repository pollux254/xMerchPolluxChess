import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    console.log('[Tournament Forfeit] Starting...')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Tournament Forfeit] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { playerAddress, tournamentId, reason } = body

    if (!playerAddress || !tournamentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('status, tournament_size, prize_pool, currency, entry_fee')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      console.error('[Tournament Forfeit] Tournament not found:', tournamentError)
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Only allow forfeit for active games
    if (tournament.status !== 'in_progress' && tournament.status !== 'in-progress') {
      console.log('[Tournament Forfeit] Tournament not in progress')
      return NextResponse.json(
        { error: 'Tournament not in progress' },
        { status: 400 }
      )
    }

    // Get all players in tournament
    const { data: players, error: playersError } = await supabase
      .from('tournament_players')
      .select('player_address, player_order')
      .eq('tournament_id', tournamentId)
      .eq('is_active', true)
      .order('player_order')

    if (playersError || !players || players.length < 2) {
      console.error('[Tournament Forfeit] Error getting players:', playersError)
      return NextResponse.json(
        { error: 'Failed to get tournament players' },
        { status: 500 }
      )
    }

    // Find the opponent (the player who will win)
    const opponent = players.find(p => p.player_address !== playerAddress)

    if (!opponent) {
      console.error('[Tournament Forfeit] No opponent found')
      return NextResponse.json(
        { error: 'Opponent not found' },
        { status: 404 }
      )
    }

    console.log(`[Tournament Forfeit] Player ${playerAddress} forfeits. Winner: ${opponent.player_address}`)

    // Update tournament status to completed
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({
        status: 'completed',
        winner: opponent.player_address,
        completed_at: new Date().toISOString(),
        forfeit_reason: reason || 'Player forfeited'
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('[Tournament Forfeit] Error updating tournament:', updateError)
      return NextResponse.json(
        { error: 'Failed to process forfeit' },
        { status: 500 }
      )
    }

    // Mark the forfeiting player as inactive/loser
    const { error: loserError } = await supabase
      .from('tournament_players')
      .update({
        is_active: false,
        is_winner: false,
        forfeited: true,
        forfeited_at: new Date().toISOString()
      })
      .eq('tournament_id', tournamentId)
      .eq('player_address', playerAddress)

    if (loserError) {
      console.error('[Tournament Forfeit] Error marking loser:', loserError)
    }

    // Mark the opponent as winner
    const { error: winnerError } = await supabase
      .from('tournament_players')
      .update({
        is_winner: true,
        won_at: new Date().toISOString()
      })
      .eq('tournament_id', tournamentId)
      .eq('player_address', opponent.player_address)

    if (winnerError) {
      console.error('[Tournament Forfeit] Error marking winner:', winnerError)
    }

    // TODO: Send prize pool to winner via Hooks
    // For now, log it for manual processing
    console.log(`[Tournament Forfeit] Prize ${tournament.prize_pool} ${tournament.currency} should be sent to ${opponent.player_address}`)

    // Store prize distribution info
    try {
      await supabase
        .from('prize_distributions')
        .insert({
          tournament_id: tournamentId,
          winner_address: opponent.player_address,
          amount: tournament.prize_pool,
          currency: tournament.currency,
          status: 'pending',
          distribution_type: 'forfeit',
          created_at: new Date().toISOString()
        })
    } catch (prizeError) {
      console.error('[Tournament Forfeit] Error logging prize:', prizeError)
      // Don't fail the forfeit if this fails
    }

    console.log('[Tournament Forfeit] Success! Forfeit processed.')
    return NextResponse.json({
      success: true,
      winner: opponent.player_address,
      loser: playerAddress,
      prizePool: tournament.prize_pool,
      currency: tournament.currency
    })

  } catch (error: any) {
    console.error('[Tournament Forfeit] Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    )
  }
}
// app/api/tournaments/check-player/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: Find the player's ID from tournament_players table
    const { data: players, error: playerError } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('player_address', address)
      .limit(1)

    if (playerError) {
      console.error('Error finding player:', playerError)
      return NextResponse.json({ error: playerError.message }, { status: 500 })
    }

    if (!players || players.length === 0) {
      // Player doesn't exist yet - they can join
      return NextResponse.json({
        hasActiveGame: false
      })
    }

    const playerId = players[0].id

    // Step 2: Check for active games where this player is white or black
    const { data: activeGames, error: gameError } = await supabase
      .from('tournament_games')
      .select('*')
      .or(`player_white.eq.${playerId},player_black.eq.${playerId}`)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)

    if (gameError) {
      console.error('Error checking games:', gameError)
      return NextResponse.json({ error: gameError.message }, { status: 500 })
    }

    // If there's an active game, check if it's actually still valid
    if (activeGames && activeGames.length > 0) {
      const game = activeGames[0]
      
      // Check if game is stale (created more than 30 minutes ago)
      const gameAge = Date.now() - new Date(game.created_at).getTime()
      const thirtyMinutesInMs = 30 * 60 * 1000
      
      if (gameAge > thirtyMinutesInMs) {
        console.log('🧹 Found stale game, marking as abandoned:', game.id)
        
        // Mark the stale game as abandoned/completed
        await supabase
          .from('tournament_games')
          .update({
            status: 'completed',
            result_reason: 'abandoned',
            completed_at: new Date().toISOString()
          })
          .eq('id', game.id)
        
        // Return no active game
        return NextResponse.json({
          hasActiveGame: false,
          message: 'Stale game cleaned up'
        })
      }

      // Game is fresh and valid
      return NextResponse.json({
        hasActiveGame: true,
        gameId: game.id,
        tournamentId: game.tournament_id
      })
    }

    // No active games found
    return NextResponse.json({
      hasActiveGame: false
    })
  } catch (err: any) {
    console.error('Error in check-player:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

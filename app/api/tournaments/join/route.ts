import { getSupabaseClient } from '@/lib/supabase-client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[Tournament Join] Starting...')

    const body = await request.json()
    console.log('[Tournament Join] Request body:', body)

    const {
      playerAddress,
      tournamentSize,
      entryFee,
      currency,
      issuer,
      signingWallet,
    } = body

    if (!playerAddress || !tournamentSize || !entryFee || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (signingWallet && signingWallet !== playerAddress) {
      console.error('[Tournament Join] Wallet mismatch:', {
        playerAddress,
        signingWallet
      })
      return NextResponse.json(
        { 
          error: `Wallet Mismatch: You're logged in as ${playerAddress.slice(0,10)}...${playerAddress.slice(-6)} but signed with ${signingWallet.slice(0,10)}...${signingWallet.slice(-6)}. Please disconnect and log in with the correct wallet.`
        },
        { status: 403 }
      )
    }

    const supabase = getSupabaseClient()

    // Build tournament ID early so we can use it in checks
    const network = body.network || 'testnet'
    const potentialTournamentId = `${currency}_${tournamentSize}_${entryFee}_${network.toUpperCase()}_ROOM1`

    // Check if player is already in any active tournament
    const { data: existingEntries } = await supabase
      .from('tournament_players')
      .select('tournament_id, tournaments!inner(id, status)')
      .eq('player_address', playerAddress)
      .in('tournaments.status', ['waiting', 'in_progress', 'in-progress'])

    if (existingEntries && existingEntries.length > 0) {
      const existing = existingEntries[0]
      
      // CRITICAL FIX: If they're in THIS tournament but game doesn't exist yet,
      // let them through to create the game
      const isInRequestedTournament = existingEntries.some(
        entry => entry.tournament_id === potentialTournamentId
      )
      
      if (!isInRequestedTournament) {
        // They're in a DIFFERENT tournament - reject
        const tournament = Array.isArray(existing.tournaments)
          ? existing.tournaments[0]
          : existing.tournaments

        return NextResponse.json(
          {
            success: false,
            error: 'Already in active tournament',
            tournamentId: existing.tournament_id,
            status: tournament?.status || 'waiting',
          },
          { status: 409 }
        )
      }
      
      // They're in THIS tournament - check if game already exists
      const { data: existingGame } = await supabase
        .from('tournament_games')
        .select('id')
        .eq('tournament_id', potentialTournamentId)
        .maybeSingle()
      
      if (existingGame) {
        console.log('[Tournament Join] Game already exists, player already in')
        return NextResponse.json({
          success: true,
          tournamentId: potentialTournamentId,
          isFull: true,
          alreadyJoined: true,
          message: 'Already in tournament and game exists',
        })
      }
      
      console.log('[Tournament Join] Player in tournament but no game yet - proceeding to create')
    }

    // Find waiting tournaments with exact match
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, tournament_size, entry_fee, currency, issuer, status, expires_at, created_at')
      .eq('status', 'waiting')
      .eq('tournament_size', tournamentSize)
      .eq('entry_fee', entryFee)
      .eq('currency', currency)

    const matchingTournaments = (tournaments || []).filter(t =>
      issuer == null ? t.issuer == null : t.issuer === issuer
    )

    let tournamentId: string | null = null
    const now = Date.now()

    // Find a tournament that's not full AND not expired
    for (const t of matchingTournaments) {
      // CRITICAL: Check if tournament is expired
      const expiresAt = t.expires_at 
        ? new Date(t.expires_at).getTime() 
        : new Date(t.created_at).getTime() + (10 * 60 * 1000)
      
      if (expiresAt <= now) {
        console.log(`[Tournament Join] Skipping expired tournament ${t.id}`)
        continue // Skip expired tournaments
      }

      const { count } = await supabase
        .from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', t.id)

      if ((count || 0) < t.tournament_size) {
        tournamentId = t.id
        console.log(`[Tournament Join] Found valid tournament ${t.id}, expires in ${Math.floor((expiresAt - now) / 1000)}s`)
        break
      }
    }

    // Create new tournament if none available
    if (!tournamentId) {
      const prizePool = entryFee * tournamentSize

      const { data: newT, error: createErr } = await supabase
        .from('tournaments')
        .insert({
          tournament_size: tournamentSize,
          entry_fee: entryFee,
          currency,
          issuer: issuer || null,
          status: 'waiting',
          prize_pool: prizePool,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      if (createErr || !newT) {
        console.error('[Tournament Join] Create tournament error:', createErr)
        return NextResponse.json(
          { error: 'Failed to create tournament' },
          { status: 500 }
        )
      }

      tournamentId = newT.id
    }

    // Fix 3: Double-check player isn't already in this specific tournament
    const { data: alreadyIn } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('player_address', playerAddress)
      .maybeSingle()

    if (alreadyIn) {
      console.log(`[Tournament Join] Player ${playerAddress} already in tournament ${tournamentId}`)
      return NextResponse.json({
        success: true,
        tournamentId,
        playerCount: tournamentSize, // Return full count so they know
        tournamentSize,
        isFull: true,
        alreadyJoined: true,
        message: 'Already joined',
      })
    }

    // CRITICAL: Get FRESH count and check if still room (race condition protection)
    const { count: freshCount } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    console.log(`[Tournament Join] Fresh count for ${tournamentId}: ${freshCount}/${tournamentSize}`)

    // Check if tournament is already full
    if ((freshCount || 0) >= tournamentSize) {
      console.log(`[Tournament Join] Tournament ${tournamentId} is FULL (${freshCount}/${tournamentSize})`)
      return NextResponse.json(
        { 
          error: 'Tournament is full',
          message: 'This tournament just filled up. Please try joining another one.'
        },
        { status: 409 }
      )
    }

    // Add player with status='joined'
    const { error: insertErr } = await supabase
      .from('tournament_players')
      .insert({
        tournament_id: tournamentId,
        player_address: playerAddress,
        player_order: (freshCount || 0) + 1,
        status: 'joined',
        joined_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.error('[Tournament Join] Insert error:', insertErr)
      
      // If duplicate key error, player already joined
      if (insertErr.code === '23505') {
        return NextResponse.json({
          success: true,
          tournamentId,
          message: 'Already joined',
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to join tournament' },
        { status: 500 }
      )
    }

    const newCount = (freshCount || 0) + 1
    const isFull = newCount >= tournamentSize

    console.log(`[Tournament Join] Player added! New count: ${newCount}/${tournamentSize}, isFull: ${isFull}`)

    // Start tournament if full
    if (isFull) {
      console.log(`[Tournament] Tournament ${tournamentId} is FULL - Starting game!`)
      
      await supabase
        .from('tournaments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', tournamentId)
      
      // Get both players with their IDs
      const { data: players } = await supabase
        .from('tournament_players')
        .select('id, player_address, player_order')
        .eq('tournament_id', tournamentId)
        .order('player_order')
      
      if (players && players.length === tournamentSize) {
        console.log(`[Tournament] Creating game for ${tournamentSize} players`)
        console.log(`[Tournament] Player 1 (White):`, players[0].player_address)
        console.log(`[Tournament] Player 2 (Black):`, players[1].player_address)
        
        // CRITICAL: Check if game already exists (prevent duplicates)
        const { data: existingGame } = await supabase
          .from('tournament_games')
          .select('id')
          .eq('tournament_id', tournamentId)
          .maybeSingle()
        
        if (!existingGame) {
          console.log(`[Tournament] No existing game, creating new one...`)
          
          // CRITICAL FIX: game_state must be JSON object, not string
          // player_white/player_black are player addresses
          const { data: newGame, error: gameError } = await supabase
            .from('tournament_games')
            .insert({
              tournament_id: tournamentId,
              player_white: players[0].player_address,
              player_black: players[1].player_address,
              status: 'in_progress',
              game_state: {
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                moves: [],
                turn: 'white'
              },
              white_time_remaining: 1200,
              black_time_remaining: 1200,
              turn_started_at: new Date().toISOString(),
              last_move_at: new Date().toISOString(),
              first_move_made: false,
              started_at: new Date().toISOString()
            })
            .select()
            .single()
          
          if (gameError) {
            console.error(`[Tournament] ❌ Failed to create game:`, gameError)
            console.error(`[Tournament] Error details:`, JSON.stringify(gameError, null, 2))
          } else {
            console.log(`[Tournament] ✅ Game created successfully!`)
            console.log(`[Tournament] Game ID:`, newGame.id)
            console.log(`[Tournament] Tournament ID:`, newGame.tournament_id)
          }
        } else {
          console.log(`[Tournament] ⚠️ Game already exists for ${tournamentId}, ID: ${existingGame.id}`)
        }
      } else {
        console.error(`[Tournament] ❌ Expected ${tournamentSize} players but found ${players?.length}`)
        console.error(`[Tournament] Players data:`, players)
      }
    }

    return NextResponse.json({
      success: true,
      tournamentId,
      playerCount: newCount,
      tournamentSize,
      isFull,
    })
  } catch (error: any) {
    console.error('[Tournament Join] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

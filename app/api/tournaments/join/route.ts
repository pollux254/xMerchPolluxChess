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

    // Check if player is already in any active tournament
    const { data: existingEntries } = await supabase
      .from('tournament_players')
      .select('tournament_id, tournaments!inner(id, status)')
      .eq('player_address', playerAddress)
      .in('tournaments.status', ['waiting', 'in_progress', 'in-progress'])

    if (existingEntries && existingEntries.length > 0) {
      const existing = existingEntries[0]
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
      
      // Get both players
      const { data: players } = await supabase
        .from('tournament_players')
        .select('player_address, player_order')
        .eq('tournament_id', tournamentId)
        .order('player_order')
      
      if (players && players.length === tournamentSize) {
        console.log(`[Tournament] Creating game for ${tournamentSize} players`)
        
        // Create game record
        const { error: gameError } = await supabase
          .from('tournament_games')
          .insert({
            tournament_id: tournamentId,
            player_white: players[0].player_address,
            player_black: players[1].player_address,
            current_turn: 'white',
            white_time_remaining: 1200,
            black_time_remaining: 1200,
            turn_started_at: new Date().toISOString(),
            last_move_at: new Date().toISOString(),
            first_move_made: false,
            started_at: new Date().toISOString(),
            status: 'active',
            game_state: '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}',
          })
        
        if (gameError) {
          console.error(`[Tournament] Failed to create game:`, gameError)
        } else {
          console.log(`[Tournament] Game created successfully for ${tournamentId}`)
        }
      } else {
        console.error(`[Tournament] Expected ${tournamentSize} players but found ${players?.length}`)
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

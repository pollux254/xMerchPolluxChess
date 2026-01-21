import { getSupabaseAdminClient } from '@/lib/supabase-client'
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
      tournamentId, // CRITICAL: Accept the tournament ID from webhook
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

    const supabase = getSupabaseAdminClient()

    // CRITICAL FIX: If webhook passed specific tournamentId, use it directly
    let targetTournamentId: string | null = tournamentId || null

    if (targetTournamentId) {
      console.log(`[Tournament Join] Using specific tournament ID from webhook: ${targetTournamentId}`)
      
      // Verify this tournament exists and is valid
      const { data: specificTournament } = await supabase
        .from('tournaments')
        .select('id, tournament_size, status')
        .eq('id', targetTournamentId)
        .maybeSingle()
      
      if (!specificTournament) {
        console.error(`[Tournament Join] Specified tournament ${targetTournamentId} not found!`)
        targetTournamentId = null // Fall back to search
      } else if (specificTournament.status !== 'waiting') {
        console.log(`[Tournament Join] Specified tournament ${targetTournamentId} is not waiting (status: ${specificTournament.status})`)
        // Don't return error - proceed with game creation logic below
      }
    }

    // If no specific tournament provided, search for one
    if (!targetTournamentId) {
      console.log('[Tournament Join] Searching for available tournament...')
      
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

      const now = Date.now()

      // Find a tournament that's not full AND not expired
      for (const t of matchingTournaments) {
        // Check if tournament is expired
        const expiresAt = t.expires_at 
          ? new Date(t.expires_at).getTime() 
          : new Date(t.created_at).getTime() + (10 * 60 * 1000)
        
        if (expiresAt <= now) {
          console.log(`[Tournament Join] Skipping expired tournament ${t.id}`)
          continue
        }

        const { count } = await supabase
          .from('tournament_players')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id)

        if ((count || 0) < t.tournament_size) {
          targetTournamentId = t.id
          console.log(`[Tournament Join] Found valid tournament ${t.id}, expires in ${Math.floor((expiresAt - now) / 1000)}s`)
          break
        }
      }

      // Create new tournament if none available
      if (!targetTournamentId) {
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

        targetTournamentId = newT.id
        console.log(`[Tournament Join] Created new tournament: ${targetTournamentId}`)
      }
    }

    // At this point we have targetTournamentId - either from webhook or from search/create
    console.log(`[Tournament Join] Using tournament: ${targetTournamentId}`)

    // Check if player isn't already in this specific tournament
    const { data: alreadyIn } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('tournament_id', targetTournamentId)
      .eq('player_address', playerAddress)
      .maybeSingle()

    if (alreadyIn) {
      console.log(`[Tournament Join] Player ${playerAddress} already in tournament ${targetTournamentId}`)
      
      // Check if game already created
      const { data: existingGame } = await supabase
        .from('tournament_games')
        .select('id')
        .eq('tournament_id', targetTournamentId)
        .maybeSingle()
      
      if (existingGame) {
        return NextResponse.json({
          success: true,
          tournamentId: targetTournamentId,
          isFull: true,
          alreadyJoined: true,
          message: 'Already in tournament and game exists',
        })
      }
      
      // Player in tournament but no game yet - fall through to game creation logic
      console.log('[Tournament Join] Player already in, checking if we should create game...')
    }

    // CRITICAL: Get FRESH count
    const { count: freshCount } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', targetTournamentId)

    console.log(`[Tournament Join] Fresh count for ${targetTournamentId}: ${freshCount}/${tournamentSize}`)

    // If not already in, add player
    if (!alreadyIn) {
      // Check if tournament is already full
      if ((freshCount || 0) >= tournamentSize) {
        console.log(`[Tournament Join] Tournament ${targetTournamentId} is FULL (${freshCount}/${tournamentSize})`)
        return NextResponse.json(
          { 
            error: 'Tournament is full',
            message: 'This tournament just filled up. Please try joining another one.'
          },
          { status: 409 }
        )
      }

      // Add player
      const { error: insertErr } = await supabase
        .from('tournament_players')
        .insert({
          tournament_id: targetTournamentId,
          player_address: playerAddress,
          player_order: (freshCount || 0) + 1,
          status: 'joined',
          joined_at: new Date().toISOString(),
        })

      if (insertErr) {
        console.error('[Tournament Join] Insert error:', insertErr)
        
        if (insertErr.code === '23505') {
          // Duplicate - already joined, continue to game creation check
          console.log('[Tournament Join] Duplicate insert, player already in')
        } else {
          return NextResponse.json(
            { error: 'Failed to join tournament' },
            { status: 500 }
          )
        }
      } else {
        console.log(`[Tournament Join] Player added successfully!`)
      }
    }

    // Re-fetch count after potential insert
    const { count: finalCount } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', targetTournamentId)

    const newCount = finalCount || 0
    const isFull = newCount >= tournamentSize

    console.log(`[Tournament Join] Final count: ${newCount}/${tournamentSize}, isFull: ${isFull}`)

    // Start tournament if full
    if (isFull) {
      console.log(`[Tournament] Tournament ${targetTournamentId} is FULL - Starting game!`)
      
      // Check if game already exists first
      const { data: existingGame } = await supabase
        .from('tournament_games')
        .select('id')
        .eq('tournament_id', targetTournamentId)
        .maybeSingle()
      
      if (existingGame) {
        console.log(`[Tournament] Game already exists: ${existingGame.id}`)
        return NextResponse.json({
          success: true,
          tournamentId: targetTournamentId,
          playerCount: newCount,
          tournamentSize,
          isFull: true,
          gameId: existingGame.id,
        })
      }
      
      // Update tournament status
      await supabase
        .from('tournaments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', targetTournamentId)
      
      // Get both players
      const { data: players } = await supabase
        .from('tournament_players')
        .select('id, player_address, player_order')
        .eq('tournament_id', targetTournamentId)
        .order('player_order')
      
      if (players && players.length === tournamentSize) {
        console.log(`[Tournament] Creating game for ${tournamentSize} players`)
        console.log(`[Tournament] Player 1 (White):`, players[0].player_address)
        console.log(`[Tournament] Player 2 (Black):`, players[1].player_address)
        
        const { data: newGame, error: gameError } = await supabase
          .from('tournament_games')
          .insert({
            tournament_id: targetTournamentId,
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
        } else {
          console.log(`[Tournament] ✅ Game created successfully! ID: ${newGame.id}`)
        }
      } else {
        console.error(`[Tournament] ❌ Expected ${tournamentSize} players but found ${players?.length}`)
      }
    }

    return NextResponse.json({
      success: true,
      tournamentId: targetTournamentId,
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
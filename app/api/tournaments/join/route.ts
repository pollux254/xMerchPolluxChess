import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    console.log('[Tournament Join] Starting...')
    
    // Check environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Tournament Join] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error - missing Supabase credentials' },
        { status: 500 }
      )
    }

    const body = await request.json()
    console.log('[Tournament Join] Request body:', body)
    
    const { 
      playerAddress, 
      tournamentSize, 
      entryFee, 
      currency, 
      issuer 
    } = body

    // Validate required fields
    if (!playerAddress || !tournamentSize || !entryFee || !currency) {
      console.error('[Tournament Join] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ✨ NEW: Step 0 - Check if player is already in ANY active tournament
    console.log('[Tournament Join] Checking if player is already in a tournament...')
    const { data: playerInTournaments, error: playerCheckError } = await supabase
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

    if (playerCheckError) {
      console.error('[Tournament Join] Error checking player tournaments:', playerCheckError)
      // Don't fail here, just log and continue
    }

    if (playerInTournaments && playerInTournaments.length > 0) {
      const existingTournamentId = playerInTournaments[0].tournament_id
      const existingStatus = (playerInTournaments[0] as any).tournaments?.status
      
      console.log(`[Tournament Join] ❌ Player already in tournament ${existingTournamentId} with status ${existingStatus}`)
      
      return NextResponse.json(
        {
          success: false,
          error: 'Player already in an active tournament',
          tournamentId: existingTournamentId,
          status: existingStatus
        },
        { status: 409 } // 409 Conflict
      )
    }

    console.log('[Tournament Join] ✅ Player not in any active tournament')

    // Step 1: Find existing waiting tournaments (simplified query)
    console.log('[Tournament Join] Searching for existing tournaments...')
    const { data: existingTournaments, error: findError } = await supabase
      .from('tournaments')
      .select('id, tournament_size, entry_fee, currency, issuer, status')
      .eq('status', 'waiting')
      .eq('tournament_size', tournamentSize)
      .eq('entry_fee', entryFee)
      .eq('currency', currency)

    if (findError) {
      console.error('[Tournament Join] Error finding tournaments:', findError)
      return NextResponse.json(
        { error: `Database error: ${findError.message}` },
        { status: 500 }
      )
    }

    // Filter by issuer in code (handle null comparison properly)
    const matchingTournaments = existingTournaments?.filter(t => {
      if (issuer === null || issuer === undefined) {
        return t.issuer === null
      }
      return t.issuer === issuer
    }) || []

    console.log('[Tournament Join] Found tournaments:', matchingTournaments.length)

    let tournamentId: string | null = null

    // Check each tournament to find one that's not full
    for (const tournament of matchingTournaments) {
      const { count } = await supabase
        .from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)

      console.log(`[Tournament Join] Tournament ${tournament.id} has ${count}/${tournament.tournament_size} players`)

      if ((count || 0) < tournament.tournament_size) {
        tournamentId = tournament.id
        console.log('[Tournament Join] Joining existing tournament:', tournamentId)
        break
      }
    }

    // Step 2: Create new tournament if no available ones
    if (!tournamentId) {
      console.log('[Tournament Join] Creating new tournament...')
      const prizePool = entryFee * tournamentSize
      
      const { data: newTournament, error: createError } = await supabase
        .from('tournaments')
        .insert({
          tournament_size: tournamentSize,
          entry_fee: entryFee,
          currency: currency,
          issuer: issuer || null,
          status: 'waiting',
          prize_pool: prizePool
        })
        .select()
        .single()

      if (createError || !newTournament) {
        console.error('[Tournament Join] Error creating tournament:', createError)
        return NextResponse.json(
          { error: `Failed to create tournament: ${createError?.message}` },
          { status: 500 }
        )
      }

      tournamentId = newTournament.id
      console.log('[Tournament Join] Created new tournament:', tournamentId)
    }

    // Step 3: Check if player already in this tournament (shouldn't happen after Step 0, but just in case)
    console.log('[Tournament Join] Checking if player already joined this specific tournament...')
    const { data: existingPlayer, error: checkError } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('player_address', playerAddress)
      .maybeSingle()

    if (checkError) {
      console.error('[Tournament Join] Error checking player:', checkError)
    }

    if (existingPlayer) {
      console.log('[Tournament Join] Player already in this tournament')
      return NextResponse.json({
        success: true,
        tournamentId,
        message: 'Already in tournament'
      })
    }

    // Step 4: Get current player count for ordering
    console.log('[Tournament Join] Getting player count...')
    const { count: playerCount, error: countError } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    if (countError) {
      console.error('[Tournament Join] Error counting players:', countError)
    }

    // Step 5: Add player to tournament
    console.log('[Tournament Join] Adding player to tournament...')
    const { error: joinError } = await supabase
      .from('tournament_players')
      .insert({
        tournament_id: tournamentId,
        player_address: playerAddress,
        player_order: (playerCount || 0) + 1,
        is_active: true
      })

    if (joinError) {
      console.error('[Tournament Join] Error joining tournament:', joinError)
      return NextResponse.json(
        { error: `Failed to join tournament: ${joinError.message}` },
        { status: 500 }
      )
    }

    // Step 6: Check if tournament is now full
    const newPlayerCount = (playerCount || 0) + 1
    console.log(`[Tournament Join] Player count: ${newPlayerCount}/${tournamentSize}`)
    
    if (newPlayerCount >= tournamentSize) {
      console.log('[Tournament Join] Tournament is full, starting game...')
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', tournamentId)

      if (updateError) {
        console.error('[Tournament Join] Error starting tournament:', updateError)
      }
    }

    console.log('[Tournament Join] Success!')
    return NextResponse.json({
      success: true,
      tournamentId,
      playerCount: newPlayerCount,
      tournamentSize,
      isFull: newPlayerCount >= tournamentSize
    })

  } catch (error: any) {
    console.error('[Tournament Join] Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    )
  }
}
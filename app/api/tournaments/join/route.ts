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

    // Wallet validation
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
      .select('id, tournament_size, entry_fee, currency, issuer, status')
      .eq('status', 'waiting')
      .eq('tournament_size', tournamentSize)
      .eq('entry_fee', entryFee)
      .eq('currency', currency)

    // Filter issuer correctly (null vs string)
    const matchingTournaments = (tournaments || []).filter(t =>
      issuer == null ? t.issuer == null : t.issuer === issuer
    )

    let tournamentId: string | null = null

    // Find a tournament that's not full
    for (const t of matchingTournaments) {
      const { count } = await supabase
        .from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', t.id)

      if ((count || 0) < t.tournament_size) {
        tournamentId = t.id
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

    // Double-check player isn't already in this specific tournament
    const { data: alreadyIn } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('player_address', playerAddress)
      .maybeSingle()

    if (alreadyIn) {
      return NextResponse.json({
        success: true,
        tournamentId,
        message: 'Already joined',
      })
    }

    // Get current player count for order
    const { count: currentCount } = await supabase
      .from('tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    // Add player with correct status
    const { error: insertErr } = await supabase
      .from('tournament_players')
      .insert({
        tournament_id: tournamentId,
        player_address: playerAddress,
        player_order: (currentCount || 0) + 1,
        status: 'joined',
        joined_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.error('[Tournament Join] Insert error:', insertErr)
      return NextResponse.json(
        { error: 'Failed to join tournament' },
        { status: 500 }
      )
    }

    const newCount = (currentCount || 0) + 1
    const isFull = newCount >= tournamentSize

    // Start tournament if full
    if (isFull) {
      await supabase
        .from('tournaments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', tournamentId)
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
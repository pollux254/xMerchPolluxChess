import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    console.log('[Tournament Join] Starting...')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Tournament Join] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
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
      issuer,
    } = body

    if (!playerAddress || !tournamentSize || !entryFee || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if player is already in any active tournament
    const { data: existingEntries } = await supabase
      .from('tournament_players')
      .select('tournament_id, tournaments!inner(status)')
      .eq('player_address', playerAddress)
      .in('tournaments.status', ['waiting', 'in_progress', 'in-progress'])

    if (existingEntries && existingEntries.length > 0) {
      const existing = existingEntries[0]
      return NextResponse.json(
        {
          success: false,
          error: 'Already in active tournament',
          tournamentId: existing.tournament_id,
          status: existing.tournaments.status,
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

    // Add player
    const { error: insertErr } = await supabase
      .from('tournament_players')
      .insert({
        tournament_id: tournamentId,
        player_address: playerAddress,
        player_order: (currentCount || 0) + 1,
        is_active: true,
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
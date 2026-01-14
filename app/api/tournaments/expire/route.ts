import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * This endpoint expires old tournaments that have been in "waiting" status too long
 * Call this from a cron job or scheduled function every 5-10 minutes
 * Or call it when a player visits the waiting room
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Expire] Checking for expired tournaments...')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Expire] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find tournaments in "waiting" status older than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const { data: expiredTournaments, error: findError } = await supabase
      .from('tournaments')
      .select('id, created_at, tournament_size')
      .eq('status', 'waiting')
      .lt('created_at', tenMinutesAgo.toISOString())

    if (findError) {
      console.error('[Expire] Error finding tournaments:', findError)
      return NextResponse.json(
        { error: 'Failed to find tournaments' },
        { status: 500 }
      )
    }

    if (!expiredTournaments || expiredTournaments.length === 0) {
      console.log('[Expire] No expired tournaments found')
      return NextResponse.json({
        success: true,
        message: 'No tournaments to expire',
        expired: 0
      })
    }

    console.log(`[Expire] Found ${expiredTournaments.length} expired tournament(s)`)
    
    const expiredIds: string[] = []

    for (const tournament of expiredTournaments) {
      const tournamentId = tournament.id
      
      console.log(`[Expire] Expiring tournament ${tournamentId}`)

      // Update tournament status to expired
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          status: 'expired',
          cancelled_reason: 'Tournament expired after 10 minutes'
        })
        .eq('id', tournamentId)

      if (updateError) {
        console.error(`[Expire] Error updating ${tournamentId}:`, updateError)
        continue
      }

      // Remove all players from expired tournament
      const { error: deletePlayersError } = await supabase
        .from('tournament_players')
        .delete()
        .eq('tournament_id', tournamentId)

      if (deletePlayersError) {
        console.error(`[Expire] Error removing players from ${tournamentId}:`, deletePlayersError)
      }

      expiredIds.push(tournamentId)
    }

    console.log(`[Expire] Success! Expired ${expiredIds.length} tournament(s)`)
    
    return NextResponse.json({
      success: true,
      message: 'Expired old tournaments',
      expired: expiredIds.length,
      tournamentIds: expiredIds
    })

  } catch (error: any) {
    console.error('[Expire] Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    )
  }
}

// Optional: Allow GET requests for cron jobs
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent abuse
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Call the same logic as POST
  return POST(request)
}
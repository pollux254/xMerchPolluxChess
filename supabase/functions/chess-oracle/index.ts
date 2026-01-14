// Chess Oracle - Watches Xahau Hook state and syncs to Supabase
// This function runs periodically to keep Supabase in sync with on-chain Hook state

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const XAHAU_WSS = Deno.env.get('XAHAU_WSS') || 'wss://xahau.network'
const HOOK_ACCOUNT = Deno.env.get('HOOK_ACCOUNT')
const SUPABASE_URL = Deno.env.get('SB_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY')

interface HookState {
  tournaments: Tournament[]
  matches: Match[]
}

interface Tournament {
  id: string
  entry_fee: number
  size: number
  player_count: number
  players: string[]
  prize_pool: number
  status: string
  created_at: number
  current_round: number
}

interface Match {
  id: string
  tournament_id: string
  player1: string
  player2: string
  player1_time: number
  player2_time: number
  board_state: any
  winner: string | null
  result_type: string | null
  status: string
}

serve(async (req) => {
  try {
    console.log('[Oracle] Starting Hook state sync...')

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Connect to Xahau network
    const hookState = await fetchHookState()

    // Sync tournaments
    for (const tournament of hookState.tournaments) {
      await syncTournament(supabase, tournament)
    }

    // Sync matches
    for (const match of hookState.matches) {
      await syncMatch(supabase, match)
    }

    console.log('[Oracle] Sync complete')

    return new Response(
      JSON.stringify({ success: true, synced_at: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Oracle] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Fetch Hook state from Xahau ledger
 */
async function fetchHookState(): Promise<HookState> {
  console.log('[Oracle] Fetching Hook state from Xahau...')

  try {
    // Connect to Xahau via WebSocket
    const ws = new WebSocket(XAHAU_WSS)

    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })

    // Request account objects (Hook state storage)
    const request = {
      id: 1,
      command: 'account_objects',
      account: HOOK_ACCOUNT,
      ledger_index: 'validated',
      type: 'state'
    }

    ws.send(JSON.stringify(request))

    const response: any = await new Promise((resolve) => {
      ws.onmessage = (event) => {
        resolve(JSON.parse(event.data))
      }
    })

    ws.close()

    // Parse Hook state from account objects
    const hookState = parseHookState(response.result.account_objects)

    console.log(`[Oracle] Found ${hookState.tournaments.length} tournaments, ${hookState.matches.length} matches`)

    return hookState
  } catch (error) {
    console.error('[Oracle] Failed to fetch Hook state:', error)
    throw error
  }
}

/**
 * Parse Hook state from raw account objects
 */
function parseHookState(accountObjects: any[]): HookState {
  const tournaments: Tournament[] = []
  const matches: Match[] = []

  for (const obj of accountObjects) {
    // State keys are hex-encoded
    // Format: "T:" + tournament_id or "M:" + match_id
    const keyHex = obj.LedgerEntryType === 'HookState' ? obj.HookStateKey : null
    if (!keyHex) continue

    const keyStr = hexToString(keyHex)

    if (keyStr.startsWith('T:')) {
      // Tournament state
      const tournament = parseTournament(obj.HookStateData)
      tournaments.push(tournament)
    } else if (keyStr.startsWith('M:')) {
      // Match state
      const match = parseMatch(obj.HookStateData)
      matches.push(match)
    }
  }

  return { tournaments, matches }
}

/**
 * Parse tournament from Hook state data
 */
function parseTournament(stateData: string): Tournament {
  // Decode hex state data
  const buffer = hexToBuffer(stateData)
  
  // Parse tournament struct (this will match the C struct in the Hook)
  // Simplified parsing - actual implementation needs to match Hook struct exactly
  
  return {
    id: buffer.slice(0, 32).toString('hex'),
    entry_fee: buffer.readBigUInt64LE(32),
    size: buffer.readUInt8(43),
    player_count: buffer.readUInt8(44),
    players: parsePlayerList(buffer, 45),
    prize_pool: buffer.readBigUInt64LE(365),
    status: buffer.readUInt8(373),
    created_at: buffer.readBigUInt64LE(374),
    current_round: buffer.readUInt8(382)
  }
}

/**
 * Parse match from Hook state data
 */
function parseMatch(stateData: string): Match {
  const buffer = hexToBuffer(stateData)
  
  return {
    id: buffer.slice(0, 32).toString('hex'),
    tournament_id: buffer.slice(32, 64).toString('hex'),
    player1: buffer.slice(64, 84).toString('hex'),
    player2: buffer.slice(84, 104).toString('hex'),
    player1_time: buffer.readBigUInt64LE(104),
    player2_time: buffer.readBigUInt64LE(112),
    board_state: parseBoardState(buffer, 120),
    winner: null, // Parse from buffer if present
    result_type: null,
    status: buffer.readUInt8(200).toString()
  }
}

/**
 * Sync tournament to Supabase
 */
async function syncTournament(supabase: any, tournament: Tournament) {
  console.log(`[Oracle] Syncing tournament ${tournament.id}...`)

  const statusMap: { [key: string]: string } = {
    '0': 'waiting',
    '1': 'active',
    '2': 'complete',
    '3': 'cancelled'
  }

  const { error } = await supabase.from('tournaments').upsert({
    id: tournament.id,
    entry_fee: tournament.entry_fee,
    size: tournament.size,
    player_count: tournament.player_count,
    prize_pool: tournament.prize_pool,
    status: statusMap[tournament.status] || 'waiting',
    current_round: tournament.current_round,
    hook_state: tournament,
    hook_account: HOOK_ACCOUNT,
    updated_at: new Date().toISOString()
  })

  if (error) {
    console.error('[Oracle] Failed to sync tournament:', error)
    throw error
  }

  // Sync tournament players
  for (let i = 0; i < tournament.player_count; i++) {
    await supabase.from('tournament_players').upsert({
      tournament_id: tournament.id,
      wallet_address: tournament.players[i],
      status: 'joined'
    })
  }

  console.log(`[Oracle] Tournament ${tournament.id} synced successfully`)
}

/**
 * Sync match to Supabase
 */
async function syncMatch(supabase: any, match: Match) {
  console.log(`[Oracle] Syncing match ${match.id}...`)

  const statusMap: { [key: string]: string } = {
    '0': 'pending',
    '1': 'in_progress',
    '2': 'complete'
  }

  const { error } = await supabase.from('matches').upsert({
    id: match.id,
    tournament_id: match.tournament_id,
    player1_wallet: match.player1,
    player2_wallet: match.player2,
    player1_time_left: match.player1_time,
    player2_time_left: match.player2_time,
    board_state: match.board_state,
    winner: match.winner,
    result_type: match.result_type,
    status: statusMap[match.status] || 'pending',
    updated_at: new Date().toISOString()
  })

  if (error) {
    console.error('[Oracle] Failed to sync match:', error)
    throw error
  }

  // If match is complete, update player stats
  if (match.status === '2' && match.winner) {
    await updatePlayerStats(supabase, match)
  }

  console.log(`[Oracle] Match ${match.id} synced successfully`)
}

/**
 * Update player stats after match completion
 */
async function updatePlayerStats(supabase: any, match: Match) {
  // Get tournament info to determine prize amounts
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('entry_fee, prize_pool')
    .eq('id', match.tournament_id)
    .single()

  if (!tournament) return

  const loser = match.winner === match.player1 ? match.player2 : match.player1

  // Calculate ELO changes
  const { data: winnerStats } = await supabase
    .from('ranked_stats')
    .select('elo_rating')
    .eq('wallet_address', match.winner)
    .single()

  const { data: loserStats } = await supabase
    .from('ranked_stats')
    .select('elo_rating')
    .eq('wallet_address', loser)
    .single()

  const winnerElo = winnerStats?.elo_rating || 1200
  const loserElo = loserStats?.elo_rating || 1200

  // Simple ELO calculation (K=32)
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const newWinnerElo = Math.round(winnerElo + 32 * (1 - expectedWinner))
  const newLoserElo = Math.round(loserElo + 32 * (0 - (1 - expectedWinner)))

  // Update winner stats
  await supabase.rpc('update_ranked_stats', {
    p_winner: match.winner,
    p_loser: loser,
    p_winner_elo: newWinnerElo,
    p_loser_elo: newLoserElo,
    p_prize_amount: 0 // Will be updated when tournament completes
  })

  console.log(`[Oracle] Updated stats for match ${match.id}`)
}

// Helper functions
function hexToString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8')
}

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex')
}

function parsePlayerList(buffer: Buffer, offset: number): string[] {
  const players: string[] = []
  const maxPlayers = 16
  const playerSize = 20 // bytes per player address

  for (let i = 0; i < maxPlayers; i++) {
    const start = offset + (i * playerSize)
    const playerAddress = buffer.slice(start, start + playerSize).toString('hex')
    
    // Skip empty addresses (all zeros)
    if (!playerAddress.match(/^0+$/)) {
      players.push(playerAddress)
    }
  }

  return players
}

function parseBoardState(buffer: Buffer, offset: number): any {
  // Parse bitboard chess state
  // This is simplified - actual implementation needs to match Hook exactly
  return {
    white_pieces: [],
    black_pieces: [],
    to_move: buffer.readUInt8(offset + 96),
    castling_rights: buffer.readUInt8(offset + 97)
  }
}
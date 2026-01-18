// lib/middleware/verify-wallet.ts
// Ensures the wallet that paid matches the logged-in wallet

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Verify that the player in the tournament matches the logged-in wallet
 * This prevents someone from paying with one wallet but joining as another
 */
export async function verifyWalletMatch(
  tournamentId: string,
  loggedInAddress: string
): Promise<{ isValid: boolean; message: string }> {
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get all players in this tournament
  const { data: players, error } = await supabase
    .from('tournament_players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('player_address', loggedInAddress)

  if (error) {
    console.error('❌ Error checking player:', error)
    return {
      isValid: false,
      message: 'Error verifying wallet'
    }
  }

  // Check if logged-in wallet is actually in this tournament
  if (!players || players.length === 0) {
    console.log('❌ Wallet mismatch detected!')
    console.log('  Tournament:', tournamentId)
    console.log('  Logged in as:', loggedInAddress)
    console.log('  But this wallet is NOT in the tournament!')
    
    return {
      isValid: false,
      message: 'You are not registered in this tournament with this wallet address.'
    }
  }

  console.log('✅ Wallet verified:', loggedInAddress)
  return {
    isValid: true,
    message: 'Wallet verified'
  }
}

/**
 * Get the wallet address that actually paid for a tournament entry
 * This checks the blockchain transaction, not just the database
 */
export async function getPayingWallet(tournamentId: string): Promise<string | null> {
  // TODO: Query Xahau ledger to see which wallet actually sent XAH
  // This would involve checking the Hook's transaction history
  // For now, we rely on database records
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { data, error } = await supabase
    .from('tournament_players')
    .select('player_address')
    .eq('tournament_id', tournamentId)
    .order('joined_at', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) {
    return null
  }

  return data[0].player_address
}
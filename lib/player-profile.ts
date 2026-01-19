import { getSupabaseClient } from './supabase-client'

const supabase = getSupabaseClient()

export interface PlayerProfile {
  wallet_address: string
  bot_elo: number
  multiplayer_elo: number
  bot_wins: number
  bot_losses: number
  bot_draws: number
  multiplayer_wins: number
  multiplayer_losses: number
  multiplayer_draws: number
  total_games: number
  created_at: string
  updated_at: string
}

export interface PlayerSettings {
  wallet_address: string
  confirm_moves: boolean
  highlight_legal_moves: boolean
  auto_queen_promotion: boolean
  created_at: string
  updated_at: string
}

/**
 * Get or create player profile and settings
 * @param walletAddress - Player's wallet address
 * @returns Profile data or null if error
 */
export async function getOrCreateProfile(walletAddress: string): Promise<PlayerProfile | null> {
  try {
    console.log('📊 [Profile] Checking profile for:', walletAddress)

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (existingProfile) {
      console.log('📊 [Profile] Found existing profile')
      return existingProfile
    }

    // Profile doesn't exist, create new one
    console.log('📊 [Profile] Creating new profile...')

    const { data: newProfile, error: profileError } = await supabase
      .from('player_profiles')
      .insert([{ wallet_address: walletAddress }])
      .select()
      .single()

    if (profileError) {
      console.error('❌ [Profile] Failed to create profile:', profileError)
      return null
    }

    // Also create settings
    const { error: settingsError } = await supabase
      .from('player_settings')
      .insert([{ wallet_address: walletAddress }])

    if (settingsError) {
      console.error('❌ [Profile] Failed to create settings:', settingsError)
      // Continue anyway, profile was created
    }

    console.log('✅ [Profile] Profile created successfully')
    return newProfile

  } catch (error) {
    console.error('❌ [Profile] Error in getOrCreateProfile:', error)
    return null
  }
}

/**
 * Get player stats
 * @param walletAddress - Player's wallet address
 * @returns Profile data or null
 */
export async function getPlayerStats(walletAddress: string): Promise<PlayerProfile | null> {
  try {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (error) {
      console.error('❌ [Profile] Failed to fetch stats:', error)
      return null
    }

    return data

  } catch (error) {
    console.error('❌ [Profile] Error in getPlayerStats:', error)
    return null
  }
}

/**
 * Update bot game stats after game ends
 * @param walletAddress - Player's wallet address
 * @param result - Game result: 'win', 'loss', or 'draw'
 * @returns Success boolean
 */
export async function updateBotStats(
  walletAddress: string,
  result: 'win' | 'loss' | 'draw'
): Promise<boolean> {
  try {
    console.log(`📊 [Profile] Updating stats for ${result}`)

    // Get current stats
    const currentStats = await getPlayerStats(walletAddress)
    if (!currentStats) {
      console.error('❌ [Profile] No profile found for stats update')
      return false
    }

    // Calculate new values
    let newElo = currentStats.bot_elo
    let newWins = currentStats.bot_wins
    let newLosses = currentStats.bot_losses
    let newDraws = currentStats.bot_draws

    if (result === 'win') {
      newElo = currentStats.bot_elo + 1
      newWins = currentStats.bot_wins + 1
    } else if (result === 'loss') {
      newElo = Math.max(1, currentStats.bot_elo - 1) // Never below 1
      newLosses = currentStats.bot_losses + 1
    } else if (result === 'draw') {
      newDraws = currentStats.bot_draws + 1
    }

    // Update database
    const { error } = await supabase
      .from('player_profiles')
      .update({
        bot_elo: newElo,
        bot_wins: newWins,
        bot_losses: newLosses,
        bot_draws: newDraws,
        total_games: currentStats.total_games + 1,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)

    if (error) {
      console.error('❌ [Profile] Failed to update stats:', error)
      return false
    }

    console.log(`✅ [Profile] Stats updated: ELO ${currentStats.bot_elo} → ${newElo}`)
    return true

  } catch (error) {
    console.error('❌ [Profile] Error in updateBotStats:', error)
    return false
  }
}

/**
 * Generate bot rank based on player's rank
 * Uses ±10 range around player rank (e.g., rank 20 → bot rank 10-30)
 * @param playerRank - Player's current bot ELO
 * @returns Random bot rank in appropriate range
 */
export function getRandomBotRankForPlayer(playerRank: number): number {
  // Calculate range: ±10 from player rank
  const minRank = Math.max(1, playerRank - 10)
  const maxRank = Math.min(1000, playerRank + 10)
  
  // Generate random rank in range
  const botRank = Math.floor(Math.random() * (maxRank - minRank + 1)) + minRank
  
  console.log(`🤖 [Profile] Player rank ${playerRank} → Bot rank ${botRank} (range: ${minRank}-${maxRank})`)
  
  return botRank
}

/**
 * Get player settings
 * @param walletAddress - Player's wallet address
 * @returns Settings data or null
 */
export async function getPlayerSettings(walletAddress: string): Promise<PlayerSettings | null> {
  try {
    const { data, error } = await supabase
      .from('player_settings')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (error) {
      console.error('❌ [Profile] Failed to fetch settings:', error)
      return null
    }

    return data

  } catch (error) {
    console.error('❌ [Profile] Error in getPlayerSettings:', error)
    return null
  }
}

/**
 * Update player settings
 * @param walletAddress - Player's wallet address
 * @param settings - Settings to update
 * @returns Success boolean
 */
export async function updatePlayerSettings(
  walletAddress: string,
  settings: Partial<Pick<PlayerSettings, 'confirm_moves' | 'highlight_legal_moves' | 'auto_queen_promotion'>>
): Promise<boolean> {
  try {
    console.log('⚙️ [Profile] Updating settings:', settings)

    const { error } = await supabase
      .from('player_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)

    if (error) {
      console.error('❌ [Profile] Failed to update settings:', error)
      return false
    }

    console.log('✅ [Profile] Settings updated successfully')
    return true

  } catch (error) {
    console.error('❌ [Profile] Error in updatePlayerSettings:', error)
    return false
  }
}

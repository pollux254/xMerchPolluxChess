// Temporarily disabled - Hook on-chain features not needed for current payment flow
// Current flow: /api/payment -> Xaman SDK -> Webhook -> Supabase

export async function getTournamentState(tournamentId: string, network?: string): Promise<any> {
  throw new Error("Not implemented - using Supabase instead of on-chain Hook state")
}

export async function joinTournamentOnChain(): Promise<any> {
  throw new Error("Not implemented - using /api/payment + Xaman instead")
}

export async function joinTournamentHook(): Promise<any> {
  throw new Error("Not implemented - using /api/payment + Xaman instead")
}

export async function submitMoveHook(): Promise<any> {
  throw new Error("Not implemented - moves stored in Supabase, not on-chain yet")
}

export async function getWaitingRoomState(network?: string): Promise<any> {
  throw new Error("Not implemented - using Supabase real-time subscriptions instead")
}

export async function getGameState(gameId: string, network?: string): Promise<any> {
  throw new Error("Not implemented - using Supabase for game state")
}

export async function getPlayerProfile(playerAddress: string, network?: string): Promise<any> {
  throw new Error("Not implemented - using Supabase for player data")
}

export async function getGlobalStats(network?: string): Promise<any> {
  throw new Error("Not implemented - using Supabase for statistics")
}

export async function forfeitGameHook(): Promise<any> {
  throw new Error("Not implemented - using /api/tournaments/forfeit instead")
}
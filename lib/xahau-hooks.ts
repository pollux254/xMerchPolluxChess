import { Client, Wallet } from 'xrpl'

const HOOK_ADDRESS = process.env.NEXT_PUBLIC_HOOK_ADDRESS!
const XAHAU_WSS = 'wss://xahau.network'

// Helper functions
function hashTournamentId(tournamentId: string): string {
  // Convert tournament ID to namespace hash
  return Buffer.from(tournamentId).toString('hex').padStart(64, '0').slice(0, 64)
}

function decodeTournamentState(response: any): any {
  // Decode hook state from response
  return response
}

// Read tournament state from hook
export async function getTournamentState(tournamentId: string) {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  // Use 'as any' to bypass TypeScript checking for Xahau-specific command
  const response = await (client as any).request({
    command: 'account_namespace',
    account: HOOK_ADDRESS,
    namespace_id: hashTournamentId(tournamentId)
  })
  
  await client.disconnect()
  return decodeTournamentState(response)
}

// Send signal to hook
export async function joinTournamentOnChain(
  playerWallet: Wallet,
  paymentHash: string,
  tournamentSize: number
) {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  const tx: any = {
    TransactionType: 'Payment',
    Account: playerWallet.address,
    Destination: HOOK_ADDRESS,
    Amount: '1', // 1 drop signal
    Memos: [{
      Memo: {
        MemoType: Buffer.from('join_tournament').toString('hex'),
        MemoData: Buffer.from(JSON.stringify({
          payment_hash: paymentHash,
          tournament_size: tournamentSize
        })).toString('hex')
      }
    }]
  }
  
  const signed = playerWallet.sign(tx)
  const result = await client.submitAndWait(signed.tx_blob)
  
  await client.disconnect()
  return result
}

/**
 * Join a 1v1 tournament by sending payment to Hook
 */
export async function joinTournamentHook(
  playerWallet: Wallet,
  entryFee: number = 10 // XAH
): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  const tx: any = {
    TransactionType: 'Payment',
    Account: playerWallet.address,
    Destination: HOOK_ADDRESS,
    Amount: String(entryFee * 1000000), // Convert XAH to drops
    Memos: [{
      Memo: {
        MemoType: Buffer.from('chess-wagering').toString('hex'),
        MemoData: Buffer.from(JSON.stringify({
          action: 'JOIN',
          mode: '1v1'
        })).toString('hex')
      }
    }]
  }
  
  const signed = playerWallet.sign(tx)
  const result = await client.submitAndWait(signed.tx_blob)
  
  await client.disconnect()
  return result
}

/**
 * Submit a chess move to the Hook
 */
export async function submitMoveHook(
  playerWallet: Wallet,
  gameId: string,
  move: string // e.g., "e2e4"
): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  const tx: any = {
    TransactionType: 'Invoke',
    Account: playerWallet.address,
    Destination: HOOK_ADDRESS,
    Memos: [{
      Memo: {
        MemoType: Buffer.from('chess-move').toString('hex'),
        MemoData: Buffer.from(JSON.stringify({
          action: 'MOVE',
          game_id: gameId,
          move: move
        })).toString('hex')
      }
    }]
  }
  
  const signed = playerWallet.sign(tx)
  const result = await client.submitAndWait(signed.tx_blob)
  
  await client.disconnect()
  return result
}

/**
 * Read waiting room state from Hook
 */
export async function getWaitingRoomState(): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  // Waiting room key: 0x02 || 0x02 (for 1v1)
  const namespaceId = '0202' + '0'.repeat(60) // 32 bytes hex
  
  const response = await (client as any).request({
    command: 'account_namespace',
    account: HOOK_ADDRESS,
    namespace_id: namespaceId
  })
  
  await client.disconnect()
  return response
}

/**
 * Read game state from Hook
 */
export async function getGameState(gameId: string): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  // Game state key: 0x01 || game_id_hash
  const gameIdHash = Buffer.from(gameId).toString('hex').padStart(62, '0')
  const namespaceId = '01' + gameIdHash
  
  const response = await (client as any).request({
    command: 'account_namespace',
    account: HOOK_ADDRESS,
    namespace_id: namespaceId
  })
  
  await client.disconnect()
  return response
}

/**
 * Read player profile from Hook
 */
export async function getPlayerProfile(playerAddress: string): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  // Player profile key: 0x03 || player_address_hash
  const addressHash = Buffer.from(playerAddress).toString('hex').padStart(62, '0')
  const namespaceId = '03' + addressHash
  
  const response = await (client as any).request({
    command: 'account_namespace',
    account: HOOK_ADDRESS,
    namespace_id: namespaceId
  })
  
  await client.disconnect()
  return response
}

/**
 * Read global statistics from Hook
 */
export async function getGlobalStats(): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  // Global stats key: 0xFF || 0x00...00
  const namespaceId = 'FF' + '0'.repeat(62)
  
  const response = await (client as any).request({
    command: 'account_namespace',
    account: HOOK_ADDRESS,
    namespace_id: namespaceId
  })
  
  await client.disconnect()
  return response
}

/**
 * Forfeit a game via Hook
 */
export async function forfeitGameHook(
  playerWallet: Wallet,
  gameId: string
): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  const tx: any = {
    TransactionType: 'Invoke',
    Account: playerWallet.address,
    Destination: HOOK_ADDRESS,
    Memos: [{
      Memo: {
        MemoType: Buffer.from('chess-forfeit').toString('hex'),
        MemoData: Buffer.from(JSON.stringify({
          action: 'FORFEIT',
          game_id: gameId
        })).toString('hex')
      }
    }]
  }
  
  const signed = playerWallet.sign(tx)
  const result = await client.submitAndWait(signed.tx_blob)
  
  await client.disconnect()
  return result
}

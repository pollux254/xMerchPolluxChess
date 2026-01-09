/**
 * Hook State Reader Utilities
 * Provides convenient functions to read and decode Hook state data
 */

import { Client } from 'xrpl'

const XAHAU_WSS = 'wss://xahau.network'

// State namespace constants (matching Hook code)
export const NS_GAMES = 0x01
export const NS_WAITING = 0x02
export const NS_PROFILES = 0x03
export const NS_GLOBAL = 0xFF

// Game state interface
export interface GameState {
  board: number[][]
  colors: number[][]
  currentPlayer: number // 0 = white, 1 = black
  gameStatus: number // 0 = waiting, 1 = active, 2 = finished
  whitePlayer: string
  blackPlayer: string
  startLedger: number
  lastMoveLedger: number
  moveCount: number
  winner: number // 0 = white, 1 = black, 2 = draw
}

// Waiting room entry interface
export interface WaitingEntry {
  playerAccount: string
  joinLedger: number
  entryFeePaid: number
}

// Player profile interface
export interface PlayerProfile {
  playerAccount: string
  gamesPlayed: number
  gamesWon: number
  totalWinnings: number
  lastGameLedger: number
}

// Global statistics interface
export interface GlobalStats {
  totalGames: number
  totalVolume: number
  totalRake: number
  activeGames: number
  waitingPlayers: number
}

/**
 * Create a namespace key for Hook state queries
 */
function createNamespaceKey(namespace: number, data: string = ''): string {
  const nsHex = namespace.toString(16).padStart(2, '0')
  const dataHex = data ? Buffer.from(data).toString('hex') : ''
  return (nsHex + dataHex).padEnd(64, '0')
}

/**
 * Read raw Hook state data
 */
export async function readHookState(
  hookAddress: string,
  namespaceKey: string
): Promise<any> {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  try {
    const response = await (client as any).request({
      command: 'account_namespace',
      account: hookAddress,
      namespace_id: namespaceKey
    })
    
    await client.disconnect()
    return response
  } catch (error) {
    await client.disconnect()
    throw error
  }
}

/**
 * Read all waiting room entries
 */
export async function readWaitingRoom(hookAddress: string): Promise<WaitingEntry[]> {
  const namespaceKey = createNamespaceKey(NS_WAITING)
  
  try {
    const response = await readHookState(hookAddress, namespaceKey)
    
    // TODO: Parse response and decode waiting room entries
    // This would require iterating through all entries in the namespace
    // For now, return empty array as placeholder
    return []
  } catch (error) {
    console.error('Failed to read waiting room:', error)
    return []
  }
}

/**
 * Read specific game state
 */
export async function readGameState(
  hookAddress: string,
  gameId: string
): Promise<GameState | null> {
  const namespaceKey = createNamespaceKey(NS_GAMES, gameId)
  
  try {
    const response = await readHookState(hookAddress, namespaceKey)
    
    if (!response || !response.namespace_entries) {
      return null
    }
    
    // TODO: Decode binary game state data
    // This would require parsing the C struct format
    // For now, return placeholder data
    return {
      board: Array(8).fill(null).map(() => Array(8).fill(0)),
      colors: Array(8).fill(null).map(() => Array(8).fill(0)),
      currentPlayer: 0,
      gameStatus: 0,
      whitePlayer: '',
      blackPlayer: '',
      startLedger: 0,
      lastMoveLedger: 0,
      moveCount: 0,
      winner: 0
    }
  } catch (error) {
    console.error('Failed to read game state:', error)
    return null
  }
}

/**
 * Read player profile
 */
export async function readPlayerProfile(
  hookAddress: string,
  playerAddress: string
): Promise<PlayerProfile | null> {
  const namespaceKey = createNamespaceKey(NS_PROFILES, playerAddress)
  
  try {
    const response = await readHookState(hookAddress, namespaceKey)
    
    if (!response || !response.namespace_entries) {
      return null
    }
    
    // TODO: Decode binary player profile data
    // For now, return placeholder data
    return {
      playerAccount: playerAddress,
      gamesPlayed: 0,
      gamesWon: 0,
      totalWinnings: 0,
      lastGameLedger: 0
    }
  } catch (error) {
    console.error('Failed to read player profile:', error)
    return null
  }
}

/**
 * Read global statistics
 */
export async function readGlobalStats(hookAddress: string): Promise<GlobalStats | null> {
  const namespaceKey = createNamespaceKey(NS_GLOBAL)
  
  try {
    const response = await readHookState(hookAddress, namespaceKey)
    
    if (!response || !response.namespace_entries) {
      return null
    }
    
    // TODO: Decode binary global stats data
    // For now, return placeholder data
    return {
      totalGames: 0,
      totalVolume: 0,
      totalRake: 0,
      activeGames: 0,
      waitingPlayers: 0
    }
  } catch (error) {
    console.error('Failed to read global stats:', error)
    return null
  }
}

/**
 * Check if player is in waiting room
 */
export async function isPlayerWaiting(
  hookAddress: string,
  playerAddress: string
): Promise<boolean> {
  const namespaceKey = createNamespaceKey(NS_WAITING, playerAddress)
  
  try {
    const response = await readHookState(hookAddress, namespaceKey)
    return response && response.namespace_entries && response.namespace_entries.length > 0
  } catch (error) {
    console.error('Failed to check waiting status:', error)
    return false
  }
}

/**
 * Find active game for player
 */
export async function findPlayerGame(
  hookAddress: string,
  playerAddress: string
): Promise<string | null> {
  // TODO: This would require iterating through all games
  // or maintaining a player-to-game mapping in Hook state
  // For now, return null as placeholder
  return null
}

/**
 * Decode hex data to readable format
 */
export function decodeHexData(hexData: string): any {
  try {
    const buffer = Buffer.from(hexData, 'hex')
    // TODO: Implement proper binary data decoding based on Hook struct formats
    return buffer
  } catch (error) {
    console.error('Failed to decode hex data:', error)
    return null
  }
}

/**
 * Format XAH amount from drops
 */
export function formatXAH(drops: number): string {
  return (drops / 1000000).toFixed(6) + ' XAH'
}

/**
 * Parse chess board from binary data
 */
export function parseChessBoard(boardData: Buffer): number[][] {
  // TODO: Parse 8x8 board from binary data
  // Each square is 1 byte (piece type + color)
  const board = Array(8).fill(null).map(() => Array(8).fill(0))
  
  if (boardData.length >= 64) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const index = row * 8 + col
        board[row][col] = boardData[index]
      }
    }
  }
  
  return board
}

/**
 * Convert move notation to coordinates
 */
export function parseMove(move: string): { from: [number, number], to: [number, number] } | null {
  // Parse algebraic notation like "e2e4"
  if (move.length !== 4) return null
  
  const fromCol = move.charCodeAt(0) - 97 // 'a' = 0
  const fromRow = parseInt(move[1]) - 1
  const toCol = move.charCodeAt(2) - 97
  const toRow = parseInt(move[3]) - 1
  
  if (fromCol < 0 || fromCol > 7 || fromRow < 0 || fromRow > 7 ||
      toCol < 0 || toCol > 7 || toRow < 0 || toRow > 7) {
    return null
  }
  
  return {
    from: [fromRow, fromCol],
    to: [toRow, toCol]
  }
}

/**
 * Convert coordinates to move notation
 */
export function formatMove(from: [number, number], to: [number, number]): string {
  const fromCol = String.fromCharCode(97 + from[1]) // 0 = 'a'
  const fromRow = (from[0] + 1).toString()
  const toCol = String.fromCharCode(97 + to[1])
  const toRow = (to[0] + 1).toString()
  
  return fromCol + fromRow + toCol + toRow
}
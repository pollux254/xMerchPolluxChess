"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import type { Square } from "react-chessboard/dist/chessboard/types"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { getPlayerSettings, type PlayerSettings } from "@/lib/player-profile"

type Theme = "light" | "middle" | "dark"

interface GameState {
  id: string
  tournament_id: string
  player_white: string
  player_black: string
  player_white_address: string
  player_black_address: string
  status: string
  game_state: {
    fen: string
    moves: string[]
    turn: 'white' | 'black'
  }
  white_time_remaining: number
  black_time_remaining: number
  last_move_at: string
  first_move_made: boolean
  started_at: string
  winner?: string
  result_reason?: string
}

// 🪝 Helper: Trigger Hook prize distribution
async function triggerPrizeDistribution(
  tournamentId: string, 
  winnerAddress: string, 
  network: 'testnet' | 'mainnet' = 'testnet'
) {
  try {
    console.log('🏆 Triggering prize distribution...')
    console.log('   Tournament:', tournamentId)
    console.log('   Winner:', winnerAddress)
    console.log('   Network:', network)
    
    const response = await fetch('/api/tournaments/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId,
        winnerAddress,
        network
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Prize distribution failed:', error)
      return false
    }

    const result = await response.json()
    console.log('✅ Prize distribution successful:', result)
    console.log('   Winner Prize:', result.winnerPrize)
    console.log('   Platform Fee:', result.platformFee)
    console.log('   TX Hash:', result.txHash)
    return true
    
  } catch (error) {
    console.error('❌ Error triggering prize distribution:', error)
    return false
  }
}

function GameMultiplayerContent() {
  const searchParams = useSearchParams()
  const gameId = searchParams.get("gameId")
  const tournamentId = searchParams.get("tournamentId")
  
  const [game, setGame] = useState<Chess>(new Chess())
  const [gamePosition, setGamePosition] = useState<string>("start")
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerID, setPlayerID] = useState<string | null>(null)
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null)
  const [whiteTime, setWhiteTime] = useState(1200)
  const [blackTime, setBlackTime] = useState(1200)
  const [turnStartedAt, setTurnStartedAt] = useState<number>(Date.now())
  const [countdown, setCountdown] = useState(5)
  const [gameStarted, setGameStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>("light")
  const [settings, setSettings] = useState<PlayerSettings | null>(null)
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet')
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.remove("light", "middle", "dark")
      document.documentElement.classList.add(savedTheme)
    }

    const savedNetwork = localStorage.getItem("network") as 'testnet' | 'mainnet'
    if (savedNetwork) {
      setNetwork(savedNetwork)
    }
  }, [])

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.remove("light", "middle", "dark")
    document.documentElement.classList.add(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  useEffect(() => {
    if (playerID && playerID !== "Guest") {
      getPlayerSettings(playerID).then(playerSettings => {
        if (playerSettings) {
          setSettings(playerSettings)
        }
      })
    }
  }, [playerID])

  useEffect(() => {
    if (!gameId && !tournamentId) {
      setError("No game ID or tournament ID provided")
      return
    }

    const storedPlayerID = localStorage.getItem('playerID')
    if (!storedPlayerID) {
      alert("Please connect your wallet first")
      window.location.href = "/chess"
      return
    }
    
    setPlayerID(storedPlayerID)
    loadGame(storedPlayerID)
  }, [gameId, tournamentId])

  async function loadGame(playerAddress: string) {
    try {
      console.log("🔍 Loading game for tournament:", tournamentId)
      
      let query = supabase.from('tournament_games').select('*')
      
      if (gameId) {
        query = query.eq('id', gameId)
      } else if (tournamentId) {
        query = query.eq('tournament_id', tournamentId)
      }
      
      const { data, error } = await query.maybeSingle()

      if (error) {
        console.error("Database error:", error)
        throw new Error(`Game query error: ${error.message}`)
      }
      
      if (!data) {
        console.error("No game found")
        await new Promise(resolve => setTimeout(resolve, 2000))
        const { data: retryData } = await query.maybeSingle()
        if (!retryData) {
          throw new Error("Game not found. Please refresh.")
        }
      }

      console.log("🎮 Game loaded:", data)

      const whitePlayerAddress = data.player_white
      const blackPlayerAddress = data.player_black

      console.log("👥 White player:", whitePlayerAddress)
      console.log("👥 Black player:", blackPlayerAddress)
      console.log("👤 Current player:", playerAddress)

      const isWhite = whitePlayerAddress === playerAddress
      const isBlack = blackPlayerAddress === playerAddress
      
      if (!isWhite && !isBlack) {
        console.error("❌ Player not in game!")
        console.error("   White:", whitePlayerAddress)
        console.error("   Black:", blackPlayerAddress)
        console.error("   You:", playerAddress)
        throw new Error("You are not a player in this game")
      }

      setMyColor(isWhite ? 'white' : 'black')
      console.log("✅ You are playing as:", isWhite ? 'white' : 'black')
      
      setGameState({
        ...data,
        player_white_address: whitePlayerAddress,
        player_black_address: blackPlayerAddress,
      })

      if (data.game_state?.fen) {
        const newGame = new Chess(data.game_state.fen)
        setGame(newGame)
        setGamePosition(data.game_state.fen)
      }

      setWhiteTime(data.white_time_remaining || 1200)
      setBlackTime(data.black_time_remaining || 1200)

      if (data.status === 'in_progress' && data.first_move_made) {
        setGameStarted(true)
        setCountdown(0)
      } else if (data.status === 'in_progress') {
        startCountdown()
        startFirstMoveTimeout(data)
      } else if (data.status === 'cancelled' || data.status === 'completed') {
        alert(`This game has ${data.status}. Returning to lobby...`)
        window.location.href = '/chess'
        return
      }

      setLoading(false)
    } catch (err: any) {
      console.error("Error loading game:", err)
      setError(err.message)
      setLoading(false)
    }
  }

  function startCountdown() {
    let count = 5
    setCountdown(count)
    
    const interval = setInterval(() => {
      count--
      setCountdown(count)
      
      if (count <= 0) {
        clearInterval(interval)
        setGameStarted(true)
      }
    }, 1000)
  }

  function startFirstMoveTimeout(gameData: any) {
    const startedAt = new Date(gameData.started_at || gameData.created_at).getTime()
    const now = Date.now()
    const elapsedSeconds = Math.floor((now - startedAt) / 1000)
    const remainingSeconds = Math.max(0, 120 - elapsedSeconds)
    
    console.log(`⏰ First move timeout: ${remainingSeconds}s remaining`)
    
    if (remainingSeconds <= 0 && !gameData.first_move_made) {
      handleFirstMoveTimeout()
      return
    }
    
    const timeoutId = setTimeout(async () => {
      const { data: currentGame } = await supabase
        .from('tournament_games')
        .select('first_move_made, status')
        .eq('id', gameData.id || tournamentId)
        .maybeSingle()
      
      if (currentGame && !currentGame.first_move_made && currentGame.status === 'in_progress') {
        handleFirstMoveTimeout()
      }
    }, remainingSeconds * 1000)
    
    return () => clearTimeout(timeoutId)
  }

  async function handleFirstMoveTimeout() {
    console.log("⏰ First move timeout - cancelling game")
    
    const gameIdToUpdate = gameState?.id || tournamentId
    
    await supabase
      .from('tournament_games')
      .update({
        status: 'cancelled',
        result_reason: 'first_move_timeout',
        completed_at: new Date().toISOString()
      })
      .eq('id', gameIdToUpdate)
    
    alert("⏰ Game cancelled - White player did not make first move within 2 minutes.\n\nReturning to lobby...")
    window.location.href = '/chess'
  }

  useEffect(() => {
    if (!gameStarted || !gameState || gameState.status !== 'in_progress' || !gameId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsedMs = now - turnStartedAt
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      const isWhiteTurn = game.turn() === 'w'

      supabase
        .from('tournament_games')
        .select('white_time_remaining, black_time_remaining')
        .eq('id', gameId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return

          if (isWhiteTurn) {
            const calculatedTime = Math.max(0, data.white_time_remaining - elapsedSeconds)
            setWhiteTime(calculatedTime)
            if (calculatedTime <= 0) handleTimeout('white')
          } else {
            const calculatedTime = Math.max(0, data.black_time_remaining - elapsedSeconds)
            setBlackTime(calculatedTime)
            if (calculatedTime <= 0) handleTimeout('black')
          }
        })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [gameStarted, gameState, game, turnStartedAt, gameId])

  // 🪝 UPDATED: Timeout handler with Hook integration
  async function handleTimeout(color: 'white' | 'black') {
    const winner = color === 'white' ? gameState?.player_black : gameState?.player_white
    
    await supabase
      .from('tournament_games')
      .update({
        status: 'completed',
        winner: winner,
        result_reason: 'timeout',
        completed_at: new Date().toISOString()
      })
      .eq('id', gameId)

    // 🪝 Trigger Hook prize distribution
    await triggerPrizeDistribution(tournamentId!, winner!, network)

    alert(`⏰ Time's up! ${color === 'white' ? 'Black' : 'White'} wins by timeout!\n\nPrizes are being distributed...`)
    
    setTimeout(() => {
      window.location.href = '/chess'
    }, 3000)
  }

  function onDrop(sourceSquare: Square, targetSquare: Square): boolean {
    const isMyTurn = (game.turn() === 'w' && myColor === 'white') || 
                     (game.turn() === 'b' && myColor === 'black')
    
    if (!isMyTurn) {
      return false
    }

    makeMove(sourceSquare, targetSquare)
    return true
  }

  async function makeMove(sourceSquare: string, targetSquare: string) {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      })

      if (move === null) {
        return false
      }

      setGamePosition(game.fen())

      const newGameState = {
        fen: game.fen(),
        moves: [...(gameState?.game_state?.moves || []), move.san],
        turn: game.turn() === 'w' ? 'white' as const : 'black' as const
      }

      const now = Date.now()
      const elapsedMs = now - turnStartedAt
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      const updatedMyTime = Math.max(0, (myColor === 'white' ? whiteTime : blackTime) - elapsedSeconds)
      
      const updates: any = {
        game_state: newGameState,
        last_move_at: new Date(now).toISOString(),
        turn_started_at: new Date(now).toISOString(),
        first_move_made: true
      }

      if (myColor === 'white') {
        updates.white_time_remaining = updatedMyTime
        updates.black_time_remaining = blackTime
      } else {
        updates.white_time_remaining = whiteTime
        updates.black_time_remaining = updatedMyTime
      }
      
      setTurnStartedAt(now)

      // 🪝 UPDATED: Checkmate handler with Hook integration
      if (game.isCheckmate()) {
        const winner = myColor === 'white' ? gameState?.player_white : gameState?.player_black
        updates.status = 'completed'
        updates.winner = winner
        updates.result_reason = 'checkmate'
        updates.completed_at = new Date().toISOString()
        
        // Update database first
        await supabase.from('tournament_games').update(updates).eq('id', gameId)
        
        // 🪝 Trigger Hook prize distribution
        await triggerPrizeDistribution(tournamentId!, winner!, network)
        
        alert(`🏆 Checkmate! ${myColor === 'white' ? 'White' : 'Black'} wins!\n\nPrizes are being distributed...`)
        
        setTimeout(() => {
          window.location.href = '/chess'
        }, 3000)
        
        return true // Exit early since we already updated DB
      } 
      // 🪝 UPDATED: Draw/Tiebreaker handler with Hook integration
      else if (game.isDraw()) {
        const winner = calculateMaterialTiebreaker()
        updates.status = 'completed'
        updates.result_reason = game.isStalemate() ? 'stalemate' : 'draw'
        updates.completed_at = new Date().toISOString()
        updates.winner = winner
        
        // Update database first
        await supabase.from('tournament_games').update(updates).eq('id', gameId)
        
        // 🪝 Trigger Hook prize distribution (only if not a perfect tie)
        if (winner !== 'tie') {
          await triggerPrizeDistribution(tournamentId!, winner, network)
        }
        
        alert(`🤝 Draw! Winner by material tiebreaker: ${winner === gameState?.player_white ? 'White' : 'Black'}\n\nPrizes are being distributed...`)
        
        setTimeout(() => {
          window.location.href = '/chess'
        }, 3000)
        
        return true // Exit early
      }

      // Regular move (game continues)
      await supabase.from('tournament_games').update(updates).eq('id', gameId)

      return true
    } catch (err) {
      console.error("Error making move:", err)
      return false
    }
  }

  function calculateMaterialTiebreaker(): string {
    const pieceValues: { [key: string]: number } = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
    
    let whiteValue = 0
    let blackValue = 0
    
    const board = game.board()
    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          const value = pieceValues[square.type]
          if (square.color === 'w') {
            whiteValue += value
          } else {
            blackValue += value
          }
        }
      })
    })

    console.log("📊 Material count - White:", whiteValue, "Black:", blackValue)

    if (whiteValue > blackValue) {
      return gameState?.player_white || ''
    } else if (blackValue > whiteValue) {
      return gameState?.player_black || ''
    } else {
      return 'tie'
    }
  }

  // 🪝 UPDATED: Resign handler with Hook integration
  async function handleResign() {
    const confirm = window.confirm("Are you sure you want to resign?")
    if (!confirm) return

    const winner = myColor === 'white' ? gameState?.player_black : gameState?.player_white

    await supabase
      .from('tournament_games')
      .update({
        status: 'completed',
        winner: winner,
        result_reason: 'resign',
        completed_at: new Date().toISOString()
      })
      .eq('id', gameId)

    // 🪝 Trigger Hook prize distribution
    await triggerPrizeDistribution(tournamentId!, winner!, network)

    alert("You resigned.\n\nPrizes are being distributed...")
    
    setTimeout(() => {
      window.location.href = '/chess'
    }, 3000)
  }

  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_games',
        filter: `id=eq.${gameId}`
      }, (payload: any) => {
        const newState = payload.new
        
        if (newState.game_state?.fen) {
          setGame(new Chess(newState.game_state.fen))
          setGamePosition(newState.game_state.fen)
        }

        setWhiteTime(newState.white_time_remaining || 1200)
        setBlackTime(newState.black_time_remaining || 1200)

        if (newState.status === 'completed') {
          setTimeout(() => {
            alert(`Game Over! ${newState.result_reason}`)
            window.location.href = "/chess"
          }, 2000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">♟️</div>
          <p className="text-2xl font-bold text-white">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400 mb-4">❌ Error</p>
          <p className="text-white mb-6">{error}</p>
          <button onClick={() => window.location.href = "/chess"} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">
            Return to Lobby
          </button>
        </div>
      </div>
    )
  }

  if (countdown > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <p className="text-4xl font-bold text-white mb-8">Game Starting In</p>
          <motion.div key={countdown} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-9xl font-black text-cyan-300">
            {countdown}
          </motion.div>
          <p className="text-xl text-gray-300 mt-8">
            You are playing as {myColor === 'white' ? '⚪ White' : '⚫ Black'}
          </p>
        </motion.div>
      </div>
    )
  }

  const getTimerColor = (isActive: boolean, timeRemaining: number) => {
    if (isActive && timeRemaining < 30) return "text-red-500"
    return theme === "light" ? "text-gray-900" : "text-cyan-300"
  }
  
  const myTimerColor = getTimerColor(
    game.turn() === (myColor === 'white' ? 'w' : 'b'),
    myColor === 'white' ? whiteTime : blackTime
  )
  const opponentTimerColor = getTimerColor(
    game.turn() !== (myColor === 'white' ? 'w' : 'b'),
    myColor === 'white' ? blackTime : whiteTime
  )

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200" : "bg-gradient-to-br from-gray-900 via-purple-900/30 to-black"} ${theme === "light" ? "text-gray-900" : "text-white"} p-4`}>
      <div className="fixed top-4 right-4 z-50 flex gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm p-2 shadow-lg">
        <button onClick={() => setThemeValue("light")} className={`rounded-full p-2 transition-all ${theme === "light" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <Sun className="h-5 w-5" />
        </button>
        <button onClick={() => setThemeValue("middle")} className={`rounded-full p-2 transition-all ${theme === "middle" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <Monitor className="h-5 w-5" />
        </button>
        <button onClick={() => setThemeValue("dark")} className={`rounded-full p-2 transition-all ${theme === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <Moon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">{myColor === 'white' ? '⚫ Black' : '⚪ White'} (Opponent)</h3>
              <p className="font-mono text-sm mb-4">
                {myColor === 'white' 
                  ? gameState?.player_black_address.slice(0, 10) + '...' + gameState?.player_black_address.slice(-6)
                  : gameState?.player_white_address.slice(0, 10) + '...' + gameState?.player_white_address.slice(-6)
                }
              </p>
              <div className={`text-4xl font-black ${opponentTimerColor}`}>
                {formatTime(myColor === 'white' ? blackTime : whiteTime)}
              </div>
              {game.turn() !== (myColor === 'white' ? 'w' : 'b') && (
                <p className="text-emerald-400 mt-2 animate-pulse">● Their turn</p>
              )}
            </div>

            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-3">Move History</h3>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {gameState?.game_state?.moves?.map((move, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="text-gray-400">{Math.floor(idx / 2) + 1}.</span> {move}
                  </div>
                )) || <p className="text-gray-500">No moves yet</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4">
              <Chessboard 
                id="multiplayer-board"
                position={gamePosition}
                onPieceDrop={onDrop}
                boardOrientation={myColor === 'white' ? 'white' : 'black'}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                }}
              />
              
              <div className="mt-4 text-center">
                {game.isCheck() && <p className="text-red-400 text-xl font-bold animate-pulse">CHECK!</p>}
                {game.turn() === (myColor === 'white' ? 'w' : 'b') && !game.isGameOver() && (
                  <p className="text-emerald-400 text-lg font-semibold">Your turn to move</p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">{myColor === 'white' ? '⚪ White' : '⚫ Black'} (You)</h3>
              <p className="font-mono text-sm mb-4">{playerID?.slice(0, 10)}...{playerID?.slice(-6)}</p>
              <div className={`text-4xl font-black ${myTimerColor}`}>
                {formatTime(myColor === 'white' ? whiteTime : blackTime)}
              </div>
              {game.turn() === (myColor === 'white' ? 'w' : 'b') && (
                <p className="text-emerald-400 mt-2 animate-pulse">● Your turn</p>
              )}
            </div>

            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 space-y-4">
              <button onClick={handleResign} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-colors">
                🏳️ Resign
              </button>
              <button onClick={() => window.location.href = "/chess"} className="w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-xl font-bold transition-colors">
                ← Back to Lobby
              </button>
            </div>

            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 mt-4">
              <h3 className="text-lg font-bold mb-3">Game Info</h3>
              <div className="space-y-2 text-sm">
                <p>Tournament: {gameState?.tournament_id?.slice(0, 8)}...</p>
                <p>Format: Single Elimination</p>
                <p>Time Control: 20+0</p>
                <p className="text-purple-400">🪝 Hook-Enabled Prizes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GameMultiplayer() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">♟️</div>
          <p className="text-2xl font-bold text-white">Loading...</p>
        </div>
      </div>
    }>
      <GameMultiplayerContent />
    </Suspense>
  )
}
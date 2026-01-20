"use client"

import { Suspense, useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase-client"
import { getPlayerSettings, type PlayerSettings } from "@/lib/player-profile"
import ProfileModal from "@/app/components/ProfileModal"

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

function GameMultiplayerContent() {
  const searchParams = useSearchParams()
  // CRITICAL FIX: Accept both gameId and tournamentId parameters
  const gameId = searchParams.get("gameId")
  const tournamentId = searchParams.get("tournamentId")
  
  const [game, setGame] = useState<Chess>(new Chess())
  const [gamePosition, setGamePosition] = useState<string>("start")
  const [visualFen, setVisualFen] = useState<string>("start")
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
  
  // Theme state
  const [theme, setTheme] = useState<Theme>("light")
  
  // Move history navigation
  const [fenHistory, setFenHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [viewingHistory, setViewingHistory] = useState(false)
  
  // Click-to-move
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  
  // Confirm moves
  const [settings, setSettings] = useState<PlayerSettings | null>(null)
  const [pendingMove, setPendingMove] = useState<{from: string, to: string} | null>(null)
  
  // Profile modal
  const [showProfile, setShowProfile] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = getSupabaseClient()

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.remove("light", "middle", "dark")
      document.documentElement.classList.add(savedTheme)
    }
  }, [])

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.remove("light", "middle", "dark")
    document.documentElement.classList.add(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  // Load player settings
  useEffect(() => {
    if (playerID && playerID !== "Guest") {
      getPlayerSettings(playerID).then(playerSettings => {
        if (playerSettings) {
          setSettings(playerSettings)
        }
      })
    }
  }, [playerID])

  // Initialize game
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

  // Load game from database
  async function loadGame(playerAddress: string) {
    try {
      // CRITICAL FIX: Simpler query without complex joins
      let query = supabase
        .from('tournament_games')
        .select('*')
      
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
        console.error("No game found for tournament:", tournamentId)
        throw new Error("Game not found - it may still be loading")
      }

      console.log("🎮 Game loaded:", data)

      // Get player addresses from tournament_players
      const { data: players } = await supabase
        .from('tournament_players')
        .select('id, player_address')
        .in('id', [data.player_white, data.player_black])
      
      const whitePlayer = players?.find(p => p.id === data.player_white)
      const blackPlayer = players?.find(p => p.id === data.player_black)
      
      if (!whitePlayer || !blackPlayer) {
        throw new Error("Player data not found")
      }

      // Determine player color
      const isWhite = whitePlayer.player_address === playerAddress
      const isBlack = blackPlayer.player_address === playerAddress
      
      if (!isWhite && !isBlack) {
        throw new Error("You are not a player in this game")
      }

      setMyColor(isWhite ? 'white' : 'black')
      
      setGameState({
        ...data,
        player_white_address: whitePlayer.player_address,
        player_black_address: blackPlayer.player_address,
      })

      // Load game position
      if (data.game_state?.fen) {
        const newGame = new Chess(data.game_state.fen)
        setGame(newGame)
        setGamePosition(data.game_state.fen)
      }

      // Set timers
      setWhiteTime(data.white_time_remaining || 1200)
      setBlackTime(data.black_time_remaining || 1200)

      // Check if game has started
      if (data.status === 'in_progress' && data.first_move_made) {
        setGameStarted(true)
        setCountdown(0)
      } else if (data.status === 'in_progress') {
        // Start countdown
        startCountdown()
        
        // Start first-move timeout check (2 minutes for white to move)
        startFirstMoveTimeout(data)
      } else if (data.status === 'cancelled' || data.status === 'completed') {
        // Game already ended
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

  // 5-second countdown before game starts
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

  // First move timeout - if white doesn't move in 2 minutes, cancel game
  function startFirstMoveTimeout(gameData: any) {
    const startedAt = new Date(gameData.started_at || gameData.created_at).getTime()
    const now = Date.now()
    const elapsedSeconds = Math.floor((now - startedAt) / 1000)
    const remainingSeconds = Math.max(0, 120 - elapsedSeconds) // 2 minutes = 120 seconds
    
    console.log(`⏰ First move timeout: ${remainingSeconds}s remaining`)
    
    if (remainingSeconds <= 0 && !gameData.first_move_made) {
      // Already expired - cancel now
      handleFirstMoveTimeout()
      return
    }
    
    // Set timeout for remaining time
    const timeoutId = setTimeout(async () => {
      // Check if first move was made
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

  // WALL CLOCK TIMER: Recalculate from database every second (ANTI-CHEAT)
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

      // Fetch STORED time from database, subtract elapsed
      supabase
        .from('tournament_games')
        .select('white_time_remaining, black_time_remaining, turn_started_at')
        .eq('id', gameId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return

          if (isWhiteTurn) {
            const calculatedTime = Math.max(0, data.white_time_remaining - elapsedSeconds)
            setWhiteTime(calculatedTime)
            
            if (calculatedTime <= 0) {
              handleTimeout('white')
            }
          } else {
            const calculatedTime = Math.max(0, data.black_time_remaining - elapsedSeconds)
            setBlackTime(calculatedTime)
            
            if (calculatedTime <= 0) {
              handleTimeout('black')
            }
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

  // Handle timeout
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

    alert(`⏰ Time's up! ${color === 'white' ? 'Black' : 'White'} wins by timeout!`)
  }

  // Handle piece drop (make move)
  function onDrop({ sourceSquare, targetSquare }: any): boolean {
    // Check if it's my turn
    const isMyTurn = (game.turn() === 'w' && myColor === 'white') || 
                     (game.turn() === 'b' && myColor === 'black')
    
    if (!isMyTurn) {
      console.log("❌ Not your turn!")
      return false
    }

    // Make the move async in the background
    (async () => {
      await makeMove(sourceSquare, targetSquare)
    })()

    // Return true to allow the UI to update
    return true
  }

  // Async move handler
  async function makeMove(sourceSquare: string, targetSquare: string) {

    try {
      // Attempt the move
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      })

      if (move === null) {
        console.log("❌ Illegal move")
        return false
      }

      console.log("✅ Legal move:", move.san)

      // Update local position
      setGamePosition(game.fen())

      // Update database with new game state
      const newGameState = {
        fen: game.fen(),
        moves: [...(gameState?.game_state?.moves || []), move.san],
        turn: game.turn() === 'w' ? 'white' : 'black'
      }

      // WALL CLOCK: Calculate elapsed time and update
      const now = Date.now()
      const elapsedMs = now - turnStartedAt
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      
      // Deduct elapsed time from my clock
      const updatedMyTime = Math.max(0, (myColor === 'white' ? whiteTime : blackTime) - elapsedSeconds)
      
      const updates: any = {
        game_state: newGameState,
        last_move_at: new Date(now).toISOString(),
        turn_started_at: new Date(now).toISOString(), // Opponent's turn starts NOW
        first_move_made: true
      }

      // Update timers - save my updated time, opponent's time unchanged
      if (myColor === 'white') {
        updates.white_time_remaining = updatedMyTime
        updates.black_time_remaining = blackTime
      } else {
        updates.white_time_remaining = whiteTime
        updates.black_time_remaining = updatedMyTime
      }
      
      console.log("⏰ [Move] Elapsed:", elapsedSeconds, "s, My time:", updatedMyTime, "s")
      
      // Reset turn timer for opponent
      setTurnStartedAt(now)

      // Check for game end
      if (game.isCheckmate()) {
        updates.status = 'completed'
        updates.winner = myColor === 'white' ? gameState?.player_white : gameState?.player_black
        updates.result_reason = 'checkmate'
        updates.completed_at = new Date().toISOString()
        
        alert(`🏆 Checkmate! ${myColor === 'white' ? 'White' : 'Black'} wins!`)
      } else if (game.isDraw()) {
        updates.status = 'completed'
        updates.result_reason = game.isStalemate() ? 'stalemate' : 'draw'
        updates.completed_at = new Date().toISOString()
        
        // Calculate material tiebreaker
        const winner = calculateMaterialTiebreaker()
        updates.winner = winner
        
        alert(`🤝 Draw! Winner by material tiebreaker: ${winner === gameState?.player_white ? 'White' : 'Black'}`)
      }

      const { error } = await supabase
        .from('tournament_games')
        .update(updates)
        .eq('id', gameId)

      if (error) throw error

      return true
    } catch (err) {
      console.error("Error making move:", err)
      return false
    }
  }

  // Calculate material tiebreaker (higher material wins)
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
      // Exact tie - split prize (handled elsewhere)
      return 'tie'
    }
  }

  // Handle resign
  async function handleResign() {
    const confirm = window.confirm("Are you sure you want to resign? You will lose the game.")
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

    alert("You resigned. Your opponent wins.")
    window.location.href = "/chess"
  }

  // Real-time sync - listen for opponent moves
  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_games',
          filter: `id=eq.${gameId}`
        },
        (payload: any) => {
          console.log("🔄 Game updated:", payload)
          
          const newState = payload.new
          
          // Update game position
          if (newState.game_state?.fen) {
            setGame(new Chess(newState.game_state.fen))
            setGamePosition(newState.game_state.fen)
          }

          // Update timers
          setWhiteTime(newState.white_time_remaining || 1200)
          setBlackTime(newState.black_time_remaining || 1200)

          // Check if game ended
          if (newState.status === 'completed') {
            setTimeout(() => {
              alert(`Game Over! ${newState.result_reason}`)
              window.location.href = "/chess"
            }, 2000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  // Format time display
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
          <button
            onClick={() => window.location.href = "/chess"}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    )
  }

  if (countdown > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <p className="text-4xl font-bold text-white mb-8">Game Starting In</p>
          <motion.div
            key={countdown}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-9xl font-black text-cyan-300"
          >
            {countdown}
          </motion.div>
          <p className="text-xl text-gray-300 mt-8">
            You are playing as {myColor === 'white' ? '⚪ White' : '⚫ Black'}
          </p>
        </motion.div>
      </div>
    )
  }

  // Theme-aware timer colors
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
      {/* Theme Switcher */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm p-2 shadow-lg">
        <button
          onClick={() => setThemeValue("light")}
          className={`rounded-full p-2 transition-all ${theme === "light" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Sun className="h-5 w-5" />
        </button>
        <button
          onClick={() => setThemeValue("middle")}
          className={`rounded-full p-2 transition-all ${theme === "middle" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Monitor className="h-5 w-5" />
        </button>
        <button
          onClick={() => setThemeValue("dark")}
          className={`rounded-full p-2 transition-all ${theme === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Moon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Opponent Info */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">
                {myColor === 'white' ? '⚫ Black' : '⚪ White'} (Opponent)
              </h3>
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

            {/* Move History */}
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

          {/* Center - Chess Board */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4">
              <Chessboard
                options={{
                  position: gamePosition,
                  onPieceDrop: onDrop,
                  boardOrientation: (myColor === 'white' ? 'white' : 'black') as 'white' | 'black'
                }}
              />
              
              {/* Game Status */}
              <div className="mt-4 text-center">
                {game.isCheck() && (
                  <p className="text-red-400 text-xl font-bold animate-pulse">CHECK!</p>
                )}
                {game.turn() === (myColor === 'white' ? 'w' : 'b') && !game.isGameOver() && (
                  <p className="text-emerald-400 text-lg font-semibold">Your turn to move</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Your Info & Controls */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">
                {myColor === 'white' ? '⚪ White' : '⚫ Black'} (You)
              </h3>
              <p className="font-mono text-sm mb-4">
                {playerID?.slice(0, 10)}...{playerID?.slice(-6)}
              </p>
              <div className={`text-4xl font-black ${myTimerColor}`}>
                {formatTime(myColor === 'white' ? whiteTime : blackTime)}
              </div>
              {game.turn() === (myColor === 'white' ? 'w' : 'b') && (
                <p className="text-emerald-400 mt-2 animate-pulse">● Your turn</p>
              )}
            </div>

            {/* Controls */}
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 space-y-4">
              <button
                onClick={handleResign}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-colors"
              >
                🏳️ Resign
              </button>
              
              <button
                onClick={() => window.location.href = "/chess"}
                className="w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-xl font-bold transition-colors"
              >
                ← Back to Lobby
              </button>
            </div>

            {/* Game Info */}
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 mt-4">
              <h3 className="text-lg font-bold mb-3">Game Info</h3>
              <div className="space-y-2 text-sm">
                <p>Tournament: {gameState?.tournament_id}</p>
                <p>Format: Single Elimination</p>
                <p>Time Control: 20+0</p>
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

"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { motion } from "framer-motion"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
  const gameId = searchParams.get("gameId")
  
  const [game, setGame] = useState<Chess>(new Chess())
  const [gamePosition, setGamePosition] = useState<string>("start")
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerID, setPlayerID] = useState<string | null>(null)
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null)
  const [whiteTime, setWhiteTime] = useState(1200) // 20 minutes in seconds
  const [blackTime, setBlackTime] = useState(1200)
  const [countdown, setCountdown] = useState(5)
  const [gameStarted, setGameStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Initialize game
  useEffect(() => {
    if (!gameId) {
      setError("No game ID provided")
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
  }, [gameId])

  // Load game from database
  async function loadGame(playerAddress: string) {
    try {
      const { data, error } = await supabase
        .from('tournament_games')
        .select(`
          *,
          white_player:tournament_players!player_white(player_address),
          black_player:tournament_players!player_black(player_address)
        `)
        .eq('id', gameId)
        .single()

      if (error) throw error
      if (!data) throw new Error("Game not found")

      console.log("🎮 Game loaded:", data)

      // Determine player color
      const isWhite = data.white_player.player_address === playerAddress
      const isBlack = data.black_player.player_address === playerAddress
      
      if (!isWhite && !isBlack) {
        throw new Error("You are not a player in this game")
      }

      setMyColor(isWhite ? 'white' : 'black')
      
      setGameState({
        ...data,
        player_white_address: data.white_player.player_address,
        player_black_address: data.black_player.player_address,
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

  // Timer countdown (only runs when it's current player's turn)
  useEffect(() => {
    if (!gameStarted || !gameState || gameState.status !== 'in_progress') return

    const interval = setInterval(() => {
      const isWhiteTurn = game.turn() === 'w'
      
      if (isWhiteTurn) {
        setWhiteTime(prev => {
          const newTime = Math.max(0, prev - 1)
          if (newTime === 0) {
            handleTimeout('white')
          }
          return newTime
        })
      } else {
        setBlackTime(prev => {
          const newTime = Math.max(0, prev - 1)
          if (newTime === 0) {
            handleTimeout('black')
          }
          return newTime
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gameStarted, gameState, game])

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
  async function onDrop(sourceSquare: string, targetSquare: string): Promise<boolean> {
    // Check if it's my turn
    const isMyTurn = (game.turn() === 'w' && myColor === 'white') || 
                     (game.turn() === 'b' && myColor === 'black')
    
    if (!isMyTurn) {
      console.log("❌ Not your turn!")
      return false
    }

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

      const updates: any = {
        game_state: newGameState,
        last_move_at: new Date().toISOString(),
        first_move_made: true
      }

      // Update timers
      if (myColor === 'white') {
        updates.white_time_remaining = whiteTime
      } else {
        updates.black_time_remaining = blackTime
      }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white p-4">
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
              <div className="text-4xl font-black text-cyan-300">
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
                position={gamePosition}
                onPieceDrop={onDrop}
                boardOrientation={myColor === 'white' ? 'white' : 'black'}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)'
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
              <div className="text-4xl font-black text-cyan-300">
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
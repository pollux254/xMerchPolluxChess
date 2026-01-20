"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { Moon, Sun, Monitor } from "lucide-react"
import { BOT_PROFILE_BY_ID, getBotDifficultyByRank, generateBotRankForDifficulty } from "@/lib/bots/bot-profiles"
import { BOT_PROFILES } from "@/lib/bots/bot-profiles"
import { getBotThinkingTimeSeconds } from "@/lib/bots/thinking-time"
import { StockfishEngine, getStockfishParams } from "@/lib/stockfish/engine"
import { getSupabaseClient } from "@/lib/supabase-client"
import { getPlayerSettings, updateBotStats, getPlayerStats, type PlayerSettings } from "@/lib/player-profile"
import ProfileModal from "@/app/components/ProfileModal"
import GameResultModal from "@/app/components/GameResultModal"

type Theme = "light" | "middle" | "dark"

function GameContent() {
  const searchParams = useSearchParams()
  const playerID = searchParams.get("player") ?? "Guest"
  const fee = searchParams.get("fee") ?? "0"
  const mode = searchParams.get("mode")
  const botId = searchParams.get("botId")
  const botRankParam = searchParams.get("botRank") // BUG FIX 1: Get botRank from URL
  const [matchedBotId, setMatchedBotId] = useState<string | null>(null)
  const effectiveBotId = botId ?? matchedBotId
  const bot = effectiveBotId ? BOT_PROFILE_BY_ID.get(effectiveBotId) : undefined
  const playerColorParam = searchParams.get("playerColor")

  console.log("🎮 [Game] URL Params:", { playerID, fee, mode, botId, botRank: botRankParam })

  const [matchmaking, setMatchmaking] = useState(mode === "bot_matchmaking")
  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [visualFen, setVisualFen] = useState(game.fen()) // Separate visual state for smooth animations
  const [isPlayerWhite, setIsPlayerWhite] = useState<boolean | null>(null)
  const [status, setStatus] = useState("Initializing...")
  const [playerTime, setPlayerTime] = useState(1200)
  const [botTime, setBotTime] = useState(1200)
  const [activePlayer, setActivePlayer] = useState<"player" | "bot" | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const botThinkingRef = useRef(false)
  const botThinkingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const engineRef = useRef<StockfishEngine | null>(null)
  const [boardWidth, setBoardWidth] = useState<number>(320)
  const [thinkingSeconds, setThinkingSeconds] = useState<number | null>(null)
  const [thinkingElapsed, setThinkingElapsed] = useState<number>(0)
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  
  const [engineReady, setEngineReady] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [engineInitializing, setEngineInitializing] = useState(false)
  const engineInitializedRef = useRef(false)
  const initRetryCountRef = useRef(0)
  const maxRetries = 3

  // Database persistence state
  const [gameId, setGameId] = useState<string | null>(null)
  const [turnStartedAt, setTurnStartedAt] = useState<number>(Date.now())
  const [gameLoaded, setGameLoaded] = useState(false)
  const [firstMoveMade, setFirstMoveMade] = useState(false)
  const [gameStartedAt, setGameStartedAt] = useState<Date | null>(null)
  const gameLoadedRef = useRef(false)
  const supabase = getSupabaseClient()

  // Player settings
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings | null>(null)
  const statsUpdatedRef = useRef(false)
  
  // FIX #1: Profile modal state
  const [showProfile, setShowProfile] = useState(false)
  
  // FIX #4: Result modal state
  const [showResultModal, setShowResultModal] = useState(false)
  const [gameResult, setGameResult] = useState<'win' | 'loss' | 'draw'>('draw')
  const [oldRank, setOldRank] = useState(1)
  const [newRank, setNewRank] = useState(1)
  const [resultReason, setResultReason] = useState<'checkmate' | 'timeout' | 'resignation' | 'stalemate'>('checkmate')
  
  // FIX #3: Confirm moves
  const [settings, setSettings] = useState<PlayerSettings | null>(null)
  const [pendingMove, setPendingMove] = useState<{from: string, to: string} | null>(null)
  
  // Move history navigation - store FEN positions
  const [fenHistory, setFenHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1) // -1 means at current position
  const [viewingHistory, setViewingHistory] = useState(false)
  
  // Click-to-move state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  
  // Theme state
  const [theme, setTheme] = useState<Theme>("light")

  // Load theme from localStorage on mount
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

  useEffect(() => {
    if (mode !== "bot_matchmaking") return

    setMatchmaking(true)
    
    // CRITICAL FIX: Use botRank parameter for rank-based bot selection
    console.log('━━━ BOT SELECTION DEBUG ━━━')
    console.log('URL botRank param:', botRankParam)
    
    const targetRank = parseInt(botRankParam || '') || 300
    console.log('Parsed targetRank:', targetRank)
    
    // Find bot closest to targetRank
    const pick = BOT_PROFILES.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.rank - targetRank)
      const currentDiff = Math.abs(current.rank - targetRank)
      return currentDiff < closestDiff ? current : closest
    })
    
    console.log(`🎯 Target Rank: ${targetRank}, Selected Bot: ${pick.name} (Rank ${pick.rank})`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const delay = 1200 + Math.floor(Math.random() * 1400)

    const t = setTimeout(() => {
      setMatchedBotId(pick.botId)
      setMatchmaking(false)
    }, delay)

    return () => clearTimeout(t)
  }, [mode, botRankParam])

  // ENGINE INITIALIZATION WITH ASYNC initialize() METHOD
  useEffect(() => {
    if (engineInitializedRef.current) return
    engineInitializedRef.current = true

    const initEngine = async () => {
      setEngineInitializing(true)
      
      try {
        console.log("🎮 [PolluxChess] Creating Stockfish engine...")
        setStatus("Loading chess engine...")
        
        // Create engine instance
        engineRef.current = new StockfishEngine()
        
        // CRITICAL: Call initialize() method first
        console.log("⏳ Initializing worker...")
        await engineRef.current.initialize()
        
        // Then wait for UCI ready
        console.log("⏳ Waiting for UCI protocol (up to 45s)...")
        await engineRef.current.waitReady(45000)
        
        setEngineReady(true)
        setEngineError(null)
        setEngineInitializing(false)
        console.log("✅ Stockfish engine ready!")
        setStatus("Engine ready - Starting game...")
        initRetryCountRef.current = 0
        
      } catch (error) {
        console.error("❌ Engine initialization failed:", error)
        
        if (initRetryCountRef.current < maxRetries) {
          initRetryCountRef.current++
          console.log(`🔄 Retry ${initRetryCountRef.current}/${maxRetries}...`)
          
          if (engineRef.current) {
            try {
              engineRef.current.terminate()
            } catch (e) {
              // ignore
            }
            engineRef.current = null
          }
          
          engineInitializedRef.current = false
          setTimeout(() => {
            initEngine()
          }, 2000)
          
        } else {
          setEngineError("Chess engine failed to load")
          setEngineInitializing(false)
          setStatus("⚠️ Engine error - See troubleshooting below")
          
          console.error("🔍 Troubleshooting:")
          console.error("1. Check if Stockfish files exist in public/stockfish/")
          console.error("2. Try opening: " + window.location.origin + "/stockfish/stockfish.worker.js")
          console.error("3. Check Network tab in DevTools for 404 errors")
          console.error("4. If files are missing, we'll use CDN fallback (slower but works)")
        }
      }
    }

    initEngine()

    return () => {
      if (engineRef.current) {
        console.log("🧹 Cleaning up engine...")
        try {
          engineRef.current.terminate()
        } catch (e) {
          // ignore
        }
        engineRef.current = null
      }
      engineInitializedRef.current = false
      setEngineReady(false)
      setEngineInitializing(false)
    }
  }, [])

  // FIX #3: Load player settings on mount
  useEffect(() => {
    if (playerID && playerID !== "Guest") {
      console.log("⚙️ [Settings] Loading player settings...")
      getPlayerSettings(playerID).then(playerSettings => {
        if (playerSettings) {
          setSettings(playerSettings)
          console.log("⚙️ [Settings] Settings loaded:", playerSettings)
        }
      })
    }
  }, [playerID])

  // FIX #4: Fetch initial rank for result modal
  useEffect(() => {
    if (playerID && playerID !== "Guest") {
      console.log("📊 [Profile] Fetching initial rank for result modal...")
      getPlayerStats(playerID).then(stats => {
        if (stats) {
          setOldRank(stats.bot_elo)
          console.log("📊 [Profile] Initial rank:", stats.bot_elo)
        }
      })
    }
  }, [playerID])

  // GAME RESTORATION & CREATION - Check for existing bot game or create new one
  useEffect(() => {
    if (gameLoadedRef.current) return
    if (!engineReady) return
    if (playerID === "Guest") return
    if (matchmaking) return // Wait for matchmaking to finish
    // Only wait for bot if we're actively matchmaking, not if restoring
    if (mode === "bot_matchmaking" && !bot) return // Wait for bot to be selected

    gameLoadedRef.current = true


    const loadOrCreateGame = async () => {
      try {
        console.log("🎮 [BotGame] Checking for existing bot game...")
        
        // Check for existing active bot game
        const { data: existingGames, error: queryError } = await supabase
          .from('tournament_games')
          .select('*')
          .eq('game_type', 'bot')
          .eq('status', 'active')
          .or(`player_white.eq.${playerID},player_black.eq.${playerID}`)
          .limit(1)

        if (queryError) {
          console.error("🎮 [BotGame] Query error:", queryError)
        }

        if (existingGames && existingGames.length > 0) {
          // Restore existing game
          const existingGame = existingGames[0]
          console.log("🎮 [BotGame] Restoring existing game:", existingGame.id)

          setGameId(existingGame.id)
          setFirstMoveMade(existingGame.first_move_made || false)
          setGameStartedAt(new Date(existingGame.started_at))

          // Restore board position
          const restoredGame = new Chess(existingGame.game_state)
          setGame(restoredGame)
          setFen(existingGame.game_state)

          // Determine player color
          const playerIsWhite = existingGame.player_white === playerID
          setIsPlayerWhite(playerIsWhite)

          // WALL CLOCK: Calculate from turn_started_at (anti-cheat)
          const now = Date.now()
          const turnStartTime = new Date(existingGame.turn_started_at || existingGame.last_move_at).getTime()
          const elapsedSeconds = Math.floor((now - turnStartTime) / 1000)

          console.log("⏰ [WALL CLOCK] Current time:", new Date(now).toLocaleTimeString())
          console.log("⏰ [WALL CLOCK] Turn started at:", new Date(turnStartTime).toLocaleTimeString())
          console.log("⏰ [WALL CLOCK] Elapsed THIS TURN:", elapsedSeconds, "seconds")
          console.log("⏰ [WALL CLOCK] Stored white time:", existingGame.white_time_remaining)
          console.log("⏰ [WALL CLOCK] Stored black time:", existingGame.black_time_remaining)
          console.log("⏰ [WALL CLOCK] Current turn:", existingGame.current_turn)

          // Calculate remaining times based on stored time - elapsed
          let whiteTimeRemaining = existingGame.white_time_remaining
          let blackTimeRemaining = existingGame.black_time_remaining

          if (existingGame.current_turn === 'white') {
            whiteTimeRemaining = Math.max(0, existingGame.white_time_remaining - elapsedSeconds)
            console.log("⏰ [WALL CLOCK] White's turn - time left:", whiteTimeRemaining)
          } else {
            blackTimeRemaining = Math.max(0, existingGame.black_time_remaining - elapsedSeconds)
            console.log("⏰ [WALL CLOCK] Black's turn - time left:", blackTimeRemaining)
          }

          if (playerIsWhite) {
            setPlayerTime(whiteTimeRemaining)
            setBotTime(blackTimeRemaining)
          } else {
            setPlayerTime(blackTimeRemaining)
            setBotTime(whiteTimeRemaining)
          }

          // Store the turn start time (NEVER update this during countdown)
          setTurnStartedAt(turnStartTime)
          console.log("⏰ [WALL CLOCK] Locked turn_started_at - timer will calculate from this")

          // Set active player based on current turn
          const currentTurn = restoredGame.turn()
          const isPlayerTurn = currentTurn === (playerIsWhite ? 'w' : 'b')
          setActivePlayer(isPlayerTurn ? 'player' : 'bot')

          setGameLoaded(true)
          setStatus(isPlayerTurn ? "Your turn! ♟️" : "Bot's turn ♘")

          console.log("🎮 [BotGame] Game restored successfully")

        } else {
          // Create new game
          console.log("🎮 [BotGame] No existing game found, creating new game...")

          // Randomly assign player color (coinflip)
          const playerIsWhite = playerColorParam === "white" ? true : playerColorParam === "black" ? false : Math.random() < 0.5
          setIsPlayerWhite(playerIsWhite)

          // Get bot difficulty from original rank, then generate random rank for that tier
          const originalRank = bot?.rank ?? 300
          const botDifficulty = getBotDifficultyByRank(originalRank)
          // Generate random rank within the same difficulty tier
          const botRank = generateBotRankForDifficulty(botDifficulty)
          
          console.log(`🎮 [BotGame] Bot ${bot?.name} - Original rank: ${originalRank}, Random rank: ${botRank}, Difficulty: ${botDifficulty}`)

          const newGameData = {
            tournament_id: 'BOT_GAME',
            game_type: 'bot',
            bot_difficulty: botDifficulty,
            bot_rank: botRank,
            player_white: playerIsWhite ? playerID : null,
            player_black: playerIsWhite ? null : playerID,
            current_turn: 'white',
            white_time_remaining: 1200,
            black_time_remaining: 1200,
            last_move_at: new Date().toISOString(),
            first_move_made: false,
            started_at: new Date().toISOString(),
            status: 'active',
            game_state: game.fen()
          }

          console.log("🎮 [BotGame] Creating new game with data:", newGameData)

          const { data: newGame, error: insertError } = await supabase
            .from('tournament_games')
            .insert([newGameData])
            .select()
            .single()

          if (insertError) {
            console.error("🎮 [BotGame] Failed to create game:", insertError)
            setStatus("Failed to create game. Please refresh.")
            return
          }

          console.log("🎮 [BotGame] New game created:", newGame.id)

          setGameId(newGame.id)
          setFirstMoveMade(false)
          setGameStartedAt(new Date(newGame.started_at))
          setTurnStartedAt(Date.now())
          setGameLoaded(true)

          // Set initial times
          setPlayerTime(1200)
          setBotTime(1200)

          // Set active player (white goes first)
          const isPlayerTurn = playerIsWhite
          setActivePlayer(isPlayerTurn ? 'player' : 'bot')
          setStatus(isPlayerTurn ? "Your turn! ♟️" : "Bot's turn ♘")
        }

      } catch (error) {
        console.error("🎮 [BotGame] Error loading/creating game:", error)
        setStatus("Error loading game. Please refresh.")
      }
    }

    loadOrCreateGame()
  }, [engineReady, playerID, matchmaking, bot, mode, playerColorParam])

  useEffect(() => {
    const compute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : 375
      const vh = typeof window !== "undefined" ? window.innerHeight : 667
      // More aggressive sizing to fit everything in viewport
      const available = Math.min(vw - 32, vh - 400)
      const size = Math.max(200, Math.min(420, Math.floor(available)))
      setBoardWidth(size)
    }

    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [])

  useEffect(() => {
    if (isPlayerWhite === null) return

    const startingColor = game.turn()
    const isPlayerTurn = startingColor === (isPlayerWhite ? "w" : "b")
    setActivePlayer(isPlayerTurn ? "player" : "bot")
    
    if (engineReady) {
      setStatus(isPlayerTurn ? "Your turn! ♟️" : "Bot's turn ♘")
    }
  }, [isPlayerWhite, game, engineReady])

  // WALL CLOCK TIMER: Recalculate from turn_started_at every second (ANTI-CHEAT)
  useEffect(() => {
    if (!activePlayer || game.isGameOver()) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (!gameId) return

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsedMs = now - turnStartedAt
      const elapsedSeconds = Math.floor(elapsedMs / 1000)

      if (activePlayer === "player") {
        // Fetch STORED time from database, subtract elapsed
        supabase
          .from('tournament_games')
          .select('white_time_remaining, black_time_remaining, current_turn')
          .eq('id', gameId)
          .single()
          .then(({ data, error }) => {
            if (error || !data) return

            const storedPlayerTime = isPlayerWhite ? data.white_time_remaining : data.black_time_remaining
            const calculatedTime = Math.max(0, storedPlayerTime - elapsedSeconds)

            setPlayerTime(calculatedTime)

            if (calculatedTime <= 0) {
              setStatus("Time forfeit! Bot wins ⏰")
              supabase.from('tournament_games').update({
                status: 'completed',
                winner: 'bot',
                result_reason: 'timeout',
                completed_at: new Date().toISOString()
              }).eq('id', gameId)
            }
          })
      } else {
        // Same for bot
        supabase
          .from('tournament_games')
          .select('white_time_remaining, black_time_remaining, current_turn')
          .eq('id', gameId)
          .single()
          .then(({ data, error }) => {
            if (error || !data) return

            const storedBotTime = isPlayerWhite ? data.black_time_remaining : data.white_time_remaining
            const calculatedTime = Math.max(0, storedBotTime - elapsedSeconds)

            setBotTime(calculatedTime)

            if (calculatedTime <= 0) {
              setStatus("Bot ran out of time! You win ⏰")
              supabase.from('tournament_games').update({
                status: 'completed',
                winner: isPlayerWhite ? 'white' : 'black',
                result_reason: 'timeout',
                completed_at: new Date().toISOString()
              }).eq('id', gameId)
            }
          })
      }
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activePlayer, game, turnStartedAt, gameId, isPlayerWhite])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Move navigation handlers - Simple FEN-based navigation
  const handlePreviousMove = () => {
    console.log(`📜 [History] Total positions: ${fenHistory.length}, Current index: ${historyIndex}`)
    if (fenHistory.length === 0) return
    
    let newIndex: number
    if (historyIndex === -1) {
      // Coming from current position, go to last saved position
      newIndex = fenHistory.length - 1
    } else if (historyIndex > 0) {
      // Go back one position
      newIndex = historyIndex - 1
    } else {
      // Already at first position
      console.log(`📜 [History] Already at starting position`)
      return
    }
    
    console.log(`📜 [History] Going to position ${newIndex + 1}/${fenHistory.length}`)
    setHistoryIndex(newIndex)
    setViewingHistory(true)
    setVisualFen(fenHistory[newIndex])
  }

  const handleNextMove = () => {
    if (historyIndex === -1) return // Already at current position
    
    const newIndex = historyIndex + 1
    
    if (newIndex >= fenHistory.length) {
      // Return to current position
      setHistoryIndex(-1)
      setViewingHistory(false)
      setVisualFen(fen)
    } else {
      setHistoryIndex(newIndex)
      setVisualFen(fenHistory[newIndex])
    }
  }

  const handleReturnToCurrent = () => {
    setHistoryIndex(-1)
    setViewingHistory(false)
    setVisualFen(fen)
  }

  // FIX #1: Game cleanup handler for Return to Lobby
  const handleReturnToLobby = async () => {
    if (gameId) {
      console.log('🧹 [Cleanup] Marking game as completed before redirect...')
      try {
        await supabase
          .from('tournament_games')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', gameId)
        console.log('✅ [Cleanup] Game marked completed successfully')
      } catch (error) {
        console.error('❌ [Cleanup] Failed to mark game completed:', error)
      }
    }
    console.log('🔄 [Redirect] Redirecting to lobby...')
    window.location.href = '/chess'
  }

  // FIX #3: Confirm/Cancel move handlers
  const confirmMove = () => {
    if (!pendingMove) return
    
    console.log('✅ [Confirm] Move confirmed, executing...')
    const { from, to } = pendingMove
    
    try {
      const gameCopy = new Chess(game.fen())
      const move = gameCopy.move({ from, to, promotion: "q" })
      
      if (move) {
        const now = Date.now()
        const elapsedSeconds = Math.floor((now - turnStartedAt) / 1000)
        const updatedPlayerTime = Math.max(0, playerTime - elapsedSeconds)
        const newWhiteTime = isPlayerWhite ? updatedPlayerTime : botTime
        const newBlackTime = isPlayerWhite ? botTime : updatedPlayerTime

        // Update database with turn_started_at
        if (gameId) {
          supabase
            .from('tournament_games')
            .update({
              game_state: gameCopy.fen(),
              last_move_at: new Date(now).toISOString(),
              turn_started_at: new Date(now).toISOString(),
              current_turn: gameCopy.turn() === 'w' ? 'white' : 'black',
              first_move_made: true,
              white_time_remaining: newWhiteTime,
              black_time_remaining: newBlackTime
            })
            .eq('id', gameId)
        }

        // Update local state
        setGame(gameCopy)
        setFen(gameCopy.fen())
        setVisualFen(gameCopy.fen())
        setTurnStartedAt(now)
        setFirstMoveMade(true)
        setActivePlayer("bot")
        setStatus("Bot's turn ♘")
      }
    } catch (error) {
      console.error('❌ [Confirm] Error executing confirmed move:', error)
    }
    
    setPendingMove(null)
  }

  const cancelMove = () => {
    console.log('❌ [Confirm] Move cancelled by user - reverting visual state')
    // Revert visual FEN back to actual game state
    setVisualFen(game.fen())
    setPendingMove(null)
  }

  const handleResign = async () => {
    if (!gameId || game.isGameOver()) return

    const confirmed = confirm("Are you sure you want to resign?")
    if (!confirmed) return

    console.log("🎮 [BotGame] Player resigned")

    // Mark stats as updated to prevent duplicate
    if (!statsUpdatedRef.current) {
      statsUpdatedRef.current = true
      
      console.log("📊 [Resign] Updating stats for resignation (loss)")
      
      // Update player stats - resignation counts as loss
      const success = await updateBotStats(playerID, 'loss')
      
      if (success) {
        console.log("✅ [Resign] Stats updated successfully - player lost 1 rank")
      } else {
        console.error("❌ [Resign] Failed to update stats")
      }
    }

    const opponentWallet = isPlayerWhite ? null : playerID // Bot doesn't have wallet
    const playerWallet = playerID

    await supabase
      .from('tournament_games')
      .update({
        status: 'completed',
        result_reason: 'resignation',
        winner: opponentWallet || 'bot', // Bot wins
        completed_at: new Date().toISOString()
      })
      .eq('id', gameId)

    setStatus("You resigned. Bot wins! Rank -1")

    setTimeout(() => {
      window.location.href = '/chess'
    }, 2000)
  }

  const onPieceDrop = ({ sourceSquare, targetSquare }: any): boolean => {
    if (isPlayerWhite === null || !targetSquare) return false
    if (!gameId) return false
    
    // Prevent moves while viewing history - return current first
    if (viewingHistory) {
      handleReturnToCurrent()
      return false // Don't process the move yet
    }

    const playerColor = isPlayerWhite ? "w" : "b"
    if (game.turn() !== playerColor) return false

    try {
      const gameCopy = new Chess(game.fen())
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      })

      if (move === null) return false

      // FIX #3: Check if confirm moves is enabled
      if (settings?.confirm_moves) {
        console.log('⏸️ [Confirm] Move requires confirmation - showing prompt')
        // CRITICAL: Update visual FEN to show piece at destination while confirming
        setVisualFen(gameCopy.fen())
        setPendingMove({ from: sourceSquare, to: targetSquare })
        return true // Move is valid but pending confirmation
      }

      // WALL CLOCK: Calculate elapsed time and save to database
      const now = Date.now()
      const elapsedMs = now - turnStartedAt
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      
      // Deduct elapsed time from player's stored time
      const updatedPlayerTime = Math.max(0, playerTime - elapsedSeconds)
      const newWhiteTime = isPlayerWhite ? updatedPlayerTime : botTime
      const newBlackTime = isPlayerWhite ? botTime : updatedPlayerTime

      console.log("🎮 [Move] Player move:", move.san)
      console.log("⏰ [Move] Elapsed:", elapsedSeconds, "s, New time:", updatedPlayerTime, "s")

      // Save to database: store final time + NEW turn_started_at for bot
      supabase
        .from('tournament_games')
        .update({
          game_state: gameCopy.fen(),
          last_move_at: new Date(now).toISOString(),
          turn_started_at: new Date(now).toISOString(), // Bot's turn starts NOW
          current_turn: gameCopy.turn() === 'w' ? 'white' : 'black',
          first_move_made: true,
          white_time_remaining: newWhiteTime,
          black_time_remaining: newBlackTime
        })
        .eq('id', gameId)
        .then(({ error }) => {
          if (error) {
            console.error("🎮 [BotGame] Failed to update game:", error)
          } else {
            console.log("🎮 [BotGame] ✅ Saved: turn_started_at =", new Date(now).toLocaleTimeString())
          }
        })

      // Update local state
      setGame(gameCopy)
      setFen(gameCopy.fen())
      setVisualFen(gameCopy.fen())
      setTurnStartedAt(now) // Bot's turn timer starts NOW
      setFirstMoveMade(true)
      setActivePlayer("bot")
      setStatus("Bot's turn ♘")
      
      // Save FEN position to history for navigation
      setFenHistory(prev => [...prev, gameCopy.fen()])
      console.log(`📜 [History] Saved position. Total: ${fenHistory.length + 1}`)
      
      // Reset history navigation to current position
      setHistoryIndex(-1)
      setViewingHistory(false)

      return true
    } catch (error) {
      console.error("🎮 [BotGame] Error in onPieceDrop:", error)
      return false
    }
  }

  useEffect(() => {
    if (!engineReady) return
    if (isPlayerWhite === null) return
    if (game.isGameOver()) return
    if (botThinkingRef.current) return
    if (mode === "bot_matchmaking" && !bot) return

    const botColor = isPlayerWhite ? "b" : "w"
    if (game.turn() !== botColor) return

    console.log("🤖 Bot making move...")
    botThinkingRef.current = true
    setBotThinking(true)
    
    // FIX #2: Use botRank from URL for Stockfish difficulty
    console.log('━━━ STOCKFISH CONFIGURATION DEBUG ━━━')
    console.log('URL botRank param:', botRankParam)
    console.log('Bot rank from profile:', bot?.rank)
    
    const targetRank = parseInt(botRankParam || '') || bot?.rank || 300
    const style = bot?.style ?? "Balanced"
    
    console.log(`🎯 Target Rank: ${targetRank}`)
    console.log(`🎨 Bot Style: ${style}`)
    console.log(`🧠 Stockfish will be configured for rank ${targetRank} (NOT bot.rank ${bot?.rank})`)
    
    const thinkFor = getBotThinkingTimeSeconds(targetRank)
    setThinkingSeconds(thinkFor)
    setThinkingElapsed(0)
    setStatus(`Bot is thinking… ${bot?.avatar ?? "♘"}💭`)

    if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current)
    thinkingIntervalRef.current = setInterval(() => {
      setThinkingElapsed((s) => s + 1)
    }, 1000)

    botThinkingTimerRef.current = setTimeout(async () => {
      try {
        const engine = engineRef.current
        if (!engine) throw new Error("Engine not available")

        const params = getStockfishParams(style, targetRank)
        console.log(`🤖 Stockfish params for rank ${targetRank}:`, params)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        // Pass ranking to engine for mistake injection (1-1000 range)
        const best = await engine.getBestMoveUci(game.fen(), params, 10000, targetRank)
        
        console.log(`✅ Bot received move UCI: "${best}" (length: ${best.length})`)
        
        // Validate UCI format before parsing
        if (!best || best.length < 4) {
          throw new Error(`Invalid UCI notation from engine: "${best}"`)
        }
        
        const from = best.slice(0, 2)
        const to = best.slice(2, 4)
        const promotion = best.length > 4 ? best[4] : undefined

        console.log(`🎯 Parsed move: from="${from}", to="${to}", promotion="${promotion}"`)

        const gameCopy = new Chess(game.fen())
        const move = gameCopy.move({ from, to, promotion: promotion ?? "q" })

        if (!move) throw new Error(`Illegal move: ${best} (from: ${from}, to: ${to})`)

        // WALL CLOCK: Calculate bot's elapsed time
        const now = Date.now()
        const elapsedMs = now - turnStartedAt
        const elapsedSeconds = Math.floor(elapsedMs / 1000)
        const updatedBotTime = Math.max(0, botTime - elapsedSeconds)
        const newWhiteTime = isPlayerWhite ? playerTime : updatedBotTime
        const newBlackTime = isPlayerWhite ? updatedBotTime : playerTime

        console.log("🎮 [Bot Move]:", move.san)
        console.log("⏰ [Bot Move] Elapsed:", elapsedSeconds, "s, New time:", updatedBotTime, "s")

        // Save to database: store final time + NEW turn_started_at for player
        if (gameId) {
          supabase
            .from('tournament_games')
            .update({
              game_state: gameCopy.fen(),
              last_move_at: new Date(now).toISOString(),
              turn_started_at: new Date(now).toISOString(), // Player's turn starts NOW
              current_turn: gameCopy.turn() === 'w' ? 'white' : 'black',
              white_time_remaining: newWhiteTime,
              black_time_remaining: newBlackTime
            })
            .eq('id', gameId)
            .then(({ error }) => {
              if (error) {
                console.error("🎮 [BotGame] Failed to update bot move:", error)
              } else {
                console.log("🎮 [BotGame] ✅ Saved: turn_started_at =", new Date(now).toLocaleTimeString())
              }
            })
        }

        // Update local state
        setGame(gameCopy)
        setFen(gameCopy.fen())
        setTurnStartedAt(now) // Player's turn timer starts NOW
        setActivePlayer("player")
        setStatus("Your turn! ♟️")
        
        // Save FEN position to history for navigation
        setFenHistory(prev => [...prev, gameCopy.fen()])
        console.log(`📜 [History] Saved bot position. Total: ${fenHistory.length + 1}`)
        
      } catch (error) {
        console.error("❌ Bot error:", error)
        setStatus("Bot error — please reload")
      } finally {
        botThinkingRef.current = false
        setBotThinking(false)
        setThinkingSeconds(null)
        setThinkingElapsed(0)
        if (thinkingIntervalRef.current) {
          clearInterval(thinkingIntervalRef.current)
          thinkingIntervalRef.current = null
        }
      }
    }, thinkFor * 1000)

    return () => {
      if (botThinkingTimerRef.current) {
        clearTimeout(botThinkingTimerRef.current)
        botThinkingTimerRef.current = null
      }
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current)
        thinkingIntervalRef.current = null
      }
      botThinkingRef.current = false
      setBotThinking(false)
    }
  }, [fen, isPlayerWhite, game, engineReady, bot, mode])

  // BUG FIX 4: Update player stats when game ends with EXTENSIVE LOGGING
  useEffect(() => {
    console.log("🎮 [Stats Check] Checking game end conditions...", {
      isPlayerWhite,
      playerID,
      statsUpdated: statsUpdatedRef.current,
      gameOver: game.isGameOver(),
      playerTime,
      botTime
    })

    if (isPlayerWhite === null) {
      console.log("⏸️ [Stats] Waiting for player color...")
      return
    }
    if (playerID === "Guest") {
      console.log("⏸️ [Stats] Guest player - skipping stats")
      return
    }
    if (statsUpdatedRef.current) {
      console.log("⏸️ [Stats] Stats already updated - preventing duplicate")
      return
    }

    const isGameEnded = game.isGameOver() || playerTime === 0 || botTime === 0

    console.log("🎮 [Stats] Game ended?", isGameEnded)

    if (isGameEnded) {
      console.log("🏁 [Stats] GAME ENDED! Processing result...")
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      // Determine game result
      let result: 'win' | 'loss' | 'draw' = 'draw'
      let statusMessage = ""

      if (game.isCheckmate()) {
        const winner = game.turn() === (isPlayerWhite ? "w" : "b") ? "Bot" : "You"
        result = winner === "You" ? 'win' : 'loss'
        statusMessage = `Checkmate! ${winner} wins! 🎉`
        console.log(`🏁 [Stats] Checkmate! Winner: ${winner}, Result: ${result}`)
      } else if (game.isDraw()) {
        result = 'draw'
        statusMessage = "It's a draw! 🤝"
        console.log(`🏁 [Stats] Game ended in draw`)
      } else if (playerTime === 0) {
        result = 'loss'
        statusMessage = "Time forfeit! Bot wins ⏰"
        console.log(`🏁 [Stats] Player timeout - Loss`)
      } else if (botTime === 0) {
        result = 'win'
        statusMessage = "Bot ran out of time! You win ⏰"
        console.log(`🏁 [Stats] Bot timeout - Win`)
      }

      setStatus(statusMessage)

      // Update stats in database
      if (!statsUpdatedRef.current) {
        statsUpdatedRef.current = true
        console.log(`📊 [Stats] Marking stats as updated to prevent duplicates`)
        console.log(`📊 [Stats] Calling updateBotStats for player: ${playerID}`)
        console.log(`📊 [Stats] Result: ${result}`)
        
        const statsUpdatePromise = updateBotStats(playerID, result)
        
        statsUpdatePromise.then(async (success) => {
          console.log(`📊 [Stats] Update completed with success=${success}`)
          
          if (success) {
            console.log(`✅ [Stats] SUCCESS! Stats updated in database`)
            console.log(`✅ [Stats] Result recorded: ${result}`)
            
            // CRITICAL: Wait a moment for database to propagate
            await new Promise(resolve => setTimeout(resolve, 500))
            
            console.log(`✅ [Stats] Fetching fresh stats from database...`)
            const newStats = await getPlayerStats(playerID)
            
            if (newStats) {
              console.log(`✅ [Stats] Fresh stats retrieved:`, {
                wins: newStats.bot_wins,
                losses: newStats.bot_losses,
                draws: newStats.bot_draws,
                elo: newStats.bot_elo
              })
              setNewRank(newStats.bot_elo)
              console.log(`✅ [Stats] Rank changed: ${oldRank} → ${newStats.bot_elo}`)
            } else {
              console.error(`❌ [Stats] Failed to fetch updated stats!`)
              setNewRank(oldRank)
            }
          } else {
            console.error(`❌ [Stats] FAILED to update stats in database`)
            console.error(`❌ [Stats] Player: ${playerID}, Result: ${result}`)
            console.error(`❌ [Stats] This is a critical error - stats not recorded!`)
            setNewRank(oldRank)
          }

          // Show result modal
          setGameResult(result)
          setShowResultModal(true)
          console.log(`🎉 [Result Modal] Showing ${result} modal`)
        }).catch(async (error) => {
          console.error(`❌ [Stats] Exception during stats update:`, error)
          console.error(`❌ [Stats] Stack trace:`, error.stack)
          
          // Try to fetch stats anyway
          const newStats = await getPlayerStats(playerID)
          if (newStats) {
            console.log(`⚠️ [Stats] Fetched stats despite error:`, newStats)
            setNewRank(newStats.bot_elo)
          }
          
          setGameResult(result)
          setShowResultModal(true)
        })
      } else {
        console.warn(`⚠️ [Stats] Attempted duplicate stats update - prevented`)
      }
    }
  }, [game, playerTime, botTime, isPlayerWhite, playerID])

  // Handle page close/refresh during active game (treat as loss)
  useEffect(() => {
    if (!gameId || playerID === "Guest") return
    if (game.isGameOver() || statsUpdatedRef.current) return

    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Only trigger if game is still active
      if (!game.isGameOver() && !statsUpdatedRef.current) {
        console.log("⚠️ [Stats] Page closing during active game - recording loss")
        
        // Mark as updated to prevent duplicate calls
        statsUpdatedRef.current = true
        
        // Update stats (loss) - using navigator.sendBeacon for reliability
        const updateData = JSON.stringify({
          walletAddress: playerID,
          result: 'loss'
        })
        
        // Try to update stats before page closes
        await updateBotStats(playerID, 'loss')
        
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [gameId, game, playerID])

  if (engineError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-gray-900 via-red-900/30 to-purple-900 text-white p-4">
        <div className="text-center w-full max-w-2xl space-y-6">
          <div className="w-24 h-24 border-4 border-red-500/60 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">⚠️</span>
          </div>
          
          <div>
            <p className="text-3xl font-black mb-2">{engineError}</p>
            <p className="text-gray-400 mb-6">
              After {maxRetries} attempts, the chess engine couldn't start.
            </p>
          </div>
          
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30 text-left space-y-4">
            <div>
              <p className="text-sm font-semibold text-red-400 mb-2">Missing Files</p>
              <p className="text-xs text-gray-300 mb-3">
                PolluxChess needs Stockfish files in your <code className="bg-gray-900 px-1 rounded">public/stockfish/</code> folder:
              </p>
              <div className="bg-gray-900/80 p-3 rounded text-xs font-mono">
                <div>public/stockfish/</div>
                <div>├── stockfish.worker.js</div>
                <div>├── stockfish-17.1-lite-single-03e3232.js</div>
                <div>└── stockfish-17.1-lite-single-03e3232.wasm</div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-yellow-400 mb-2">Quick Fix</p>
              <ol className="text-xs text-gray-300 space-y-2 list-decimal ml-4">
                <li>
                  Download from: <a href="https://github.com/nmrugg/stockfish.js" target="_blank" className="text-blue-400 underline">github.com/nmrugg/stockfish.js</a>
                </li>
                <li>Extract and copy files to <code className="bg-gray-900 px-1 rounded">public/stockfish/</code></li>
                <li>Restart your dev server</li>
                <li>Clear browser cache (Ctrl+Shift+R)</li>
              </ol>
            </div>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold transition-all shadow-xl"
          >
            🔄 Try Again
          </button>

          <div className="text-xs text-gray-500">
            <a href="/diagnostics" className="underline hover:text-gray-300">
              Run File Diagnostics
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (isPlayerWhite === null || !engineReady) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 text-white p-4">
        <div className="text-center w-full max-w-sm space-y-6">
          <div className="w-24 h-24 border-4 border-purple-500/60 rounded-full flex items-center justify-center mx-auto animate-spin">
            <span className="text-4xl">♟️</span>
          </div>
          
          <div>
            <p className="text-2xl font-black mb-2">
              {matchmaking ? "Finding opponent…" : engineInitializing ? "Loading engine…" : status}
            </p>
            
            {engineInitializing && initRetryCountRef.current > 0 && (
              <p className="text-sm text-yellow-400">
                Retry {initRetryCountRef.current}/{maxRetries}
              </p>
            )}
            
            {engineInitializing && (
              <p className="text-xs text-gray-400 mt-2">
                First load may take 30-45 seconds
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Theme-aware timer colors: black for light theme, white for dark themes
  const getTimerColor = (isActive: boolean, timeRemaining: number) => {
    if (isActive && timeRemaining < 30) return "text-red-500" // Low time warning (always red)
    return theme === "light" ? "text-gray-900" : "text-white" // Theme-aware color
  }
  
  const playerClockColor = getTimerColor(activePlayer === "player", playerTime)
  const botClockColor = getTimerColor(activePlayer === "bot", botTime)

  // Click-to-move handler
  const onSquareClick = ({ square, piece }: { piece: any; square: string }) => {
    if (viewingHistory || botThinking || !engineReady || !gameId) return
    if (isPlayerWhite === null) return
    
    const playerColor = isPlayerWhite ? "w" : "b"
    if (game.turn() !== playerColor) return

    // If no piece is selected, select this piece
    if (!selectedSquare) {
      const piece = game.get(square as any)
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square)
        // Get legal moves for this piece
        const moves = game.moves({ square: square as any, verbose: true })
        setLegalMoves(moves.map(m => m.to))
        console.log(`🖱️ [Click] Selected ${square}, legal moves:`, moves.map(m => m.to))
      }
      return
    }

    // If clicking the same square, deselect
    if (square === selectedSquare) {
      setSelectedSquare(null)
      setLegalMoves([])
      console.log(`🖱️ [Click] Deselected ${square}`)
      return
    }

    // If clicking another piece of same color, switch selection
    const clickedPiece = game.get(square as any)
    if (clickedPiece && clickedPiece.color === playerColor) {
      setSelectedSquare(square)
      const moves = game.moves({ square: square as any, verbose: true })
      setLegalMoves(moves.map(m => m.to))
      console.log(`🖱️ [Click] Switched selection to ${square}`)
      return
    }

    // Try to make the move
    if (selectedSquare && legalMoves.includes(square)) {
      console.log(`🖱️ [Click] Attempting move: ${selectedSquare} → ${square}`)
      const moved = onPieceDrop({ sourceSquare: selectedSquare, targetSquare: square })
      if (moved) {
        setSelectedSquare(null)
        setLegalMoves([])
      }
    } else {
      // Invalid move, deselect
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }

  const chessboardOptions = {
    position: viewingHistory ? visualFen : (pendingMove ? visualFen : fen),
    onPieceDrop: onPieceDrop,
    onSquareClick: onSquareClick,
    boardOrientation: (isPlayerWhite ? "white" : "black") as "white" | "black",
    customBoardStyle: {
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
    },
    customDarkSquareStyle: { backgroundColor: "#404040" },
    customLightSquareStyle: { backgroundColor: "#e5e5e5" },
    customSquareStyles: {
      ...(selectedSquare && {
        [selectedSquare]: {
          backgroundColor: "rgba(255, 255, 0, 0.4)",
        },
      }),
      ...Object.fromEntries(
        legalMoves.map(square => [
          square,
          {
            background: "radial-gradient(circle, rgba(0,255,0,0.3) 25%, transparent 25%)",
            borderRadius: "50%",
          },
        ])
      ),
    },
    boardWidth,
    arePiecesDraggable: !botThinking && engineReady && !viewingHistory,
  }

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-background via-muted/20 to-background text-foreground flex items-center justify-center p-2">
      {/* Theme Switcher */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 flex gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm p-2 shadow-lg">
        <button
          onClick={() => setThemeValue("light")}
          className={`rounded-full p-2 transition-all ${theme === "light" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          aria-label="Light theme"
        >
          <Sun className="h-5 w-5" />
        </button>
        <button
          onClick={() => setThemeValue("middle")}
          className={`rounded-full p-2 transition-all ${theme === "middle" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          aria-label="System theme"
        >
          <Monitor className="h-5 w-5" />
        </button>
        <button
          onClick={() => setThemeValue("dark")}
          className={`rounded-full p-2 transition-all ${theme === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          aria-label="Dark theme"
        >
          <Moon className="h-5 w-5" />
        </button>
      </div>

      <div className="w-full max-w-5xl h-full max-h-[98vh] flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h1 className="text-xl md:text-2xl font-black text-foreground">
              POLLUX'S CHESS
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 items-start flex-shrink-0">
            <div className="order-2 lg:order-1 bg-card/60 backdrop-blur-xl rounded-xl p-2 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Bot</p>
                  <p className="text-base font-bold text-foreground">
                    {bot ? `${bot.avatar} ${bot.name}` : "♘ Practice Bot"}
                  </p>
                  <p className={`text-2xl font-bold ${botClockColor}`}>{formatTime(botTime)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Entry</p>
                  <p className="text-sm font-semibold text-foreground">
                    {fee === "0" ? "FREE" : `${fee} XAH`}
                  </p>
                </div>
              </div>

              {thinkingSeconds !== null && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Thinking…
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2 flex flex-col items-center gap-2">
              <div
                className="bg-card/60 backdrop-blur-xl rounded-xl p-2 shadow-2xl border border-border"
                style={{ width: boardWidth + 16 }}
              >
                <Chessboard options={chessboardOptions} />
              </div>
              
              {/* Move Navigation Buttons */}
              {game.history().length > 0 && (
                <div className="flex items-center gap-2 bg-card/80 backdrop-blur-xl rounded-xl px-3 py-2 border border-border">
                  <button
                    onClick={handlePreviousMove}
                    disabled={game.history().length === 0 || historyIndex === 0}
                    className="w-10 h-10 bg-primary text-primary-foreground hover:opacity-90 disabled:bg-muted disabled:cursor-not-allowed rounded-lg text-xl flex items-center justify-center transition-all shadow-lg hover:scale-105 disabled:hover:scale-100"
                    title="Previous move"
                  >
                    ◀
                  </button>
                  
                  <div className="text-xs text-muted-foreground min-w-[80px] text-center">
                    {viewingHistory ? (
                      <>
                        <span className="text-foreground font-semibold">Viewing</span>
                        <br />
                        Move {historyIndex + 1}/{game.history().length}
                      </>
                    ) : (
                      <>
                        Current
                        <br />
                        {game.history().length} moves
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={handleNextMove}
                    disabled={historyIndex === -1 || !viewingHistory}
                    className="w-10 h-10 bg-primary text-primary-foreground hover:opacity-90 disabled:bg-muted disabled:cursor-not-allowed rounded-lg text-xl flex items-center justify-center transition-all shadow-lg hover:scale-105 disabled:hover:scale-100"
                    title="Next move"
                  >
                    ▶
                  </button>
                  
                  {viewingHistory && (
                    <button
                      onClick={handleReturnToCurrent}
                      className="ml-2 px-3 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs font-semibold transition-all shadow-lg hover:scale-105"
                      title="Return to current position"
                    >
                      ⏩ Current
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="order-3 bg-card/60 backdrop-blur-xl rounded-xl p-2 border border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Player {isPlayerWhite ? "♔ White" : "♚ Black"}
                </p>
                {playerID !== "Guest" && (
                  <button
                    onClick={() => setShowProfile(true)}
                    className="text-lg hover:scale-110 transition-transform"
                    title="View Profile"
                  >
                    👤
                  </button>
                )}
              </div>
              <p className="font-mono text-sm md:text-base font-semibold text-foreground break-all">
                {playerID.length > 12 ? `${playerID.slice(0, 6)}...${playerID.slice(-4)}` : playerID}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Your Time</p>
                <p className={`text-2xl font-bold ${playerClockColor}`}>{formatTime(playerTime)}</p>
              </div>
            </div>
          </div>

          <div className="mt-2 flex-shrink-0">
            <p className="text-center text-sm md:text-base font-bold bg-card/60 backdrop-blur-xl rounded-xl border border-border px-3 py-2">
              {status}
            </p>

            {!game.isGameOver() && gameId && (
              <div className="mt-2 flex justify-center gap-2">
                {viewingHistory && (
                  <button
                    onClick={handleReturnToCurrent}
                    className="rounded-xl px-4 py-2 text-sm md:text-base font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xl transition-all"
                  >
                    ⏩ Return to Game
                  </button>
                )}
                <button
                  onClick={handleResign}
                  className="rounded-xl px-5 py-2 text-sm md:text-base font-bold bg-red-600 hover:bg-red-500 text-white shadow-xl transition-all"
                >
                  Resign
                </button>
              </div>
            )}

            {game.isGameOver() && (
              <div className="mt-2 flex justify-center">
                <button
                  onClick={() => window.location.href = '/chess'}
                  className="rounded-xl px-5 py-2 text-sm md:text-base font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xl transition-all"
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Confirm Move Overlay - Centered, doesn't push anything */}
      {pendingMove && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gray-800/95 backdrop-blur-md rounded-full border border-yellow-500/50 shadow-2xl px-3 py-2 flex gap-3 pointer-events-auto">
            <button
              onClick={confirmMove}
              className="w-12 h-12 bg-green-600 hover:bg-green-500 rounded-full text-white text-2xl flex items-center justify-center transition-all shadow-lg hover:scale-110"
              title="Confirm move"
            >
              ✓
            </button>
            <button
              onClick={cancelMove}
              className="w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full text-white text-2xl flex items-center justify-center transition-all shadow-lg hover:scale-110"
              title="Cancel move"
            >
              ✗
            </button>
          </div>
        </div>
      )}
      
      {/* FIX #1: Profile Modal */}
      {playerID !== "Guest" && (
        <ProfileModal 
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          walletAddress={playerID}
        />
      )}
      
      {/* FIX #4: Result Modal with cleanup handler */}
      {playerID !== "Guest" && (
        <GameResultModal 
          isOpen={showResultModal}
          result={gameResult}
          oldRank={oldRank}
          newRank={newRank}
          onReturnToLobby={handleReturnToLobby}
        />
      )}
    </div>
  )
}

export default function Game() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900 text-white p-4">
        <p className="text-2xl font-bold">Loading PolluxChess...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}

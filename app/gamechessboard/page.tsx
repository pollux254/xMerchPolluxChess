"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { BOT_PROFILE_BY_ID } from "@/lib/bots/bot-profiles"
import { BOT_PROFILES } from "@/lib/bots/bot-profiles"
import { getBotThinkingTimeSeconds } from "@/lib/bots/thinking-time"
import { StockfishEngine, getStockfishParams } from "@/lib/stockfish/engine"

function GameContent() {
  const searchParams = useSearchParams()
  const playerID = searchParams.get("player") ?? "Guest"
  const fee = searchParams.get("fee") ?? "0"
  const mode = searchParams.get("mode")
  const botId = searchParams.get("botId")
  const [matchedBotId, setMatchedBotId] = useState<string | null>(null)
  const effectiveBotId = botId ?? matchedBotId
  const bot = effectiveBotId ? BOT_PROFILE_BY_ID.get(effectiveBotId) : undefined
  const playerColorParam = searchParams.get("playerColor")

  const [matchmaking, setMatchmaking] = useState(mode === "bot_matchmaking")
  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
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

  useEffect(() => {
    if (mode !== "bot_matchmaking") return

    setMatchmaking(true)
    const pick = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)]
    const delay = 1200 + Math.floor(Math.random() * 1400)

    const t = setTimeout(() => {
      setMatchedBotId(pick.botId)
      setMatchmaking(false)
    }, delay)

    return () => clearTimeout(t)
  }, [mode])

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

  useEffect(() => {
    if (matchmaking) {
      setIsPlayerWhite(null)
      return
    }

    if (playerColorParam === "white") {
      setIsPlayerWhite(true)
      return
    }
    if (playerColorParam === "black") {
      setIsPlayerWhite(false)
      return
    }

    setIsPlayerWhite(Math.random() < 0.5)
  }, [playerColorParam, matchmaking])

  useEffect(() => {
    const compute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : 375
      const vh = typeof window !== "undefined" ? window.innerHeight : 667
      const available = Math.min(vw - 32, vh - 280)
      const size = Math.max(240, Math.min(520, Math.floor(available)))
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

  useEffect(() => {
    if (!activePlayer || game.isGameOver() || playerTime === 0 || botTime === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      if (activePlayer === "player") {
        setPlayerTime((prev) => {
          if (prev <= 1) {
            setStatus("Time forfeit! Bot wins ⏰")
            return 0
          }
          return prev - 1
        })
      } else {
        setBotTime((prev) => {
          if (prev <= 1) {
            setStatus("Bot ran out of time! You win ⏰")
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activePlayer, game, playerTime, botTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const onPieceDrop = ({ sourceSquare, targetSquare }: any): boolean => {
    if (isPlayerWhite === null || !targetSquare) return false

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

      setGame(gameCopy)
      setFen(gameCopy.fen())
      setActivePlayer("bot")
      setStatus("Bot's turn ♘")

      return true
    } catch (error) {
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
    
    const rank = bot?.rank ?? 300
    const style = bot?.style ?? "Balanced"
    const thinkFor = getBotThinkingTimeSeconds(rank)
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

        const params = getStockfishParams(style, rank)
        const best = await engine.getBestMoveUci(game.fen(), params)
        
        console.log(`✅ Bot move: ${best}`)
        
        const from = best.slice(0, 2)
        const to = best.slice(2, 4)
        const promotion = best.length > 4 ? best[4] : undefined

        const gameCopy = new Chess(game.fen())
        const move = gameCopy.move({ from, to, promotion: promotion ?? "q" })

        if (!move) throw new Error(`Illegal move: ${best}`)

        setGame(gameCopy)
        setFen(gameCopy.fen())
        setActivePlayer("player")
        setStatus("Your turn! ♟️")
        
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

  useEffect(() => {
    if (isPlayerWhite === null) return

    if (game.isGameOver() || playerTime === 0 || botTime === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (game.isCheckmate()) {
        const winner = game.turn() === (isPlayerWhite ? "w" : "b") ? "Bot" : "You"
        setStatus(`Checkmate! ${winner} wins! 🎉`)
      } else if (game.isDraw()) {
        setStatus("It's a draw! 🤝")
      } else if (playerTime === 0) {
        setStatus("Time forfeit! Bot wins ⏰")
      } else if (botTime === 0) {
        setStatus("Bot ran out of time! You win ⏰")
      }
    }
  }, [game, playerTime, botTime, isPlayerWhite])

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

  const playerClockColor = activePlayer === "player" && playerTime < 30 ? "text-red-500" : "text-white"
  const botClockColor = activePlayer === "bot" && botTime < 30 ? "text-red-500" : "text-white"

  const chessboardOptions = {
    position: fen,
    onPieceDrop: onPieceDrop,
    boardOrientation: (isPlayerWhite ? "white" : "black") as "white" | "black",
    customBoardStyle: {
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
    },
    customDarkSquareStyle: { backgroundColor: "#1e3a8a" },
    customLightSquareStyle: { backgroundColor: "#a5d8ff" },
    boardWidth,
    arePiecesDraggable: !botThinking && engineReady,
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92dvh] overflow-hidden">
        <div className="h-full overflow-y-auto scrollable-container pr-1">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-2xl">
              PolluxChess
            </h1>
            <div className="text-right">
              <p className="text-xs text-gray-300">You are</p>
              <p className="text-base md:text-lg font-bold">
                {isPlayerWhite ? "White ♔" : "Black ♚"}
              </p>
            </div>
          </div>

          {mode === "bot_matchmaking" && (
            <p className="text-center text-xs text-gray-400 mb-3">
              Practice Match • Opponent is hidden
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="order-2 lg:order-1 bg-gray-800/60 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-300">Bot</p>
                  <p className="text-base font-bold text-cyan-200">
                    {bot ? `${bot.avatar} ${bot.name}` : "♘ Practice Bot"}
                  </p>
                  <p className={`text-2xl font-bold ${botClockColor}`}>{formatTime(botTime)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-300">Entry</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {fee === "0" ? "FREE" : `${fee} XAH`}
                  </p>
                  {bot && (
                    <p className="text-xs text-gray-400 mt-1">
                      Rank {bot.rank} • {bot.style}
                    </p>
                  )}
                </div>
              </div>

              {thinkingSeconds !== null && (
                <div className="mt-3 text-xs text-gray-300">
                  Thinking… {thinkingElapsed}s / {thinkingSeconds}s
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div
                className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-purple-500/40"
                style={{ width: boardWidth + 24 }}
              >
                <Chessboard options={chessboardOptions} />
              </div>
            </div>

            <div className="order-3 bg-gray-800/60 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30">
              <p className="text-xs text-gray-300">Player</p>
              <p className="font-mono text-sm md:text-base font-semibold text-cyan-200 break-all">
                {playerID.length > 16 ? `${playerID.slice(0, 10)}...${playerID.slice(-6)}` : playerID}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-300">Your Time</p>
                <p className={`text-2xl font-bold ${playerClockColor}`}>{formatTime(playerTime)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-center text-base md:text-lg font-bold bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-indigo-500/30 px-4 py-3">
              {status}
            </p>

            {game.isGameOver() && (
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="min-h-11 rounded-2xl px-6 py-3 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-xl border border-emerald-300/40 transition-all"
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
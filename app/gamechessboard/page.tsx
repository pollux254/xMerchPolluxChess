"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"

function GameContent() {
  const searchParams = useSearchParams()
  const playerID = searchParams.get("player") ?? "Guest"
  const fee = searchParams.get("fee") ?? "0"

  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [isPlayerWhite, setIsPlayerWhite] = useState<boolean | null>(null)
  const [status, setStatus] = useState("Assigning color...")
  const [playerTime, setPlayerTime] = useState(1200)
  const [botTime, setBotTime] = useState(1200)
  const [activePlayer, setActivePlayer] = useState<"player" | "bot" | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const botThinkingRef = useRef(false)

  useEffect(() => {
    setIsPlayerWhite(Math.random() < 0.5)
  }, [])

  useEffect(() => {
    if (isPlayerWhite === null) return

    const startingColor = game.turn()
    const isPlayerTurn = startingColor === (isPlayerWhite ? "w" : "b")
    setActivePlayer(isPlayerTurn ? "player" : "bot")
    setStatus(isPlayerTurn ? "Your turn! ♟️" : "Bot's turn ♘")
  }, [isPlayerWhite, game])

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
    if (isPlayerWhite === null || game.isGameOver() || botThinkingRef.current) return

    const botColor = isPlayerWhite ? "b" : "w"
    if (game.turn() !== botColor) return

    botThinkingRef.current = true
    setStatus("Bot is thinking… ♘💭")

    const timeout = setTimeout(() => {
      const moves = game.moves()
      if (moves.length === 0) {
        botThinkingRef.current = false
        return
      }

      const botMove = moves[Math.floor(Math.random() * moves.length)]
      const gameCopy = new Chess(game.fen())
      
      try {
        gameCopy.move(botMove)
        setGame(gameCopy)
        setFen(gameCopy.fen())
        setActivePlayer("player")
        setStatus("Your turn! ♟️")
      } catch (error) {
        console.error("Bot move error:", error)
      }
      
      botThinkingRef.current = false
    }, 600 + Math.random() * 1200)

    return () => {
      clearTimeout(timeout)
      botThinkingRef.current = false
    }
  }, [fen, isPlayerWhite, game])

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

  if (isPlayerWhite === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 text-white">
        <div className="text-center">
          <div className="w-32 h-32 border-8 border-purple-500/60 rounded-full flex items-center justify-center mx-auto mb-10 animate-spin">
            <span className="text-5xl">♟️</span>
          </div>
          <p className="text-5xl font-black">{status}</p>
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
    boardWidth: 480,
    arePiecesDraggable: true,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex flex-col items-center justify-center gap-8 px-6 py-16">
      <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-2xl">
        PolluxChess
      </h1>

      <div className="text-center">
        <p className="text-2xl text-gray-400">Bot</p>
        <p className={`text-5xl font-bold ${botClockColor} drop-shadow-lg`}>
          {formatTime(botTime)}
        </p>
      </div>

      <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-purple-500/40 max-w-lg w-full">
        <div className="text-center space-y-4">
          <p className="text-2xl text-gray-300 uppercase tracking-widest">Player</p>
          <p className="font-mono text-4xl font-bold text-cyan-300">
            {playerID.length > 16 ? `${playerID.slice(0, 8)}...${playerID.slice(-6)}` : playerID}
          </p>
          <div className="h-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full"></div>
          <p className="text-3xl font-bold text-emerald-400">
            {fee === "0" ? "FREE PLAY" : `${fee} XAH Entry`}
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-5xl md:text-6xl font-black mb-4 drop-shadow-xl">You are</p>
        <p className="text-7xl md:text-8xl font-black">{isPlayerWhite ? "White ♔" : "Black ♚"}</p>
      </div>

      <div className="text-center">
        <p className="text-2xl text-gray-400">Your Time</p>
        <p className={`text-5xl font-bold ${playerClockColor} drop-shadow-lg`}>
          {formatTime(playerTime)}
        </p>
      </div>

      <div className="relative">
        <div className="bg-gray-800/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-4 border-purple-600/60">
          <Chessboard options={chessboardOptions} />
        </div>
      </div>

      <p className="text-5xl md:text-6xl font-black text-center px-8 py-6 bg-gray-800/70 backdrop-blur-xl rounded-3xl border-4 border-indigo-500/50 shadow-2xl">
        {status}
      </p>

      {game.isGameOver() && (
        <button
          onClick={() => window.location.reload()}
          className="px-20 py-10 text-4xl font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-3xl shadow-2xl border-4 border-emerald-400/60 hover:border-emerald-300 transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          Play Again 🎲
        </button>
      )}
    </div>
  )
}

export default function Game() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900 text-white">
        <p className="text-5xl font-bold">Loading PolluxChess...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
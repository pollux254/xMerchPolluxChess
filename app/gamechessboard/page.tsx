"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Chess } from "chess.js"
import Chessground from "@bezalel6/react-chessground"

// Base layout + coordinates + highlights
import "chessground/assets/chessground.base.css"

// Crisp modern pieces (chess.com style)
import "chessground/assets/chessground.cburnett.css"

import type { Key } from "chessground/types"

function GameContent() {
  const searchParams = useSearchParams()
  const playerID = searchParams.get("player") ?? "Guest"
  const fee = searchParams.get("fee") ?? "0"

  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [isPlayerWhite, setIsPlayerWhite] = useState<boolean | null>(null)
  const [status, setStatus] = useState("Assigning color...")
  const [lastMove, setLastMove] = useState<[Key, Key] | undefined>(undefined)
  const [dests, setDests] = useState<Map<Key, Key[]>>(new Map())

  // Custom PolluxChess Dark/Light Blue Board with Grid Lines
  useEffect(() => {
    const customTheme = `
      /* Dark fallback */
      .cg-wrap {
        background: #0f172a !important;
      }

      /* Dark blue squares */
      .cg-wrap square {
        background-color: #1e3a8a !important; /* Deep dark blue */
        border: 1px solid #172554 !important; /* Subtle dark grid line */
      }

      /* Light blue alternating squares */
      .cg-wrap square:nth-child(16n+1), .cg-wrap square:nth-child(16n+3),
      .cg-wrap square:nth-child(16n+5), .cg-wrap square:nth-child(16n+7),
      .cg-wrap square:nth-child(16n+9), .cg-wrap square:nth-child(16n+11),
      .cg-wrap square:nth-child(16n+13), .cg-wrap square:nth-child(16n+15),
      .cg-wrap square:nth-child(16n+2), .cg-wrap square:nth-child(16n+4),
      .cg-wrap square:nth-child(16n+6), .cg-wrap square:nth-child(16n+8),
      .cg-wrap square:nth-child(16n+10), .cg-wrap square:nth-child(16n+12),
      .cg-wrap square:nth-child(16n+14), .cg-wrap square:nth-child(16n+16) {
        background-color: #60a5fa !important; /* Bright light blue */
        border: 1px solid #3b82f6 !important; /* Slightly lighter grid line */
      }

      /* Last move highlight */
      .cg-wrap square.last-move {
        box-shadow: inset 0 0 0 4px #fbbf24 !important;
        background-color: rgba(251, 191, 36, 0.5) !important;
      }

      /* Check highlight */
      .cg-wrap square.check {
        box-shadow: inset 0 0 0 5px #ef4444 !important;
      }

      /* Legal move dots */
      .cg-wrap square.move-dest {
        background: radial-gradient(circle, #06b6d4 35%, transparent 65%) !important;
      }

      /* Coordinates */
      .cg-wrap coords {
        color: #f1f5f9 !important;
        font-weight: bold;
        text-shadow: 1px 1px 2px #000;
      }
    `

    const style = document.createElement("style")
    style.innerHTML = customTheme
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  // Rest of your logic unchanged...
  useEffect(() => {
    setIsPlayerWhite(Math.random() < 0.5)
  }, [])

  useEffect(() => {
    if (isPlayerWhite === null) return

    const color = isPlayerWhite ? "w" : "b"
    if (game.turn() !== color) {
      setDests(new Map())
      return
    }

    const map = new Map<Key, Key[]>()
    game.moves({ verbose: true }).forEach((move) => {
      if (!map.has(move.from as Key)) map.set(move.from as Key, [])
      map.get(move.from as Key)!.push(move.to as Key)
    })
    setDests(map)
  }, [fen, isPlayerWhite, game])

  const onMove = (from: string, to: string) => {
    if (isPlayerWhite === null) return

    const color = isPlayerWhite ? "w" : "b"
    if (game.turn() !== color) return

    const gameCopy = new Chess(game.fen())
    const move = gameCopy.move({ from, to, promotion: "q" })

    if (move) {
      setGame(gameCopy)
      setFen(gameCopy.fen())
      setLastMove([from as Key, to as Key])
    }
  }

  // Bot move logic (same as before)
  useEffect(() => {
    if (isPlayerWhite === null || game.isGameOver()) return

    const botColor = isPlayerWhite ? "b" : "w"
    if (game.turn() !== botColor) return

    setStatus("Bot is thinking… ♘💭")

    const timeout = setTimeout(() => {
      const moves = game.moves()
      if (moves.length === 0) return

      const botMove = moves[Math.floor(Math.random() * moves.length)]
      const gameCopy = new Chess(game.fen())
      gameCopy.move(botMove)

      const from = botMove.slice(0, 2) as Key
      const to = botMove.slice(2, 4) as Key
      setGame(gameCopy)
      setFen(gameCopy.fen())
      setLastMove([from, to])
    }, 600 + Math.random() * 1200)

    return () => clearTimeout(timeout)
  }, [fen, isPlayerWhite])

  useEffect(() => {
    if (isPlayerWhite === false && game.turn() === "w" && !game.isGameOver()) {
      setStatus("Bot is thinking… ♘💭")

      const timeout = setTimeout(() => {
        const moves = game.moves()
        if (moves.length === 0) return

        const botMove = moves[Math.floor(Math.random() * moves.length)]
        const gameCopy = new Chess(game.fen())
        gameCopy.move(botMove)

        const from = botMove.slice(0, 2) as Key
        const to = botMove.slice(2, 4) as Key
        setGame(gameCopy)
        setFen(gameCopy.fen())
        setLastMove([from, to])
      }, 800)

      return () => clearTimeout(timeout)
    }
  }, [isPlayerWhite])

  useEffect(() => {
    if (isPlayerWhite === null) return

    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const winner = game.turn() === (isPlayerWhite ? "w" : "b") ? "Bot" : "You"
        setStatus(`Checkmate! ${winner} wins! 🎉`)
      } else if (game.isDraw()) {
        setStatus("It's a draw! 🤝")
      } else {
        setStatus("Game over.")
      }
    } else {
      setStatus(game.turn() === (isPlayerWhite ? "w" : "b") ? "Your turn" : "Bot is thinking…")
    }
  }, [fen, isPlayerWhite])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex flex-col items-center justify-center gap-10 px-6 py-16">
      <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-2xl">
        PolluxChess
      </h1>

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

      <div className="relative">
        <div className="bg-gray-800/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border-4 border-purple-600/60">
          <Chessground
            width={480}
            height={480}
            fen={fen}
            orientation={isPlayerWhite ? "white" : "black"}
            turnColor={game.turn() === "w" ? "white" : "black"}
            coordinates={true}
            highlight={{ lastMove: true, check: true }}
            premovable={{ enabled: true }}
            movable={{
              free: false,
              color: isPlayerWhite ? "white" : "black",
              dests,
              showDests: true,
              events: { after: onMove },
            }}
            lastMove={lastMove}
            animation={{ enabled: true, duration: 250 }}
          />
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
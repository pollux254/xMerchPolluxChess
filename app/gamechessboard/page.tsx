"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Chess } from "chess.js"
import Chessground from "@bezalel6/react-chessground"

// Import base + custom blue theme + merida pieces (clean, modern like chess.com)
import "chessground/assets/chessground.base.css"
import "chessground/assets/chessground.cburnett.css" // fallback if needed
import "@bezalel6/react-chessground/dist/style.css"

// Custom CSS for xmerch blue board theme (inspired by chess.com blue)
const customBoardCSS = `
.cg-wrap piece { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); }
.cg-wrap coords.ranks, .cg-wrap coords.files { font-weight: bold; color: #f0f0f0; opacity: 0.8; }
.cg-wrap square.last-move { background-color: rgba(255, 255, 0, 0.4) !important; }
.cg-wrap square.check { background: radial-gradient(circle, rgba(255,0,0,.4) 20%, transparent 60%) !important; }
.cg-wrap square.premovable { background-color: rgba(20, 85, 30, 0.4) !important; }
.cg-wrap square.selected { background-color: rgba(20, 85, 30, 0.5) !important; }
.cg-wrap square.move-dest { background: radial-gradient(circle, rgba(20, 85, 30, .4) 40%, transparent 60%) !important; }
.cg-wrap square.oc.move-dest { background: radial-gradient(circle, rgba(20, 85, 30, .4) 40%, transparent 60%) !important; }
`

// Inline the custom board colors
const styleTag = document.createElement("style")
styleTag.innerHTML = `
.cg-wrap {
  --cg-square-light: #dee3e6;
  --cg-square-dark: #8ca2ad;
  background-image: 
    linear-gradient(45deg, var(--cg-square-dark) 25%, transparent 25%),
    linear-gradient(-45deg, var(--cg-square-dark) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--cg-square-dark) 75%),
    linear-gradient(-45deg, transparent 75%, var(--cg-square-dark) 75%);
  background-size: 100px 100px;
  background-position: 0 0, 50px 0, 50px -50px, 0px 50px;
}
` + customBoardCSS
document.head.appendChild(styleTag)

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

  useEffect(() => {
    setIsPlayerWhite(Math.random() < 0.5)
  }, [])

  // Legal moves destinations
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

  // Bot move
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

      const from = botMove.slice(0, 2)
      const to = botMove.slice(2, 4)
      setGame(gameCopy)
      setFen(gameCopy.fen())
      setLastMove([from as Key, to as Key])
    }, 600 + Math.random() * 1200)

    return () => clearTimeout(timeout)
  }, [fen, isPlayerWhite])

  // Bot first move if player is Black
  useEffect(() => {
    if (isPlayerWhite === false && game.turn() === "w" && !game.isGameOver()) {
      setStatus("Bot is thinking… ♘💭")

      const timeout = setTimeout(() => {
        const moves = game.moves()
        if (moves.length === 0) return

        const botMove = moves[Math.floor(Math.random() * moves.length)]
        const gameCopy = new Chess(game.fen())
        gameCopy.move(botMove)

        const from = botMove.slice(0, 2)
        const to = botMove.slice(2, 4)
        setGame(gameCopy)
        setFen(gameCopy.fen())
        setLastMove([from as Key, to as Key])
      }, 800)

      return () => clearTimeout(timeout)
    }
  }, [isPlayerWhite])

  // Status update
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <p className="text-4xl font-bold">{status}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white flex flex-col items-center justify-center gap-8 px-4 py-12">
      <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600">
        PolluxChess
      </h1>

      <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-6 shadow-2xl border border-purple-500/30">
        <div className="text-center space-y-2">
          <p className="text-lg text-gray-300">Player</p>
          <p className="font-mono text-2xl font-bold text-cyan-300">
            {playerID.length > 16 ? `${playerID.slice(0, 10)}...${playerID.slice(-6)}` : playerID}
          </p>
          <p className="text-xl text-gray-300 mt-4">
            {fee === "0" ? "FREE PLAY" : `${fee} XAH Entry`}
          </p>
        </div>
      </div>

      <p className="text-4xl font-bold drop-shadow-lg">
        You are {isPlayerWhite ? "White ♔" : "Black ♚"}
      </p>

      <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-purple-600/50 bg-gray-800 p-4">
        <Chessground
          width={480}
          height={480}
          fen={fen}
          orientation={isPlayerWhite ? "white" : "black"}
          turnColor={game.turn() === "w" ? "white" : "black"}
          coordinates={true}
          viewOnly={false}
          movable={{
            free: false,
            color: isPlayerWhite ? "white" : "black",
            dests,
            showDests: true,
            events: { after: onMove },
          }}
          highlight={{
            lastMove: true,
            check: true,
          }}
          premovable={{ enabled: true }}
          lastMove={lastMove}
          animation={{ enabled: true, duration: 300 }}
          style={{ aspectRatio: "1 / 1" }}
        />
      </div>

      <p className="text-4xl font-bold drop-shadow-md">{status}</p>

      {game.isGameOver() && (
        <button
          onClick={() => window.location.reload()}
          className="px-12 py-6 text-3xl font-bold bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-2xl shadow-xl transition transform hover:scale-105"
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <p className="text-4xl font-bold">Loading game...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
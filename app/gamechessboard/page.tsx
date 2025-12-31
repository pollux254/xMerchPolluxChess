"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Chess } from "chess.js"
import Chessground from "@react-chess/chessground"
import "chessground/assets/chessground.base.css"
import "chessground/assets/chessground.cburnett.css" // Lichess look with colored squares + pieces

export default function Game() {
  const searchParams = useSearchParams()
  const playerID = searchParams.get("player") ?? "Guest"
  const fee = searchParams.get("fee") ?? "0"

  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [isPlayerWhite, setIsPlayerWhite] = useState<boolean | null>(null)
  const [status, setStatus] = useState("Assigning color...")
  const [lastMove, setLastMove] = useState<[string, string] | undefined>(undefined)
  const [dests, setDests] = useState<Map<string, string[]>>(new Map())

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

    const map = new Map<string, string[]>()
    game.moves({ verbose: true }).forEach((move) => {
      if (!map.has(move.from)) map.set(move.from, [])
      map.get(move.from)!.push(move.to)
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
      setLastMove([from, to])
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
      setLastMove([from, to])
    }, 600 + Math.random() * 1200)

    return () => clearTimeout(timeout)
  }, [fen, isPlayerWhite])

  // Bot first move if Black
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
        setLastMove([from, to])
      }, 800)

      return () => clearTimeout(timeout)
    }
  }, [isPlayerWhite])

  // Status
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
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p className="text-3xl">{status}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6 px-4 py-8">
      <h1 className="text-4xl md:text-5xl font-bold">PolluxChess</h1>

      <div className="text-center space-y-1">
        <p className="text-lg text-gray-400">Player</p>
        <p className="font-mono text-xl font-bold">
          {playerID.length > 16 ? `${playerID.slice(0, 10)}...${playerID.slice(-6)}` : playerID}
        </p>
        <p className="text-lg text-gray-400 mt-3">
          {fee === "0" ? "FREE PLAY" : `${fee} XAH Entry`}
        </p>
      </div>

      <p className="text-3xl font-bold">
        You are {isPlayerWhite ? "White ♔" : "Black ♚"}
      </p>

      {/* Smaller board — perfect for phones/iPad/laptop */}
      <div className="w-full max-w-[min(85vw,400px)]">
        <Chessground
          fen={fen}
          orientation={isPlayerWhite ? "white" : "black"}
          turnColor={game.turn() === "w" ? "white" : "black"}
          movable={{
            free: false,
            color: isPlayerWhite ? "white" : "black",
            dests,
            events: { after: onMove },
          }}
          highlight={{
            lastMove: true,
            check: true,
          }}
          lastMove={lastMove}
          animation={{ enabled: true }}
          style={{ aspectRatio: "1 / 1" }}
        />
      </div>

      <p className="text-3xl font-bold">{status}</p>

      {game.isGameOver() && (
        <button
          onClick={() => window.location.reload()}
          className="px-10 py-5 text-2xl bg-green-600 rounded-xl font-bold"
        >
          Play Again 🎲
        </button>
      )}
    </div>
  )
}
"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Chess, Square } from "chess.js"
import { Chessboard } from "react-chessboard"
import { motion } from "framer-motion"

export default function Game() {
  const searchParams = useSearchParams()
  const playerID = searchParams.get("player") || "Guest"
  const entryFee = searchParams.get("fee") || "0"

  const [isPlayerWhite, setIsPlayerWhite] = useState<boolean | null>(null)
  const [game, setGame] = useState<Chess | null>(null)
  const [status, setStatus] = useState("🎲 Assigning your random color...")
  const stockfishRef = useRef<Worker | null>(null)

  // Initialize color and new game on mount
  useEffect(() => {
    setIsPlayerWhite(Math.random() < 0.5)
    setGame(new Chess())
  }, [])

  // Initialize Stockfish worker (only once) — Full strength Stockfish 17.1
  useEffect(() => {
    console.log("Starting Stockfish worker...");
    const stockfish = new Worker("/stockfish/stockfish-17.1-single-a496a04.js");

    stockfish.postMessage("uci");
    stockfish.postMessage("isready");
    stockfish.postMessage("ucinewgame");

    stockfish.onmessage = (e) => {
      const message = e.data;
      console.log("Stockfish message:", message); // Debug line

      if (typeof message === "string") {
        if (message.includes("readyok")) {
          console.log("Stockfish is ready!");
        }
        if (message.startsWith("bestmove")) {
          const bestMove = message.split(" ")[1];
          console.log("Best move received:", bestMove);

          if (!bestMove || bestMove === "(none)") return;

          const from = bestMove.substring(0, 2) as Square;
          const to = bestMove.substring(2, 4) as Square;
          const promotion = bestMove.length > 4 ? bestMove[4].toLowerCase() : undefined;

          setGame((prevGame) => {
            if (!prevGame) return null;
            const gameCopy = new Chess(prevGame.fen());
            gameCopy.move({ from, to, promotion });
            return gameCopy;
          });
        }
      }
    };

    stockfishRef.current = stockfish;

    return () => {
      console.log("Terminating Stockfish worker");
      stockfish.terminate();
    };
  }, [])

  // Trigger Stockfish move when it's the bot's turn (including first move!)
  useEffect(() => {
    if (!game || isPlayerWhite === null || !stockfishRef.current) return

    const botColor = isPlayerWhite ? "b" : "w"
    if (game.turn() !== botColor || game.isGameOver()) return

    console.log("Bot's turn - sending position to Stockfish");
    setStatus("Stockfish 17.1 is thinking... ♘💭")

    stockfishRef.current.postMessage(`position fen ${game.fen()}`)
    stockfishRef.current.postMessage("go depth 15")
  }, [game, isPlayerWhite])

  // Player move handler
  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!game || isPlayerWhite === null) return false

    const playerColor = isPlayerWhite ? "w" : "b"
    if (game.turn() !== playerColor) return false

    console.log(`Player trying move: ${sourceSquare} -> ${targetSquare}`);

    const gameCopy = new Chess(game.fen())

    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    })

    if (move === null) {
      console.log("Illegal move - snapping back");
      return false
    }

    console.log("Legal move accepted:", move);
    setGame(gameCopy)
    return true
  }

  // Update status
  useEffect(() => {
    if (!game || isPlayerWhite === null) return

    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const winner = game.turn() === (isPlayerWhite ? "w" : "b") ? "Stockfish" : "You"
        setStatus(`Checkmate! ${winner} wins! 🎉`)
      } else {
        setStatus("It's a draw! 🤝")
      }
      return
    }

    if (game.turn() === (isPlayerWhite ? "w" : "b")) {
      setStatus(`Your turn — you are ${isPlayerWhite ? "White ♔" : "Black ♚"}`)
    }
  }, [game, isPlayerWhite])

  if (isPlayerWhite === null || !game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-2xl text-foreground">{status}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-8 text-center shadow-2xl">
        <h1 className="mb-6 text-3xl font-bold text-foreground">PolluxChess Game Room</h1>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-6 backdrop-blur">
            <p className="text-sm text-muted-foreground">Player</p>
            <p className="font-mono text-xl font-bold text-foreground">
              {playerID.length > 14 ? `${playerID.slice(0, 8)}...${playerID.slice(-6)}` : playerID}
            </p>
          </div>

          <div className="rounded-xl bg-muted/60 p-6 backdrop-blur">
            <p className="text-sm text-muted-foreground">Your Color</p>
            <p className={`text-3xl font-bold ${isPlayerWhite ? "text-blue-300 drop-shadow-lg" : "text-gray-200 drop-shadow-lg"}`}>
              {isPlayerWhite ? "White ♔" : "Black ♚"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isPlayerWhite ? "You move first!" : "Stockfish 17.1 (White) moves first"}
            </p>
          </div>

          <div className="rounded-xl bg-muted/60 p-6 backdrop-blur">
            <p className="text-sm text-muted-foreground">Entry Fee</p>
            <p className="text-2xl font-bold text-foreground">
              {entryFee === "0" ? "Free Play" : `${entryFee} XAH`}
            </p>
          </div>
        </div>

        <div className="mx-auto mb-10 max-w-2xl">
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            boardOrientation={isPlayerWhite ? "white" : "black"}
            boardWidth={600}
            customBoardStyle={{
              borderRadius: "16px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          />
        </div>

        <motion.div
          key={status}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-3xl font-bold text-foreground"
        >
          {status}
        </motion.div>

        {game.isGameOver() && (
          <div className="space-y-6">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-12 py-5 text-2xl font-bold text-white shadow-2xl hover:shadow-green-500/50"
            >
              Play Again — New Random Color! 🎲
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => (window.location.href = "/chess")}
              className="block mx-auto mt-4 text-lg text-muted-foreground underline hover:text-foreground"
            >
              ← Back to Lobby
            </motion.button>
          </div>
        )}

        {!game.isGameOver() && (
          <p className="mt-12 text-sm text-muted-foreground">
            Opponent: <span className="font-bold">Stockfish 17.1 (World's #1 Engine)</span> — Drag pieces slowly and release over the target square ♟️
          </p>
        )}
      </div>
    </div>
  )
}
"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

function GameContent() {
  const searchParams = useSearchParams()
  const tournamentId = searchParams.get("tournamentId")

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex items-center justify-center p-4">
      <div className="text-center w-full max-w-lg">
        <h1 className="text-3xl md:text-4xl font-black mb-4 bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
          Multiplayer Game
        </h1>
        
        <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-purple-500/40">
          <p className="text-xl font-bold mb-4">🚧 Coming Soon! 🚧</p>
          <p className="text-sm text-gray-300 mb-3">
            Tournament ID: {tournamentId || "Unknown"}
          </p>
          <p className="text-sm text-gray-400">
            The multiplayer chess game will be implemented next.
          </p>
          
          <button
            onClick={() => window.location.href = "/chess"}
            className="mt-6 min-h-11 px-6 py-3 text-base font-bold bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MultiplayerGame() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center p-4">
        <p className="text-2xl font-bold text-white">Loading...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}

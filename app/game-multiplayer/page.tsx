"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

function GameContent() {
  const searchParams = useSearchParams()
  const tournamentId = searchParams.get("tournamentId")

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center">
        <h1 className="text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
          Multiplayer Game
        </h1>
        
        <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-purple-500/40 max-w-2xl">
          <p className="text-3xl font-bold mb-6">🚧 Coming Soon! 🚧</p>
          <p className="text-xl text-gray-300 mb-4">
            Tournament ID: {tournamentId || "Unknown"}
          </p>
          <p className="text-lg text-gray-400">
            The multiplayer chess game will be implemented next.
          </p>
          
          <button
            onClick={() => window.location.href = "/chess"}
            className="mt-8 px-8 py-4 text-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl hover:from-cyan-400 hover:to-blue-500 transition-all"
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black flex items-center justify-center">
        <p className="text-4xl font-bold text-white">Loading...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
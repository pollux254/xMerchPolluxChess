"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BOT_PROFILES } from "@/lib/bots/bot-profiles"

export default function BotsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const playerID = searchParams.get("player") ?? "Guest"

  const [rank, setRank] = useState(400)
  const [rankWindow, setRankWindow] = useState(200) // show bots within ±window

  useEffect(() => {
    // If player is missing but user is logged in (like /chess), recover it.
    if (playerID === "Guest") {
      const saved = localStorage.getItem("playerID")
      if (saved) {
        router.replace(`/bots?player=${encodeURIComponent(saved)}`)
      }
    }
  }, [playerID, router])

  const bots = useMemo(() => {
    const min = Math.max(0, rank - rankWindow)
    const max = Math.min(1000, rank + rankWindow)
    return BOT_PROFILES
      .filter((b) => b.rank >= min && b.rank <= max)
      .slice()
      .sort((a, b) => a.rank - b.rank)
  }, [rank, rankWindow])

  const playBot = (botId: string) => {
    // Always start as white for a predictable UX (bot moves second).
    router.push(
      `/gamechessboard?player=${encodeURIComponent(playerID)}&fee=0&botId=${encodeURIComponent(botId)}&playerColor=white`
    )
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white p-4">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            onClick={() => router.push("/chess")}
            className="rounded-xl px-4 py-2 bg-gray-800/60 border border-purple-500/30 hover:bg-gray-800/80 transition"
          >
            ← Back
          </button>
          <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
            🤖 Choose Your Opponent
          </h1>
          <div className="text-right">
            <p className="text-xs text-gray-300">Player</p>
            <p className="font-mono text-xs md:text-sm text-cyan-200">
              {playerID.length > 16 ? `${playerID.slice(0, 10)}...${playerID.slice(-6)}` : playerID}
            </p>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-200">Difficulty Target</p>
              <p className="text-xs text-gray-400 mb-2">Rank: {rank}</p>
              <input
                type="range"
                min={0}
                max={1000}
                value={rank}
                onChange={(e) => setRank(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">Search Window</p>
              <p className="text-xs text-gray-400 mb-2">±{rankWindow} rank</p>
              <input
                type="range"
                min={50}
                max={400}
                step={50}
                value={rankWindow}
                onChange={(e) => setRankWindow(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => (
            <div
              key={bot.botId}
              className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl">{bot.avatar}</div>
                    <div>
                      <p className="text-lg font-black">{bot.name}</p>
                      <p className="text-xs text-gray-300">
                        Rank: <span className="text-cyan-200 font-semibold">{bot.rank}</span> • {bot.style}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 mt-3">{bot.bio}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Fun fact: <span className="text-gray-300">{bot.funFact}</span>
                  </p>
                </div>
                <button
                  onClick={() => playBot(bot.botId)}
                  className="shrink-0 rounded-xl px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 font-bold"
                >
                  Play
                </button>
              </div>
            </div>
          ))}
        </div>

        {bots.length === 0 && (
          <div className="mt-10 text-center text-gray-300">No bots found in this range. Try widening the window.</div>
        )}
      </div>
    </div>
  )
}

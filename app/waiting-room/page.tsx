"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { motion } from "framer-motion"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function WaitingRoomContent() {
  const searchParams = useSearchParams()
  const tournamentId = searchParams.get("tournamentId")
  
  const [tournament, setTournament] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentId) {
      alert("No tournament ID provided")
      window.location.href = "/chess"
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch initial tournament data
    async function fetchTournament() {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single()

      if (error || !data) {
        console.error("Error fetching tournament:", error)
        alert("Tournament not found")
        window.location.href = "/chess"
        return
      }

      setTournament(data)
      setLoading(false)
    }

    // Fetch players
    async function fetchPlayers() {
      const { data, error } = await supabase
        .from("tournament_players")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("player_order", { ascending: true })

      if (error) {
        console.error("Error fetching players:", error)
        return
      }

      setPlayers(data || [])
    }

    fetchTournament()
    fetchPlayers()

    // Subscribe to real-time updates
    const tournamentsChannel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload: any) => {
          console.log("Tournament updated:", payload)
          if (payload.new) {
            setTournament(payload.new)
            
            // Redirect to game if tournament starts
            if (payload.new.status === "in_progress") {
              setTimeout(() => {
                window.location.href = `/game-multiplayer?tournamentId=${tournamentId}`
              }, 2000)
            }
          }
        }
      )
      .subscribe()

    const playersChannel = supabase
      .channel(`tournament-players-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_players",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload: any) => {
          console.log("Players updated:", payload)
          fetchPlayers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(tournamentsChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [tournamentId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 border-8 border-purple-500/60 rounded-full flex items-center justify-center mx-auto mb-10 animate-spin">
            <span className="text-5xl">♟️</span>
          </div>
          <p className="text-4xl font-bold text-white">Loading tournament...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center">
        <p className="text-4xl font-bold text-white">Tournament not found</p>
      </div>
    )
  }

  const playerCount = players.length
  const spotsRemaining = tournament.tournament_size - playerCount
  const isFull = playerCount >= tournament.tournament_size

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <h1 className="text-6xl md:text-7xl font-black text-center mb-8 bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
          Tournament Lobby
        </h1>

        <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-purple-500/40 mb-8">
          <div className="text-center space-y-4">
            <p className="text-3xl font-bold text-emerald-400">
              {tournament.entry_fee} {tournament.currency}
            </p>
            <p className="text-xl text-gray-300">Entry Fee</p>
            
            <div className="h-1 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full my-6"></div>
            
            <p className="text-5xl font-black text-yellow-400">
              {tournament.prize_pool} {tournament.currency}
            </p>
            <p className="text-xl text-gray-300">Prize Pool</p>
          </div>
        </div>

        <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-purple-500/40 mb-8">
          <h2 className="text-4xl font-bold mb-6 text-center">
            {isFull ? "Tournament Starting!" : "Waiting for Players..."}
          </h2>
          
          <div className="text-center mb-8">
            <p className="text-7xl font-black text-cyan-400">
              {playerCount} / {tournament.tournament_size}
            </p>
            <p className="text-2xl text-gray-300 mt-2">
              {isFull ? "All players ready!" : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining`}
            </p>
          </div>

          {isFull && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-emerald-400 animate-pulse">
                Starting game in 2 seconds...
              </p>
            </motion.div>
          )}
        </div>

        <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl border border-purple-500/40">
          <h3 className="text-3xl font-bold mb-6">Players Joined:</h3>
          <div className="space-y-3">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-700/50 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-cyan-400">#{player.player_order}</span>
                  <span className="font-mono text-lg">
                    {player.player_address.slice(0, 10)}...{player.player_address.slice(-6)}
                  </span>
                </div>
                <span className="text-2xl">♟️</span>
              </motion.div>
            ))}
            
            {Array.from({ length: spotsRemaining }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="bg-gray-700/20 rounded-xl p-4 flex items-center justify-between opacity-50"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-gray-500">#{playerCount + index + 1}</span>
                  <span className="text-lg text-gray-500">Waiting...</span>
                </div>
                <span className="text-2xl opacity-30">♟️</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function WaitingRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 border-8 border-purple-500/60 rounded-full flex items-center justify-center mx-auto mb-10 animate-spin">
            <span className="text-5xl">♟️</span>
          </div>
          <p className="text-4xl font-bold text-white">Loading tournament...</p>
        </div>
      </div>
    }>
      <WaitingRoomContent />
    </Suspense>
  )
}
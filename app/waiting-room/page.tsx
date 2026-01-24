"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import { verifyWalletMatch } from "@/lib/middleware/verify-wallet"
import { motion } from "framer-motion"

function WaitingRoomContent() {
  const searchParams = useSearchParams()
  const tournamentId = searchParams.get("tournamentId")
  
  const [tournament, setTournament] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState("Loading tournament...")
  const [timeRemaining, setTimeRemaining] = useState<number>(600)
  const [walletVerified, setWalletVerified] = useState(false)

  // ────────────────────────────────────────────────────────────────
  // All logic, effects, fetches, channels, cancel handler remain 100% unchanged
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tournamentId) {
      alert("No tournament ID provided")
      window.location.href = "/chess"
      return
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'playerID' && e.newValue === null) {
        console.log("🚪 Player logged out detected - leaving waiting room")
        alert("You've been logged out. Returning to lobby...")
        window.location.href = "/chess"
      }
    }

    const checkPlayerStatus = () => {
      const playerID = localStorage.getItem('playerID')
      if (!playerID) {
        console.log("🚪 No player ID found - redirecting to lobby")
        window.location.href = "/chess"
      }
    }

    checkPlayerStatus()
    window.addEventListener('storage', handleStorageChange)
    
    const statusCheckInterval = setInterval(checkPlayerStatus, 2000)

    const supabase = getSupabaseClient()

    async function verifyWallet() {
      const playerID = localStorage.getItem('playerID')
      if (!playerID || !tournamentId) {
        alert("❌ No wallet connected.\n\nPlease connect your wallet first.")
        window.location.href = "/chess"
        return false
      }

      console.log("🔐 Verifying wallet match...")

      if (!tournamentId) {
        console.error("❌ No tournament ID")
        alert("❌ No tournament connected.\n\nReturning to lobby.")
        window.location.href = "/chess"
        return false
      }

      const verification = await verifyWalletMatch(tournamentId, playerID)

      if (!verification.isValid) {
        console.error("❌ WALLET MISMATCH DETECTED!")
        alert(`❌ SECURITY ERROR: Wallet Mismatch\n\n${verification.message}\n\nReturning to lobby.`)
        window.location.href = "/chess"
        return false
      }

      console.log("✅ Wallet verified successfully")
      setWalletVerified(true)
      return true
    }

    async function fetchTournamentStatus() {
      try {
        const isVerified = await verifyWallet()
        if (!isVerified) return

        console.log("🔍 Fetching tournament status...")
        
        const { data, error } = await supabase
          .from("tournaments")
          .select("*")
          .eq("id", tournamentId)
          .single()

        if (error || !data) {
          console.error("❌ Tournament not found:", error)
          setLoadingMessage("Tournament not found")
          setLoading(false)
          alert("⚠️ Tournament not found or has expired.\n\nReturning to lobby.")
          window.location.href = "/chess"
          return
        }

        if (data.status === 'cancelled') {
          console.log("🧹 Tournament was cancelled")
          alert("⏰ Tournament expired.\n\nReturning to lobby.")
          window.location.href = "/chess"
          return
        }

        const createdAt = new Date(data.created_at).getTime()
        const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : createdAt + (10 * 60 * 1000)
        const now = Date.now()
        const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000))

        if (secondsRemaining <= 0 && data.status === 'waiting') {
          console.log("⏰ Tournament expired")
          alert("⏰ Tournament expired.\n\nReturning to lobby.")
          window.location.href = "/chess"
          return
        }

        setTournament(data)
        setTimeRemaining(secondsRemaining)
        setLoading(false)

        if (data.status === "in_progress") {
          console.log("🚀 Tournament started! Checking game...")
          
          const { data: game } = await supabase
            .from('tournament_games')
            .select('id, status')
            .eq('tournament_id', tournamentId)
            .maybeSingle()
          
          if (game) {
            console.log("✅ Game exists, redirecting...")
            setTimeout(() => {
              window.location.href = `/game-multiplayer?tournamentId=${tournamentId}`
            }, 2000)
          } else {
            console.log("⏳ Game being created...")
          }
        }

      } catch (err) {
        console.error("💥 Error:", err)
        setLoading(false)
      }
    }

    async function fetchPlayers() {
      const { data, error } = await supabase
        .from("tournament_players")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("status", "joined")
        .order("player_order", { ascending: true })

      if (error) {
        console.error("Error fetching players:", error)
        return
      }

      setPlayers(data || [])
    }

    fetchTournamentStatus()
    fetchPlayers()

    const statusPollInterval = setInterval(() => {
      if (walletVerified) {
        fetchTournamentStatus()
        fetchPlayers()
      }
    }, 3000)

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
          console.log("🔄 Tournament updated:", payload)
          if (payload.new) {
            setTournament(payload.new)
            
            if (payload.new.status === "in_progress") {
              clearInterval(statusPollInterval)
              
              supabase
                .from('tournament_games')
                .select('id, status')
                .eq('tournament_id', tournamentId)
                .maybeSingle()
                .then(({ data: game }) => {
                  if (game) {
                    console.log("✅ Game exists, redirecting...")
                    setTimeout(() => {
                      window.location.href = `/game-multiplayer?tournamentId=${tournamentId}`
                    }, 2000)
                  }
                })
            }

            if (payload.new.status === "cancelled") {
              clearInterval(statusPollInterval)
              alert("⏰ Tournament cancelled.\n\nReturning to lobby.")
              window.location.href = "/chess"
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
        () => {
          fetchPlayers()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(statusCheckInterval)
      clearInterval(statusPollInterval)
      supabase.removeChannel(tournamentsChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [tournamentId, walletVerified])

  const handleCancel = async () => {
    const confirmCancel = confirm("Leave waiting room?\n\nYour entry fee will be refunded.")
    if (!confirmCancel) return
    
    const playerID = localStorage.getItem('playerID')
    if (!playerID) return
    
    try {
      console.log("🚪 Cancelling...")
      
      await fetch('/api/tournaments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentId: tournamentId,
          reason: 'Player cancelled'
        })
      })
      
      await fetch('/api/tournaments/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentId: tournamentId
        })
      })
      
      await fetch('/api/tournaments/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID
        })
      })
      
      sessionStorage.clear()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      alert("✅ Left waiting room. Refund processed.")
      window.location.href = '/chess'
    } catch (err) {
      console.error("Cancel error:", err)
      alert("Failed to leave. Please try logging out.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-black via-gray-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-sm">
          <div className="w-20 h-20 border-4 border-cyan-500/50 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
            <span className="text-3xl">♟️</span>
          </div>
          <p className="text-2xl font-bold text-white mb-2">{loadingMessage}</p>
          <p className="text-sm text-cyan-300/80">Verifying wallet...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-black via-gray-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-md mx-auto">
          <p className="text-2xl font-bold text-red-400 mb-2">❌ Tournament Not Found</p>
          <p className="text-sm text-gray-400 mb-6">Tournament may have been cancelled.</p>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/chess'}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 transition-all"
          >
            ← Return to Lobby
          </motion.button>
        </div>
      </div>
    )
  }

  const playerCount = players.length
  const tournamentSize = tournament.tournament_size
  const spotsRemaining = tournamentSize - playerCount
  const isFull = playerCount >= tournamentSize

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-black via-gray-950 to-indigo-950 text-white flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg sm:max-w-2xl md:max-w-3xl flex flex-col gap-3 sm:gap-4 max-h-[96vh]"
      >
        {/* Header */}
        <h1 className="text-3xl sm:text-4xl font-black text-center bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent tracking-tight flex-shrink-0">
          Tournament Lobby
        </h1>

        {/* Wallet Verified */}
        {walletVerified && (
          <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/40 backdrop-blur-lg rounded-xl p-3 border border-emerald-500/30 text-center shadow-lg shadow-emerald-500/10 flex-shrink-0">
            <p className="text-sm font-semibold text-emerald-300">✅ Wallet Verified</p>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 sm:space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-cyan-700/50 scrollbar-track-gray-900/40">
          {/* Timer */}
          <div className="bg-gradient-to-br from-gray-900/80 to-indigo-950/60 backdrop-blur-xl rounded-xl p-4 border border-cyan-500/30 text-center shadow-xl">
            <p className="text-sm text-cyan-300/80 font-medium">Expires in</p>
            <p className={`text-4xl sm:text-5xl font-black tracking-tight ${timeRemaining < 60 ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>
              {timeString}
            </p>
          </div>

          {/* Prize Info */}
          <div className="bg-gradient-to-br from-gray-900/70 to-purple-950/40 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-purple-500/30 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                {tournament.entry_fee} {tournament.currency}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Entry Fee</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-yellow-400">
                {tournament.prize_pool} {tournament.currency}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Prize Pool</p>
            </div>
          </div>

          {/* Player Count */}
          <div className="bg-gradient-to-br from-gray-900/70 to-indigo-950/40 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-cyan-500/30 text-center">
            <h2 className="text-lg sm:text-xl font-bold mb-3 text-white/90">
              {isFull ? "Tournament Starting!" : "Waiting for Players..."}
            </h2>
            
            <div>
              <p className="text-5xl sm:text-6xl font-black text-cyan-400 tracking-tighter">
                {playerCount} / {tournamentSize}
              </p>
              <p className="text-sm sm:text-base text-gray-300 mt-2">
                {isFull ? "All ready!" : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} left`}
              </p>
            </div>

            {isFull && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3">
                <p className="text-base font-semibold text-emerald-300 animate-pulse">
                  Starting in 2 seconds...
                </p>
              </motion.div>
            )}
          </div>

          {/* Players List */}
          <div className="bg-gradient-to-br from-gray-900/70 to-purple-950/30 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-purple-500/30">
            <h3 className="text-base sm:text-lg font-bold mb-3 text-white/90">Players Joined</h3>

            <div className="max-h-[30vh] sm:max-h-[40vh] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-purple-600/50 scrollbar-track-transparent">
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.08 }}
                  className="bg-gray-800/50 hover:bg-gray-700/60 rounded-lg p-3 flex items-center justify-between border border-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-cyan-400">#{player.player_order}</span>
                    <span className="font-mono text-sm text-gray-300">
                      {player.player_address.slice(0, 8)}...{player.player_address.slice(-4)}
                    </span>
                  </div>
                  <span className="text-2xl text-cyan-300/70">♟️</span>
                </motion.div>
              ))}
              
              {Array.from({ length: spotsRemaining }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="bg-gray-800/30 rounded-lg p-3 flex items-center justify-between opacity-60 border border-gray-700/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-600">#{playerCount + index + 1}</span>
                    <span className="text-sm text-gray-500">Waiting...</span>
                  </div>
                  <span className="text-2xl opacity-40">♟️</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCancel}
          className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 py-4 font-bold text-white text-base sm:text-lg shadow-xl shadow-red-600/30 hover:shadow-red-500/50 transition-all flex-shrink-0 border border-red-500/40"
        >
          ❌ Cancel & Get Refund
        </motion.button>
      </motion.div>
    </div>
  )
}

export default function WaitingRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-gradient-to-br from-black via-gray-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-cyan-500/50 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
            <span className="text-3xl">♟️</span>
          </div>
          <p className="text-2xl font-bold text-white">Loading...</p>
        </div>
      </div>
    }>
      <WaitingRoomContent />
    </Suspense>
  )
}
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-sm">
          <div className="w-20 h-20 border-4 border-purple-500/60 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
            <span className="text-3xl">♟️</span>
          </div>
          <p className="text-2xl font-bold text-white mb-2">{loadingMessage}</p>
          <p className="text-sm text-purple-300">Verifying wallet...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-md mx-auto">
          <p className="text-2xl font-bold text-red-400 mb-2">❌ Tournament Not Found</p>
          <p className="text-sm text-gray-300 mb-6">Tournament may have been cancelled.</p>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/chess'}
            className="rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow-xl"
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
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex items-center justify-center p-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl flex flex-col max-h-[95vh]"
      >
        {/* Header - Fixed */}
        <h1 className="text-2xl md:text-3xl font-black text-center mb-2 bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent flex-shrink-0">
          Tournament Lobby
        </h1>

        {/* Wallet Verified - Fixed */}
        {walletVerified && (
          <div className="bg-emerald-900/30 backdrop-blur-xl rounded-xl p-2 mb-2 border border-emerald-500/40 text-center flex-shrink-0">
            <p className="text-xs text-emerald-200">✅ Wallet Verified</p>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 mb-2 min-h-0">
          {/* Timer */}
          <div className="bg-orange-900/30 backdrop-blur-xl rounded-xl p-2 mb-2 border border-orange-500/40 text-center">
            <p className="text-xs text-orange-200">Expires in</p>
            <p className={`text-2xl md:text-3xl font-black ${timeRemaining < 60 ? 'text-red-400 animate-pulse' : 'text-orange-300'}`}>
              {timeString}
            </p>
          </div>

          {/* Prize Info */}
          <div className="bg-gray-800/70 backdrop-blur-2xl rounded-xl p-3 shadow-2xl border border-purple-500/40 mb-2">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-base md:text-lg font-bold text-emerald-300">
                  {tournament.entry_fee} {tournament.currency}
                </p>
                <p className="text-xs text-gray-300">Entry Fee</p>
              </div>
              <div>
                <p className="text-base md:text-lg font-black text-yellow-300">
                  {tournament.prize_pool} {tournament.currency}
                </p>
                <p className="text-xs text-gray-300">Prize Pool</p>
              </div>
            </div>
          </div>

          {/* Player Count */}
          <div className="bg-gray-800/70 backdrop-blur-2xl rounded-xl p-3 shadow-2xl border border-purple-500/40 mb-2">
            <h2 className="text-base md:text-lg font-bold mb-2 text-center">
              {isFull ? "Tournament Starting!" : "Waiting for Players..."}
            </h2>
            
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-black text-cyan-300">
                {playerCount} / {tournamentSize}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                {isFull ? "All ready!" : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} left`}
              </p>
            </div>

            {isFull && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center mt-2">
                <p className="text-sm font-bold text-emerald-300 animate-pulse">
                  Starting in 2 seconds...
                </p>
              </motion.div>
            )}
          </div>

          {/* Players List */}
          <div className="bg-gray-800/70 backdrop-blur-2xl rounded-xl p-3 shadow-2xl border border-purple-500/40">
            <h3 className="text-sm md:text-base font-bold mb-2">Players Joined</h3>

            <div className="max-h-[20vh] overflow-y-auto pr-1 space-y-1">
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-700/50 rounded-lg p-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-cyan-300">#{player.player_order}</span>
                    <span className="font-mono text-xs">
                      {player.player_address.slice(0, 8)}...{player.player_address.slice(-4)}
                    </span>
                  </div>
                  <span className="text-base">♟️</span>
                </motion.div>
              ))}
              
              {Array.from({ length: spotsRemaining }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="bg-gray-700/20 rounded-lg p-2 flex items-center justify-between opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-500">#{playerCount + index + 1}</span>
                    <span className="text-xs text-gray-500">Waiting...</span>
                  </div>
                  <span className="text-base opacity-30">♟️</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cancel Button - Fixed at Bottom, Always Visible */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCancel}
          className="w-full rounded-xl bg-red-600/90 hover:bg-red-700 py-3 font-bold text-white text-sm md:text-base shadow-xl transition-all flex-shrink-0"
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-purple-500/60 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
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
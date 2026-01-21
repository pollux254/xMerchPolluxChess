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

    const supabase = getSupabaseClient() // Use singleton client

    // ============================================================================
    // WALLET VERIFICATION - CRITICAL SECURITY CHECK
    // ============================================================================
    async function verifyWallet() {
      const playerID = localStorage.getItem('playerID')
      if (!playerID || !tournamentId) {
        alert("❌ No wallet connected.\n\nPlease connect your wallet first.")
        window.location.href = "/chess"
        return false
      }

      console.log("🔐 Verifying wallet match...")
      console.log("  Logged in as:", playerID)
      console.log("  Tournament ID:", tournamentId)

      if (!tournamentId) {
        console.error("❌ No tournament ID")
        alert("❌ No tournament connected.\n\nReturning to lobby.")
        window.location.href = "/chess"
        return false
      }

      const verification = await verifyWalletMatch(tournamentId, playerID)

      if (!verification.isValid) {
        console.error("❌ WALLET MISMATCH DETECTED!")
        alert(`❌ SECURITY ERROR: Wallet Mismatch\n\n${verification.message}\n\nLogged in wallet: ${playerID.slice(0, 10)}...${playerID.slice(-6)}\n\nThis wallet did not pay for this tournament.\n\nReturning to lobby.`)
        window.location.href = "/chess"
        return false
      }

      console.log("✅ Wallet verified successfully")
      setWalletVerified(true)
      return true
    }

    // ============================================================================
    // FETCH STATUS FROM SERVER
    // ============================================================================
    async function fetchTournamentStatus() {
      try {
        // First verify wallet
        const isVerified = await verifyWallet()
        if (!isVerified) return

        console.log("🔍 Fetching tournament status from server...")
        
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

        // Check if tournament was cancelled/expired
        if (data.status === 'cancelled') {
          console.log("🧹 Tournament was cancelled (expired)")
          alert("⏰ Tournament expired - not enough players joined in time.\n\nReturning to lobby.")
          window.location.href = "/chess"
          return
        }

        // Calculate time remaining from SERVER timestamp
        const createdAt = new Date(data.created_at).getTime()
        const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : createdAt + (10 * 60 * 1000)
        const now = Date.now()
        const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000))

        console.log(`⏰ Time remaining (from server): ${secondsRemaining}s`)

        // If expired on server side
        if (secondsRemaining <= 0 && data.status === 'waiting') {
          console.log("⏰ Tournament expired on server")
          alert("⏰ Tournament expired - not enough players joined in time.\n\nReturning to lobby.")
          window.location.href = "/chess"
          return
        }

        setTournament(data)
        setTimeRemaining(secondsRemaining)
        setLoading(false)

        // Check if tournament started
        if (data.status === "in_progress") {
          console.log("🚀 Tournament started! Checking if game exists...")
          
          // CRITICAL FIX: Verify game exists before redirecting
          const { data: game } = await supabase
            .from('tournament_games')
            .select('id, status')
            .eq('tournament_id', tournamentId)
            .maybeSingle()  // ✅ Returns null if no game exists
          
          if (game) {
            console.log("✅ Game exists, redirecting...")
            setTimeout(() => {
              window.location.href = `/game-multiplayer?tournamentId=${tournamentId}`
            }, 2000) // ✅ Changed from 10000 to 2000 (2 seconds)
          } else {
            console.log("⏳ Game being created, waiting...")
            // Game is being created, keep polling
          }
        }

      } catch (err) {
        console.error("💥 Error fetching tournament:", err)
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

    // Initial fetch
    fetchTournamentStatus()
    fetchPlayers()

    // ============================================================================
    // POLL SERVER EVERY 3 SECONDS
    // ============================================================================
    const statusPollInterval = setInterval(() => {
      if (walletVerified) {
        fetchTournamentStatus()
        fetchPlayers()
      }
    }, 3000)

    // ============================================================================
    // REAL-TIME SUBSCRIPTIONS
    // ============================================================================
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
          console.log("🔄 Tournament updated via realtime:", payload)
          if (payload.new) {
            setTournament(payload.new)
            
            if (payload.new.status === "in_progress") {
              clearInterval(statusPollInterval)
              
              // CRITICAL FIX: Verify game exists before redirecting
              supabase
                .from('tournament_games')
                .select('id, status')
                .eq('tournament_id', tournamentId)
                .maybeSingle()  // ✅ Returns null if no game exists
                .then(({ data: game }) => {
                  if (game) {
                    console.log("✅ Game exists, redirecting from realtime update...")
                    setTimeout(() => {
                      window.location.href = `/game-multiplayer?tournamentId=${tournamentId}`
                    }, 2000) // ✅ Changed from 10000 to 2000 (2 seconds)
                  } else {
                    console.log("⏳ Game being created, waiting...")
                  }
                })
            }

            if (payload.new.status === "cancelled") {
              clearInterval(statusPollInterval)
              alert("⏰ Tournament was cancelled.\n\nReturning to lobby.")
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
        (payload: any) => {
          console.log("🔄 Players updated via realtime:", payload)
          fetchPlayers()
        }
      )
      .subscribe()

    // ============================================================================
    // CLEANUP
    // ============================================================================
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(statusCheckInterval)
      clearInterval(statusPollInterval)
      supabase.removeChannel(tournamentsChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [tournamentId, walletVerified])

  const handleCancel = async () => {
    const confirmCancel = confirm("Are you sure you want to leave the waiting room?\n\nYour entry fee will be refunded.")
    if (!confirmCancel) return
    
    const playerID = localStorage.getItem('playerID')
    if (!playerID) return
    
    try {
      console.log("🚪 Player cancelling from waiting room...")
      
      await fetch('/api/tournaments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentId: tournamentId,
          reason: 'Player cancelled from waiting room'
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
      
      console.log("🧹 Running cleanup after cancel...")
      await fetch('/api/tournaments/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID
        })
      })
      
      sessionStorage.clear()
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      console.log("✅ Cancel complete, redirecting to lobby...")
      alert("✅ Left waiting room. Your entry fee will be refunded.")
      
      window.location.href = '/chess'
    } catch (err) {
      console.error("Cancel error:", err)
      alert("Failed to leave waiting room. Please try logging out and back in.")
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
          <p className="text-sm text-purple-300">Verifying wallet and loading tournament...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-md mx-auto">
          <p className="text-2xl font-bold text-red-400 mb-2">❌ Tournament Not Found</p>
          <p className="text-sm text-gray-300 mb-6">This tournament may have been cancelled or does not exist.</p>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/chess'}
            className="rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground text-base shadow-xl hover:opacity-90 transition-all"
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
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl max-h-[92dvh] overflow-hidden"
      >
        <div className="h-full overflow-y-auto scrollable-container pr-1">
          <h1 className="text-3xl md:text-4xl font-black text-center mb-4 bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
            Tournament Lobby
          </h1>

          {/* Wallet Verified Indicator */}
          {walletVerified && (
            <div className="bg-emerald-900/30 backdrop-blur-xl rounded-xl p-2 mb-4 border border-emerald-500/40 text-center">
              <p className="text-xs text-emerald-200">
                ✅ Wallet Verified
              </p>
            </div>
          )}

          <div className="bg-orange-900/30 backdrop-blur-xl rounded-2xl p-4 mb-4 border border-orange-500/40 text-center">
            <p className="text-xs text-orange-200 mb-1">Tournament expires in</p>
            <p className={`text-3xl md:text-4xl font-black ${timeRemaining < 60 ? 'text-red-400 animate-pulse' : 'text-orange-300'}`}>
              {timeString}
            </p>
            <p className="text-[11px] text-orange-200/70 mt-1">
              Based on server time (not your computer clock)
            </p>
          </div>

          <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-5 md:p-6 shadow-2xl border border-purple-500/40 mb-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-lg md:text-2xl font-bold text-emerald-300">
                  {tournament.entry_fee} {tournament.currency}
                </p>
                <p className="text-xs md:text-sm text-gray-300">Entry Fee</p>
              </div>
              <div>
                <p className="text-lg md:text-2xl font-black text-yellow-300">
                  {tournament.prize_pool} {tournament.currency}
                </p>
                <p className="text-xs md:text-sm text-gray-300">Prize Pool</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-5 md:p-6 shadow-2xl border border-purple-500/40 mb-4">
            <h2 className="text-xl md:text-2xl font-bold mb-3 text-center">
              {isFull ? "Tournament Starting!" : "Waiting for Players..."}
            </h2>
            
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-black text-cyan-300">
                {playerCount} / {tournamentSize}
              </p>
              <p className="text-sm md:text-base text-gray-300 mt-1">
                {isFull ? "All players ready!" : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining`}
              </p>
            </div>

            {isFull && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center mt-3"
              >
                <p className="text-base md:text-lg font-bold text-emerald-300 animate-pulse">
                  Starting game in 2 seconds...
                </p>
              </motion.div>
            )}
          </div>

          <div className="bg-gray-800/70 backdrop-blur-2xl rounded-3xl p-5 md:p-6 shadow-2xl border border-purple-500/40 mb-4">
            <h3 className="text-lg md:text-xl font-bold mb-3">Players Joined</h3>

            <div className="max-h-[32vh] overflow-y-auto scrollable-container pr-1 space-y-2">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-700/50 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-cyan-300">#{player.player_order}</span>
                  <span className="font-mono text-sm md:text-base">
                    {player.player_address.slice(0, 10)}...{player.player_address.slice(-6)}
                  </span>
                </div>
                <span className="text-xl">♟️</span>
              </motion.div>
            ))}
            
            {Array.from({ length: spotsRemaining }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="bg-gray-700/20 rounded-xl p-3 flex items-center justify-between opacity-50"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-gray-500">#{playerCount + index + 1}</span>
                  <span className="text-sm md:text-base text-gray-500">Waiting...</span>
                </div>
                <span className="text-xl opacity-30">♟️</span>
              </div>
            ))}
            </div>
          </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCancel}
          className="w-full rounded-2xl bg-red-600/90 hover:bg-red-700 py-4 font-bold text-white text-base md:text-lg shadow-xl transition-all"
        >
          ❌ Cancel & Get Refund
        </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

export default function WaitingRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-indigo-900/30 to-purple-900 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-sm">
          <div className="w-20 h-20 border-4 border-purple-500/60 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
            <span className="text-3xl">♟️</span>
          </div>
          <p className="text-2xl font-bold text-white">Redirecting to waiting room…</p>
        </div>
      </div>
    }>
      <WaitingRoomContent />
    </Suspense>
  )
}
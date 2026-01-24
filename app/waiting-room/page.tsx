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
  const [loadingMessage, setLoadingMessage] = useState("Joining tournament...")
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

    // ✅ FIXED: Retry logic for wallet verification (handles race condition)
    async function verifyWallet(retries = 5, delay = 800) {
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

      // ✅ RETRY LOGIC: Player might not be in DB yet after redirect
      for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`🔐 Verification attempt ${attempt}/${retries}...`)
        
        const verification = await verifyWalletMatch(tournamentId, playerID)

        if (verification.isValid) {
          console.log("✅ Wallet verified successfully!")
          setWalletVerified(true)
          return true
        }

        // If not last attempt, wait and retry
        if (attempt < retries) {
          console.log(`⏳ Player not in DB yet, retrying in ${delay}ms...`)
          setLoadingMessage(`Verifying wallet (attempt ${attempt}/${retries})...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      // After all retries exhausted
      console.error("❌ WALLET VERIFICATION FAILED after", retries, "attempts")
      alert(`❌ SECURITY ERROR: Unable to verify wallet\n\nYou may not be registered in this tournament.\n\nReturning to lobby.`)
      window.location.href = "/chess"
      return false
    }

    async function fetchTournamentStatus() {
      try {
        setLoadingMessage("Verifying wallet...")
        const isVerified = await verifyWallet()
        if (!isVerified) return

        setLoadingMessage("Loading tournament...")
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-black to-gray-900 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-sm">
          <div className="w-20 h-20 border-4 border-gray-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
            <span className="text-3xl">♟️</span>
          </div>
          <p className="text-2xl font-bold text-white mb-2">{loadingMessage}</p>
          <p className="text-sm text-gray-400">Please wait...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-black to-gray-900 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-md mx-auto">
          <p className="text-2xl font-bold text-red-500 mb-2">❌ Tournament Not Found</p>
          <p className="text-sm text-gray-400 mb-6">Tournament may have been cancelled.</p>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/chess'}
            className="rounded-xl bg-gray-700 px-6 py-3 font-bold text-white shadow-md hover:bg-gray-600"
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

  // ✅ FIX: Calculate actual winner prize (89% after 11% platform fee)
  const totalPrizePool = parseFloat(tournament.prize_pool || 0)
  const platformFeePercent = 11
  const winnerPrizePercent = 89
  const winnerPrize = (totalPrizePool * winnerPrizePercent / 100).toFixed(2)
  const platformFee = (totalPrizePool * platformFeePercent / 100).toFixed(2)

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-black to-gray-900 text-white flex items-center justify-center p-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl flex flex-col max-h-[95vh]"
      >
        {/* Header - Fixed */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-2 text-white flex-shrink-0">
          Tournament Lobby
        </h1>

        {/* Wallet Verified - Fixed */}
        {walletVerified && (
          <div className="bg-gray-800/80 backdrop-blur-md rounded-lg p-2 mb-2 border border-gray-700 text-center flex-shrink-0">
            <p className="text-xs text-green-500">✅ Wallet Verified</p>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 mb-2 min-h-0">
          {/* Timer */}
          <div className="bg-gray-800/80 backdrop-blur-md rounded-lg p-2 mb-2 border border-gray-700 text-center">
            <p className="text-xs text-gray-400">Expires in</p>
            <p className={`text-2xl md:text-3xl font-bold ${timeRemaining < 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {timeString}
            </p>
          </div>

          {/* Prize Info */}
          <div className="bg-gray-800/80 backdrop-blur-md rounded-lg p-3 shadow-md border border-gray-700 mb-2">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-base md:text-lg font-bold text-white">
                  {tournament.entry_fee} {tournament.currency}
                </p>
                <p className="text-xs text-gray-400">Entry Fee</p>
              </div>
              <div>
                <p className="text-base md:text-lg font-bold text-white">
                  {winnerPrize} {tournament.currency}
                </p>
                <p className="text-xs text-gray-400">Winner Prize (89%)</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Pool: {totalPrizePool} • Fee: {platformFeePercent}%
                </p>
              </div>
            </div>
          </div>

          {/* Player Count */}
          <div className="bg-gray-800/80 backdrop-blur-md rounded-lg p-3 shadow-md border border-gray-700 mb-2">
            <h2 className="text-base md:text-lg font-bold mb-2 text-center text-white">
              {isFull ? "Tournament Starting!" : "Waiting for Players..."}
            </h2>
            
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white">
                {playerCount} / {tournamentSize}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {isFull ? "All ready!" : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} left`}
              </p>
            </div>

            {isFull && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center mt-2">
                <p className="text-sm font-bold text-green-500 animate-pulse">
                  Starting in 2 seconds...
                </p>
              </motion.div>
            )}
          </div>

          {/* Players List */}
          <div className="bg-gray-800/80 backdrop-blur-md rounded-lg p-3 shadow-md border border-gray-700">
            <h3 className="text-sm md:text-base font-bold mb-2 text-white">Players Joined</h3>

            <div className="max-h-[20vh] overflow-y-auto pr-1 space-y-1">
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-700/50 rounded-md p-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-blue-400"># {player.player_order}</span>
                    <span className="font-mono text-xs text-white">
                      {player.player_address.slice(0, 8)}...{player.player_address.slice(-4)}
                    </span>
                  </div>
                  <span className="text-base text-gray-400">👤</span>
                </motion.div>
              ))}
              
              {Array.from({ length: spotsRemaining }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="bg-gray-700/20 rounded-md p-2 flex items-center justify-between opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-500"># {playerCount + index + 1}</span>
                    <span className="text-xs text-gray-500">Waiting...</span>
                  </div>
                  <span className="text-base opacity-30 text-gray-500">👤</span>
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
          className="w-full rounded-lg bg-red-600 hover:bg-red-700 py-3 font-bold text-white text-sm md:text-base shadow-md transition-all flex-shrink-0"
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-black to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-gray-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin">
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
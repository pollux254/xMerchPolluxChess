"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { motion } from "framer-motion"

// Hook state (Phase 1): optional read for debugging/verification.
// This does NOT affect the existing Supabase-based waiting room.
import { getWaitingRoomState } from "@/lib/xahau-hooks"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Add support for testnet/mainnet toggle
const isTestnet = process.env.NEXT_PUBLIC_XAHAU_NETWORK === 'testnet'; // Based on env var, e.g., 'testnet' or 'mainnet'

function WaitingRoomContent() {
  const searchParams = useSearchParams()
  const tournamentId = searchParams.get("tournamentId")
  
  const [tournament, setTournament] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState("Loading tournament...")
  const [timeRemaining, setTimeRemaining] = useState<number>(600) // 10 minutes in seconds

  const [hookWaitingRoom, setHookWaitingRoom] = useState<any>(null)

  useEffect(() => {
    if (!tournamentId) {
      alert("No tournament ID provided")
      window.location.href = "/chess"
      return
    }

    // Check if player is still logged in
    const handleStorageStorageChange = (e: StorageEvent) => {
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

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ✅ ROBUST: Fetch tournament with multiple retries and NEVER redirect back
    async function fetchTournament() {
      setLoadingMessage("Loading tournament...")
      
      // Wait 1 second for any final DB propagation
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const maxAttempts = 5
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔍 Waiting room: Attempt ${attempt}/${maxAttempts} to fetch tournament ${tournamentId}`)
        
        const { data, error } = await supabase
          .from("tournaments")
          .select("*")
          .eq("id", tournamentId)
          .single()

        if (!error && data) {
          console.log(`✅ SUCCESS on attempt ${attempt}! Tournament loaded:`, data.id)
          setTournament(data)
          setLoading(false)
          return
        }
        
        console.error(`❌ Attempt ${attempt} failed:`, error?.message || 'Unknown error')
        
        if (attempt < maxAttempts) {
          setLoadingMessage(`Retrying... (${attempt}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      // ❌ After all attempts, tournament genuinely doesn't exist
      // 🚨 CRITICAL: DO NOT REDIRECT BACK TO CHESS (this causes infinite loop)
      console.error("💥 All attempts failed - Tournament not found")
      setLoadingMessage("Tournament not found")
      setLoading(false)
      
      // Show error state without redirecting
      alert("⚠️ Tournament could not be loaded.\n\nThis tournament may have been cancelled.\n\nPlease use the button below to return to the lobby.")
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

    // Optional: read Hook waiting room namespace if Hook address is configured.
    // This is useful to verify the Hook is deployed and state can be read.
    ;(async () => {
      const hookAddress = process.env.NEXT_PUBLIC_HOOK_ADDRESS
      if (!hookAddress) return

      try {
        const resp = await getWaitingRoomState()
        setHookWaitingRoom(resp)
      } catch (err) {
        console.warn("Hook waiting room read failed (non-fatal):", err)
      }
    })()

    // ✨ 10-minute countdown timer
    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // ✨ Auto-timeout after 10 minutes
    const timeoutDuration = 10 * 60 * 1000 // 10 minutes
    const timeoutTimer = setTimeout(async () => {
      const playerID = localStorage.getItem('playerID')
      if (!playerID) return

      // Check if tournament is still waiting
      const { data: currentTournament } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournamentId)
        .single()

      if (currentTournament?.status !== 'waiting') {
        console.log('⏰ Tournament already started or finished - no timeout')
        return
      }

      console.log('⏰ Waiting room timeout - requesting refund and leaving')
      
      // Request refund
      try {
        const refundRes = await fetch('/api/tournaments/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress: playerID,
            tournamentId: tournamentId,
            reason: 'Waiting room timeout (10 minutes)'
          })
        })

        if (refundRes.ok) {
          alert('⏰ No match found after 10 minutes. Your entry fee has been refunded!\n\nYou can try joining again.')
        } else {
          alert('⏰ No match found after 10 minutes. Please contact support for refund.')
        }
      } catch (err) {
        console.error('Refund request failed:', err)
        alert('⏰ Timeout reached. Please contact support for refund if needed.')
      }

      // Remove player from tournament
      try {
        await fetch('/api/tournaments/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress: playerID,
            tournamentId: tournamentId
          })
        })
      } catch (err) {
        console.error('Failed to leave tournament:', err)
      }

      window.location.href = '/chess'
    }, timeoutDuration)

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
              clearTimeout(timeoutTimer)
              clearInterval(countdownInterval)
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
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(statusCheckInterval)
      clearTimeout(timeoutTimer)
      clearInterval(countdownInterval)
      supabase.removeChannel(tournamentsChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [tournamentId])

  // ✅ UPDATED: Handle cancel button with force cleanup
  const handleCancel = async () => {
    const confirmCancel = confirm("Are you sure you want to leave the waiting room?\n\nYour entry fee will be refunded.")
    if (!confirmCancel) return
    
    const playerID = localStorage.getItem('playerID')
    if (!playerID) return
    
    try {
      console.log("🚪 Player cancelling from waiting room...")
      
      // 1. Request refund
      await fetch('/api/tournaments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentId: tournamentId,
          reason: 'Player cancelled from waiting room'
        })
      })
      
      // 2. Leave tournament
      await fetch('/api/tournaments/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentId: tournamentId
        })
      })
      
      // 3. ✅ NEW: Force cleanup to remove any stuck entries
      console.log("🧹 Running cleanup after cancel...")
      await fetch('/api/tournaments/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID
        })
      })
      
      // 4. ✅ NEW: Clear any cached state
      sessionStorage.clear()
      
      // 5. ✅ NEW: Small delay to ensure DB writes complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      console.log("✅ Cancel complete, redirecting to lobby...")
      alert("✅ Left waiting room. Your entry fee will be refunded.")
      
      // 6. Redirect to chess
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
          <p className="text-sm text-purple-300">Setting up your tournament...</p>
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

  // Format time remaining as MM:SS
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

          /* Timeout countdown */
          <div className="bg-orange-900/30 backdrop-blur-xl rounded-2xl p-4 mb-4 border border-orange-500/40 text-center">
            <p className="text-xs text-orange-200 mb-1">Auto-leave and refund in</p>
            <p className={`text-3xl md:text-4xl font-black ${timeRemaining < 60 ? 'text-red-400 animate-pulse' : 'text-orange-300'}`}>
              {timeString}
            </p>
            <p className="text-[11px] text-orange-200/70 mt-1">
              If no match is found within 10 minutes, you'll be automatically refunded
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

        /* Phase 1 debug: Hook state snapshot (hidden unless available) */
        {hookWaitingRoom && (
          <div className="bg-gray-900/40 backdrop-blur rounded-2xl p-3 mb-4 border border-purple-500/20">
            <p className="text-xs text-purple-200 mb-2">🪝 Hook waiting room state (debug)</p>
            <pre className="text-[11px] overflow-auto max-h-32 text-gray-200">
              {JSON.stringify(hookWaitingRoom, null, 2)}
            </pre>
          </div>
        )}

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

            /* Only the player list scrolls */
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
        

        /* ✅ UPDATED: Cancel Button with Force Cleanup */
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
function handleStorageChange(e: StorageEvent) {
  if (e.key === 'playerID' && e.newValue === null) {
    console.log("🚪 Player logged out detected - leaving waiting room")
    alert("You've been logged out. Returning to lobby...")
    window.location.href = "/chess"
  }
}

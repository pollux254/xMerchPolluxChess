"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { getOrCreateProfile, getPlayerStats, getRandomBotRankForPlayer } from "@/lib/player-profile"
import SettingsModal from "@/app/components/SettingsModal"
import ProfileModal from "@/app/components/ProfileModal"

type Theme = "light" | "middle" | "dark"

type Asset = {
  currency: string
  issuer: string | null
  label: string
}

const assets: Asset[] = [
  { currency: "XAH", issuer: null, label: "XAH (Native)" },
  { currency: "PLX", issuer: "rGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q", label: "PLX" },
  { currency: "XRP", issuer: null, label: "XRP (IOU - trusted issuer required)" },
  { currency: "EVR", issuer: "rEvernodee8dJLaFsujS6q1EiXvZYmHXr8", label: "EVR" },
  { currency: "FUZZY", issuer: "rhCAT4hRdi2Y9puNdkpMzxrdKa5wkppR62", label: "FUZZY" },
  { currency: "RLUSD", issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", label: "RLUSD" },
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Chess() {
  const [playerID, setPlayerID] = useState<string | null>(null)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loadingPay, setLoadingPay] = useState(false)
  const [selectedFee, setSelectedFee] = useState<number>(10)
  const [selectedSize, setSelectedSize] = useState<number>(2)
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0)
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [theme, setTheme] = useState<Theme>("light")
  const [existingTournament, setExistingTournament] = useState<{
    id: string
    status: string
  } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet')

  const selectedAsset = assets[selectedAssetIndex]
  const feeTiers = [10, 25, 50, 100]
  const sizes = [2, 4, 8, 16]

  const hookAddress = network === 'testnet'
    ? (process.env.NEXT_PUBLIC_HOOK_ADDRESS_TESTNET || 'r4NnL62r1pJyQ5AZYaoHKjrV9tErJBUpWY')
    : (process.env.NEXT_PUBLIC_HOOK_ADDRESS || process.env.NEXT_PUBLIC_HOOK_ADDRESS_MAINNET || 'r4NnL62r1pJyQ5AZYaoHKjrV9tErJBUpWY')

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.remove("light", "middle", "dark")
      document.documentElement.classList.add(savedTheme)
    }

    const savedNetwork = localStorage.getItem("network") as 'testnet' | 'mainnet'
    if (savedNetwork) {
      setNetwork(savedNetwork)
    }

    const savedID = localStorage.getItem("playerID")
    if (savedID) {
      setPlayerID(savedID)
      checkExistingTournament(savedID)
    }
  }, [])

  useEffect(() => {
    if (!playerID) return
    
    const interval = setInterval(() => {
      checkExistingTournament(playerID)
    }, 10000)
    
    return () => clearInterval(interval)
  }, [playerID])

  async function cleanupPlayerTournaments(playerAddress: string) {
    try {
      console.log("🧹 Cleaning up any stuck tournament entries...")
      const res = await fetch("/api/tournaments/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAddress })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.removed > 0) {
          console.log(`🧹 Cleaned up ${data.removed} stuck tournament(s)`)
        }
      }
    } catch (err) {
      console.log("Cleanup not available:", err)
    }
  }

  async function checkExistingTournament(playerAddress: string) {
    try {
      console.log("🔍 Checking existing tournament for:", playerAddress)
      
      const { data } = await supabase
        .from('tournament_players')
        .select('tournament_id, tournaments!inner(status, expires_at, created_at)')
        .eq('player_address', playerAddress)
        .in('tournaments.status', ['waiting', 'in_progress'])
        .maybeSingle()

      if (data) {
        const tournament = Array.isArray(data.tournaments)
          ? data.tournaments[0]
          : data.tournaments
        
        if (tournament) {
          const expiresAt = tournament.expires_at 
            ? new Date(tournament.expires_at).getTime()
            : new Date(tournament.created_at).getTime() + (10 * 60 * 1000)
          
          const now = Date.now()
          
          if (expiresAt <= now || tournament.status === 'cancelled') {
            console.log("🧹 Removing player from expired tournament")
            await supabase
              .from('tournament_players')
              .delete()
              .eq('player_address', playerAddress)
              .eq('tournament_id', data.tournament_id)
            return
          }
          
          console.log("✅ Player in active tournament:", data.tournament_id)
          
          setExistingTournament({
            id: data.tournament_id,
            status: tournament.status
          })

          if (window.location.pathname === '/chess') {
            if (tournament.status === "waiting") {
              setTimeout(() => {
                console.log("🚀 Auto-redirecting to waiting room...")
                window.location.href = `/waiting-room?tournamentId=${data.tournament_id}`
              }, 1500)
            } else if (tournament.status === "in_progress" || tournament.status === "in-progress") {
              setTimeout(() => {
                console.log("🚀 Auto-redirecting to active game...")
                window.location.href = `/game-multiplayer?tournamentId=${data.tournament_id}`
              }, 1500)
            }
          }
        }
      } else {
        console.log("ℹ️ No existing tournament found")
      }
    } catch (err) {
      console.error("❌ Error checking existing tournament:", err)
    }
  }

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.remove("light", "middle", "dark")
    document.documentElement.classList.add(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  const toggleNetwork = () => {
    const newNetwork = network === 'testnet' ? 'mainnet' : 'testnet'
    setNetwork(newNetwork)
    localStorage.setItem("network", newNetwork)
    console.log(`🔄 Switching to ${newNetwork.toUpperCase()}...`)
    
    setTimeout(() => {
      window.location.reload()
    }, 300)
  }

  async function handleLogin() {
    try {
      setLoadingLogin(true)

      const returnUrl = `${window.location.origin}/chess`

      const res = await fetch("/api/auth/xaman/create-signin/xahau-signin", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-xahau-network": network
        },
        body: JSON.stringify({ returnUrl }),
      })

      if (!res.ok) {
        console.error("Failed to create signin payload:", await res.text())
        alert("Error preparing signin.")
        return
      }

      const data = await res.json()
      const { nextUrl, websocketUrl, uuid } = data

      if (!nextUrl || !websocketUrl || !uuid) {
        alert("Missing Xaman details")
        return
      }

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      
      console.log("📱 Device detection:", isMobile ? "MOBILE" : "DESKTOP")
      
      sessionStorage.setItem("waitingForLogin", "true")
      
      let signinPopup: Window | null = null
      let popupCheckInterval: NodeJS.Timeout | null = null
      let timeoutId: NodeJS.Timeout | null = null
      
      if (isMobile) {
        console.log("📱 Mobile detected - Direct redirect to Xaman app")
        window.location.href = nextUrl
      } else {
        console.log("💻 Desktop detected - Opening popup")
        signinPopup = window.open(nextUrl, "_blank", "width=480,height=720")
        
        if (!signinPopup) {
          alert("Popup blocked. Please allow popups for Xaman.")
          setLoadingLogin(false)
          return
        }

        popupCheckInterval = setInterval(() => {
          if (signinPopup && signinPopup.closed) {
            console.log("Signin popup was closed manually")
            clearInterval(popupCheckInterval!)
            if (timeoutId) clearTimeout(timeoutId)
            ws.close()
            setLoadingLogin(false)
          }
        }, 500)

        timeoutId = setTimeout(() => {
          if (signinPopup && !signinPopup.closed) {
            console.log("Signin popup timeout - auto closing")
            signinPopup.close()
          }
          if (popupCheckInterval) clearInterval(popupCheckInterval)
          ws.close()
          setLoadingLogin(false)
          alert("Sign-in request expired. Please try again.")
        }, 5 * 60 * 1000)
      }

      const ws = new WebSocket(websocketUrl)
      ws.onmessage = async (event) => {
        const status = JSON.parse(event.data)

        if (status.signed === true) {
          if (popupCheckInterval) clearInterval(popupCheckInterval)
          if (timeoutId) clearTimeout(timeoutId)
          
          if (signinPopup && !signinPopup.closed) {
            signinPopup.close()
          }
          
          try {
            const payloadRes = await fetch("/api/auth/xaman/get-payload/xahau-payload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uuid }),
            })

            if (!payloadRes.ok) throw new Error(await payloadRes.text())
            const payloadData = await payloadRes.json()

            if (payloadData.account) {
              const walletAddress = payloadData.account

              console.log("Creating Supabase session for wallet:", walletAddress)
              
              const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
                options: {
                  data: {
                    wallet_address: walletAddress
                  }
                }
              })

              if (authError) {
                console.error("Supabase auth error:", authError)
                setPlayerID(walletAddress)
                localStorage.setItem("playerID", walletAddress)
                sessionStorage.removeItem("waitingForLogin")
                
                getOrCreateProfile(walletAddress)
                
                alert(`Logged in!\nWallet: ${walletAddress.slice(0,10)}...${walletAddress.slice(-6)}`)
              } else {
                console.log("✅ Supabase session created:", authData.session?.user.id)
                console.log("✅ Wallet stored in metadata:", authData.session?.user.user_metadata.wallet_address)
                
                setPlayerID(walletAddress)
                localStorage.setItem("playerID", walletAddress)
                sessionStorage.removeItem("waitingForLogin")
                
                getOrCreateProfile(walletAddress)
                
                alert(`Logged in successfully!\nWallet: ${walletAddress.slice(0,10)}...${walletAddress.slice(-6)}`)
              }
            }
          } catch (err) {
            console.error("Failed to get account:", err)
            alert("Signed, but couldn't retrieve address.")
          }
          ws.close()
        } else if (status.signed === false || status.expired) {
          if (popupCheckInterval) clearInterval(popupCheckInterval)
          if (timeoutId) clearTimeout(timeoutId)
          
          if (signinPopup && !signinPopup.closed) {
            signinPopup.close()
          }
          
          sessionStorage.removeItem("waitingForLogin")
          alert(status.signed === false ? "Sign-in rejected." : "Sign-in expired.")
          ws.close()
          setLoadingLogin(false)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        
        if (popupCheckInterval) clearInterval(popupCheckInterval)
        if (timeoutId) clearTimeout(timeoutId)
        
        if (signinPopup && !signinPopup.closed) {
          signinPopup.close()
        }
        ws.close()
        setLoadingLogin(false)
      }

      ws.onclose = () => {
        console.log("WebSocket closed")
        
        if (popupCheckInterval) clearInterval(popupCheckInterval)
        if (timeoutId) clearTimeout(timeoutId)
      }
    } catch (err) {
      console.error("Login error:", err)
      sessionStorage.removeItem("waitingForLogin")
      alert("Login failed.")
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleDisconnect = async () => {
    if (!playerID) {
      localStorage.removeItem("playerID")
      sessionStorage.clear()
      await supabase.auth.signOut()
      window.location.reload()
      return
    }

    let playerTournament = existingTournament

    if (!playerTournament) {
      try {
        const checkRes = await fetch(`/api/tournaments/check-player?address=${playerID}`)
        if (checkRes.ok) {
          const checkData = await checkRes.json()
          if (checkData.inTournament) {
            playerTournament = {
              id: checkData.tournamentId,
              status: checkData.status
            }
          }
        }
      } catch (err) {
        console.error("Failed to check tournament status:", err)
      }
    }

    if (playerTournament?.status === "in_progress" || playerTournament?.status === "in-progress") {
      const confirmLeave = confirm(
        "⚠️ You're in an active game! Logging out now will FORFEIT the match (you lose).\n\nAre you sure you want to logout and forfeit?"
      )
      if (!confirmLeave) {
        return
      }
      
      try {
        const forfeitRes = await fetch("/api/tournaments/forfeit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerAddress: playerID,
            tournamentId: playerTournament.id,
            reason: "Player logged out during game"
          })
        })
        
        if (!forfeitRes.ok) {
          console.error("Failed to process forfeit")
          alert("Warning: Failed to register forfeit. Please contact support.")
        } else {
          alert("Game forfeited. Your opponent wins.")
        }
      } catch (err) {
        console.error("Forfeit error:", err)
        alert("Warning: Failed to register forfeit. Please contact support.")
      }
    } else if (playerTournament?.status === "waiting") {
      const confirmLeave = confirm(
        "You're in a waiting room. Logging out will remove you from the tournament.\n\nContinue logout?"
      )
      if (!confirmLeave) {
        return
      }
      
      try {
        const leaveRes = await fetch("/api/tournaments/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerAddress: playerID,
            tournamentId: playerTournament.id
          })
        })
        
        if (!leaveRes.ok) {
          console.error("Failed to leave tournament")
        } else {
          console.log("✅ Successfully left tournament")
        }
      } catch (err) {
        console.error("Failed to leave tournament:", err)
      }
    }
    
    if (playerID) {
      console.log("🧹 Running cleanup on logout...")
      try {
        await cleanupPlayerTournaments(playerID)
      } catch (err) {
        console.error("Cleanup failed:", err)
      }
    }
    
    setPlayerID(null)
    setExistingTournament(null)
    
    localStorage.removeItem("playerID")
    sessionStorage.clear()
    
    await supabase.auth.signOut()
    
    console.log("🚪 Logout complete - all state cleared")
    
    alert("Wallet disconnected successfully!")
    window.location.reload()
  }

  async function handlePayFeeHook() {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    if (!hookAddress) {
      alert(`No Hook address configured for ${network.toUpperCase()}`)
      return
    }

    try {
      setLoadingPay(true)
      console.log(`🪝 Starting Hook payment on ${network.toUpperCase()}...`)

      // CRITICAL FIX: Call join API FIRST to get/create tournament with real UUID
      console.log("🔍 Finding or creating tournament...")
      const joinRes = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentSize: selectedSize,
          entryFee: selectedFee,
          currency: selectedAsset.currency,
          issuer: selectedAsset.issuer,
        })
      })

      if (!joinRes.ok) {
        const errorData = await joinRes.json()
        
        // Check if player already in tournament
        if (joinRes.status === 409 && errorData.tournamentId) {
          console.log("❌ Player already in tournament:", errorData.tournamentId)
          alert("You're already in a tournament!\n\nRedirecting...")
          window.location.href = `/waiting-room?tournamentId=${errorData.tournamentId}`
          return
        }
        
        throw new Error(errorData.error || 'Failed to join tournament')
      }

      const joinData = await joinRes.json()
      const tournamentId = joinData.tournamentId // ✅ Real UUID from backend
      
      console.log("✅ Tournament ready:", tournamentId)
      console.log("📊 Players:", `${joinData.playerCount}/${joinData.tournamentSize}`)

      // If tournament is already full, redirect immediately
      if (joinData.isFull) {
        console.log("🎉 Tournament is full! Redirecting to game...")
        window.location.href = `/game-multiplayer?tournamentId=${tournamentId}`
        return
      }

      // Create payment memo with REAL tournament ID
      const memoData = {
        action: "join",
        tournament: tournamentId, // ✅ Using real UUID
        player: playerID,
        network: network
      }

      console.log("📤 Creating Xaman payload...")
      const payloadRes = await fetch("/api/payment", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-xahau-network": network
        },
        body: JSON.stringify({ 
          amount: selectedFee,
          currency: selectedAsset.currency,
          issuer: selectedAsset.issuer,
          memo: JSON.stringify(memoData),
          network: network
        })
      })

      if (!payloadRes.ok) {
        const errorData = await payloadRes.json()
        throw new Error(`Xaman payload creation failed: ${errorData.error || 'Unknown error'}`)
      }

      const payloadData = await payloadRes.json()
      const { uuid, nextUrl, websocketUrl } = payloadData

      if (!uuid || !nextUrl || !websocketUrl) {
        throw new Error("Missing Xaman payload data")
      }

      console.log("✅ Xaman payload created:", uuid)

      // Mobile detection
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent.toLowerCase())
      
      let xamanPopup: Window | null = null
      
      if (isMobileDevice) {
        console.log("📱 Mobile: Using deep link for Xaman app")
        const deepLink = `xumm://xumm.app/sign/${uuid}`
        console.log("📱 Deep link:", deepLink)
        window.location.href = deepLink
      } else {
        console.log("💻 Desktop - Opening popup")
        xamanPopup = window.open(nextUrl, "_blank", "width=480,height=720")
        
        if (!xamanPopup) {
          alert("Popup blocked! Please allow popups for Xaman.")
          setLoadingPay(false)
          return
        }
      }

      const ws = new WebSocket(websocketUrl)
      
      const timeoutId = setTimeout(() => {
        ws.close()
        if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
        setLoadingPay(false)
        alert("Payment request expired. Please try again.")
      }, 5 * 60 * 1000)

      ws.onmessage = async (event) => {
        const status = JSON.parse(event.data)
        console.log("📡 Xaman payment status:", status)

        if (status.signed === true) {
          clearTimeout(timeoutId)
          if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
          
          console.log("✅ Payment signed! Redirecting to waiting room...")
          
          setLoadingPay(true)
          // Wait 2 seconds for webhook to process
          await new Promise(resolve => setTimeout(resolve, 2000))
          window.location.href = `/waiting-room?tournamentId=${tournamentId}`
          
          ws.close()
        } else if (status.signed === false) {
          clearTimeout(timeoutId)
          if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
          
          alert("❌ Payment rejected")
          setLoadingPay(false)
          ws.close()
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        clearTimeout(timeoutId)
        if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
        alert("Connection error. Please try again.")
        setLoadingPay(false)
      }

    } catch (err: any) {
      console.error("❌ Hook payment error:", err)
      alert(`Failed to start payment:\n\n${err.message || err}`)
    } finally {
      setLoadingPay(false)
    }
  }

  const handleFreePlay = async () => {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    try {
      console.log(`🎯 [Matchmaking] Starting matchmaking for player: ${playerID}`)
      
      await getOrCreateProfile(playerID)
      
      const stats = await getPlayerStats(playerID)
      
      let botRank: number
      
      if (stats) {
        console.log(`📊 [Matchmaking] Player stats:`, {
          bot_elo: stats.bot_elo,
          wins: stats.bot_wins,
          losses: stats.bot_losses,
          draws: stats.bot_draws
        })
        
        botRank = getRandomBotRankForPlayer(stats.bot_elo)
        
        console.log(`🤖 [Matchmaking] Player ELO: ${stats.bot_elo}`)
        console.log(`🤖 [Matchmaking] Generated Bot Rank: ${botRank}`)
        console.log(`🤖 [Matchmaking] Range: ${Math.max(1, stats.bot_elo - 10)} - ${Math.min(1000, stats.bot_elo + 10)}`)
      } else {
        botRank = 100
        console.warn('⚠️ [Matchmaking] No stats found, using default botRank:', botRank)
      }
      
      const gameUrl = `/gamechessboard?player=${playerID}&fee=0&mode=bot_matchmaking&botRank=${botRank}`
      console.log(`🔗 [Matchmaking] Redirecting to:`, gameUrl)
      
      window.location.href = gameUrl
      
    } catch (error) {
      console.error('❌ [Matchmaking] Error during matchmaking:', error)
      const defaultBotRank = 100
      console.log(`🔗 [Matchmaking] Error fallback - using botRank: ${defaultBotRank}`)
      window.location.href = `/gamechessboard?player=${playerID}&fee=0&mode=bot_matchmaking&botRank=${defaultBotRank}`
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground transition-colors duration-300 flex flex-col items-center justify-center p-4">
      <div className="fixed top-20 left-4 z-50">
        <button
          onClick={toggleNetwork}
          className="bg-gray-800/70 hover:bg-gray-700/70 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
        >
          🌐 {network.toUpperCase()}
        </button>
      </div>

      <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 flex items-center justify-between z-50">
        <Link href="/" className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
          ← Home
        </Link>

        <div className="flex gap-2 items-center">
          {playerID && (
            <>
              <button
                onClick={() => setShowProfile(true)}
                className="rounded-full p-2 border border-border bg-card/80 backdrop-blur-sm hover:bg-muted transition-all shadow-lg text-lg"
                aria-label="View Profile"
                title="View your stats"
              >
                👤
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-full p-2 border border-border bg-card/80 backdrop-blur-sm hover:bg-muted transition-all shadow-lg"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </>
          )}
          
          <div className="flex gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm p-2 shadow-lg">
            <button onClick={() => setThemeValue("light")} className={`rounded-full p-2 transition-all ${theme === "light" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="Light theme">
              <Sun className="h-5 w-5" />
            </button>
            <button onClick={() => setThemeValue("middle")} className={`rounded-full p-2 transition-all ${theme === "middle" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="System theme">
              <Monitor className="h-5 w-5" />
            </button>
            <button onClick={() => setThemeValue("dark")} className={`rounded-full p-2 transition-all ${theme === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="Dark theme">
              <Moon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm md:max-w-md mt-16 md:mt-0 rounded-3xl border border-border bg-card/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain"
      >
        <div className="text-center mb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            PolluxChess Tournament
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Skill-based chess wagering on Xahau
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {!playerID ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loadingLogin}
              onClick={handleLogin}
              className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base md:text-lg"
            >
              {loadingLogin ? "Connecting..." : "Connect with Xaman"}
            </motion.button>
          ) : existingTournament ? (
            <>
              <div className="text-center py-6">
                <div className="mb-3 text-3xl">♟️</div>
                <h2 className="text-xl font-bold mb-2">
                  {existingTournament.status === "waiting" 
                    ? "You're in the Waiting Room!"
                    : "You're in an Active Game!"
                  }
                </h2>
                <p className="text-muted-foreground mb-6">
                  Redirecting you back...
                </p>
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Connected as</p>
                  <p className="font-mono text-base md:text-lg font-semibold text-foreground">
                    {playerID.slice(0, 10)}...{playerID.slice(-6)}
                  </p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="ml-3 rounded-full p-3 bg-red-600/90 hover:bg-red-700 text-white transition-all"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Tournament Size</p>
                <div className="grid grid-cols-4 gap-2">
                  {sizes.map((size) => (
                    <motion.button
                      key={size}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-xl py-4 font-bold transition-all ${
                        selectedSize === size
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "border border-border bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      {size === 2 ? "1v1" : size === 4 ? "4P" : size === 8 ? "8P" : "16P"}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Entry Fee</p>
                <div className="relative mb-4">
                  <button
                    onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                    className="w-full rounded-xl py-3 px-4 font-bold text-left bg-muted/50 border border-border hover:bg-muted transition-all flex items-center justify-between"
                  >
                    <span>{selectedAsset.label}</span>
                    <span className="text-xl">▼</span>
                  </button>
                  {showAssetDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-10">
                      {assets.map((asset, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setSelectedAssetIndex(index)
                            setShowAssetDropdown(false)
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-muted transition-all"
                        >
                          {asset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {feeTiers.map((tier) => (
                    <motion.button
                      key={tier}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedFee(tier)}
                      className={`rounded-xl py-4 font-bold transition-all ${
                        selectedFee === tier
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "border border-border bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      {tier}
                    </motion.button>
                  ))}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loadingPay}
                onClick={handlePayFeeHook}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 py-4 font-bold text-white text-base md:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingPay ? "Processing..." : `🪝 Join via Hook (${selectedFee} ${selectedAsset.currency})`}
              </motion.button>

              <div className="text-center text-muted-foreground font-medium my-2">Or</div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFreePlay}
                className="w-full rounded-2xl bg-card border-2 border-border py-4 font-bold text-foreground text-base md:text-lg shadow-xl hover:shadow-muted/30 transition-all"
              >
                🚀 FREE PLAY vs BOT
              </motion.button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Powered by{" "}
          <a href="https://xmerch.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">
            xMerch
          </a>
        </p>

        <div className="mt-5 flex items-center justify-center gap-6">
          <a href="https://xaman.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="7" cy="14" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a href="https://xahau.network" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <path d="M12 7v4m0 0l-5 6m5-6l5 6" />
            </svg>
          </a>
          <a href="https://evernode.org" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2" />
            </svg>
          </a>
        </div>
      </motion.div>

      {playerID && (
        <SettingsModal 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          walletAddress={playerID}
        />
      )}

      {playerID && (
        <ProfileModal 
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          walletAddress={playerID}
        />
      )}
    </div>
  )
}
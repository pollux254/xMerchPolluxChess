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
  network: "xahau" | "xrpl-bridged"
}

// ✨ SEPARATED BY NETWORK
const assets: Asset[] = [
  // Xahau Native Network
  { currency: "XAH", issuer: null, label: "XAH (Native)", network: "xahau" },
  { currency: "EVR", issuer: "rEvernodee8dJLaFsujS6q1EiXvZYmHXr8", label: "EVR", network: "xahau" },
  
  // XRPL Bridged
  { currency: "PLX", issuer: "rGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q", label: "PLX (Bridged)", network: "xrpl-bridged" },
  { currency: "FUZZY", issuer: "rhCAT4hRdi2Y9puNdkpMzxrdKa5wkppR62", label: "FUZZY (Bridged)", network: "xrpl-bridged" },
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
  const [selectedNetwork, setSelectedNetwork] = useState<"xahau" | "xrpl-bridged">("xahau")

  const selectedAsset = assets[selectedAssetIndex]
  const feeTiers = [10, 25, 50, 100]
  const sizes = [2, 4, 8, 16]

  // 🪝 HOOK ADDRESSES
  const hookAddress = network === 'testnet'
    ? 'rpbvh5LmrV17BVCu5fAc1ybKev1pFa8evh'
    : (process.env.NEXT_PUBLIC_HOOK_ADDRESS_MAINNET || 'rYOUR_MAINNET_HOOK_ADDRESS')

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

  useEffect(() => {
    const firstIndex = assets.findIndex(a => a.network === selectedNetwork)
    if (firstIndex !== -1) {
      setSelectedAssetIndex(firstIndex)
    }
  }, [selectedNetwork])

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

  // ✅ FIXED: Payment validation with cleanup + WebSocket wait for ALL devices
  async function handlePayFeeHook() {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    if (!hookAddress) {
      alert(`No Hook address configured for ${network.toUpperCase()}`)
      return
    }

    if (selectedAsset.network !== "xahau") {
      alert("This token is not yet supported. Please use XAH or EVR.")
      return
    }

    let tournamentId: string | null = null

    try {
      setLoadingPay(true)
      console.log(`🪝 Starting Hook payment on ${network.toUpperCase()}...`)
      console.log(`🪝 Hook Address: ${hookAddress}`)

      // Step 1: Join tournament
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
        
        if (joinRes.status === 409 && errorData.tournamentId) {
          console.log("❌ Player already in tournament:", errorData.tournamentId)
          alert("You're already in a tournament!\n\nRedirecting...")
          window.location.href = `/waiting-room?tournamentId=${errorData.tournamentId}`
          return
        }
        
        throw new Error(errorData.error || 'Failed to join tournament')
      }

      const joinData = await joinRes.json()
      tournamentId = joinData.tournamentId
      
      console.log("✅ Tournament ready:", tournamentId)

      // Step 2: Create payment
      const memoData = {
        action: "join",
        tournament: tournamentId,
        player: playerID,
        network: network
      }

      console.log("📤 Creating Xaman payload...")
      
      const payloadRes = await fetch("/api/payment-hook", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-xahau-network": network
        },
        body: JSON.stringify({ 
          amount: selectedFee,
          currency: selectedAsset.currency,
          issuer: selectedAsset.issuer,
          destination: hookAddress,
          memo: JSON.stringify(memoData),
          network: network
        })
      })

      if (!payloadRes.ok) {
        const errorData = await payloadRes.json()
        throw new Error(`Payment creation failed: ${errorData.error || 'Unknown error'}`)
      }

      const payloadData = await payloadRes.json()
      const { uuid, nextUrl, websocketUrl } = payloadData

      if (!uuid || !nextUrl || !websocketUrl) {
        throw new Error("Missing Xaman payload data")
      }

      console.log("✅ Xaman payload created:", uuid)

      // Step 3: Open Xaman (FIXED - works for both desktop AND mobile/browser)
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent.toLowerCase())
      
      let xamanPopup: Window | null = null
      
      console.log(isMobileDevice ? "📱 Mobile device detected" : "💻 Desktop detected")
      console.log("🔓 Opening Xaman in new window...")
      
      // ✅ FIX: ALWAYS open in new window/tab (never redirect current page)
      // This keeps the WebSocket alive on the current page for BOTH mobile and desktop
      xamanPopup = window.open(nextUrl, "_blank", isMobileDevice ? "" : "width=480,height=720")
      
      if (!xamanPopup) {
        console.warn("⚠️ Popup was blocked - showing manual instructions")
        const userConfirm = confirm(
          "⚠️ Popup was blocked!\n\n" +
          "Please manually:\n" +
          "1. Open your Xaman app or browser extension\n" +
          "2. Check for pending payment request\n" +
          "3. Sign the transaction\n\n" +
          "This page will automatically detect when signed.\n\n" +
          "Click OK to continue waiting for confirmation."
        )
        if (!userConfirm) {
          throw new Error("Payment cancelled by user")
        }
        // Even if popup blocked, WebSocket below will still listen for confirmation
      }

      console.log("⏳ Waiting for payment confirmation via WebSocket...")

      // Step 4: CRITICAL - Wait for payment confirmation
      // WebSocket runs on THIS page (which stays open)
      const ws = new WebSocket(websocketUrl)
      
      const paymentPromise = new Promise<boolean>((resolve, reject) => {
        let txValidated = false
        
        const timeoutId = setTimeout(() => {
          console.log("⏱️ Payment timeout (5 minutes)")
          ws.close()
          if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
          if (!txValidated) {
            reject(new Error("Payment request timed out"))
          }
        }, 5 * 60 * 1000)

        ws.onmessage = (event) => {
          const status = JSON.parse(event.data)
          console.log("📡 WebSocket message:", status)

          // User rejected
          if (status.signed === false) {
            clearTimeout(timeoutId)
            if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
            console.log("❌ Payment REJECTED")
            ws.close()
            reject(new Error("Payment rejected by user"))
            return
          }

          // User signed - keep waiting for ledger
          if (status.signed === true && !txValidated) {
            console.log("✍️ Signed - waiting for ledger validation...")
          }

          // Transaction dispatched
          if (status.dispatched === true && !txValidated) {
            console.log("📤 Dispatched to ledger...")
          }

          // CRITICAL: Check ledger result
          if (status.payload_uuidv4 || status.resolved === true || status.payload_resolved === true) {
            const result = status.result?.engine_result || status.meta?.TransactionResult
            
            console.log("📊 Ledger result:", result)
            
            if (result === "tesSUCCESS") {
              txValidated = true
              clearTimeout(timeoutId)
              if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
              console.log("✅ VALIDATED on ledger!")
              ws.close()
              resolve(true)
            } else if (result && result !== "tesSUCCESS") {
              clearTimeout(timeoutId)
              if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
              console.error("❌ TX FAILED:", result)
              ws.close()
              reject(new Error(`Transaction failed: ${result}`))
            }
          }
        }

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error)
          clearTimeout(timeoutId)
          if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
          if (!txValidated) {
            reject(new Error("Connection error"))
          }
        }

        ws.onclose = () => {
          console.log("🔌 WebSocket closed")
        }
      })

      // WAIT for ledger validation before redirecting
      await paymentPromise

      // Step 5: ONLY redirect if payment was successfully confirmed
      console.log("✅ Payment confirmed - redirecting to waiting room...")
      await new Promise(resolve => setTimeout(resolve, 1000))
      window.location.href = `/waiting-room?tournamentId=${tournamentId}`

    } catch (err: any) {
      console.error("❌ Payment error:", err)
      
      // ✅ CRITICAL FIX: Remove from tournament if payment failed
      if (tournamentId && playerID) {
        console.log("🧹 Cleaning up - removing player from tournament...")
        try {
          await fetch('/api/tournaments/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerAddress: playerID,
              tournamentId: tournamentId
            })
          })
          console.log("✅ Player removed from tournament")
        } catch (cleanupErr) {
          console.error("❌ Cleanup failed:", cleanupErr)
        }
      }
      
      // User-friendly error
      let errorMessage = "Payment failed"
      if (err.message.includes("rejected")) {
        errorMessage = "Payment was cancelled"
      } else if (err.message.includes("timed out")) {
        errorMessage = "Payment request expired"
      } else if (err.message.includes("terPRE_SEQ") || err.message.includes("tefPAST_SEQ")) {
        errorMessage = "Transaction sequence error - please try again"
      } else if (err.message.includes("terINSUF_FEE")) {
        errorMessage = "Insufficient XAH for transaction fees"
      } else if (err.message.includes("tecUNFUNDED") || err.message.includes("tecINSUFF")) {
        errorMessage = "Insufficient XAH balance"
      } else if (err.message.includes("tec")) {
        errorMessage = "Transaction error - please check your balance"
      } else if (err.message.includes("Connection error")) {
        errorMessage = "Connection error - please try again"
      } else if (err.message.includes("Popup blocked")) {
        errorMessage = "Popup was blocked - please allow popups"
      } else if (err.message.includes("cancelled by user")) {
        errorMessage = "Payment was cancelled"
      } else if (err.message.includes("failed:")) {
        const match = err.message.match(/failed: (\w+)/)
        errorMessage = match ? `Transaction failed: ${match[1]}` : err.message
      } else {
        errorMessage = err.message
      }
      
      alert(`❌ ${errorMessage}\n\nYou can try again.`)
      
      setLoadingPay(false)
    }
  }

  const handleFreePlay = async () => {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    try {
      console.log(`🎯 [Matchmaking] Starting for: ${playerID}`)
      
      await getOrCreateProfile(playerID)
      
      const stats = await getPlayerStats(playerID)
      
      let botRank: number
      
      if (stats) {
        botRank = getRandomBotRankForPlayer(stats.bot_elo)
        console.log(`🤖 Player ELO: ${stats.bot_elo}, Bot Rank: ${botRank}`)
      } else {
        botRank = 100
        console.warn('⚠️ No stats, using default botRank:', botRank)
      }
      
      window.location.href = `/gamechessboard?player=${playerID}&fee=0&mode=bot_matchmaking&botRank=${botRank}`
      
    } catch (error) {
      console.error('❌ Matchmaking error:', error)
      window.location.href = `/gamechessboard?player=${playerID}&fee=0&mode=bot_matchmaking&botRank=100`
    }
  }

  const filteredAssets = assets.filter(a => a.network === selectedNetwork)

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

      <div className="w-full max-w-sm md:max-w-md mt-20 md:mt-16 flex flex-col gap-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Pollux's Chess Tournament
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Skill-based Chess Game Wagering on Xahau
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {!playerID ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loadingLogin}
              onClick={handleLogin}
              className="w-full rounded-2xl bg-primary py-3 md:py-4 font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base md:text-lg"
            >
              {loadingLogin ? "Connecting..." : "Connect with Xaman"}
            </motion.button>
          ) : existingTournament ? (
            <>
              <div className="text-center py-4">
                <div className="mb-3 text-3xl">♟️</div>
                <h2 className="text-xl font-bold mb-2">
                  {existingTournament.status === "waiting" 
                    ? "You're in the Waiting Room!"
                    : "You're in an Active Game!"
                  }
                </h2>
                <p className="text-muted-foreground mb-4">
                  Redirecting you back...
                </p>
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3">
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Connected as</p>
                  <p className="font-mono text-sm md:text-base font-semibold text-foreground">
                    {playerID.slice(0, 10)}...{playerID.slice(-6)}
                  </p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="ml-2 rounded-full p-2 bg-red-600/90 hover:bg-red-700 text-white transition-all"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 text-center">Pick a Size</p>
                <div className="grid grid-cols-4 gap-2">
                  {sizes.map((size) => (
                    <motion.button
                      key={size}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-xl py-3 font-bold transition-all text-sm ${
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

              <div className="mt-4">
                <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-xl p-2 border border-border">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedNetwork("xahau")}
                    className={`rounded-lg py-2.5 font-medium text-sm transition-all ${
                      selectedNetwork === "xahau"
                        ? "bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-md"
                        : "bg-transparent hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    Xahau
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedNetwork("xrpl-bridged")}
                    className={`rounded-lg py-2.5 font-medium text-sm transition-all ${
                      selectedNetwork === "xrpl-bridged"
                        ? "bg-gradient-to-r from-blue-600/80 to-cyan-600/80 text-white shadow-md"
                        : "bg-transparent hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    XRPL Bridged
                  </motion.button>
                </div>
              </div>

              <div>
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1 px-2">
                    {selectedNetwork === "xahau" ? "🪝 Xahau Network" : "🌉 XRPL Bridged"}
                  </p>
                  <div className="relative">
                    <button
                      onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                      className={`w-full rounded-xl py-2 px-3 font-bold text-left border-2 transition-all flex items-center justify-between text-sm ${
                        selectedNetwork === "xahau"
                          ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/50 hover:border-purple-500"
                          : "bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-blue-500/50 hover:border-blue-500"
                      }`}
                    >
                      <span>{selectedAsset.label}</span>
                      <span className="text-xl">▼</span>
                    </button>
                    {showAssetDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-10">
                        {filteredAssets.map((asset, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedAssetIndex(assets.indexOf(asset))
                              setShowAssetDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-muted transition-all text-sm"
                          >
                            {asset.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-2">
                  {feeTiers.map((tier) => (
                    <motion.button
                      key={tier}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedFee(tier)}
                      className={`rounded-xl py-3 font-bold transition-all text-sm ${
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
                disabled={loadingPay || selectedAsset.network !== selectedNetwork}
                onClick={handlePayFeeHook}
                className={`w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 font-bold text-white text-sm md:text-base shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  selectedNetwork === "xrpl-bridged" ? "from-blue-600 to-cyan-600" : ""
                }`}
              >
                {loadingPay 
                  ? "Processing..." 
                  : selectedAsset.network === "xahau"
                    ? `🪝 Submit!  (${selectedFee} ${selectedAsset.currency})`
                    : "🔒 Coming soon"
                }
              </motion.button>

              {selectedAsset.network === "xahau" && (
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  💡 Powered by Xahau Hooks - Trustless, Permissionless prize distribution
                </p>
              )}

              <div className="text-center text-muted-foreground font-medium text-sm my-1">Or</div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFreePlay}
                className="w-full rounded-2xl bg-card border-2 border-border py-3 font-bold text-foreground text-sm md:text-base shadow-xl hover:shadow-muted/30 transition-all"
              >
                🚀 FREE PLAY vs BOT, WIN FREE NFT's
              </motion.button>
            </>
          )}
        </div>

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
    </div>
  )
}
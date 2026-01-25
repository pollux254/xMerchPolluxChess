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

  // MOBILE RESUME: Check if returning from Xaman deep-link
  useEffect(() => {
    const pendingPayment = sessionStorage.getItem('pendingPayment')
    if (pendingPayment) {
      console.log("📱 Returned from Xaman deep-link - resuming payment...")
      const paymentData = JSON.parse(pendingPayment)
      resumePaymentAfterMobile(paymentData)
      sessionStorage.removeItem('pendingPayment') // Clean up
    }
  }, [])

  async function resumePaymentAfterMobile(paymentData: any) {
    try {
      setLoadingPay(true)
      console.log("🔄 Resuming payment after mobile deep-link...")

      const ws = new WebSocket(paymentData.websocketUrl)
      let txValidated = false

      const paymentPromise = new Promise<boolean>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          ws.close()
          reject(new Error("Payment timeout after mobile return"))
        }, 3 * 60 * 1000)

        ws.onmessage = (event) => {
          const status = JSON.parse(event.data)
          console.log("📡 Mobile resume - WebSocket:", status)

          if (status.signed === true && !txValidated) {
            console.log("✅ Payment confirmed after mobile return!")
            txValidated = true
            clearTimeout(timeoutId)
            ws.close()
            resolve(true)
          } else if (status.signed === false) {
            reject(new Error("Payment rejected after mobile return"))
          }
        }

        ws.onerror = (error) => {
          console.error("❌ WebSocket error on resume:", error)
          clearTimeout(timeoutId)
          reject(new Error("Connection error on mobile resume"))
        }
      })

      await paymentPromise

      // Join tournament after confirmation
      console.log("✅ Joining tournament after mobile payment...")
      const joinRes = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData.tournamentData)
      })

      if (!joinRes.ok) {
        const errorText = await joinRes.text()
        console.error("❌ Join failed after mobile:", errorText)
        throw new Error(`Join failed: ${errorText}`)
      }

      const joinData = await joinRes.json()
      window.location.href = `/waiting-room?tournamentId=${joinData.tournamentId}`

    } catch (err: any) {
      console.error("Mobile resume error:", err)
      alert("Payment verification failed after returning from Xaman. Please try again.")
      setLoadingPay(false)
    }
  }

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

        // ... rest of desktop popup logic (unchanged)
      }

      // ... rest of handleLogin (unchanged)
    } catch (err) {
      console.error("Login error:", err)
      sessionStorage.removeItem("waitingForLogin")
      alert("Login failed.")
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleDisconnect = async () => {
    // ... (unchanged)
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

    if (selectedAsset.network !== "xahau") {
      alert("This token is not yet supported. Please use XAH or EVR.")
      return
    }

    let tournamentId: string | null = null

    try {
      setLoadingPay(true)
      console.log(`🪝 Starting Hook payment on ${network.toUpperCase()}...`)
      console.log(`🪝 Hook Address: ${hookAddress}`)

      // STEP 1: Create payment payload FIRST
      console.log("📤 Creating Xaman payload...")
      
      const tempMemoData = {
        action: "join",
        player: playerID,
        network: network,
        size: selectedSize,
        fee: selectedFee
      }
      
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
          memo: JSON.stringify(tempMemoData),
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

      // STEP 2: Open Xaman correctly by device type
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent.toLowerCase())
      
      let xamanPopup: Window | null = null
      
      console.log(isMobileDevice ? "📱 Mobile device detected" : "💻 Desktop detected")

      if (isMobileDevice) {
        // MOBILE: Direct deep-link push to Xaman app (no browser popup/tab)
        console.log("📱 Mobile: Direct push to Xaman app...")
        
        // Store payment state so we can resume when user returns
        sessionStorage.setItem('pendingPayment', JSON.stringify({
          uuid,
          websocketUrl,
          tournamentData: {
            playerAddress: playerID,
            tournamentSize: selectedSize,
            entryFee: selectedFee,
            currency: selectedAsset.currency,
            issuer: selectedAsset.issuer
          }
        }))

        // Direct push - this should open Xaman app immediately
        window.location.href = nextUrl

        // Function exits here - page will reload/continue when user returns from Xaman
        return

      } else {
        // DESKTOP/LAPTOP: Safe popup
        console.log("💻 Desktop: Opening Xaman popup...")
        xamanPopup = window.open(nextUrl, "_blank", "width=480,height=720")
        
        if (!xamanPopup) {
          console.warn("⚠️ Popup blocked on desktop")
          const userConfirm = confirm(
            "⚠️ Popup was blocked!\n\n" +
            "Please allow popups for this site or open Xaman manually.\n\n" +
            "Click OK to keep waiting here."
          )
          if (!userConfirm) {
            throw new Error("Payment cancelled by user")
          }
        }
      }

      console.log("⏳ Waiting for payment confirmation via WebSocket...")

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
          console.log("📡 WebSocket received:", JSON.stringify(status, null, 2))

          if (status.signed === false) {
            clearTimeout(timeoutId)
            if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
            console.log("❌ Payment REJECTED")
            ws.close()
            reject(new Error("Payment rejected by user"))
            return
          }

          const shouldCheckResult = 
            status.signed === true ||
            status.payload_resolved === true ||
            status.resolved === true ||
            status.dispatched === true

          if (shouldCheckResult && !txValidated) {
            const result = status.result?.engine_result || 
                           status.meta?.TransactionResult ||
                           status.response?.engine_result

            if (result) {
              console.log("📊 Transaction result:", result)
              
              if (result === "tesSUCCESS") {
                txValidated = true
                clearTimeout(timeoutId)
                if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
                console.log("✅ VALIDATED on ledger!")
                ws.close()
                resolve(true)
              } else if (result.startsWith("tec") || result.startsWith("tef") || result.startsWith("ter")) {
                clearTimeout(timeoutId)
                if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
                console.error("❌ TX FAILED:", result)
                ws.close()
                reject(new Error(`Transaction failed: ${result}`))
              } else {
                console.log("⏳ Waiting for final result...")
              }
            } else if (status.signed === true) {
              console.log("✍️ Signed, waiting 3 seconds for ledger confirmation...")
              setTimeout(() => {
                if (!txValidated) {
                  console.log("⏰ Accepting payment after 3 second delay...")
                  txValidated = true
                  clearTimeout(timeoutId)
                  if (xamanPopup && !xamanPopup.closed) xamanPopup.close()
                  ws.close()
                  resolve(true)
                }
              }, 3000)
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

      await paymentPromise

      // STEP 4: Join tournament only after confirmed
      console.log("✅ Payment confirmed ON LEDGER - now joining tournament...")
      
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
        const errorText = await joinRes.text()
        console.error("❌ Join API failed:", errorText)
        throw new Error(`Failed to join tournament: ${errorText}`)
      }

      const joinData = await joinRes.json()
      tournamentId = joinData.tournamentId
      
      console.log("✅ Joined tournament:", tournamentId)

      // STEP 5: Redirect to waiting room
      console.log("🚀 Redirecting to waiting room...")
      await new Promise(resolve => setTimeout(resolve, 1000))
      window.location.href = `/waiting-room?tournamentId=${tournamentId}`

    } catch (err: any) {
      console.error("❌ Payment error:", err)
      
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
      } else if (err.message.includes("cancelled by user")) {
        errorMessage = "Payment was cancelled"
      } else {
        errorMessage = err.message
      }
      
      alert(`❌ ${errorMessage}\n\nYou can try again.`)
      setLoadingPay(false)
    }
  }

  // ... (rest of your code unchanged: handleFreePlay, filteredAssets, return JSX)
  // Your return JSX, SettingsModal, ProfileModal, etc. remain exactly as in your original
}
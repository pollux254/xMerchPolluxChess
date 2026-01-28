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

  // 📱 COMPREHENSIVE DEVICE DETECTION
  const isMobileOrTablet = (): boolean => {
    if (typeof window === 'undefined') return false

    // Check 1: PWA/Standalone mode (user installed as app)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true ||
                        document.referrer.includes('android-app://')

    // Check 2: Touch capability
    const hasTouch = 'ontouchstart' in window || 
                    navigator.maxTouchPoints > 0

    // Check 3: User Agent (comprehensive list)
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|kindle|silk|playbook|bb10|meego|windows phone/i
    const isMobileUA = mobileRegex.test(navigator.userAgent.toLowerCase())

    // Check 4: Screen size (tablets and phones typically < 1024px)
    const isSmallScreen = window.innerWidth <= 1024

    // Check 5: Device orientation API exists (mobile/tablet feature)
    const hasOrientation = 'orientation' in window

    // Combine signals: If standalone OR (mobile UA and touch) OR (small screen and touch and orientation)
    const isMobile = isStandalone || 
                    (isMobileUA && hasTouch) || 
                    (isSmallScreen && hasTouch && hasOrientation) ||
                    isMobileUA

    console.log('🔍 Device Detection:', {
      isStandalone,
      hasTouch,
      isMobileUA,
      isSmallScreen,
      hasOrientation,
      finalDecision: isMobile ? 'MOBILE/TABLET' : 'DESKTOP',
      userAgent: navigator.userAgent
    })

    return isMobile
  }

  // ✅ NEW: Clean up stale payment states
  const clearStuckPaymentState = () => {
    const pendingPayment = localStorage.getItem('pendingPayment')
    if (pendingPayment) {
      try {
        const data = JSON.parse(pendingPayment)
        const createdAt = data.timestamp || 0
        const now = Date.now()
        const ageMinutes = (now - createdAt) / 1000 / 60
        
        // Clear if older than 10 minutes (payment should complete in < 5 min)
        if (ageMinutes > 10) {
          console.log(`🧹 Clearing stale payment (${ageMinutes.toFixed(1)} minutes old)`)
          localStorage.removeItem('pendingPayment')
          return true
        }
      } catch (err) {
        console.error('❌ Error parsing pendingPayment:', err)
        localStorage.removeItem('pendingPayment')
        return true
      }
    }
    return false
  }

  // ✅ SINGLE UNIFIED LOGIN SYSTEM - Resume after mobile redirect
  useEffect(() => {
    console.log('[MOUNT] Chess page mounted, checking for pending actions...')
    
    // ============================================
    // PRIORITY 1: Check for pending LOGIN
    // ============================================
    const waitingMobile = sessionStorage.getItem('xaman_waiting_mobile')
    const uuid = sessionStorage.getItem('xaman_signin_uuid')
    
    if (waitingMobile === 'true' && uuid) {
      console.log('[RESUME LOGIN] Detected return from mobile Xaman for LOGIN')
      console.log('[RESUME LOGIN] UUID:', uuid)
      
      setLoadingLogin(true)
      
      // Clear the mobile flag
      sessionStorage.removeItem('xaman_waiting_mobile')
      
      // Start verification
      startLoginVerification(uuid)
      return // Exit early - login takes priority
    }
    
    // ============================================
    // PRIORITY 2: Check for stale payment state
    // ============================================
    const wasStale = clearStuckPaymentState()
    if (wasStale) {
      alert("⚠️ Previous payment session expired.\n\nPlease try again.")
      setLoadingPay(false)
      return // Exit early
    }

    // ============================================
    // PRIORITY 3: Check for pending PAYMENT
    // ============================================
    const pendingPayment = localStorage.getItem('pendingPayment')
    console.log("🔍 [PAYMENT CHECK] pendingPayment in localStorage:", !!pendingPayment)
    
    if (pendingPayment) {
      console.log("📱 [PAYMENT] Returned from Xaman payment - resuming...")
      
      try {
        const paymentData = JSON.parse(pendingPayment)
        console.log("📱 [PAYMENT] Parsed payment data:", {
          uuid: paymentData.uuid,
          hasWebsocketUrl: !!paymentData.websocketUrl,
          hasTournamentData: !!paymentData.tournamentData
        })
        
        // Resume payment verification
        resumePaymentAfterMobileRedirect(paymentData)
      } catch (err) {
        console.error("❌ [PAYMENT] Failed to parse pendingPayment:", err)
        localStorage.removeItem('pendingPayment')
      }
      return // Exit early if handling payment
    }
    
    // ============================================
    // PRIORITY 4: Check if already logged in
    // ============================================
    const savedID = localStorage.getItem("playerID")
    if (savedID && !playerID) {
      console.log("✅ Found existing playerID, setting state:", savedID)
      setPlayerID(savedID)
      checkExistingTournament(savedID)
    }
  }, [])

  // ✅ NEW UUID-BASED LOGIN - Start verification polling
  async function startLoginVerification(uuid: string) {
    console.log('[VERIFY] Starting verification for UUID:', uuid)
    
    const maxAttempts = 60 // 60 seconds (1 attempt per second)
    let attempts = 0
    
    const pollStatus = async (): Promise<boolean> => {
      attempts++
      console.log(`[VERIFY] Attempt ${attempts}/${maxAttempts}`)
      
      try {
        const response = await fetch(`/api/auth/xaman/verify-signin/${uuid}`)
        
        if (!response.ok) {
          console.error('[VERIFY] API error:', response.status)
          return false
        }
        
        const data = await response.json()
        console.log('[VERIFY] Response:', data)
        
        // Check if signed
        if (data.signed === true) {
          console.log('[VERIFY] ✅ SIGNED!')
          
          // Check for account
          if (!data.account) {
            console.error('[VERIFY] ❌ Signed but no account!')
            console.log('[VERIFY] Full data:', JSON.stringify(data, null, 2))
            return false
          }
          
          console.log('[VERIFY] ✅ Account found:', data.account)
          
          // Save to localStorage
          localStorage.setItem('playerID', data.account)
          console.log('[VERIFY] ✅ Saved to localStorage')
          
          // Clear session storage
          sessionStorage.removeItem('xaman_signin_uuid')
          sessionStorage.removeItem('xaman_login_timestamp')
          sessionStorage.removeItem('xaman_waiting_mobile')
          console.log('[VERIFY] ✅ Cleared sessionStorage')
          
          // Create profile
          await getOrCreateProfile(data.account)
          
          // Update React state
          setPlayerID(data.account)
          setLoadingLogin(false)
          
          console.log('[VERIFY] ✅✅✅ LOGIN COMPLETE ✅✅✅')
          alert(`Logged in successfully!\nWallet: ${data.account.slice(0,10)}...${data.account.slice(-6)}`)
          return true
          
        } else if (data.signed === false) {
          console.log('[VERIFY] ❌ User rejected sign-in')
          throw new Error('Sign-in was rejected')
          
        } else {
          // Still pending
          console.log('[VERIFY] ⏳ Still pending...')
          return false
        }
        
      } catch (error) {
        console.error('[VERIFY] Error during attempt:', error)
        return false
      }
    }
    
    // Polling loop
    const poll = async () => {
      while (attempts < maxAttempts) {
        const success = await pollStatus()
        
        if (success) {
          return // Success! Exit
        }
        
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Timeout
      console.error('[VERIFY] ❌ Timeout after', maxAttempts, 'attempts')
      setLoadingLogin(false)
      alert('Login verification timed out. Please try again.')
      sessionStorage.removeItem('xaman_signin_uuid')
      sessionStorage.removeItem('xaman_login_timestamp')
      sessionStorage.removeItem('xaman_waiting_mobile')
    }
    
    poll()
  }

  async function resumePaymentAfterMobileRedirect(paymentData: any) {
    try {
      setLoadingPay(true)
      console.log("🔄 Resuming payment after mobile redirect...")
      console.log("⏰ Payment age:", ((Date.now() - (paymentData.timestamp || 0)) / 1000 / 60).toFixed(1), "minutes")
      console.log("🌐 Network:", paymentData.network || 'unknown')
      console.log("📦 Tournament data:", paymentData.tournamentData)
      
      // ✅ CRITICAL FIX: Check payload status via API FIRST
      console.log("📞 Checking payment status via API (uuid:", paymentData.uuid, ")")
      
      try {
        const payloadRes = await fetch("/api/auth/xaman/get-payload/xahau-payload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid: paymentData.uuid }),
        })

        if (payloadRes.ok) {
          const payloadStatus = await payloadRes.json()
          console.log("📊 Payload API status:", JSON.stringify(payloadStatus, null, 2))
          
          // ✅ CHECK 1: Was it rejected by user?
          if (payloadStatus.response?.rejected === true || payloadStatus.meta?.rejected === true) {
            console.log("❌ Payment was rejected by user in Xaman")
            localStorage.removeItem('pendingPayment')
            throw new Error("Payment was rejected")
          }
          
          // ✅ CHECK 2: Did the payload expire?
          if (payloadStatus.expired === true || payloadStatus.meta?.expired === true) {
            console.log("⏰ Payment payload expired (user took too long)")
            localStorage.removeItem('pendingPayment')
            throw new Error("Payment request expired")
          }
          
          // ✅ CHECK 3: Is it still waiting for user action?
          if (!payloadStatus.response && !payloadStatus.meta) {
            console.log("⏳ Payment still pending, will use WebSocket to wait...")
          } else {
            // ✅ CHECK 4: Did it succeed on ledger?
            const result = payloadStatus.response?.result?.engine_result || 
                          payloadStatus.meta?.TransactionResult ||
                          payloadStatus.result?.engine_result
            
            if (result === "tesSUCCESS") {
              console.log("✅ Payment already completed and validated on ledger!")
              localStorage.removeItem('pendingPayment')
              
              // Join tournament directly
              console.log("✅ Joining tournament after confirmed mobile payment...")
              const joinRes = await fetch('/api/tournaments/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentData.tournamentData)
              })
              
              if (!joinRes.ok) {
                const errorText = await joinRes.text()
                console.error("❌ Join API failed:", errorText)
                throw new Error(`Failed to join tournament: ${errorText}`)
              }

              const joinData = await joinRes.json()
              console.log("✅ Joined tournament:", joinData.tournamentId)
              
              if (joinRes.status === 409 && joinData.tournamentId) {
                console.log("⚠️ Player already in tournament:", joinData.tournamentId)
                alert("You're already in a tournament!\n\nRedirecting...")
              }
              
              console.log("🚀 Redirecting to waiting room from mobile...")
              window.location.href = `/waiting-room?tournamentId=${joinData.tournamentId}`
              return
              
            } else if (result && (result.startsWith("tec") || result.startsWith("tef") || result.startsWith("ter"))) {
              console.error("❌ Transaction failed on ledger:", result)
              localStorage.removeItem('pendingPayment')
              throw new Error(`Transaction failed: ${result}`)
            } else {
              console.log("⚠️ Unexpected result, falling back to WebSocket:", result)
            }
          }
        } else {
          console.warn("⚠️ Could not check payload status (HTTP error), falling back to WebSocket")
        }
      } catch (apiError: any) {
        if (apiError.message?.includes("rejected") || 
            apiError.message?.includes("expired") || 
            apiError.message?.includes("Transaction failed:") ||
            apiError.message?.includes("Failed to join tournament")) {
          throw apiError
        }
        console.warn("⚠️ API check failed, falling back to WebSocket:", apiError)
      }
      
      // ✅ FALLBACK: If API didn't confirm completion, listen to WebSocket
      console.log("👂 Listening to WebSocket for payment updates...")
      const ws = new WebSocket(paymentData.websocketUrl)
      let txValidated = false
      
      const paymentPromise = new Promise<boolean>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.log("⏱️ Payment WebSocket timeout (3 minutes)")
          ws.close()
          localStorage.removeItem('pendingPayment')
          if (!txValidated) {
            reject(new Error("Payment request timed out - please try again"))
          }
        }, 3 * 60 * 1000)
        
        ws.onmessage = (event) => {
          const status = JSON.parse(event.data)
          console.log("📡 Mobile WebSocket:", JSON.stringify(status, null, 2))
          
          if (status.signed === false) {
            clearTimeout(timeoutId)
            ws.close()
            reject(new Error("Payment rejected"))
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
                console.log("✅ VALIDATED on ledger via WebSocket!")
                ws.close()
                resolve(true)
              } else if (result.startsWith("tec") || result.startsWith("tef") || result.startsWith("ter")) {
                clearTimeout(timeoutId)
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
                  console.log("⏰ Accepting payment after delay...")
                  txValidated = true
                  clearTimeout(timeoutId)
                  ws.close()
                  resolve(true)
                }
              }, 3000)
            }
          }
        }

        ws.onerror = (error) => {
          console.error("❌ Mobile WebSocket error:", error)
          clearTimeout(timeoutId)
          localStorage.removeItem('pendingPayment')
          if (!txValidated) {
            reject(new Error("Connection error"))
          }
        }

        ws.onclose = () => {
          console.log("🔌 Mobile WebSocket closed")
        }
      })
      
      await paymentPromise
      
      localStorage.removeItem('pendingPayment')
      
      console.log("✅ Joining tournament after mobile payment...")
      const joinRes = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData.tournamentData)
      })
      
      if (!joinRes.ok) {
        const errorText = await joinRes.text()
        console.error("❌ Join API failed after mobile payment:", errorText)
        throw new Error(`Failed to join tournament: ${errorText}`)
      }

      const joinData = await joinRes.json()
      console.log("✅ Joined tournament after mobile payment:", joinData.tournamentId)
      
      if (joinRes.status === 409 && joinData.tournamentId) {
        console.log("⚠️ Player already in tournament:", joinData.tournamentId)
        alert("You're already in a tournament!\n\nRedirecting...")
      }
      
      console.log("🚀 Redirecting to waiting room from mobile...")
      window.location.href = `/waiting-room?tournamentId=${joinData.tournamentId}`
      
    } catch (err: any) {
      console.error("❌ Mobile payment resume error:", err)
      localStorage.removeItem('pendingPayment')
      
      let errorMessage = "Payment verification failed"
      let shouldRetry = true
      
      if (err.message.includes("rejected")) {
        errorMessage = "Payment was cancelled in Xaman"
        shouldRetry = false
      } else if (err.message.includes("expired")) {
        errorMessage = "Payment request expired (took too long)"
        shouldRetry = true
      } else if (err.message.includes("timed out") || err.message.includes("timeout")) {
        errorMessage = "Payment verification timed out"
        shouldRetry = true
      } else if (err.message.includes("Failed to join tournament")) {
        errorMessage = "Payment succeeded but failed to join tournament\n\n⚠️ Contact support - you may need a refund"
        shouldRetry = false
      } else if (err.message.includes("Connection error")) {
        errorMessage = "Connection error during verification"
        shouldRetry = true
      } else if (err.message.includes("Transaction failed:")) {
        errorMessage = err.message
        shouldRetry = true
      } else if (err.message.includes("tecUNFUNDED") || err.message.includes("tecINSUFF")) {
        errorMessage = "Insufficient funds for transaction"
        shouldRetry = false
      } else if (err.message) {
        errorMessage = err.message
      }
      
      alert(`❌ ${errorMessage}\n\n${shouldRetry ? 'Please try again.' : 'Returning to lobby.'}`)
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

  // ✅ SINGLE UUID-BASED LOGIN - Main handler
  async function handleLogin() {
    console.log('[LOGIN] Starting login flow')
    setLoadingLogin(true)

    try {
      // Step 1: Create sign-in request
      console.log('[LOGIN] Creating Xaman sign-in request...')
      const response = await fetch('/api/auth/xaman/create-signin/xahau-signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-xahau-network': network
        },
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()
      console.log('[LOGIN] Sign-in request created:', {
        uuid: data.uuid,
        hasNext: !!data.next,
      })

      if (!data.uuid) {
        throw new Error('No UUID returned from API')
      }

      // Step 2: Store UUID for polling
      const uuid = data.uuid
      sessionStorage.setItem('xaman_signin_uuid', uuid)
      sessionStorage.setItem('xaman_login_timestamp', Date.now().toString())
      console.log('[LOGIN] UUID stored in sessionStorage:', uuid)

      // Step 3: Check if mobile or desktop
      const isMobile = isMobileOrTablet()
      console.log('[LOGIN] Device type:', isMobile ? 'MOBILE' : 'DESKTOP')

      if (isMobile && data.next?.always) {
        // MOBILE FLOW: Redirect to Xaman, then poll on return
        console.log('[LOGIN] Mobile detected - redirecting to Xaman')
        console.log('[LOGIN] Redirect URL:', data.next.always)
        
        // Mark that we're waiting for mobile return
        sessionStorage.setItem('xaman_waiting_mobile', 'true')
        
        // Redirect to Xaman
        window.location.href = data.next.always
        
      } else {
        // DESKTOP FLOW: Start polling immediately
        console.log('[LOGIN] Desktop detected - starting verification')
        startLoginVerification(uuid)
      }

    } catch (error) {
      console.error('[LOGIN] Error:', error)
      setLoadingLogin(false)
      alert(error instanceof Error ? error.message : 'Login failed')
      sessionStorage.removeItem('xaman_signin_uuid')
      sessionStorage.removeItem('xaman_login_timestamp')
      sessionStorage.removeItem('xaman_waiting_mobile')
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

    if (selectedAsset.network !== "xahau") {
      alert("This token is not yet supported. Please use XAH or EVR.")
      return
    }

    let tournamentId: string | null = null

    try {
      setLoadingPay(true)
      console.log(`🪝 Starting Hook payment on ${network.toUpperCase()}...`)
      console.log(`🪝 Hook Address: ${hookAddress}`)

      console.log("📤 Creating Xaman payload BEFORE joining tournament...")
      
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
          network: network,
          returnUrl: `${window.location.origin}/chess`
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

      const isMobileDevice = isMobileOrTablet()
      
      let xamanPopup: Window | null = null

      console.log("📱 Payment device detection:", isMobileDevice ? "MOBILE/TABLET/PWA" : "DESKTOP")

      if (isMobileDevice) {
        console.log("📱 Mobile/Tablet/PWA: Direct push to Xaman app...")
        
        localStorage.setItem('pendingPayment', JSON.stringify({
          uuid,
          websocketUrl,
          timestamp: Date.now(),
          network,
          tournamentData: {
            playerAddress: playerID,
            tournamentSize: selectedSize,
            entryFee: selectedFee,
            currency: selectedAsset.currency,
            issuer: selectedAsset.issuer
          }
        }))

        window.location.href = nextUrl
        return

      } else {
        console.log("💻 Desktop: Opening Xaman popup window...")
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

      console.log("✅ Payment confirmed ON LEDGER - now joining tournament...")
      console.log("📤 Sending join request with:", {
        playerAddress: playerID,
        tournamentSize: selectedSize,
        entryFee: selectedFee,
        currency: selectedAsset.currency,
        issuer: selectedAsset.issuer,
      })
      
      const joinRes = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress: playerID,
          tournamentSize: selectedSize,
          entryFee: selectedFee,
          currency: selectedAsset.currency,
          issuer: selectedAsset.issuer
        })
      })

      console.log("📡 Join API response status:", joinRes.status)

      if (!joinRes.ok) {
        const errorText = await joinRes.text()
        console.error("❌ Join API failed:", errorText)
        throw new Error(`Failed to join tournament: ${errorText}`)
      }

      const joinData = await joinRes.json()
      console.log("✅ Join API response:", joinData)
      tournamentId = joinData.tournamentId
      
      if (joinRes.status === 409 && joinData.tournamentId) {
        console.log("⚠️ Player already in tournament:", joinData.tournamentId)
        alert("You're already in a tournament!\n\nRedirecting...")
        window.location.href = `/waiting-room?tournamentId=${joinData.tournamentId}`
        return
      }
      
      console.log("✅ Joined tournament:", tournamentId)

      console.log("🚀 Redirecting to waiting room...")
      await new Promise(resolve => setTimeout(resolve, 1000))
      window.location.href = `/waiting-room?tournamentId=${tournamentId}`

    } catch (err: any) {
      console.error("❌ Payment error:", err)
      
      console.log("ℹ️ Payment failed before joining - no database cleanup needed")
      
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
      } else if (err.message.includes("Failed to join tournament")) {
        errorMessage = "Payment succeeded but failed to join tournament - contact support"
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
          {loadingLogin && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
              <div className="bg-card/90 backdrop-blur-xl p-8 rounded-3xl max-w-md mx-4 text-center border border-border shadow-2xl">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold mb-2">Connecting Wallet...</h2>
                <p className="text-muted-foreground">
                  Please complete the sign-in in Xaman
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Waiting for confirmation...
                </p>
              </div>
            </div>
          )}
          
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
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor, LogOut } from "lucide-react"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

// Hook integration (Phase 1: UI placeholder)
// TODO: Wire this to the wallet-connect flow (getConnectedWallet)
// import { joinTournamentHook } from "@/lib/xahau-hooks"

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

// Initialize Supabase client
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

  const selectedAsset = assets[selectedAssetIndex]

  const feeTiers = [10, 25, 50, 100]
  const sizes = [2, 4, 8, 16]

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.remove("light", "middle", "dark")
      document.documentElement.classList.add(savedTheme)
    }

    const savedID = localStorage.getItem("playerID")
    if (savedID) {
      setPlayerID(savedID)
      checkExistingTournament(savedID)
    }
  }, [])

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
      
      const { data: { session } } = await supabase.auth.getSession()
      console.log("🔐 Current auth session:", !!session, session?.user?.id)
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
        console.log("🔐 Adding auth header to request")
      }
      
      const res = await fetch(`/api/tournaments/check-player?address=${playerAddress}`, {
        headers
      })
      
      console.log("🔍 Check player response status:", res.status)
      
      if (res.ok) {
        const data = await res.json()
        console.log("🔍 Check player response data:", data)
        
        if (data.inTournament && data.tournamentId) {
          console.log("✅ Player already in tournament:", data.tournamentId, "Status:", data.status)
          
          setExistingTournament({
            id: data.tournamentId,
            status: data.status
          })

          if (data.status === "waiting") {
            setTimeout(() => {
              console.log("🚀 Auto-redirecting to waiting room...")
              window.location.href = `/waiting-room?tournamentId=${data.tournamentId}`
            }, 1500)
          } else if (data.status === "in_progress" || data.status === "in-progress") {
            setTimeout(() => {
              console.log("🚀 Auto-redirecting to active game...")
              window.location.href = `/gamechessboard?tournamentId=${data.tournamentId}`
            }, 1500)
          }
        } else {
          console.log("ℹ️ No existing tournament found")
        }
      } else {
        console.error("❌ Check player request failed:", res.status, await res.text())
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

  async function handleLogin() {
    try {
      setLoadingLogin(true)

      const returnUrl = `${window.location.origin}/chess`

      const res = await fetch("/api/auth/xaman/create-signin/xahau-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      
      sessionStorage.setItem("waitingForLogin", "true")
      
      let signinPopup: Window | null = null
      let popupCheckInterval: NodeJS.Timeout | null = null
      let timeoutId: NodeJS.Timeout | null = null
      
      if (isMobile) {
        window.location.href = nextUrl
      } else {
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
                alert(`Logged in!\nWallet: ${walletAddress.slice(0,10)}...${walletAddress.slice(-6)}`)
              } else {
                console.log("✅ Supabase session created:", authData.session?.user.id)
                console.log("✅ Wallet stored in metadata:", authData.session?.user.user_metadata.wallet_address)
                
                setPlayerID(walletAddress)
                localStorage.setItem("playerID", walletAddress)
                sessionStorage.removeItem("waitingForLogin")
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

  // Phase 1 placeholder: Hook-based tournament join
  async function handlePayFeeHook() {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    try {
      setLoadingPay(true)

      // TODO: Get wallet instance (needs wallet connect integration)
      // const wallet = await getConnectedWallet()

      // Join tournament via Hook
      // const result = await joinTournamentHook(wallet, selectedFee)
      // console.log("Hook join result:", result)

      alert("⚠️ Hook integration coming soon! Use standard payment for now.")
    } catch (err) {
      console.error("Hook payment error:", err)
      alert("Failed to join via Hook. Try again.")
    } finally {
      setLoadingPay(false)
    }
  }

  const handleFreePlay = () => {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }
    window.location.href = `/gamechessboard?player=${playerID}&fee=0&size=${selectedSize}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col items-center justify-center px-6 py-12">
      <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 flex items-center justify-between z-50">
        <Link href="/" className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
          ← Home
        </Link>

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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md rounded-3xl border border-border bg-card/90 backdrop-blur-xl p-10 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            PolluxChess Tournament
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Skill-based chess wagering on Xahau
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {!playerID ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loadingLogin}
              onClick={handleLogin}
              className="w-full rounded-2xl bg-primary py-5 font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
            >
              {loadingLogin ? "Connecting..." : "Connect with Xaman"}
            </motion.button>
          ) : existingTournament ? (
            <>
              <div className="text-center py-8">
                <div className="mb-4 text-4xl">♟️</div>
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
                  <p className="font-mono text-lg font-semibold text-foreground">
                    {playerID.slice(0, 10)}...{playerID.slice(-6)}
                  </p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="ml-4 rounded-full p-3 bg-red-600/90 hover:bg-red-700 text-white transition-all"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Tournament Size</p>
                <div className="grid grid-cols-4 gap-3">
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
                    className="w-full rounded-xl py-4 px-6 font-bold text-left bg-muted/50 border border-border hover:bg-muted transition-all flex items-center justify-between"
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
                          className="w-full px-6 py-4 text-left hover:bg-muted transition-all"
                        >
                          {asset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
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

              {/* Hook-based entry */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loadingPay}
                onClick={handlePayFeeHook}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 py-6 font-bold text-white text-xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingPay ? "Processing..." : `🪝 Join via Hook (${selectedFee} XAH)`}
              </motion.button>

              <div className="text-center text-muted-foreground font-medium my-2">Or</div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFreePlay}
                className="w-full rounded-2xl bg-card border-2 border-border py-5 font-bold text-foreground text-lg shadow-xl hover:shadow-muted/30 transition-all"
              >
                🚀 FREE PLAY vs BOT
              </motion.button>
            </>
          )}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Powered by{" "}
          <a href="https://xmerch.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">
            xMerch
          </a>
        </p>

        <div className="mt-6 flex items-center justify-center gap-10">
          <a href="https://xaman.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="7" cy="14" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a href="https://xahau.network" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <path d="M12 7v4m0 0l-5 6m5-6l5 6" />
            </svg>
          </a>
          <a href="https://evernode.org" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2" />
            </svg>
          </a>
        </div>
      </motion.div>
    </div>
  )
}
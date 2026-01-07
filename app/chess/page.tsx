"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor, LogOut } from "lucide-react"
import Link from "next/link"

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

export default function Chess() {
  const [playerID, setPlayerID] = useState<string | null>(null)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loadingPay, setLoadingPay] = useState(false)
  const [selectedFee, setSelectedFee] = useState<number>(10)
  const [selectedSize, setSelectedSize] = useState<number>(1)
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0)
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [theme, setTheme] = useState<Theme>("light")

  const selectedAsset = assets[selectedAssetIndex]

  const feeTiers = [10, 25, 50, 100]
  const sizes = [1, 4, 8, 16]

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.remove("light", "middle", "dark")
      document.documentElement.classList.add(savedTheme)
    }

    const savedID = localStorage.getItem("playerID")
    if (savedID) setPlayerID(savedID)
  }, [])

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.remove("light", "middle", "dark")
    document.documentElement.classList.add(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  async function handleLogin() {
    try {
      setLoadingLogin(true)

      // FIX 1: Add returnUrl to stay on /chess page after signin
      const returnUrl = `${window.location.origin}/chess`

      const res = await fetch("/api/auth/xaman/create-signin/xahau-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl }), // Pass returnUrl
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
      
      // FIX 2: Store that we're waiting for login
      sessionStorage.setItem("waitingForLogin", "true")
      
      if (isMobile) {
        // Mobile: redirect to Xaman app, it will return to /chess
        window.location.href = nextUrl
      } else {
        // Desktop: open in popup
        window.open(nextUrl, "_blank", "width=480,height=720")
      }

      const ws = new WebSocket(websocketUrl)
      ws.onmessage = async (event) => {
        const status = JSON.parse(event.data)

        if (status.signed === true) {
          try {
            const payloadRes = await fetch("/api/auth/xaman/get-payload/xahau-payload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uuid }),
            })

            if (!payloadRes.ok) throw new Error(await payloadRes.text())
            const payloadData = await payloadRes.json()

            if (payloadData.account) {
              setPlayerID(payloadData.account)
              localStorage.setItem("playerID", payloadData.account)
              sessionStorage.removeItem("waitingForLogin")
              alert(`Logged in successfully!\nPlayer ID: ${payloadData.account}`)
            }
          } catch (err) {
            console.error("Failed to get account:", err)
            alert("Signed, but couldn't retrieve address.")
          }
          ws.close()
        } else if (status.signed === false || status.expired) {
          sessionStorage.removeItem("waitingForLogin")
          alert(status.signed === false ? "Sign-in rejected." : "Sign-in expired.")
          ws.close()
        }
      }
    } catch (err) {
      console.error("Login error:", err)
      sessionStorage.removeItem("waitingForLogin")
      alert("Login failed.")
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleDisconnect = () => {
    setPlayerID(null)
    localStorage.removeItem("playerID")
    alert("Wallet disconnected successfully!")
  }

  async function handlePayFee() {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    try {
      setLoadingPay(true)
      const memo = `Chess Tournament - ${selectedSize === 1 ? '1v1' : `${selectedSize} Players`} - Fee ${selectedFee} ${selectedAsset.currency}`

      // Add return URL for mobile flow
      const returnUrl = `${window.location.origin}/chess`

      const payloadBody: any = {
        amount: selectedFee,
        currency: selectedAsset.currency,
        memo,
        player: playerID,
        size: selectedSize,
        returnUrl, // Add this so Xaman knows where to return
      }

      if (selectedAsset.issuer) {
        payloadBody.issuer = selectedAsset.issuer
      }

      const res = await fetch("/api/auth/xaman/create-payload/xahau-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Payment payload error:", errorText)
        alert("Error preparing payment. Check console for details.")
        return
      }

      const data = await res.json()

      if (!data.nextUrl || !data.websocketUrl || !data.uuid) {
        console.error("Missing links from payload:", data)
        alert("Payment prepared but missing redirect links. Try again.")
        return
      }

      const { nextUrl, websocketUrl, uuid } = data

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768

      // FIX 3: Better mobile/desktop handling
      let xamanWin: Window | null = null
      let popupCheckInterval: NodeJS.Timeout | null = null
      let timeoutId: NodeJS.Timeout | null = null

      // For mobile phones (not tablets), do full redirect
      if (isMobile && !isTablet) {
        // Mobile: Store payment state before redirecting
        sessionStorage.setItem("waitingForPayment", uuid)
        sessionStorage.setItem("tournamentConfig", JSON.stringify({
          playerAddress: playerID,
          tournamentSize: selectedSize,
          entryFee: selectedFee,
          currency: selectedAsset.currency,
          issuer: selectedAsset.issuer || null
        }))
        
        // Full page redirect on mobile - no popup
        window.location.href = nextUrl
        return // Exit function - no WebSocket needed since we're leaving the page
      } else {
        // Desktop/Tablet: Open popup
        xamanWin = window.open(nextUrl, "_blank", "width=480,height=720")

        if (!xamanWin) {
          alert("Popup blocked. Please allow popups for Xaman sign-in.")
          setLoadingPay(false)
          return
        }

        // FIX 3A: Monitor if user manually closes popup
        popupCheckInterval = setInterval(() => {
          if (xamanWin && xamanWin.closed) {
            console.log("Popup was closed manually")
            clearInterval(popupCheckInterval!)
            if (timeoutId) clearTimeout(timeoutId)
            ws.close()
            setLoadingPay(false)
          }
        }, 500)

        // FIX 3B: Auto-close popup after 5 minutes (payload expiry)
        timeoutId = setTimeout(() => {
          if (xamanWin && !xamanWin.closed) {
            console.log("Popup timeout - auto closing")
            xamanWin.close()
          }
          if (popupCheckInterval) clearInterval(popupCheckInterval)
          ws.close()
          setLoadingPay(false)
          alert("Payment request expired. Please try again.")
        }, 5 * 60 * 1000) // 5 minutes
      }

      // Listen for payment success via WebSocket (desktop/tablet only)
      const ws = new WebSocket(websocketUrl)
      
      ws.onmessage = async (event) => {
        const status = JSON.parse(event.data)

        if (status.signed === true) {
          ws.close()
          
          // Clean up timers
          if (popupCheckInterval) clearInterval(popupCheckInterval)
          if (timeoutId) clearTimeout(timeoutId)
          
          // FIX 4: Close popup window on desktop
          if (xamanWin && !xamanWin.closed) {
            xamanWin.close()
          }
          
          // Payment successful! Now join tournament
          try {
            const joinRes = await fetch("/api/tournaments/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerAddress: playerID,
                tournamentSize: selectedSize,
                entryFee: selectedFee,
                currency: selectedAsset.currency,
                issuer: selectedAsset.issuer || null
              })
            })

            if (!joinRes.ok) {
              throw new Error("Failed to join tournament")
            }

            const joinData = await joinRes.json()

            if (joinData.success) {
              // Clean up session storage
              sessionStorage.removeItem("waitingForPayment")
              sessionStorage.removeItem("tournamentConfig")
              
              // Redirect to waiting room
              window.location.href = `/waiting-room?tournamentId=${joinData.tournamentId}`
            } else {
              alert("Payment successful but failed to join tournament. Contact support.")
              setLoadingPay(false)
            }
          } catch (err) {
            console.error("Tournament join error:", err)
            alert("Payment successful but failed to join tournament. Contact support.")
            setLoadingPay(false)
          }
        } else if (status.signed === false || status.expired) {
          // Clean up timers
          if (popupCheckInterval) clearInterval(popupCheckInterval)
          if (timeoutId) clearTimeout(timeoutId)
          
          // FIX 5: Close popup on rejection/expiry too
          if (xamanWin && !xamanWin.closed) {
            xamanWin.close()
          }
          alert(status.signed === false ? "Payment rejected." : "Payment expired.")
          ws.close()
          setLoadingPay(false)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        
        // Clean up timers
        if (popupCheckInterval) clearInterval(popupCheckInterval)
        if (timeoutId) clearTimeout(timeoutId)
        
        if (xamanWin && !xamanWin.closed) {
          xamanWin.close()
        }
        ws.close()
        setLoadingPay(false)
      }

      ws.onclose = () => {
        console.log("WebSocket closed")
        
        // Clean up timers when WebSocket closes
        if (popupCheckInterval) clearInterval(popupCheckInterval)
        if (timeoutId) clearTimeout(timeoutId)
      }
    } catch (err) {
      console.error("Payment error:", err)
      alert("Payment failed. Check console.")
      setLoadingPay(false)
    }
  }

  // FIX 6: Handle return from mobile Xaman
  useEffect(() => {
    const checkMobileReturn = async () => {
      const waitingForPayment = sessionStorage.getItem("waitingForPayment")
      const tournamentConfig = sessionStorage.getItem("tournamentConfig")
      
      if (waitingForPayment && tournamentConfig) {
        // User returned from mobile payment
        console.log("Detected return from mobile payment")
        setLoadingPay(true)
        
        // Small delay to ensure page is fully loaded
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        try {
          const config = JSON.parse(tournamentConfig)
          
          // Check payment status
          const payloadRes = await fetch("/api/auth/xaman/get-payload/xahau-payload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uuid: waitingForPayment }),
          })

          if (!payloadRes.ok) {
            throw new Error("Failed to check payment status")
          }
          
          const payloadData = await payloadRes.json()
          console.log("Payment status:", payloadData)
          
          if (payloadData.meta?.signed === true) {
            // Payment was successful, join tournament
            console.log("Payment successful, joining tournament...")
            
            const joinRes = await fetch("/api/tournaments/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config)
            })

            if (!joinRes.ok) {
              const errorText = await joinRes.text()
              console.error("Tournament join error:", errorText)
              throw new Error("Failed to join tournament")
            }

            const joinData = await joinRes.json()
            console.log("Tournament join response:", joinData)

            if (joinData.success) {
              // Clean up
              sessionStorage.removeItem("waitingForPayment")
              sessionStorage.removeItem("tournamentConfig")
              
              // Show success message briefly
              alert("Payment successful! Joining tournament...")
              
              // Redirect to waiting room
              window.location.href = `/waiting-room?tournamentId=${joinData.tournamentId}`
            } else {
              throw new Error(joinData.error || "Failed to join tournament")
            }
          } else if (payloadData.meta?.signed === false) {
            // Payment was rejected
            sessionStorage.removeItem("waitingForPayment")
            sessionStorage.removeItem("tournamentConfig")
            alert("Payment was rejected.")
            setLoadingPay(false)
          } else {
            // Payment still pending or expired
            console.log("Payment not completed yet")
            sessionStorage.removeItem("waitingForPayment")
            sessionStorage.removeItem("tournamentConfig")
            alert("Payment was not completed. Please try again.")
            setLoadingPay(false)
          }
        } catch (err) {
          console.error("Mobile return error:", err)
          sessionStorage.removeItem("waitingForPayment")
          sessionStorage.removeItem("tournamentConfig")
          alert(`Failed to process payment: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setLoadingPay(false)
        }
      }
    }

    // Only run on mount
    checkMobileReturn()
  }, []) // Empty dependency array - run once on mount

  const handleFreePlay = () => {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }
    window.location.href = `/gamechessboard?player=${playerID}&fee=0&size=${selectedSize}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col items-center justify-center px-6 py-12">
      {/* Top Bar */}
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

              {/* Tournament Size Selection */}
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
                      {size === 1 ? "1v1" : `${size}`}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Asset & Entry Fee Selection */}
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

              {/* Play Buttons */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loadingPay}
                onClick={handlePayFee}
                className="w-full rounded-2xl bg-primary py-6 font-bold text-primary-foreground text-xl shadow-2xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingPay ? "Processing..." : `Pay ${selectedFee} ${selectedAsset.currency} → Enter Tournament`}
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
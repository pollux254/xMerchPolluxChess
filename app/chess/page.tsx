"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor } from "lucide-react"
import Link from "next/link"

type Theme = "light" | "middle" | "dark"

export default function Chess() {
  const [playerID, setPlayerID] = useState<string | null>(null)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loadingPay, setLoadingPay] = useState(false)
  const [selectedFee, setSelectedFee] = useState<number>(10)
  const [selectedSize, setSelectedSize] = useState<number>(1)
  const [theme, setTheme] = useState<Theme>("light")

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

      const res = await fetch("/api/auth/xaman/create-signin/xahau-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
      if (isMobile) {
        window.location.href = nextUrl
      } else {
        window.open(nextUrl, "_blank")
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
              alert(`Logged in successfully!\nPlayer ID: ${payloadData.account}`)
            }
          } catch (err) {
            console.error("Failed to get account:", err)
            alert("Signed, but couldn't retrieve address.")
          }
          ws.close()
        } else if (status.signed === false || status.expired) {
          alert(status.signed === false ? "Sign-in rejected." : "Sign-in expired.")
          ws.close()
        }
      }
    } catch (err) {
      console.error("Login error:", err)
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
      const memo = `Chess Tournament - ${selectedSize === 1 ? '1v1' : `${selectedSize} Players`} - Fee ${selectedFee} XAH`

      const res = await fetch("/api/auth/xaman/create-payload/xahau-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedFee,
          memo,
          player: playerID,
          size: selectedSize,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Payment payload error:", errorText)
        alert("Error preparing payment. Check console for details.")
        return
      }

      const data = await res.json()

      // Ensure both nextUrl and gameUrl are present
      if (!data.nextUrl || !data.gameUrl) {
        console.error("Missing links from payload:", data)
        alert("Payment prepared but missing redirect links. Try again.")
        return
      }

      const { nextUrl, gameUrl } = data

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

      if (isMobile) {
        window.location.href = nextUrl
      } else {
        const xamanWin = window.open(nextUrl, "_blank", "width=480,height=720")

        if (!xamanWin) {
          alert("Popup blocked. Please allow popups for Xaman sign-in.")
          return
        }

        const checkClosed = setInterval(() => {
          if (xamanWin.closed) {
            clearInterval(checkClosed)
            window.location.href = gameUrl
          }
        }, 1000)

        const visibilityHandler = () => {
          if (!document.hidden) {
            setTimeout(() => {
              clearInterval(checkClosed)
              window.location.href = gameUrl
            }, 2000)
          }
        }
        document.addEventListener("visibilitychange", visibilityHandler)

        setTimeout(() => {
          clearInterval(checkClosed)
          document.removeEventListener("visibilitychange", visibilityHandler)
          window.location.href = gameUrl
        }, 30000)
      }
    } catch (err) {
      console.error("Payment error:", err)
      alert("Payment failed. Check console.")
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
      {/* Top Bar: Home Link + Theme Switcher */}
      <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 flex items-center justify-between z-50">
        {/* Home Link - Top Left */}
        <Link href="/" className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
          ← Home
        </Link>

        {/* Theme Switcher - Top Right */}
        <div className="flex gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm p-2 shadow-lg">
          <button
            onClick={() => setThemeValue("light")}
            className={`rounded-full p-2 transition-all ${theme === "light" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            aria-label="Light theme"
          >
            <Sun className="h-5 w-5" />
          </button>
          <button
            onClick={() => setThemeValue("middle")}
            className={`rounded-full p-2 transition-all ${theme === "middle" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            aria-label="System theme"
          >
            <Monitor className="h-5 w-5" />
          </button>
          <button
            onClick={() => setThemeValue("dark")}
            className={`rounded-full p-2 transition-all ${theme === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            aria-label="Dark theme"
          >
            <Moon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Card - Modern, elevated design matching landing page */}
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
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Connected as</p>
                <p className="font-mono text-lg font-semibold text-foreground">
                  {playerID.slice(0, 10)}...{playerID.slice(-6)}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDisconnect}
                className="w-full rounded-xl bg-red-600/90 hover:bg-red-700 py-3 font-semibold text-white transition-all"
              >
                Disconnect Wallet
              </motion.button>

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

              {/* Entry Fee Selection */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Entry Fee (XAH)</p>
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

              {/* Play Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loadingPay}
                onClick={handlePayFee}
                className="w-full rounded-2xl bg-primary py-6 font-bold text-primary-foreground text-xl shadow-2xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingPay ? "Preparing Transaction..." : `Pay ${selectedFee} XAH → Enter Tournament`}
              </motion.button>

              {/* Free Play Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFreePlay}
                className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-5 font-bold text-white text-lg shadow-xl hover:shadow-green-500/30 transition-all"
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
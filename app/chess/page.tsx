"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor } from "lucide-react"

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

  // === LOGIN (unchanged) ===
  async function handleLogin() {
    // ... your existing handleLogin code (exactly the same)
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

  // === NEW: DISCONNECT FUNCTION ===
  const handleDisconnect = () => {
    setPlayerID(null)
    localStorage.removeItem("playerID")
    alert("Wallet disconnected successfully!")
  }

  // === PAY FEE & FREE PLAY (unchanged) ===
  async function handlePayFee() {
    if (!playerID) {
      alert("Please connect your wallet first!")
      return
    }

    try {
      setLoadingPay(true)
      const memo = `Chess Tournament - ${selectedSize === 1 ? '1vs1' : `${selectedSize} Players`}`

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
        console.error("Payment payload error:", await res.text())
        alert("Error preparing payment.")
        return
      }

      const data = await res.json()
      const { nextUrl, gameUrl } = data

      if (!nextUrl || !gameUrl) {
        alert("Missing payment links")
        return
      }

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

      if (isMobile) {
        window.location.href = nextUrl
      } else {
        const xamanWin = window.open(nextUrl, "_blank", "width=480,height=720")

        const checkClosed = setInterval(() => {
          if (xamanWin?.closed) {
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

        setTimeout(() => clearInterval(checkClosed) || (window.location.href = gameUrl), 15000)
        setTimeout(() => {
          document.removeEventListener("visibilitychange", visibilityHandler)
          window.location.href = gameUrl
        }, 30000)
      }
    } catch (err) {
      console.error("Payment error:", err)
      alert("Payment failed.")
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
    <div className="flex h-screen items-center justify-center bg-background transition-colors duration-200">
      {/* Theme Switcher */}
      <div className="fixed top-6 right-6 flex gap-1 rounded-lg border border-border bg-card p-1">
        <button onClick={() => setThemeValue("light")} className={`rounded-md p-2 transition-colors ${theme === "light" ? "bg-foreground text-background" : "hover:bg-muted"}`}>
          <Sun className="h-4 w-4" />
        </button>
        <button onClick={() => setThemeValue("middle")} className={`rounded-md p-2 transition-colors ${theme === "middle" ? "bg-foreground text-background" : "hover:bg-muted"}`}>
          <Monitor className="h-4 w-4" />
        </button>
        <button onClick={() => setThemeValue("dark")} className={`rounded-md p-2 transition-colors ${theme === "dark" ? "bg-foreground text-background" : "hover:bg-muted"}`}>
          <Moon className="h-4 w-4" />
        </button>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">PolluxChess Tournament</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connect wallet to play and pay fees on Xahau</p>
        </div>

        <div className="flex flex-col gap-4">
          {!playerID ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loadingLogin}
              onClick={handleLogin}
              className="w-full rounded-lg bg-foreground py-2.5 font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingLogin ? "Connecting..." : "Connect with Xaman"}
            </motion.button>
          ) : (
            <>
              <p className="text-center text-sm font-medium text-foreground">
                Player ID: <span className="font-mono">{playerID.slice(0, 8)}...{playerID.slice(-4)}</span>
              </p>

              {/* Disconnect Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDisconnect}
                className="w-full rounded-lg bg-red-600 hover:bg-red-700 py-2.5 font-medium text-white transition"
              >
                Disconnect Wallet
              </motion.button>

              <div className="flex gap-2">
                {sizes.map((size) => (
                  <motion.button
                    key={size}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedSize(size)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      selectedSize === size
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {size === 1 ? "1 vs 1" : `${size} Players`}
                  </motion.button>
                ))}
              </div>

              <div className="flex gap-2">
                {feeTiers.map((tier) => (
                  <motion.button
                    key={tier}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedFee(tier)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      selectedFee === tier
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {tier} XAH
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loadingPay}
                onClick={handlePayFee}
                className="mt-2 w-full rounded-lg bg-foreground py-2.5 font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingPay ? "Preparing..." : `Pay ${selectedFee} XAH → Game`}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFreePlay}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-green-500 to-green-600 py-3 font-bold text-white shadow-lg hover:from-green-600 hover:to-green-700 hover:shadow-xl"
              >
                🚀 FREE PLAY vs BOT
              </motion.button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a href="https://xmerch.app" target="_blank" rel="noopener noreferrer" className="underline">
            xMerch
          </a>
        </p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <a href="https://xaman.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="7" cy="14" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a href="https://xahau.network" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <path d="M12 7v4m0 0l-5 6m5-6l5 6" />
            </svg>
          </a>
          <a href="https://evernode.org" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
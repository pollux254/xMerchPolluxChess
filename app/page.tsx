"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Moon, Sun, Monitor, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

type Theme = "light" | "middle" | "dark"

export default function Home() {
  const [selected, setSelected] = useState<number>(10)
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState<Theme>("light")
  const [isFAQOpen, setIsFAQOpen] = useState(false)

  const donationTiers = [100, 500, 1000]

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.remove("light", "middle", "dark")
      document.documentElement.classList.add(savedTheme)
    }
  }, [])

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.remove("light", "middle", "dark")
    document.documentElement.classList.add(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  async function handleDonate() {
    try {
      setLoading(true)

      const res = await fetch("/api/auth/xaman/create-payload/xahau-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: selected }),
      })

      if (!res.ok) {
        console.error("Failed to create payload:", await res.text())
        alert("Error preparing transaction.")
        return
      }

      const data = await res.json()
      const nextUrl = data?.nextUrl
      if (nextUrl) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        if (isMobile) window.location.href = nextUrl
        else window.open(nextUrl, "_blank")
      } else {
        alert("Missing Xaman redirect URL")
      }
    } catch (err) {
      console.error("Donation error:", err)
      alert("Donation failed. Check console.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-16 pb-12 px-4 transition-colors duration-200">
      {/* Theme Switcher */}
      <div className="fixed top-6 right-6 flex gap-1 rounded-lg border border-border bg-card p-1 z-10">
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

      {/* Title + Let's Play Button */}
      <div className="text-center mt-8 mb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4">POLLUX'S CHESS</h1>
        <p className="text-lg text-muted-foreground mb-10">Skill-based chess tournaments on Xahau</p>

        <Link href="/chess">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-2xl py-5 px-12 rounded-xl shadow-xl"
          >
            ♟️ Let's Play
          </motion.button>
        </Link>
      </div>

      {/* Donate Card */}
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Donate to xBase</h1>
          <p className="mt-1 text-sm text-muted-foreground">Support open-source on Xahau</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {donationTiers.map((tier) => (
              <motion.button
                key={tier}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(tier)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  selected === tier
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
            disabled={loading}
            onClick={handleDonate}
            className="mt-2 w-full rounded-lg bg-foreground py-2.5 font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Preparing..." : `Donate ${selected} XAH via Xaman`}
          </motion.button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a href="https://xmerch.app" target="_blank" rel="noopener noreferrer" className="underline">
            xMerch
          </a>
        </p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <a href="https://xaman.app" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="7" cy="14" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a href="https://xahau.network" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
              <path d="M12 7v4m0 0l-5 6m5-6l5 6" />
            </svg>
          </a>
          <a href="https://evernode.org" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2" />
            </svg>
          </a>
        </div>
      </div>

      {/* Important Notice */}
      <div className="mt-16 max-w-3xl w-full">
        <div className="rounded-xl border border-red-600/50 bg-red-900/20 p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Important Notice</h2>
          <p className="text-foreground leading-relaxed">
            External platforms like XPMarket, NFTCafe, and Magnetic are not affiliated with POLLUX'S CHESS. 
            Activities such as AMM, swaps, NFT trading, or token purchases occur at your own risk. 
            POLLUX'S CHESS is a skill-based chess tournament platform and does not offer or endorse investment or financial services. 
            Please do your own research and risks of any external platform before participating!!!
          </p>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="mt-12 max-w-3xl w-full">
        <button
          onClick={() => setIsFAQOpen(!isFAQOpen)}
          className="w-full bg-amber-600/90 hover:bg-amber-600 text-black font-bold py-4 px-6 rounded-t-xl flex items-center justify-between text-xl"
        >
          FAQ
          {isFAQOpen ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
        </button>

        {isFAQOpen && (
          <div className="rounded-b-xl border border-border bg-card p-8 space-y-7 text-foreground">
            <div>
              <h3 className="font-semibold text-lg">Which wallets can I use?</h3>
              <p className="text-muted-foreground mt-1">Only Xaman is avaiable for now and your wallet will be used as Player ID.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg">How does the tournament work?</h3>
              <p className="text-muted-foreground mt-1">Select an asset (XRP, XAH, EVR, FUZZY, PLX, or RLUSD) and tournament size (2, 4, or 8, and 16 players), pay the entry fee to join the queue. Once full, you're matched into a bracket and redirected to the game page. Winner gets 90% of the pot, with a 10% platform fee. Games use a 20-min default timer.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg">How does the NFT prize work?</h3>
              <p className="text-muted-foreground mt-1">Depositing an NFT is optional. Any number of players can deposit NFTs, and the tournament winner receives all valid deposited NFTs as collectible prizes. For example, if 5 players in a 24-player tournament deposit NFTs, the winner gets all 5. If no NFTs are awarded, all deposited NFTs are returned to their owners' wallets after the tournament.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg">When does the game timer start?</h3>
              <p className="text-muted-foreground mt-1">The timer starts after the first move by White. All games default to 20 minutes.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg">What happens if I disconnect?</h3>
              <p className="text-muted-foreground mt-1">You can recover your session while the tournament is active. The timer does not pause during disconnection.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg">What about external platforms?</h3>
              <p className="text-muted-foreground mt-1">Links to XPMarket, NFTCafe, and Magnetic are provided for convenience. These services are not controlled by POLLUX'S CHESS, and all activities are at your own risk externally. See the warning above.</p>
            </div>
          </div>
        )}
      </div>

      {/* External Platform Buttons */}
      <div className="mt-12 flex flex-wrap justify-center gap-5">
        <a href="https://xpmarket.com/token/PLX-rGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q" target="_blank" rel="noopener noreferrer">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition">
            PLX AMM at XPMarket
          </button>
        </a>
        <a href="https://xrp.cafe/collection/polluxoriginal" target="_blank" rel="noopener noreferrer">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition">
            Visit PLX on NFTCafe
          </button>
        </a>
        <a href="https://www.xmagnetic.org/dex/PLX%2BrGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q_XRP%2BXRP?network=mainnet" target="_blank" rel="noopener noreferrer">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition">
            Trade $PLX on Magnetic
          </button>
        </a>
      </div>

      {/* Social Links */}
      <div className="mt-12 text-center space-y-3">
        <p className="text-muted-foreground">Follow us:</p>
        <div className="flex justify-center gap-10 text-lg">
          <a href="https://x.com/pollux2789" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
            X: @pollux2789
          </a>
          <a href="https://t.me/plx589" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
            Telegram: @plx589
          </a>
          <a href="https://tiktok.com/@p0llux11" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
            TikTok: @p0llux11 
          </a>
        </div>
      </div>
    </div>
  )
}
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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col">
      {/* Theme Switcher */}
      <div className="fixed top-4 left-4 md:top-6 md:right-6 md:left-auto z-50 flex gap-2 rounded-full border border-border bg-card/80 backdrop-blur-sm p-2 shadow-lg">
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

      {/* Hero Section - Full viewport on all screens, no scrolling required on ≥768px */}
      <section className="relative flex-1 flex flex-col justify-center items-center px-6 py-20 md:py-0 overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background min-h-screen md:min-h-0 md:h-screen">
        <div className="absolute inset-0 bg-grid-muted/10 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto text-center z-10">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent leading-tight"
          >
            POLLUX'S CHESS
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-4 md:mt-6 text-2xl md:text-4xl lg:text-5xl font-semibold text-foreground"
          >
            Strategy Meets Finance on Xahau
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-6 text-lg md:text-xl lg:text-2xl max-w-3xl mx-auto text-muted-foreground leading-relaxed"
          >
            World's first skill-based multiplayer chess wager platform — compete trustlessly for real pots on the Xahau network.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-10 md:mt-12 flex flex-col md:flex-row gap-6 justify-center items-center"
          >
            <Link href="/chess" className="w-full md:w-auto max-w-xs md:max-w-none">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full px-12 py-6 text-2xl md:text-3xl font-bold rounded-2xl bg-primary text-primary-foreground shadow-2xl hover:shadow-primary/30 transition-shadow"
              >
                ♟️ Play & Win Prizes!
              </motion.button>
            </Link>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsModalOpen(true)}
              className="px-10 py-5 text-lg md:text-xl font-medium rounded-2xl border-2 border-primary bg-transparent hover:bg-primary/10 transition-colors"
            >
              Support xMerch
            </motion.button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-4 text-lg text-muted-foreground"
          >
            Trustless on Xahau Network, Powered by xMerch 🚀
          </motion.p>
        </div>
      </section>

      {/* Below-the-Fold Content - Only visible after scrolling on desktop (≥768px) */}
      <div className="w-full bg-muted/10">
        {/* Important Notice */}
        <section className="max-w-4xl mx-auto px-2 py-4">
          <div className="rounded-2xl border border-red-600/40 bg-red-900/20 p-10 text-center backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-6">Important Notice</h2>
            <p className="text-lg leading-relaxed">
              External platforms like XPMarket, NFTCafe, and Magnetic are not affiliated with POLLUX'S CHESS. 
              Activities such as AMM, swaps, NFT trading, or token purchases occur at your own risk. 
              POLLUX'S CHESS is a skill-based chess tournament platform and does not offer or endorse investment or financial services. 
              Please do your own research before participating.
            </p>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="max-w-4xl mx-auto px-6 py-6">
          <button
            onClick={() => setIsFAQOpen(!isFAQOpen)}
            className="w-full bg-primary/90 hover:bg-primary text-primary-foreground font-bold py-6 px-8 rounded-2xl flex items-center justify-between text-2xl shadow-lg transition-colors"
          >
            FAQ
            {isFAQOpen ? <ChevronUp className="h-8 w-8" /> : <ChevronDown className="h-8 w-8" />}
          </button>

          {isFAQOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-6 mt-6"
            >
              {/* Wallet & Account */}
              <div>
                <h3 className="font-bold text-xl">Which wallets can I use?</h3>
                <p className="text-muted-foreground mt-2">Only <strong>Xaman</strong> is supported. Your wallet address serves as your Player ID across all tournaments and games.</p>
              </div>
              
              <div>
                <h3 className="font-bold text-xl">Do I need to create an account?</h3>
                <p className="text-muted-foreground mt-2">No separate account needed — just connect your Xaman wallet. Your wallet address is your Player ID, and all stats are tied to it.</p>
              </div>

              {/* Tournament System */}
              <div>
                <h3 className="font-bold text-xl">How does the tournament work?</h3>
                <p className="text-muted-foreground mt-2">
                  Select an asset (XRP, XAH, EVR, FUZZY, PLX, or RLUSD) and tournament size (2, 4, 8, or 16 players), then pay the entry fee. Your funds are held securely in an on-chain smart contract (Xahau Hook). Once the tournament fills, bracket matches begin automatically. This is <strong>single elimination</strong> — lose once and you're out! Prizes are distributed based on final placement.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-xl">What's the prize structure?</h3>
                <p className="text-muted-foreground mt-2">
                  <strong>Platform fee:</strong> 11% (deducted when tournament starts)<br />
                  <strong>Winner takes all</strong>
                </p>
              </div>

              <div>
                <h3 className="font-bold text-xl">What if the tournament doesn't fill?</h3>
                <p className="text-muted-foreground mt-2">If the tournament doesn't fill within <strong>10 minutes</strong>, it's automatically cancelled and all entry fees are refunded 100% (no platform fee charged).</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">How are my funds protected?</h3>
                <p className="text-muted-foreground mt-2">All entry fees are held in a <strong>Xahau Hook</strong> (smart contract) on the blockchain. The platform cannot access these funds — they're automatically distributed to winners based on game results verified on-chain.</p>
              </div>

              {/* Chess Rules */}
              <div>
                <h3 className="font-bold text-xl">How does the chess engine work?</h3>
                <p className="text-muted-foreground mt-2">All chess moves are <strong>validated on-chain</strong> by a Xahau Hook smart contract. Illegal moves are automatically rejected, check and checkmate are detected on-chain, and game results are trustless and verifiable.</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">What are the time controls?</h3>
                <p className="text-muted-foreground mt-2">
                  Each player gets <strong>20 minutes total</strong>. Your clock counts down only when it's YOUR turn to move. When your opponent is thinking, your clock is paused.<br /><br />
                  <strong>First move rule:</strong> If a player doesn't make their first move within 5 minutes, they automatically forfeit and lose the game.<br /><br />
                  If your clock runs out at any point, you automatically lose. Time is tracked on-chain and enforced by the smart contract.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-xl">Can I offer a draw?</h3>
                <p className="text-muted-foreground mt-2"><strong>No.</strong> Draw offers are disabled to prevent bracket conflicts. Games can only end in forced draws (stalemate, repetition, 50-move rule, or insufficient material).</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">What happens if there's a draw?</h3>
                <p className="text-muted-foreground mt-2">
                  We use a <strong>material tiebreaker</strong>: Pawn=1, Knight=3, Bishop=3, Rook=5, Queen=9. <strong>Higher material value wins</strong> (better position = more pieces remaining).<br /><br />
                  <strong>Example:</strong><br />
                  • Player A: Queen + Pawn = 10 points<br />
                  • Player B: Rook + Bishop = 8 points<br />
                  • <strong>Player A wins</strong> the tiebreaker (10 &gt; 8)<br /><br />
                  If both players have exactly the same material value in the final game, the prize is split 50/50.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-xl">Can I resign?</h3>
                <p className="text-muted-foreground mt-2">Yes, you can resign at any time. Your opponent will win immediately.</p>
              </div>

              {/* Playing & Connectivity */}
              <div>
                <h3 className="font-bold text-xl">What happens if I disconnect?</h3>
                <p className="text-muted-foreground mt-2">Your session is <strong>automatically recoverable</strong>. Refresh or return to the site, reconnect your wallet, and you'll be redirected back to your active game. Your clock continues running during disconnect. ⚠️ If you disconnect and your time runs out, you automatically lose.</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">Can I leave a tournament early?</h3>
                <p className="text-muted-foreground mt-2"><strong>During waiting room:</strong> Yes, you can disconnect before the tournament starts.<br /><strong>During active game:</strong> No. Logging out during an active match will forfeit the game (automatic loss).</p>
              </div>

              {/* Practice vs Ranked */}
              <div>
                <h3 className="font-bold text-xl">What's the difference between Bot Mode and Tournaments?</h3>
                <p className="text-muted-foreground mt-2">
                  <strong>Bot Mode (Free Play):</strong> Practice against AI with no entry fee. Separate practice stats & ELO. Does NOT affect ranked stats.<br />
                  <strong>Tournaments (Real Money):</strong> Play against real players with entry fees. Ranked stats & ELO. Win real prizes.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-xl">Are stats tracked separately?</h3>
                <p className="text-muted-foreground mt-2">
                  <strong>Yes!</strong> You have two independent stat profiles:<br />
                  <strong>Ranked Stats</strong> (tournaments): Games, wins, losses, ranked ELO, total wagered & won, leaderboard placement.<br />
                  <strong>Practice Stats</strong> (bot games): Games, wins, losses, practice ELO. Playing bot games will never affect your ranked tournament stats.
                </p>
              </div>

              {/* NFT Prizes */}
              <div>
                <h3 className="font-bold text-xl">How does the NFT prize work?</h3>
                <p className="text-muted-foreground mt-2">Optional NFT deposits — winner receives all deposited NFTs. If none awarded, NFTs are returned. <em>(Note: This feature may be deprecated in future versions as we focus on the Hook-based prize system)</em></p>
              </div>

              {/* Technical */}
              <div>
                <h3 className="font-bold text-xl">What is a Xahau Hook?</h3>
                <p className="text-muted-foreground mt-2">A <strong>Xahau Hook</strong> is like a smart contract — code that runs on the Xahau blockchain. Our chess Hook holds tournament entry fees in escrow, validates every chess move on-chain, enforces time controls automatically, and distributes prizes to winners. No human intervention needed.</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">Why use Hooks instead of a traditional backend?</h3>
                <p className="text-muted-foreground mt-2">
                  <strong>Trustless:</strong> You don't have to trust us with your money — the blockchain holds it.<br />
                  <strong>Transparent:</strong> All game results are verified on-chain and publicly auditable.<br />
                  <strong>Secure:</strong> Smart contract code can't be changed mid-tournament.<br />
                  <strong>Fair:</strong> Impossible for us to manipulate results or withhold prizes.
                </p>
              </div>

              {/* Safety */}
              <div>
                <h3 className="font-bold text-xl">Is my money safe?</h3>
                <p className="text-muted-foreground mt-2">Yes. Entry fees are held in an <strong>on-chain smart contract</strong> (Xahau Hook), not in our wallets. We cannot access tournament funds — they're automatically distributed by the blockchain based on game results.</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">Can the platform steal my funds?</h3>
                <p className="text-muted-foreground mt-2"><strong>No.</strong> Once you pay your entry fee, funds go directly to the Hook (smart contract). Only the Hook can distribute prizes based on game results. We have zero access to escrowed funds.</p>
              </div>

              {/* External Links */}
              <div>
                <h3 className="font-bold text-xl">What about external platforms?</h3>
                <p className="text-muted-foreground mt-2">Links to external sites (Xaman, Xahau docs, etc.) are provided for convenience only. All external activity is at your own risk.</p>
              </div>

              {/* Common Issues */}
              <div>
                <h3 className="font-bold text-xl">I paid but didn't join the tournament — what happened?</h3>
                <p className="text-muted-foreground mt-2">
                  Check: Did you pay the exact entry fee? Did you include the correct tournament ID? Was the tournament already full? Did the transaction succeed in Xaman? Your wallet address can be checked on-chain to verify payment status.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-xl">My opponent isn't moving — what happens?</h3>
                <p className="text-muted-foreground mt-2">If they run out of time (20 minutes), they <strong>automatically lose</strong> by time forfeit. You win and advance.</p>
              </div>

              <div>
                <h3 className="font-bold text-xl">What if my opponent doesn't make their first move?</h3>
                <p className="text-muted-foreground mt-2">If they don't move within <strong>5 minutes</strong> of the game starting, they automatically forfeit. You win immediately.</p>
              </div>
            </motion.div>
          )}
        </section>

        {/* External Platforms */}
        <section className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-3xl font-bold text-center mb-12">Explore the Ecosystem</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <a href="https://xpmarket.com/token/PLX-rGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q" target="_blank" rel="noopener noreferrer" className="group">
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 text-center hover:border-primary transition-all">
                <p className="text-xl font-semibold group-hover:text-primary transition-colors">PLX AMM at XPMarket</p>
              </div>
            </a>
            <a href="https://xrp.cafe/collection/polluxoriginal" target="_blank" rel="noopener noreferrer" className="group">
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 text-center hover:border-primary transition-all">
                <p className="text-xl font-semibold group-hover:text-primary transition-colors">Visit PLX on NFTCafe</p>
              </div>
            </a>
            <a href="https://www.xmagnetic.org/dex/PLX%2BrGLEgQdktoN4Be5thhk6seg1HifGPBxY5Q_XRP%2BXRP?network=mainnet" target="_blank" rel="noopener noreferrer" className="group">
              <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 text-center hover:border-primary transition-all">
                <p className="text-xl font-semibold group-hover:text-primary transition-colors">Trade $PLX on Magnetic</p>
              </div>
            </a>
          </div>
        </section>

        {/* Social Links */}
        <section className="max-w-4xl mx-auto px-6 py-8 text-center pb-12">
          <p className="text-xl text-muted-foreground mb-8">Follow the journey</p>
          <div className="flex justify-center gap-12 text-lg">
            <a href="https://x.com/pollux2789" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              X: @pollux2789
            </a>
            <a href="https://t.me/plx589" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              Telegram: @plx589
            </a>
            <a href="https://tiktok.com/@p0llux11" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              TikTok: @p0llux11
            </a>
          </div>
        </section>
      </div>

      {/* Donation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md rounded-3xl border border-border bg-card/90 backdrop-blur-xl p-10 shadow-2xl"
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold">Donate to xBase</h1>
              <p className="mt-2 text-muted-foreground">Support open-source development on Xahau</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                {donationTiers.map((tier) => (
                  <motion.button
                    key={tier}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelected(tier)}
                    className={`rounded-xl py-4 font-semibold transition-all ${
                      selected === tier
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "border border-border bg-muted/50 hover:bg-muted"
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
                className="w-full rounded-xl bg-primary py-5 font-bold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? "Preparing..." : `Donate ${selected} XAH via Xaman`}
              </motion.button>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Powered by{" "}
              <a href="https://xmerch.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                xMerch
              </a>
            </p>

            <div className="mt-6 flex justify-center gap-8">
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
      )}
    </div>
  )
}
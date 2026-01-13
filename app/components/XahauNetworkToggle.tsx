"use client"

import { type XahauNetwork } from "@/lib/xahau-network"

export function XahauNetworkToggle({
  network,
  onChange,
  className,
}: {
  network: XahauNetwork
  onChange: (next: XahauNetwork) => void
  className?: string
}) {
  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 backdrop-blur-sm p-1 shadow-lg">
        <button
          type="button"
          onClick={() => onChange("mainnet")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
            network === "mainnet"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground"
          }`}
          aria-pressed={network === "mainnet"}
        >
          Mainnet
        </button>
        <button
          type="button"
          onClick={() => onChange("testnet")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
            network === "testnet"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground"
          }`}
          aria-pressed={network === "testnet"}
        >
          Testnet
        </button>
      </div>
    </div>
  )
}


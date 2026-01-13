"use client"

import { useEffect, useMemo, useState } from "react"
import { DEFAULT_NETWORK, type XahauNetwork } from "./xahau-network"

const STORAGE_KEY = "xahauNetwork"

export function useXahauNetwork() {
  const [network, setNetwork] = useState<XahauNetwork>(DEFAULT_NETWORK)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as XahauNetwork | null
      if (saved === "mainnet" || saved === "testnet") {
        setNetwork(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  const apiHeaders = useMemo(() => {
    return {
      "Content-Type": "application/json",
      "x-xahau-network": network,
    } as const
  }, [network])

  const setAndPersist = (next: XahauNetwork) => {
    setNetwork(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return { network, setNetwork: setAndPersist, apiHeaders }
}


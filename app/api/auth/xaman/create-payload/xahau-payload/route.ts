import { type NextRequest, NextResponse } from "next/server"
import { XummSdk, XummTypes } from "xumm-sdk"
import { getXahauNetworkId, type XahauNetwork } from "@/lib/xahau-network"

interface PayloadResponse {
  ok: boolean
  uuid?: string
  nextUrl?: string
  qrUrl?: string
  websocketUrl?: string
  error?: string
}

interface RequestBody {
  amount: number
  currency?: string
  issuer?: string | null
  player?: string
  size?: number
  memo?: string
  network?: XahauNetwork
}

function getNetworkFromRequest(req: NextRequest, body?: RequestBody): XahauNetwork {
  const header = (req.headers.get("x-xahau-network") || "").toLowerCase()
  const fromHeader = header === "testnet" || header === "mainnet" ? (header as XahauNetwork) : undefined
  const fromBody = body?.network
  if (fromBody === "testnet" || fromBody === "mainnet") return fromBody
  if (fromHeader) return fromHeader
  return "mainnet"
}

function getDestinationForNetwork(network: XahauNetwork): string {
  // Prefer explicit per-network env vars when present.
  if (network === "testnet") {
    return (
      process.env.XAH_DESTINATION_TESTNET ||
      process.env.XAH_DESTINATION ||
      process.env.XAMAN_DESTINATION_ADDRESS ||
      ""
    )
  }

  return (
    process.env.XAH_DESTINATION_MAINNET ||
    process.env.XAH_DESTINATION ||
    process.env.XAMAN_DESTINATION_ADDRESS ||
    ""
  )
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    const { amount, currency = "XAH", issuer, player, size = 1, memo } = body
    const network = getNetworkFromRequest(req, body)

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    const displayAmount = `${amount} ${currency}${issuer ? ` (issued by ${issuer.slice(0, 8)}...${issuer.slice(-4)})` : ""}`

    const fullMemo = memo || `Chess Tournament Entry - ${size === 1 ? "1v1" : `${size} Players`} - ${displayAmount}`

    // Check if using Supabase edge function
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/xaman-createPayload`

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          amount,
          currency,
          issuer,
          memo: fullMemo,
          returnUrl: `${baseUrl}/chess`,
          network,
        }),
      })

      const data: PayloadResponse = await response.json()

      if (!response.ok || !data.ok) {
        console.error("[Payment] Edge function error:", data)
        return NextResponse.json(
          { ok: false, error: data.error || "Failed to create payment request" },
          { status: response.status }
        )
      }

      return NextResponse.json({
        ok: true,
        uuid: data.uuid,
        nextUrl: data.nextUrl,
        qrUrl: data.qrUrl,
        websocketUrl: data.websocketUrl,
      })
    }

    // Fallback: Use local Xumm SDK
    const apiKey = process.env.XUMM_API_KEY || process.env.NEXT_PUBLIC_XAMAN_XAHAU_API_KEY || ""
    const apiSecret = process.env.XUMM_API_SECRET || process.env.XAMAN_XAHAU_API_SECRET || ""
    const destination = getDestinationForNetwork(network)
    const networkId = getXahauNetworkId(network)

    if (!apiKey || !apiSecret || !destination) {
      return NextResponse.json(
        { ok: false, error: "Server configuration error" },
        { status: 500 }
      )
    }

    const xaman = new XummSdk(apiKey, apiSecret)

    const txjson: any = {
      TransactionType: "Payment",
      Destination: destination,
      NetworkID: networkId,
      Memos: fullMemo
        ? [
            {
              Memo: {
                MemoType: Buffer.from("Text").toString("hex").toUpperCase(),
                MemoData: Buffer.from(fullMemo).toString("hex").toUpperCase(),
              },
            },
          ]
        : undefined,
    }

    if (currency === "XAH" || !issuer) {
      // Native XAH payment
      const drops = Math.round(Number(amount) * 1_000_000)
      if (Number.isNaN(drops) || drops <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
      }
      txjson.Amount = String(drops)
    } else {
      // Issued currency payment
      txjson.Amount = {
        value: String(amount),
        currency: currency,
        issuer: issuer,
      }
    }

    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson,
      options: {
        submit: true,
        expire: 300,
        return_url: {
          web: `${baseUrl}/chess`,
        },
      },
      custom_meta: {
        instruction: fullMemo,
        identifier: `polluxchess-${Date.now()}`,
      },
    }

    const response = await xaman.payload.create(payload)

    if (!response?.next?.always) {
      return NextResponse.json({ ok: false, error: "Failed to create payment request" }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      uuid: response.uuid,
      nextUrl: response.next.always,
      qrUrl: response.refs?.qr_png,
      websocketUrl: response.refs?.websocket_status,
    })
  } catch (err) {
    console.error("[Payment] Error:", err)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}

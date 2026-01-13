import { type NextRequest, NextResponse } from "next/server"
import { XummSdk, XummTypes } from "xumm-sdk"
import { getXahauNetworkId, type XahauNetwork } from "@/lib/xahau-network"

interface SignInResponse {
  ok: boolean
  uuid?: string
  nextUrl?: string
  websocketUrl?: string
  qrUrl?: string
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    const header = (req.headers.get("x-xahau-network") || "").toLowerCase()
    const network: XahauNetwork = header === "testnet" || header === "mainnet" ? (header as XahauNetwork) : "mainnet"

    // Check if using Supabase edge function
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/xaman-signinPayload`

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          returnUrl: baseUrl,
          network,
        }),
      })

      const data: SignInResponse = await response.json()

      if (!response.ok || !data.ok) {
        console.error("[SignIn] Edge function error:", data)
        return NextResponse.json(
          { ok: false, error: data.error || "Failed to create sign-in request" },
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
    const networkId = getXahauNetworkId(network)

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: "Server configuration error: Missing Xaman credentials" },
        { status: 500 }
      )
    }

    const xaman = new XummSdk(apiKey, apiSecret)

    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "SignIn",
        NetworkID: networkId,
      },
      options: {
        submit: false,
        expire: 300,
        return_url: {
          web: baseUrl,
        },
      },
      custom_meta: {
        instruction: "Sign in to PolluxChess",
        identifier: `polluxchess-signin-${Date.now()}`,
      },
    }

    const response = await xaman.payload.create(payload)

    if (!response?.next?.always) {
      return NextResponse.json(
        { ok: false, error: "Failed to create sign-in request" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      uuid: response.uuid,
      nextUrl: response.next.always,
      qrUrl: response.refs?.qr_png,
      websocketUrl: response.refs?.websocket_status,
    })
  } catch (err) {
    console.error("[SignIn] Error:", err)
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

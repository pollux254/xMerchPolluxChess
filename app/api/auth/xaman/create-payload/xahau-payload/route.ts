import { type NextRequest, NextResponse } from "next/server"
import { XummSdk, XummTypes } from "xumm-sdk"

interface PayloadResponse {
  ok: boolean
  uuid?: string
  nextUrl?: string
  qrUrl?: string
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    if (supabaseUrl && anonKey) {
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/xaman-createPayload`

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey
        },
        body: JSON.stringify({
          amount,
          returnUrl: baseUrl ? `${baseUrl}/` : undefined
        })
      })

      const data: PayloadResponse = await response.json()

      if (!response.ok || !data.ok) {
        console.error("[xBase] Edge function error:", data)
        return NextResponse.json(
          { ok: false, error: data.error || "Failed to create payment request" },
          { status: response.status }
        )
      }

      return NextResponse.json({
        ok: true,
        uuid: data.uuid,
        nextUrl: data.nextUrl,
        qrUrl: data.qrUrl
      })
    }

    // Fallback for local dev when Supabase is not configured
    const apiKey = process.env.XUMM_API_KEY || process.env.NEXT_PUBLIC_XAMAN_XAHAU_API_KEY || ""
    const apiSecret = process.env.XUMM_API_SECRET || process.env.XAMAN_XAHAU_API_SECRET || ""
    const destination = process.env.XAH_DESTINATION || process.env.XAMAN_DESTINATION_ADDRESS || ""
    const networkId = Number(process.env.NEXT_PUBLIC_XAHAU_NETWORK_ID || 21337)

    if (!apiKey || !apiSecret || !destination) {
      console.error("[xBase] Missing Supabase config and local Xaman credentials")
      return NextResponse.json(
        { ok: false, error: "Server configuration error: set Supabase env OR local XUMM_* + XAH_DESTINATION" },
        { status: 500 }
      )
    }

    const drops = Math.round(Number(amount) * 1_000_000)
    if (Number.isNaN(drops) || drops <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }

    const xaman = new XummSdk(apiKey, apiSecret)

    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "Payment",
        Destination: destination,
        Amount: String(drops),
        NetworkID: networkId
      },
      options: {
        submit: true,
        expire: 300
      },
      custom_meta: {
        instruction: `Donate ${amount} XAH via Xaman`,
        identifier: `xbase-local-${Date.now()}`
      }
    }

    const response = await xaman.payload.create(payload)

    if (!response?.next?.always) {
      console.error("[xBase] Xaman did not return a signing URL")
      return NextResponse.json({ ok: false, error: "Failed to create payment request" }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      uuid: response.uuid,
      nextUrl: response.next.always,
      qrUrl: response.refs?.qr_png
    })
  } catch (err) {
    console.error("[xBase] Payload creation error:", err)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}

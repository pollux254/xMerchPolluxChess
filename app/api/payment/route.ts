import { type NextRequest, NextResponse } from "next/server"
import { XummSdk, XummTypes } from "xumm-sdk"

interface PayloadResponse {
  ok: boolean
  uuid?: string
  nextUrl?: string
  qrUrl?: string
  websocketUrl?: string
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, currency = "XAH", issuer, memo, network } = body

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    // Get API credentials
    const apiKey = process.env.XUMM_API_KEY || process.env.NEXT_PUBLIC_XAMAN_XAHAU_API_KEY || ""
    const apiSecret = process.env.XUMM_API_SECRET || process.env.XAMAN_XAHAU_API_SECRET || ""

    // Get destination (Hook address for tournament, or regular destination)
    const destination = network === 'testnet'
      ? (process.env.NEXT_PUBLIC_HOOK_ADDRESS_TESTNET || process.env.XAH_DESTINATION_TESTNET || "")
      : (process.env.NEXT_PUBLIC_HOOK_ADDRESS_MAINNET || process.env.XAH_DESTINATION_MAINNET || "")

    if (!apiKey || !apiSecret || !destination) {
      return NextResponse.json(
        { ok: false, error: "Server configuration error - missing API keys or destination" },
        { status: 500 }
      )
    }

    console.log(`💰 Creating payment: ${amount} ${currency} to ${destination} on ${network}`)

    const xaman = new XummSdk(apiKey, apiSecret)

    // Build transaction
    const txjson: any = {
      TransactionType: "Payment",
      Destination: destination,
      NetworkID: network === 'testnet' ? 21338 : 21337, // Xahau testnet/mainnet IDs
    }

    // Add amount (native XAH or issued currency)
    if (currency === "XAH" || !issuer) {
      const drops = Math.round(Number(amount) * 1_000_000)
      if (Number.isNaN(drops) || drops <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
      }
      txjson.Amount = String(drops)
    } else {
      txjson.Amount = {
        value: String(amount),
        currency: currency,
        issuer: issuer,
      }
    }

    // Add memo if provided
    if (memo) {
      txjson.Memos = [
        {
          Memo: {
            MemoType: Buffer.from("application/json").toString("hex").toUpperCase(),
            MemoData: Buffer.from(memo).toString("hex").toUpperCase(),
          },
        },
      ]
    }

    console.log("📤 Creating Xaman payload with txjson:", JSON.stringify(txjson, null, 2))

    // Create Xaman payload
    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson,
      options: {
        submit: true,
        expire: 300,
        return_url: {
          web: `${baseUrl}/chess`,
        },
      },
    }

    const response = await xaman.payload.create(payload)

    if (!response?.next?.always) {
      return NextResponse.json({ ok: false, error: "Failed to create payment request" }, { status: 500 })
    }

    console.log("✅ Xaman payload created:", response.uuid)

    return NextResponse.json({
      ok: true,
      uuid: response.uuid,
      nextUrl: response.next.always,
      qrUrl: response.refs?.qr_png,
      websocketUrl: response.refs?.websocket_status,
    })
  } catch (err) {
    console.error("❌ Payment API error:", err)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
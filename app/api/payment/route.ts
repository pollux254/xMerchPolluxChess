import { type NextRequest, NextResponse } from "next/server"
import { XummSdk, XummTypes } from "xumm-sdk"
import { getXahauNetworkId, getHookAddress, type XahauNetwork } from "@/lib/xahau-network"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, currency = "XAH", issuer, memo, network } = body

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }

    // Determine network from body or header
    const requestedNetwork: XahauNetwork = 
      (network === 'testnet' || network === 'mainnet') 
        ? network 
        : ((req.headers.get("x-xahau-network") || "testnet") as XahauNetwork)

    console.log(`💳 Creating payment for ${requestedNetwork.toUpperCase()}`)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const apiKey = process.env.XUMM_API_KEY || ""
    const apiSecret = process.env.XUMM_API_SECRET || ""
    
    // Get network-specific hook address
    const destination = getHookAddress(requestedNetwork)

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: "Missing Xaman API credentials" },
        { status: 500 }
      )
    }

    if (!destination) {
      return NextResponse.json(
        { ok: false, error: `No hook address configured for ${requestedNetwork}` },
        { status: 500 }
      )
    }

    console.log(`📍 Destination: ${destination}`)

    const xaman = new XummSdk(apiKey, apiSecret)
    
    // Get network ID for Xahau
    const networkId = getXahauNetworkId(requestedNetwork)
    console.log(`🌐 Network ID: ${networkId} (${requestedNetwork})`)

    const txjson: any = { 
      TransactionType: "Payment", 
      Destination: destination,
      NetworkID: networkId  // ✅ Critical: Specify which Xahau network
    }

    // Handle amount formatting
    if (currency === "XAH" || !issuer) {
      const drops = Math.round(Number(amount) * 1000000)
      txjson.Amount = String(drops)
    } else {
      txjson.Amount = { value: String(amount), currency, issuer }
    }

    // Add memo if provided
    if (memo) {
      txjson.Memos = [{
        Memo: {
          MemoType: Buffer.from("application/json").toString("hex").toUpperCase(),
          MemoData: Buffer.from(memo).toString("hex").toUpperCase()
        }
      }]
    }

    // Webhook URL for Supabase Edge Function
    const webhookUrl = process.env.NEXT_PUBLIC_SUPABASE_URL 
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/xaman-webhook`
      : undefined

      console.log("🪝 Webhook URL:", webhookUrl)
      console.log("🪝 NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)

    const payload: XummTypes.XummPostPayloadBodyJson = {
      txjson,
      options: { 
        submit: true, 
        expire: 300, 
        return_url: { web: baseUrl + "/chess" },
        ...(webhookUrl && { webhook: webhookUrl }) // Add webhook URL
      },
      custom_meta: {
        instruction: `Pay ${amount} ${currency} entry fee`,
        identifier: `polluxchess-payment-${Date.now()}`,
      }
    }

    console.log("📤 Creating Xaman payload...")
    const response = await xaman.payload.create(payload)

    if (!response?.next?.always) {
      console.error("❌ Failed to create Xaman payload")
      return NextResponse.json({ ok: false, error: "Failed to create payment" }, { status: 500 })
    }

    console.log("✅ Xaman payload created:", response.uuid)

    return NextResponse.json({
      ok: true,
      uuid: response.uuid,
      nextUrl: response.next.always,
      qrUrl: response.refs?.qr_png,
      websocketUrl: response.refs?.websocket_status,
      network: requestedNetwork
    })
  } catch (err) {
    console.error("❌ Payment error:", err)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
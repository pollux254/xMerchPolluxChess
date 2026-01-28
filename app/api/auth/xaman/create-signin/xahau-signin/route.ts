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
    console.log("🔐 [CREATE-SIGNIN] === REQUEST START ===")
    
    // ✅ FIX: Safely parse JSON - handle empty body
    let body: any = {}
    try {
      const text = await req.text()
      console.log("🔐 [CREATE-SIGNIN] Request body:", text)
      
      if (text && text.trim().length > 0) {
        body = JSON.parse(text)
      } else {
        console.log("🔐 [CREATE-SIGNIN] Empty body, using defaults")
      }
    } catch (parseError) {
      console.warn("🔐 [CREATE-SIGNIN] Body parse failed, using defaults:", parseError)
    }
    
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://xmerch-polluxchess.vercel.app'}/chess`
    
    console.log("🔐 [CREATE-SIGNIN] returnUrl:", returnUrl)

    const header = (req.headers.get("x-xahau-network") || "").toLowerCase()
    const network: XahauNetwork = header === "testnet" || header === "mainnet" ? (header as XahauNetwork) : "testnet"

    console.log("🔐 [CREATE-SIGNIN] Network header:", header)
    console.log("🔐 [CREATE-SIGNIN] Network selected:", network)

    // Check if using Supabase edge function
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log("🔐 [CREATE-SIGNIN] Using Supabase edge function")
      
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/xaman-signinPayload`

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          returnUrl: returnUrl,
          network,
        }),
      })

      const data: SignInResponse = await response.json()

      if (!response.ok || !data.ok) {
        console.error("[CREATE-SIGNIN] Edge function error:", data)
        return NextResponse.json(
          { ok: false, error: data.error || "Failed to create sign-in request" },
          { status: response.status }
        )
      }

      console.log("✅ [CREATE-SIGNIN] Edge function success:", {
        uuid: data.uuid,
        hasNextUrl: !!data.nextUrl,
        hasWebsocket: !!data.websocketUrl
      })

      return NextResponse.json({
        ok: true,
        uuid: data.uuid,
        next: {
          always: data.nextUrl
        },
        refs: {
          qr_png: data.qrUrl,
          websocket_status: data.websocketUrl
        }
      })
    }

    // Fallback: Use local Xumm SDK
    console.log("🔐 [CREATE-SIGNIN] Using local Xumm SDK")
    
    const apiKey = process.env.XAMAN_API_KEY || process.env.XUMM_API_KEY || process.env.NEXT_PUBLIC_XAMAN_XAHAU_API_KEY || ""
    const apiSecret = process.env.XAMAN_API_SECRET || process.env.XUMM_API_SECRET || process.env.XAMAN_XAHAU_API_SECRET || ""
    const networkId = getXahauNetworkId(network)

    console.log("🔐 [CREATE-SIGNIN] SDK - NetworkID:", networkId, "for network:", network)
    console.log("🔐 [CREATE-SIGNIN] Has API Key:", !!apiKey)
    console.log("🔐 [CREATE-SIGNIN] Has API Secret:", !!apiSecret)

    if (!apiKey || !apiSecret) {
      console.error("🔐 [CREATE-SIGNIN] ❌ Missing credentials")
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
          web: returnUrl,
          app: returnUrl,
        },
      },
      custom_meta: {
        instruction: "Sign in to PolluxChess",
        identifier: `polluxchess-signin-${Date.now()}`,
      },
    }

    console.log("🔐 [CREATE-SIGNIN] Creating payload with return URLs:", returnUrl)

    const response = await xaman.payload.create(payload)

    if (!response) {
      console.error("🔐 [CREATE-SIGNIN] ❌ No response from Xaman SDK")
      return NextResponse.json(
        { ok: false, error: "Failed to create sign-in request" },
        { status: 500 }
      )
    }

    console.log("🔐 [CREATE-SIGNIN] Xaman SDK response:", {
      uuid: response.uuid,
      hasNext: !!response.next,
      hasRefs: !!response.refs
    })

    if (!response?.next?.always) {
      console.error("🔐 [CREATE-SIGNIN] ❌ No next.always in response")
      return NextResponse.json(
        { ok: false, error: "Failed to create sign-in request" },
        { status: 500 }
      )
    }

    console.log("✅ [CREATE-SIGNIN] Payload created successfully")
    console.log("✅ [CREATE-SIGNIN] UUID:", response.uuid)
    console.log("✅ [CREATE-SIGNIN] Next URL:", response.next.always)

    return NextResponse.json({
      ok: true,
      uuid: response.uuid,
      next: {
        always: response.next.always
      },
      refs: {
        qr_png: response.refs?.qr_png,
        websocket_status: response.refs?.websocket_status
      }
    })
  } catch (err: any) {
    console.error("[CREATE-SIGNIN] ❌❌❌ EXCEPTION ❌❌❌")
    console.error("[CREATE-SIGNIN] Error:", err)
    console.error("[CREATE-SIGNIN] Stack:", err?.stack)
    
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
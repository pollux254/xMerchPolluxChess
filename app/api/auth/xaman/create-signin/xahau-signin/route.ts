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
    
    // ✅ Safely parse JSON - handle empty body
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
    
    // ✅ CRITICAL: Use callback page for mobile PWA
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://xmerch-polluxchess.vercel.app'
    const returnUrl = `${baseUrl}/auth/xaman-callback`
    
    console.log("🔐 [CREATE-SIGNIN] returnUrl:", returnUrl)

    const header = (req.headers.get("x-xahau-network") || "").toLowerCase()
    const network: XahauNetwork = header === "testnet" || header === "mainnet" ? (header as XahauNetwork) : "testnet"

    console.log("🔐 [CREATE-SIGNIN] Network header:", header)
    console.log("🔐 [CREATE-SIGNIN] Network selected:", network)

    // ✅ ALWAYS use Supabase edge function (has webhook support)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log("🔐 [CREATE-SIGNIN] Using Supabase edge function with webhook")
      
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
          useWebhook: true, // ✅ Enable webhook
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

    // ❌ No Supabase - return error (we need webhook support)
    console.error("🔐 [CREATE-SIGNIN] ❌ Supabase not configured")
    return NextResponse.json(
      { ok: false, error: "Server configuration error: Supabase required for mobile support" },
      { status: 500 }
    )
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
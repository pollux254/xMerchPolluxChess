// Supabase Edge Function for creating Xahau payment payloads (CHESS BULLETPROOF)
// Deploy: supabase functions deploy xaman-createPayload
// Secrets: XUMM_API_KEY, XUMM_API_SECRET, XAH_DESTINATION, SB_URL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface PayloadRequest {
  amount: number
  memo?: string
  returnUrl?: string
  player?: string  // NEW: Player wallet address
  size?: number    // NEW: Tournament size (1,4,8,16)
}

function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

function xahToDrops(xah: number): string {
  return Math.floor(xah * 1_000_000).toString()
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const XUMM_API_KEY = Deno.env.get("XUMM_API_KEY")
    const XUMM_API_SECRET = Deno.env.get("XUMM_API_SECRET")
    const DESTINATION = Deno.env.get("XAH_DESTINATION")
    const SUPABASE_URL = Deno.env.get("SB_URL")

    if (!XUMM_API_KEY || !XUMM_API_SECRET) {
      console.error("Missing XUMM_API_KEY or XUMM_API_SECRET")
      return new Response(
        JSON.stringify({ ok: false, error: "Server config error: Missing Xaman credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (!DESTINATION) {
      console.error("Missing XAH_DESTINATION")
      return new Response(
        JSON.stringify({ ok: false, error: "Server config error: Missing destination" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const body: PayloadRequest = await req.json()
    const { amount, memo, returnUrl, player, size } = body

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // BULLETPROOF GAME REDIRECT URL
    const baseDomain = SUPABASE_URL ? SUPABASE_URL.replace('supabase.co', 'yourdomain.com') : 'https://yourdomain.com'
    const gameUrl = `${baseDomain}/chesschessboard?player=${player}&fee=${amount}&size=${size}`
    
    console.log("Chess payment:", { player, amount, size, gameUrl })

    const txjson: Record<string, unknown> = {
      TransactionType: "Payment",
      Destination: DESTINATION,
      Amount: xahToDrops(amount),
      NetworkID: 21337,
    }

    if (memo && memo.trim()) {
      txjson.Memos = [
        {
          Memo: {
            MemoType: stringToHex("text/plain"),
            MemoData: stringToHex(memo.trim()),
          },
        },
      ]
    }

    const payloadOptions: Record<string, unknown> = {
      submit: true,
      expire: 15,  // Increased to 15min for mobile users
    }

    // BULLETPROOF RETURN URL - Always goes to GAME with params
    payloadOptions.return_url = { 
      web: gameUrl,
      app: gameUrl,  // Also for Xaman app
      xapp: gameUrl  // xApp scheme
    }

    if (SUPABASE_URL) {
      payloadOptions.webhook = `${SUPABASE_URL}/functions/v1/xaman-webhook`
    }

    const payload = {
      txjson,
      options: payloadOptions,
      custom_meta: {
        instruction: `Pay ${amount} XAH → PolluxChess Game Room (${size === 1 ? '1vs1' : `${size} Players`})`,
        identifier: `polluxchess-${player?.slice(-6)}-${Date.now()}`,
        ...(player && { player }),  // Embed player ID in meta
        ...(size && { size }),      // Embed tournament size
      },
    }

    const response = await fetch("https://xumm.app/api/v1/platform/payload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": XUMM_API_KEY,
        "X-API-Secret": XUMM_API_SECRET,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Xaman API error:", response.status, errorText)
      return new Response(JSON.stringify({ ok: false, error: `Xaman API: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const data = await response.json()
    console.log("Chess payload created:", data.uuid, gameUrl)

    return new Response(
      JSON.stringify({
        ok: true,
        uuid: data.uuid,
        nextUrl: data.next?.always,
        qrUrl: data.refs?.qr_png,
        websocketUrl: data.refs?.websocket_status,
        gameUrl,  // Frontend fallback
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Edge function error:", error)
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
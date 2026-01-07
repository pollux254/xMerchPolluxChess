// Supabase Edge Function for creating Xahau payment payloads
// Deploy: supabase functions deploy xaman-createPayload
// Secrets: XUMM_API_KEY, XUMM_API_SECRET, XAH_DESTINATION

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface PayloadRequest {
  amount: number
  currency?: string
  issuer?: string | null
  memo?: string
  returnUrl?: string
  player?: string
  size?: number
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
    const { amount, currency = "XAH", issuer, memo, returnUrl, player, size } = body

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("Payment request:", { player, amount, size, currency, returnUrl })

    const txjson: Record<string, unknown> = {
      TransactionType: "Payment",
      Destination: DESTINATION,
      NetworkID: 21337,
    }

    // Handle native XAH vs issued currencies
    if (currency === "XAH" || !issuer) {
      txjson.Amount = xahToDrops(amount)
    } else {
      txjson.Amount = {
        value: String(amount),
        currency: currency,
        issuer: issuer,
      }
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
      expire: 300, // 5 minutes
    }

    // USE THE RETURN URL FROM FRONTEND (not hardcoded!)
    if (returnUrl) {
      payloadOptions.return_url = {
        web: returnUrl,
      }
      console.log("Using returnUrl:", returnUrl)
    }

    // Add webhook if Supabase URL is configured
    if (SUPABASE_URL) {
      payloadOptions.webhook = `${SUPABASE_URL}/functions/v1/xaman-webhook`
    }

    const payload = {
      txjson,
      options: payloadOptions,
      custom_meta: {
        instruction: memo || `Pay ${amount} ${currency} → PolluxChess`,
        identifier: `polluxchess-${Date.now()}`,
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
    console.log("Payload created:", data.uuid)

    return new Response(
      JSON.stringify({
        ok: true,
        uuid: data.uuid,
        nextUrl: data.next?.always,
        qrUrl: data.refs?.qr_png,
        websocketUrl: data.refs?.websocket_status,
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
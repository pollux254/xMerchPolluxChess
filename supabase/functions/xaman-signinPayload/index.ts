// Supabase Edge Function for creating Xahau SignIn payloads
// Deploy: supabase functions deploy xaman-signinPayload
// Secrets: XUMM_API_KEY, XUMM_API_SECRET

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SignInRequest {
  returnUrl?: string
  network?: "mainnet" | "testnet"
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const XUMM_API_KEY = Deno.env.get("XUMM_API_KEY")
    const XUMM_API_SECRET = Deno.env.get("XUMM_API_SECRET")

    if (!XUMM_API_KEY || !XUMM_API_SECRET) {
      console.error("Missing XUMM_API_KEY or XUMM_API_SECRET")
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error: Missing Xaman credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const body: SignInRequest = await req.json()
    const { returnUrl, network } = body

    // ✅ FIXED: Default to testnet instead of mainnet
    const resolvedNetwork = network === "testnet" || network === "mainnet" ? network : "testnet"
    const networkId = resolvedNetwork === "testnet" ? 21338 : 21337

    console.log("🔐 SignIn Edge Function - Network:", resolvedNetwork, "NetworkID:", networkId)

    const txjson: Record<string, unknown> = {
      TransactionType: "SignIn",
      NetworkID: networkId,
    }

    const payloadOptions: Record<string, unknown> = {
      submit: false,
      expire: 300,
    }

    // Only set return URL if provided
    if (returnUrl) {
      payloadOptions.return_url = { web: returnUrl }
    }

    const payload = {
      txjson,
      options: payloadOptions,
      custom_meta: {
        instruction: "Sign in to PolluxChess",
        identifier: `polluxchess-signin-${Date.now()}`,
      },
    }

    console.log("📤 Creating Xaman SignIn payload with NetworkID:", networkId)

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
      return new Response(JSON.stringify({ ok: false, error: `Xaman API error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const data = await response.json()
    console.log("✅ SignIn payload created:", data.uuid, "for", resolvedNetwork)

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
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
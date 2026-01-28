// Supabase Edge Function for creating Xahau SignIn payloads with webhook support
// Deploy: supabase functions deploy xaman-signinPayload
// Secrets: XUMM_API_KEY, XUMM_API_SECRET

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SignInRequest {
  returnUrl?: string
  network?: "mainnet" | "testnet"
  useWebhook?: boolean
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const XUMM_API_KEY = Deno.env.get("XUMM_API_KEY")
    const XUMM_API_SECRET = Deno.env.get("XUMM_API_SECRET")
    const SUPABASE_URL = Deno.env.get("SB_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")

    if (!XUMM_API_KEY || !XUMM_API_SECRET) {
      console.error("Missing XUMM_API_KEY or XUMM_API_SECRET")
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error: Missing Xaman credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const body: SignInRequest = await req.json()
    const { returnUrl, network, useWebhook } = body

    const resolvedNetwork = network === "testnet" || network === "mainnet" ? network : "testnet"
    const networkId = resolvedNetwork === "testnet" ? 21338 : 21337

    console.log("🔐 SignIn Edge Function - Network:", resolvedNetwork, "NetworkID:", networkId, "Webhook:", useWebhook)

    const txjson: Record<string, unknown> = {
      TransactionType: "SignIn",
      NetworkID: networkId,
    }

    const payloadOptions: Record<string, unknown> = {
      submit: false,
      expire: 300,
    }

    // Set return URL if provided
    if (returnUrl) {
      payloadOptions.return_url = { 
        web: returnUrl,
        app: returnUrl 
      }
    }

    const payload: Record<string, unknown> = {
      txjson,
      options: payloadOptions,
      custom_meta: {
        instruction: "Sign in to PolluxChess",
        identifier: `polluxchess-signin-${Date.now()}`,
      },
    }

    // ✅ ADD WEBHOOK if enabled and Supabase is configured
    if (useWebhook && SUPABASE_URL) {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/xaman-signin-webhook`
      payload.user_token = webhookUrl // Store webhook URL
      console.log("🔐 Adding webhook URL:", webhookUrl)
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

    // ✅ REGISTER WEBHOOK with Xaman if enabled
    if (useWebhook && SUPABASE_URL && data.uuid) {
      try {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/xaman-signin-webhook`
        
        const webhookResponse = await fetch(`https://xumm.app/api/v1/platform/payload/${data.uuid}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": XUMM_API_KEY,
            "X-API-Secret": XUMM_API_SECRET,
          },
          body: JSON.stringify({
            webhook: webhookUrl
          }),
        })

        if (webhookResponse.ok) {
          console.log("✅ Webhook registered for signin:", data.uuid)
        } else {
          console.warn("⚠️ Failed to register webhook:", await webhookResponse.text())
        }
      } catch (webhookError) {
        console.warn("⚠️ Webhook registration error:", webhookError)
      }
    }

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
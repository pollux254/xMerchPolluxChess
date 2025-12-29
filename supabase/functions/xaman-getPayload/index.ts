// Supabase Edge Function to get Xumm payload details securely
// Deploy: supabase functions deploy xaman-getPayload
// Uses same secrets: XUMM_API_KEY, XUMM_API_SECRET

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const XUMM_API_KEY = Deno.env.get("XUMM_API_KEY")
    const XUMM_API_SECRET = Deno.env.get("XUMM_API_SECRET")

    if (!XUMM_API_KEY || !XUMM_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "Missing Xumm credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { uuid } = await req.json()

    if (!uuid) {
      return new Response(
        JSON.stringify({ error: "Missing payload UUID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const response = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
      headers: {
        "X-API-Key": XUMM_API_KEY,
        "X-API-Secret": XUMM_API_SECRET,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Xumm payload fetch error:", response.status, errorText)
      return new Response(
        JSON.stringify({ error: "Failed to fetch payload from Xumm" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({
        account: data?.response?.account || null,
        signed: data?.meta?.signed || false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Function error:", error)
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
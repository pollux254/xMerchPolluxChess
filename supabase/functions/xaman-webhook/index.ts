// Supabase Edge Function for handling Xaman webhooks (Xahau)
// Deploy: supabase functions deploy xaman-webhook
// Handles both tournament payments and regular donations

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
/// <reference lib="deno.window" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface WebhookPayload {
  meta: {
    payload_uuidv4?: string
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const XUMM_API_KEY = Deno.env.get("XUMM_API_KEY")
    const XUMM_API_SECRET = Deno.env.get("XUMM_API_SECRET")
    const XAH_DESTINATION = Deno.env.get("XAH_DESTINATION")
    const HOOK_ADDRESS_TESTNET = Deno.env.get("HOOK_ADDRESS_TESTNET")
    const HOOK_ADDRESS_MAINNET = Deno.env.get("HOOK_ADDRESS_MAINNET")
    const SUPABASE_URL = Deno.env.get("SB_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")

    if (!XUMM_API_KEY || !XUMM_API_SECRET) {
      console.error("Missing Xaman API credentials")
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const webhookData: WebhookPayload = await req.json()
    const payloadUuid = webhookData.meta?.payload_uuidv4

    if (!payloadUuid) {
      return new Response(JSON.stringify({ error: "Missing payload UUID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("📥 Webhook received for payload:", payloadUuid)

    const statusResponse = await fetch(`https://xumm.app/api/v1/platform/payload/${payloadUuid}`, {
      method: "GET",
      headers: {
        "X-API-Key": XUMM_API_KEY,
        "X-API-Secret": XUMM_API_SECRET,
      },
    })

    if (!statusResponse.ok) {
      const error = await statusResponse.text()
      console.error("Failed to fetch payload status:", error)
      return new Response(JSON.stringify({ error: "Failed to verify transaction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const payloadStatus = await statusResponse.json()
    const response = payloadStatus.response
    const payload = payloadStatus.payload

    // ✅ DETAILED DEBUG LOGGING
    console.log("🔍 FULL RESPONSE OBJECT:")
    console.log(JSON.stringify(response, null, 2))
    console.log("🔍 FULL PAYLOAD OBJECT:")
    console.log(JSON.stringify(payload, null, 2))
    console.log("🔍 FULL PAYLOAD STATUS:")
    console.log(JSON.stringify(payloadStatus, null, 2))

    if (!response?.dispatched_result) {
      console.log("⚠️ Transaction not submitted")
      return new Response(JSON.stringify({ ok: true, verified: false, reason: "Transaction not submitted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const txResult = response.dispatched_result
    const isSuccess = txResult === "tesSUCCESS"
    
    // ✅ FIX: Get destination from the RIGHT place!
    const txDestination = payload?.tx_destination || 
                         response.destination || 
                         response.dispatched_to || 
                         payload?.request_json?.Destination ||
                         null
                         
    const networkId = response.networkId || response.network_id
    const signerAccount = response.account
    const txHash = response.txid
    const amountDrops = payload?.request_json?.Amount
    const amount = amountDrops ? Number(amountDrops) / 1_000_000 : 0

    console.log("💰 Transaction details:", { 
      txHash, 
      amount, 
      destination: txDestination,
      result: txResult,
      networkId 
    })

    // Decode memo to check if this is a tournament payment
    let memo = ""
    let memoData: any = null
    const memos = payload?.request_json?.Memos
    if (memos && memos[0]?.Memo?.MemoData) {
      try {
        memo = new TextDecoder().decode(
          new Uint8Array(memos[0].Memo.MemoData.match(/.{1,2}/g).map((byte: string) => Number.parseInt(byte, 16))),
        )
        console.log("📝 Decoded memo:", memo)
        
        // Try to parse as JSON for tournament data
        try {
          memoData = JSON.parse(memo)
          console.log("🎮 Parsed memo data:", memoData)
        } catch {
          // Not JSON, regular text memo
          console.log("📝 Memo is plain text, not JSON")
        }
      } catch (e) {
        console.error("Failed to decode memo:", e)
      }
    }

    // Check if destination is Hook address (tournament payment)
    const isHookPayment = txDestination === HOOK_ADDRESS_TESTNET || txDestination === HOOK_ADDRESS_MAINNET
    const isRegularDonation = txDestination === XAH_DESTINATION

    console.log("🔍 Payment type check:", {
      txDestination,
      HOOK_ADDRESS_TESTNET,
      HOOK_ADDRESS_MAINNET,
      XAH_DESTINATION,
      isHookPayment,
      isRegularDonation
    })

    const verified = isSuccess && (isHookPayment || isRegularDonation)

    if (!verified) {
      console.log("❌ Transaction not verified:", { 
        isSuccess, 
        isHookPayment, 
        isRegularDonation,
        txDestination 
      })
      return new Response(
        JSON.stringify({
          ok: true,
          verified: false,
          reason: `Transaction failed or wrong destination`,
          debug: {
            txDestination,
            HOOK_ADDRESS_TESTNET,
            HOOK_ADDRESS_MAINNET,
            isHookPayment,
            isRegularDonation
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ✅ CRITICAL DEBUG - Check database conditions
    console.log("🔍 Database check:", {
      hasSUPABASE_URL: !!SUPABASE_URL,
      hasSUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      isHookPayment,
      memoData,
      "memoData?.action": memoData?.action,
      "memoData?.tournament": memoData?.tournament,
      "memoData?.player": memoData?.player,
      willProcess: isHookPayment && memoData?.action === "join" && memoData?.tournament && memoData?.player
    })

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Handle tournament payment
      if (isHookPayment && memoData?.action === "join" && memoData?.tournament && memoData?.player) {
        console.log("🎮 Processing tournament join:", memoData)

        try {
          // Get tournament details
          const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', memoData.tournament)
            .single()

          if (tournamentError) {
            console.error("❌ Tournament not found:", tournamentError)
            throw tournamentError
          }

          console.log("✅ Tournament found:", tournament.id)

          // Add player to tournament
          // Get current player count for order
          const { count: currentCount } = await supabase
            .from('tournament_players')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', memoData.tournament)

          const { error: playerError } = await supabase
            .from('tournament_players')
            .insert({
              tournament_id: memoData.tournament,
              player_address: memoData.player,
              player_order: (currentCount || 0) + 1,
              status: 'joined',  // CRITICAL FIX: Use 'joined' not 'waiting'
              joined_at: new Date().toISOString()
            })

          if (playerError && playerError.code !== '23505') { // Ignore duplicate
            console.error("❌ Failed to add player:", playerError)
            throw playerError
          }

          console.log("✅ Player added to tournament")

          // Log transaction
          await supabase
            .from('hook_logs')
            .insert({
              tx_hash: txHash,
              tournament_id: memoData.tournament,
              player_address: memoData.player,
              network: memoData.network || 'testnet',
              status: 'success',
              message: `Player ${memoData.player} joined tournament ${memoData.tournament}`
            })

          console.log("✅ Transaction logged")

          // Check if tournament is full
          const { count } = await supabase
            .from('tournament_players')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', memoData.tournament)
            .eq('status', 'joined')  // CRITICAL FIX: Match the insert status

          console.log("👥 Current player count:", count, "/", tournament.tournament_size)

          if (count && count >= tournament.tournament_size) {
            console.log("🎉 Tournament is FULL! Starting...")
            
            // Tournament is full - start it
            await supabase
              .from('tournaments')
              .update({ status: 'in_progress' })
              .eq('id', memoData.tournament)

            console.log("✅ Tournament status updated to in_progress")
          }

        } catch (dbError) {
          console.error("❌ Database error processing tournament:", dbError)
        }
      } 
      // Handle regular donation
      else if (isRegularDonation) {
        console.log("💝 Processing regular donation")
        try {
          const { error: insertError } = await supabase.from("donations").insert({
            network: "xahau",
            amount,
            currency: "XAH",
            memo: memo || null,
            tx_hash: txHash,
            sender_address: signerAccount,
            status: "completed",
            payload_uuid: payloadUuid,
            completed_at: new Date().toISOString(),
          })

          if (insertError) {
            console.error("❌ Failed to store donation:", insertError)
          } else {
            console.log("✅ Donation stored successfully")
          }
        } catch (dbError) {
          console.error("❌ Database error storing donation:", dbError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        verified,
        txHash,
        txResult,
        signerAccount,
        destination: txDestination,
        networkId,
        payloadUuid,
        amount,
        tournamentJoin: isHookPayment && memoData?.action === "join"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("❌ Webhook error:", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

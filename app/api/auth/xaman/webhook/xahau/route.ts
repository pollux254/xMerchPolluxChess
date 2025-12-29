import { NextResponse } from "next/server"

// Webhooks are handled in Supabase Edge Functions now.
// This endpoint stays as a no-op to avoid retries if someone points Xaman to the Next.js URL.
export async function POST() {
  console.warn("[xBase webhook] Received webhook at Next.js route. Use Supabase function xaman-webhook instead.")
  return NextResponse.json({ ok: true, message: "Handled by Supabase Edge Function" })
}

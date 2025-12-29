import { NextResponse } from "next/server"

export async function POST(request: Request) {
  // These match your .env.local exactly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !apikey) {
    console.error("Missing Supabase env vars:", { supabaseUrl: !!supabaseUrl, apikey: !!apikey })
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()

    const res = await fetch(`${supabaseUrl}/functions/v1/xaman-signinPayload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apikey,
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Supabase function error:", data)
      return NextResponse.json({ error: data.error || "Failed to create signin payload" }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Unexpected error in signin route:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
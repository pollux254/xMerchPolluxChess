import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !apikey) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 })
  }

  const body = await request.json()

  const res = await fetch(`${supabaseUrl}/functions/v1/xaman-getPayload`, {
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
    return NextResponse.json({ error: data.error || "Failed to get payload" }, { status: res.status })
  }

  return NextResponse.json(data)
}
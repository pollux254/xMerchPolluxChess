import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const playerAddress = searchParams.get("address")

    if (!playerAddress) {
      return NextResponse.json(
        { error: "Missing player address" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Check if player is in any active tournament
    const { data: playerData, error } = await supabase
      .from("tournament_players")
      .select("tournament_id, status, tournaments(status)")
      .eq("player_address", playerAddress)
      .in("status", ["waiting", "active"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (not an error)
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!playerData) {
      return NextResponse.json({
        inTournament: false,
        tournamentId: null,
        status: null,
      })
    }

    return NextResponse.json({
      inTournament: true,
      tournamentId: playerData.tournament_id,
      status: (playerData.tournaments as any)?.status || "unknown",
    })
  } catch (err: any) {
    console.error("Check player error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
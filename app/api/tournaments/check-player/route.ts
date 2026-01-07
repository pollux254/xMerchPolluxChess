import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const playerAddress = searchParams.get("address")

    if (!playerAddress) {
      return NextResponse.json({ error: "Missing player address" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase config missing for check-player")
      return NextResponse.json({ inTournament: false })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Query with proper type handling
    const { data, error } = await supabase
      .from("tournament_players")
      .select(`
        tournament_id,
        tournaments!inner (
          id,
          status
        )
      `)
      .eq("player_address", playerAddress)
      .in("tournaments.status", ["waiting", "in_progress", "in-progress"])

    if (error) {
      console.error("[Check Player] Supabase error:", error)
      return NextResponse.json({ inTournament: false })
    }

    if (data && data.length > 0) {
      const entry = data[0]
      
      // Handle both possible shapes: tournaments as object or array
      const tournament = Array.isArray(entry.tournaments) 
        ? entry.tournaments[0] 
        : entry.tournaments

      return NextResponse.json({
        inTournament: true,
        tournamentId: entry.tournament_id,
        status: tournament?.status || "waiting",
      })
    }

    return NextResponse.json({ inTournament: false })
  } catch (err) {
    console.error("[Check Player] Unexpected error:", err)
    return NextResponse.json({ inTournament: false })
  }
}
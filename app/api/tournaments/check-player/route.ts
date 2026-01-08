import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    console.log("[Check Player] Starting check for player...")
    
    const { searchParams } = new URL(req.url)
    const playerAddress = searchParams.get("address")

    if (!playerAddress) {
      console.error("[Check Player] Missing player address")
      return NextResponse.json({ error: "Missing player address" }, { status: 400 })
    }

    console.log("[Check Player] Checking player:", playerAddress)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[Check Player] Missing Supabase config")
      return NextResponse.json({ inTournament: false })
    }

    // ✨ BUG FIX 2: Always use service role for consistency with join route
    // This ensures we can read tournament data regardless of RLS policies
    console.log("[Check Player] Using service role for consistent data access")
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get auth session from request headers for logging
    const authHeader = req.headers.get('authorization')
    console.log("[Check Player] Auth header present:", !!authHeader)

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
      console.error("[Check Player] Database error:", error)
      return NextResponse.json({ inTournament: false })
    }

    console.log("[Check Player] Query result:", data)

    if (data && data.length > 0) {
      const entry = data[0]
      const tournament = Array.isArray(entry.tournaments) 
        ? entry.tournaments[0] 
        : entry.tournaments

      console.log("[Check Player] Found tournament:", {
        tournamentId: entry.tournament_id,
        status: tournament?.status
      })

      return NextResponse.json({
        inTournament: true,
        tournamentId: entry.tournament_id,
        status: tournament?.status || "waiting",
      })
    }

    console.log("[Check Player] No tournament found for player")
    return NextResponse.json({ inTournament: false })
  } catch (err) {
    console.error("[Check Player] Unexpected error:", err)
    return NextResponse.json({ inTournament: false })
  }
}

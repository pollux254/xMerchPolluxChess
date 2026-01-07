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
      console.warn("Supabase config missing")
      return NextResponse.json({ inTournament: false })
    }

    // Create client with anon key (will use RLS policies)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get auth session from request headers (if exists)
    const authHeader = req.headers.get('authorization')
    
    // If no auth header, query with service role (temporary fallback)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const queryClient = authHeader && authHeader !== 'Bearer undefined' 
      ? supabase 
      : createClient(supabaseUrl, serviceRoleKey!)

    const { data, error } = await queryClient
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
      console.error("[Check Player] Error:", error)
      return NextResponse.json({ inTournament: false })
    }

    if (data && data.length > 0) {
      const entry = data[0]
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
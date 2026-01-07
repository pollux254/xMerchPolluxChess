import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const playerAddress = searchParams.get("address")

    if (!playerAddress) {
      return NextResponse.json({ error: "Missing player address" }, { status: 400 })
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        inTournament: false,
        message: "Tournament tracking not available",
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if player is in any active tournament
    // This assumes you have a tournaments table with player data
    const { data: activeTournaments, error } = await supabase
      .from("tournaments")
      .select("id, status, players")
      .or("status.eq.waiting,status.eq.in-progress")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({
        inTournament: false,
        message: "Failed to check tournaments",
      })
    }

    // Find if player is in any of these tournaments
    const playerTournament = activeTournaments?.find((tournament) => {
      // Check if players array includes this address
      if (Array.isArray(tournament.players)) {
        return tournament.players.some((p: any) => 
          p === playerAddress || p.address === playerAddress
        )
      }
      return false
    })

    if (playerTournament) {
      return NextResponse.json({
        inTournament: true,
        tournamentId: playerTournament.id,
        status: playerTournament.status,
      })
    }

    return NextResponse.json({
      inTournament: false,
    })
  } catch (err) {
    console.error("Check player error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
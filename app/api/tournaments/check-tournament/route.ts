import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('id')

    if (!tournamentId) {
      return NextResponse.json({ exists: false }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from('tournaments')
      .select('id, status')
      .eq('id', tournamentId)
      .single()

    if (error || !data) {
      console.log(`[Check Tournament] Tournament ${tournamentId} not found:`, error?.message)
      return NextResponse.json({ exists: false })
    }

    console.log(`[Check Tournament] Tournament ${tournamentId} exists with status: ${data.status}`)
    return NextResponse.json({ 
      exists: true, 
      tournamentId: data.id,
      status: data.status 
    })
  } catch (error: any) {
    console.error('[Check Tournament] Error:', error.message)
    return NextResponse.json({ exists: false }, { status: 500 })
  }
}
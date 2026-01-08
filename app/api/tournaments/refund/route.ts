import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerAddress, tournamentId, reason } = body

    console.log('[Refund] Request received:', { playerAddress, tournamentId, reason })

    // TODO: Implement Hooks refund logic here
    // For now, just log and return success
    console.log('[Refund] TODO: Send refund via Hooks')
    console.log('[Refund] Player:', playerAddress)
    console.log('[Refund] Tournament:', tournamentId)
    console.log('[Refund] Reason:', reason)

    // When you implement Hooks, you'll:
    // 1. Get tournament entry fee and currency
    // 2. Create Hook transaction to send refund
    // 3. Return transaction hash

    return NextResponse.json({
      success: true,
      message: 'Refund requested (Hooks integration pending)',
      playerAddress,
      tournamentId,
      note: 'This is a placeholder. Implement Hooks refund logic here.'
    })

  } catch (error: any) {
    console.error('[Refund] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
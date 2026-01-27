import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const startTime = Date.now()
  
  try {
    const { uuid } = await params
    console.log(`[API-VERIFY] Request for UUID: ${uuid}`)

    // Validate UUID format (basic check)
    if (!uuid || uuid.length < 10) {
      console.error('[API-VERIFY] Invalid UUID format')
      return NextResponse.json(
        { error: 'Invalid UUID', signed: false },
        { status: 400 }
      )
    }

    // Check environment variables
    if (!process.env.XAMAN_API_KEY || !process.env.XAMAN_API_SECRET) {
      console.error('[API-VERIFY] Missing Xaman credentials')
      return NextResponse.json(
        { error: 'Server configuration error', signed: false },
        { status: 500 }
      )
    }

    // Call Xaman API
    console.log('[API-VERIFY] Calling Xaman API...')
    const xamanUrl = `https://xumm.app/api/v1/platform/payload/${uuid}`
    
    const response = await fetch(xamanUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.XAMAN_API_KEY,
        'X-API-Secret': process.env.XAMAN_API_SECRET,
      },
    })

    console.log('[API-VERIFY] Xaman API status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API-VERIFY] Xaman API error:', errorText)
      return NextResponse.json(
        { error: `Xaman API error: ${response.status}`, signed: false },
        { status: response.status }
      )
    }

    // Parse response
    const data = await response.json()
    
    // Log the FULL response for debugging
    console.log('[API-VERIFY] === FULL XAMAN RESPONSE ===')
    console.log(JSON.stringify(data, null, 2))
    console.log('[API-VERIFY] === END RESPONSE ===')

    // Extract key information
    const isSigned = data.meta?.signed === true
    const isResolved = data.meta?.resolved === true
    
    // Try to find account in multiple possible locations
    let account = null
    
    // Location 1: response.account (most common)
    if (data.response?.account) {
      account = data.response.account
      console.log('[API-VERIFY] ✅ Found account in response.account:', account)
    }
    
    // Location 2: response.signer (alternative)
    if (!account && data.response?.signer) {
      account = data.response.signer
      console.log('[API-VERIFY] ✅ Found account in response.signer:', account)
    }
    
    // Location 3: application.issued_user_token
    if (!account && data.application?.issued_user_token) {
      account = data.application.issued_user_token
      console.log('[API-VERIFY] ✅ Found account in issued_user_token:', account)
    }

    // Prepare response
    const result = {
      signed: isSigned,
      resolved: isResolved,
      account: account,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    }

    console.log('[API-VERIFY] Returning:', result)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })

  } catch (error) {
    console.error('[API-VERIFY] Exception:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        signed: false,
        timestamp: Date.now(),
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> }
) {
  const startTime = Date.now()
  
  try {
    // ✅ AWAIT PARAMS (Next.js 15 requirement)
    console.log('[API-VERIFY] === REQUEST START ===')
    console.log('[API-VERIFY] Awaiting params...')
    
    const params = await context.params
    const uuid = params.uuid
    
    console.log(`[API-VERIFY] UUID received: ${uuid}`)
    console.log(`[API-VERIFY] Timestamp: ${new Date().toISOString()}`)

    // ✅ VALIDATE UUID
    if (!uuid || uuid.length < 10) {
      console.error('[API-VERIFY] ❌ Invalid UUID format')
      return NextResponse.json(
        { error: 'Invalid UUID', signed: false },
        { status: 400 }
      )
    }

    // ✅ CHECK ENVIRONMENT VARIABLES
    const apiKey = process.env.XAMAN_API_KEY
    const apiSecret = process.env.XAMAN_API_SECRET
    
    console.log('[API-VERIFY] Checking credentials...')
    console.log('[API-VERIFY] Has API Key:', !!apiKey, apiKey ? `(${apiKey.substring(0, 8)}...)` : '(missing)')
    console.log('[API-VERIFY] Has API Secret:', !!apiSecret, apiSecret ? `(${apiSecret.substring(0, 8)}...)` : '(missing)')
    
    if (!apiKey || !apiSecret) {
      console.error('[API-VERIFY] ❌ Missing Xaman credentials')
      return NextResponse.json(
        { error: 'Server configuration error - missing credentials', signed: false },
        { status: 500 }
      )
    }

    console.log('[API-VERIFY] ✅ Credentials validated')

    // ✅ CALL XAMAN API
    const xamanUrl = `https://xumm.app/api/v1/platform/payload/${uuid}`
    console.log(`[API-VERIFY] Calling Xaman API: ${xamanUrl}`)
    
    const response = await fetch(xamanUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
        'Content-Type': 'application/json',
      },
    })

    console.log(`[API-VERIFY] Xaman API status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API-VERIFY] ❌ Xaman API error:')
      console.error('[API-VERIFY] Status:', response.status)
      console.error('[API-VERIFY] Response:', errorText)
      return NextResponse.json(
        { 
          error: `Xaman API error: ${response.status}`, 
          signed: false,
          details: errorText 
        },
        { status: response.status }
      )
    }

    // ✅ PARSE RESPONSE
    console.log('[API-VERIFY] Parsing Xaman response...')
    const data = await response.json()
    
    console.log('[API-VERIFY] === FULL XAMAN RESPONSE ===')
    console.log(JSON.stringify(data, null, 2))
    console.log('[API-VERIFY] === END RESPONSE ===')

    // ✅ EXTRACT DATA
    const isSigned = data.meta?.signed === true
    const isResolved = data.meta?.resolved === true
    
    console.log('[API-VERIFY] Metadata:', {
      signed: isSigned,
      resolved: isResolved,
      hasResponse: !!data.response,
      hasMeta: !!data.meta,
    })
    
    // Try multiple locations for account
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

    // Location 4: response.dispatched_to
    if (!account && data.response?.dispatched_to) {
      account = data.response.dispatched_to
      console.log('[API-VERIFY] ✅ Found account in dispatched_to:', account)
    }
    
    // Location 5: response.txjson.Account
    if (!account && data.response?.txjson?.Account) {
      account = data.response.txjson.Account
      console.log('[API-VERIFY] ✅ Found account in txjson.Account:', account)
    }

    if (account) {
      console.log(`[API-VERIFY] ✅ Final account extracted: ${account}`)
    } else {
      console.log('[API-VERIFY] ⚠️ No account found in any known location')
    }

    // ✅ PREPARE RESPONSE
    const result = {
      signed: isSigned,
      resolved: isResolved,
      account: account,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    }

    console.log('[API-VERIFY] === RETURNING RESULT ===')
    console.log(JSON.stringify(result, null, 2))
    console.log('[API-VERIFY] === REQUEST END ===')

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })

  } catch (error: any) {
    console.error('[API-VERIFY] ❌❌❌ EXCEPTION CAUGHT ❌❌❌')
    console.error('[API-VERIFY] Error type:', typeof error)
    console.error('[API-VERIFY] Error name:', error?.name)
    console.error('[API-VERIFY] Error message:', error?.message)
    console.error('[API-VERIFY] Error stack:', error?.stack)
    console.error('[API-VERIFY] Full error:', JSON.stringify(error, null, 2))
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.name || 'Unknown',
        signed: false,
        timestamp: Date.now(),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    )
  }
}
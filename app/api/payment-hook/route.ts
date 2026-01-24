import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { amount, currency, issuer, destination, memo, network } = await req.json()
    
    console.log('🪝 [Payment-Hook] Creating Hook payment payload')
    console.log('  Amount:', amount)
    console.log('  Currency:', currency)
    console.log('  Destination:', destination)
    console.log('  Network:', network)
    
    // CRITICAL: Check environment variables exist
    if (!process.env.XAMAN_API_KEY) {
      console.error('❌ XAMAN_API_KEY is not set in environment variables!')
      return NextResponse.json(
        { error: 'Xaman API not configured - missing API key' },
        { status: 500 }
      )
    }
    
    if (!process.env.XAMAN_API_SECRET) {
      console.error('❌ XAMAN_API_SECRET is not set in environment variables!')
      return NextResponse.json(
        { error: 'Xaman API not configured - missing API secret' },
        { status: 500 }
      )
    }
    
    console.log('✅ Xaman credentials present')
    console.log('  API Key prefix:', process.env.XAMAN_API_KEY.substring(0, 8) + '...')
    
    const xamanNetwork = network === 'testnet' ? 'Testnet' : 'Mainnet'
    console.log('  Xaman Network:', xamanNetwork)
    
    // Build transaction JSON
    const txjson: any = {
      TransactionType: 'Payment',
      Destination: destination,
      Amount: currency === 'XAH' || currency === 'EVR'
        ? String(amount * 1000000) // Convert to drops for native tokens
        : {
            currency,
            issuer,
            value: String(amount)
          }
    }
    
    // Add memo if provided
    if (memo) {
      txjson.Memos = [{
        Memo: {
          MemoData: Buffer.from(memo).toString('hex')
        }
      }]
    }
    
    console.log('📤 Sending to Xaman API...')
    console.log('  Transaction:', JSON.stringify(txjson, null, 2))
    
    // Create Xaman payload
    const xamanRes = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.XAMAN_API_KEY,
        'X-API-Secret': process.env.XAMAN_API_SECRET,
      },
      body: JSON.stringify({
        txjson,
        options: {
          submit: true,
          multisign: false,
          expire: 5,
          network: xamanNetwork
        }
      })
    })

    console.log('📡 Xaman response status:', xamanRes.status)
    
    if (!xamanRes.ok) {
      const errorText = await xamanRes.text()
      console.error('❌ Xaman API error response:', errorText)
      console.error('  Status code:', xamanRes.status)
      console.error('  Status text:', xamanRes.statusText)
      
      // Try to parse as JSON for better error message
      let errorMessage = 'Xaman API error'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorJson.message || errorText
        console.error('  Parsed error:', errorMessage)
        
        // Log additional error details if available
        if (errorJson.error?.code) {
          console.error('  Error code:', errorJson.error.code)
        }
        if (errorJson.error?.reference) {
          console.error('  Error reference:', errorJson.error.reference)
        }
      } catch (e) {
        console.error('  Raw error (not JSON):', errorText)
        errorMessage = errorText
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: xamanRes.status }
      )
    }

    const xamanData = await xamanRes.json()
    
    console.log('✅ Xaman payload created successfully')
    console.log('  UUID:', xamanData.uuid)
    console.log('  Next URL:', xamanData.next?.always)
    console.log('  WebSocket:', xamanData.refs?.websocket_status)
    
    // Validate response has required fields
    if (!xamanData.uuid || !xamanData.next?.always || !xamanData.refs?.websocket_status) {
      console.error('❌ Xaman response missing required fields:', xamanData)
      return NextResponse.json(
        { error: 'Invalid Xaman response - missing required fields' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      uuid: xamanData.uuid,
      nextUrl: xamanData.next.always,
      websocketUrl: xamanData.refs.websocket_status
    })
    
  } catch (error: any) {
    console.error('❌ Payment Hook API exception:', error)
    console.error('  Error name:', error.name)
    console.error('  Error message:', error.message)
    if (error.stack) {
      console.error('  Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create payment payload' },
      { status: 500 }
    )
  }
}
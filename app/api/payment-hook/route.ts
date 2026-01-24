// app/api/payment-hook/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { amount, currency, issuer, destination, memo, network } = await req.json()
    
    const xamanNetwork = network === 'testnet' ? 'Testnet' : 'Mainnet'
    
    // Create Xaman payload for Hook payment
    const xamanRes = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.XAMAN_API_KEY!,
        'X-API-Secret': process.env.XAMAN_API_SECRET!,
      },
      body: JSON.stringify({
        txjson: {
          TransactionType: 'Payment',
          Destination: destination, // Hook account
          Amount: currency === 'XAH' 
            ? String(amount * 1000000) // Convert to drops
            : {
                currency,
                issuer,
                value: String(amount)
              },
          Memos: memo ? [{
            Memo: {
              MemoData: Buffer.from(memo).toString('hex')
            }
          }] : undefined
        },
        options: {
          submit: true,
          multisign: false,
          expire: 5,
          network: xamanNetwork
        }
      })
    })

    if (!xamanRes.ok) {
      throw new Error('Xaman API error')
    }

    const xamanData = await xamanRes.json()
    
    return NextResponse.json({
      uuid: xamanData.uuid,
      nextUrl: xamanData.next.always,
      websocketUrl: xamanData.refs.websocket_status
    })
    
  } catch (error: any) {
    console.error('Payment Hook API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    )
  }
}
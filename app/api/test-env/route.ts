import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    xaman_key_exists: !!process.env.XAMAN_API_KEY,
    xaman_secret_exists: !!process.env.XAMAN_API_SECRET,
    xumm_key_exists: !!process.env.XUMM_API_KEY,
    xumm_secret_exists: !!process.env.XUMM_API_SECRET,
    xaman_key_length: process.env.XAMAN_API_KEY?.length || 0,
    xaman_key_preview: process.env.XAMAN_API_KEY?.substring(0, 8) || 'NOT_SET',
    node_env: process.env.NODE_ENV,
  })
}
import { NextResponse } from 'next/server';

// Placeholder price endpoint to keep the API route a valid module for Next.js.
export async function GET() {
  return NextResponse.json({ price: null, source: 'placeholder' });
}

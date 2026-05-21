import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const data = await res.json()
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (!rate) return NextResponse.json({ error: 'rate not found' }, { status: 404 })
    return NextResponse.json({ rate }) // 1달러 = rate원
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
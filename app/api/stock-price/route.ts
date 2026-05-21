import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  const market = searchParams.get('market')
  const date = searchParams.get('date')

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  }

  const apiKey = process.env.POLYGON_API_KEY

  try {
    let symbol = ticker.toUpperCase()
    
    if (market === 'KRX') {
      const yahooSymbol = `${ticker}.KS`
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const data = await res.json()
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price) return NextResponse.json({ ticker: yahooSymbol, price })
      return NextResponse.json({ error: 'price not found' }, { status: 404 })
    }

    if (date) {
      const targetDate = new Date(date)
      const dateStr = targetDate.toISOString().split('T')[0]
      const url = `https://api.polygon.io/v1/open-close/${symbol}/${dateStr}?adjusted=true&apiKey=${apiKey}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.close) {
        return NextResponse.json({ ticker: symbol, price: data.close })
      }
      return NextResponse.json({ error: 'price not found' }, { status: 404 })
} else {
      const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${apiKey}`
      const res = await fetch(url)
      const data = await res.json()
      console.log('polygon response:', JSON.stringify(data).substring(0, 200))
      if (data.results?.[0]?.c) {
        return NextResponse.json({ ticker: symbol, price: data.results[0].c })
      }
      return NextResponse.json({ error: 'price not found', debug: data }, { status: 404 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
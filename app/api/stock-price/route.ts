import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  const market = searchParams.get('market')
  const date = searchParams.get('date')

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  }

  try {
    let symbol = ticker
    if (market === 'KRX') {
      symbol = `${ticker}.KS`
    }

    let url = ''

    if (date) {
      const targetDate = new Date(date)
      const period1 = Math.floor(targetDate.getTime() / 1000)
      const period2 = period1 + 86400
      url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`
    } else {
      url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com',
      },
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      return NextResponse.json({ error: `yahoo responded ${res.status}` }, { status: 404 })
    }

    const data = await res.json()

    let price = null

    if (date) {
      const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
      if (closes && closes.length > 0) {
        price = closes.find((c: number) => c !== null)
      }
    } else {
      price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    }

    if (!price) {
      return NextResponse.json({ error: 'price not found' }, { status: 404 })
    }

    return NextResponse.json({ ticker: symbol, price })
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  const market = searchParams.get('market')
  const date = searchParams.get('date') // 과거 날짜 (ISO 형식: 2026-04-14T11:44:00)

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
      // 과거 가격 조회
      const targetDate = new Date(date)
      const period1 = Math.floor(targetDate.getTime() / 1000)
      // 하루 뒤까지 범위 설정
      const period2 = period1 + 86400
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`
    } else {
      // 현재가 조회
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const data = await res.json()

    let price = null

    if (date) {
      // 과거 가격은 close 가격 사용
      const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
      if (closes && closes.length > 0) {
        price = closes[0]
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
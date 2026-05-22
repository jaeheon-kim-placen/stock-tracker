export const runtime = 'edge'
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
    // 한국 주식: 네이버 금융
    if (market === 'KRX') {
      const res = await fetch(`https://finance.naver.com/item/main.naver?code=${ticker}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const html = await res.text()
      const match = html.match(/<strong id="_nowVal"[^>]*>([\d,]+)<\/strong>/)
      if (match) {
        return NextResponse.json({ ticker, price: parseFloat(match[1].replace(/,/g, '')) })
      }
      return NextResponse.json({ error: 'price not found' }, { status: 404 })
    }

    const symbol = ticker.toUpperCase()

    // Yahoo Finance crumb 방식
    // 1. 먼저 crumb 가져오기
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Cookie': 'GUCS=AQABCAFn; B=abc123'
      }
    })
    const crumb = await crumbRes.text()

    if (date) {
      const targetDate = new Date(date)
      const period1 = Math.floor(targetDate.getTime() / 1000)
      const period2 = period1 + 86400
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}&crumb=${crumb}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': 'GUCS=AQABCAFn; B=abc123'
        }
      })
      const data = await res.json()
      const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
      if (closes?.length > 0) {
        const price = closes.find((c: number) => c !== null)
        if (price) return NextResponse.json({ ticker, price })
      }
    } else {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d&crumb=${crumb}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': 'GUCS=AQABCAFn; B=abc123'
        }
      })
      const data = await res.json()
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price) return NextResponse.json({ ticker, price })
    }

    return NextResponse.json({ error: 'price not found' }, { status: 404 })
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
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

  const polygonKey = process.env.POLYGON_API_KEY

  try {
    const symbol = ticker.toUpperCase()

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

    // 과거 가격: Polygon
    if (date) {
      const dateStr = new Date(date).toISOString().split('T')[0]
      const res = await fetch(`https://api.polygon.io/v1/open-close/${symbol}/${dateStr}?adjusted=true&apiKey=${polygonKey}`)
      const data = await res.json()
      if (data.close) return NextResponse.json({ ticker, price: data.close })
      return NextResponse.json({ error: 'price not found' }, { status: 404 })
    }

    // 현재가: Polygon 먼저 시도
    const polygonRes = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${polygonKey}`)
    const polygonData = await polygonRes.json()
    if (polygonData.results?.[0]?.c) {
      return NextResponse.json({ ticker, price: polygonData.results[0].c })
    }

    // Polygon 실패시 stooq 폴백 (5초 타임아웃)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const stooqRes = await fetch(`https://stooq.com/q/l/?s=${ticker.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal
      })
      clearTimeout(timeout)
      const text = await stooqRes.text()
      const lines = text.trim().split('\n')
      if (lines.length >= 2) {
        const values = lines[1].split(',')
        const price = parseFloat(values[6])
        if (price) return NextResponse.json({ ticker, price })
      }
    } catch (e) {
      clearTimeout(timeout)
    }

    return NextResponse.json({ error: 'price not found' }, { status: 404 })

  } catch (e) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
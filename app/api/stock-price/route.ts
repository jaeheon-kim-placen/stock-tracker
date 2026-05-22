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
    let price = null

    if (market === 'KRX') {
      // 한국 주식: 네이버 금융
      const url = `https://finance.naver.com/item/main.naver?code=${ticker}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const html = await res.text()
      const match = html.match(/<strong id="_nowVal"[^>]*>([\d,]+)<\/strong>/)
      if (match) {
        price = parseFloat(match[1].replace(/,/g, ''))
      }
    } else {
      // 미국 주식: stooq
      const symbol = `${ticker.toLowerCase()}.us`
      
      if (date) {
        const targetDate = new Date(date)
        const dateStr = targetDate.toISOString().split('T')[0].replace(/-/g, '')
        const url = `https://stooq.com/q/d/l/?s=${symbol}&d1=${dateStr}&d2=${dateStr}&i=d`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const text = await res.text()
        const lines = text.trim().split('\n')
        if (lines.length >= 2) {
          const values = lines[1].split(',')
          price = parseFloat(values[4]) // Close price
        }
      } else {
        const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const text = await res.text()
        const lines = text.trim().split('\n')
        if (lines.length >= 2) {
          const values = lines[1].split(',')
          price = parseFloat(values[6]) // Close price
        }
      }
    }

    if (!price) {
      return NextResponse.json({ error: 'price not found' }, { status: 404 })
    }

    return NextResponse.json({ ticker, price })
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
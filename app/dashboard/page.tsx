'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Order = {
  id: number
  person_name: string
  stock_code: string
  stock_name: string
  market: string
  action: string
  price_at_order: number | null
  quantity: string
  amount: string
  message_original: string
  messaged_at: string
}

type Portfolio = {
  id: number
  user_id: string
  order_id: number | null
  stock_code: string
  stock_name: string
  market: string
  action: string
  my_quantity: number | null
  my_amount: number | null
  my_price: number | null
  messaged_at: string
  exchange_rate_at_purchase: number | null
}

type HoldingSummary = {
  stock_code: string
  stock_name: string
  market: string
  total_quantity: number
  avg_price: number
  total_amount_usd: number
  total_amount_krw: number
  avg_exchange_rate: number
}

type PortfolioModalData = {
  order: Order | null
  historicalPrice: number | null
  mode: 'buy' | 'sell'
  stock_code?: string
  stock_name?: string
  market?: string
}

export default function DashboardPage() {
  const [tab, setTab] = useState<'feed' | 'portfolio'>('feed')
  const [orders, setOrders] = useState<Order[]>([])
  const [portfolio, setPortfolio] = useState<Portfolio[]>([])
  const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<number>>(new Set())
  const [prices, setPrices] = useState<{[key: string]: number}>({})
  const [historicalPrices, setHistoricalPrices] = useState<{[key: number]: number}>({})
  const [exchangeRate, setExchangeRate] = useState<number>(1380)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [showHidden, setShowHidden] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState<PortfolioModalData | null>(null)
  const [myQuantity, setMyQuantity] = useState('')
  const [myAmount, setMyAmount] = useState('')
  const [myPrice, setMyPrice] = useState('')
  const [amountCurrency, setAmountCurrency] = useState<'USD' | 'KRW'>('USD')
  const [lastChanged, setLastChanged] = useState<'price' | 'qty' | 'amount' | null>(null)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchExchangeRate()
  }, [])

  useEffect(() => {
    const price = parseFloat(myPrice)
    const qty = parseFloat(myQuantity)
    const amount = parseFloat(myAmount)

    if (lastChanged === 'price' || lastChanged === 'qty') {
      if (price > 0 && qty > 0) {
        const usd = price * qty
        setMyAmount(amountCurrency === 'USD' ? usd.toFixed(2) : Math.round(usd * exchangeRate).toString())
      }
    } else if (lastChanged === 'amount') {
      if (amount > 0 && qty > 0) {
        const usd = amountCurrency === 'USD' ? amount : amount / exchangeRate
        setMyPrice((usd / qty).toFixed(2))
      } else if (amount > 0 && price > 0) {
        const usd = amountCurrency === 'USD' ? amount : amount / exchangeRate
        setMyQuantity((usd / price).toFixed(4))
      }
    }
  }, [myPrice, myQuantity, myAmount, lastChanged])

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('/api/exchangerate')
      const data = await res.json()
      if (data.rate) setExchangeRate(data.rate)
    } catch (e) {}
  }

  const checkAuth = async () => {
    const supabase = createClient()  // ← 여기 추가
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    fetchOrders()
    fetchPortfolio(session.user.id)
    fetchHiddenOrders(session.user.id)
  }

  const fetchOrders = async () => {
    const supabase = createClient()  // ← 여기 추가
    const { data } = await supabase.from('orders').select('*').order('messaged_at', { ascending: false })
    if (data) { setOrders(data); fetchCurrentPrices(data); fetchHistoricalPrices(data) }
    setLoading(false)
  }

  const fetchPortfolio = async (uid: string) => {
    const supabase = createClient()  // ← 여기 추가
    const { data } = await supabase.from('portfolios').select('*').eq('user_id', uid).order('messaged_at', { ascending: false })
    if (data) setPortfolio(data)
  }

  const fetchHiddenOrders = async (uid: string) => {
    const supabase = createClient()  // ← 여기 추가
    const { data } = await supabase.from('hidden_orders').select('order_id').eq('user_id', uid)
    if (data) setHiddenOrderIds(new Set(data.map(h => h.order_id)))
  }

  const fetchCurrentPrices = async (orders: Order[]) => {
    const uniqueTickers = [...new Set(orders.map(o => o.stock_code).filter(Boolean))]
    const newPrices: {[key: string]: number} = {}
    const chunkSize = 5
    for (let i = 0; i < uniqueTickers.length; i += chunkSize) {
      const chunk = uniqueTickers.slice(i, i + chunkSize)
      await Promise.all(chunk.map(async (ticker) => {
        const order = orders.find(o => o.stock_code === ticker)
        try {
          const res = await fetch(`/api/stock-price?ticker=${ticker}&market=${order?.market}`)
          const data = await res.json()
          if (data.price) newPrices[ticker] = data.price
        } catch (e) {}
      }))
      setPrices({...newPrices})
      if (i + chunkSize < uniqueTickers.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

const fetchHistoricalPrices = async (orders: Order[]) => {
    const targets = orders.filter(o => !o.price_at_order && o.stock_code && o.messaged_at).slice(0, 50)
    const newHistoricalPrices: {[key: number]: number} = {}
    const chunkSize = 5
    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize)
      await Promise.all(chunk.map(async (order) => {
        try {
          const res = await fetch(`/api/stock-price?ticker=${order.stock_code}&market=${order.market}&date=${order.messaged_at}`)
          const data = await res.json()
          if (data.price) newHistoricalPrices[order.id] = data.price
        } catch (e) {}
      }))
      setHistoricalPrices({...newHistoricalPrices})
      if (i + chunkSize < targets.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  const hideOrder = async (orderId: number) => {
    const supabase = createClient()  // ← 여기 추가
    if (!userId) return
    await supabase.from('hidden_orders').insert({ user_id: userId, order_id: orderId })
    setHiddenOrderIds(prev => new Set([...prev, orderId]))
  }

  const unhideOrder = async (orderId: number) => {
    const supabase = createClient()  // ← 여기 추가
    if (!userId) return
    await supabase.from('hidden_orders').delete().eq('user_id', userId).eq('order_id', orderId)
    setHiddenOrderIds(prev => { const next = new Set(prev); next.delete(orderId); return next })
  }

  const hideSelected = async () => {
    const supabase = createClient()  // ← 여기 추가
    if (!userId || selectedIds.size === 0) return
    await Promise.all([...selectedIds].map(id =>
      supabase.from('hidden_orders').upsert({ user_id: userId, order_id: id })
    ))
    setHiddenOrderIds(prev => new Set([...prev, ...selectedIds]))
    setSelectedIds(new Set())
  }

  const hideAll = async () => {
    const supabase = createClient()  // ← 여기 추가
    if (!userId) return
    const visibleIds = visibleOrders.filter(o => !hiddenOrderIds.has(o.id)).map(o => o.id)
    await Promise.all(visibleIds.map(id =>
      supabase.from('hidden_orders').upsert({ user_id: userId, order_id: id })
    ))
    setHiddenOrderIds(prev => new Set([...prev, ...visibleIds]))
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const visibleNonHidden = visibleOrders.filter(o => !hiddenOrderIds.has(o.id)).map(o => o.id)
    if (selectedIds.size === visibleNonHidden.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleNonHidden))
    }
  }

  const getHoldings = (): HoldingSummary[] => {
    const map: {[key: string]: HoldingSummary} = {}
    portfolio.filter(p => p.action === 'BUY').forEach(p => {
      const key = p.stock_code
      if (!map[key]) map[key] = { stock_code: p.stock_code, stock_name: p.stock_name, market: p.market, total_quantity: 0, avg_price: 0, total_amount_usd: 0, total_amount_krw: 0, avg_exchange_rate: 0 }
      const qty = p.my_quantity || 0
      const price = p.my_price || 0
      const amountUSD = p.my_amount || (qty * price)
      const rate = p.exchange_rate_at_purchase || exchangeRate
      const amountKRW = amountUSD * rate
      const prevQty = map[key].total_quantity
      const prevAvgPrice = map[key].avg_price
      map[key].total_quantity += qty
      map[key].total_amount_usd += amountUSD
      map[key].total_amount_krw += amountKRW
      if (map[key].total_quantity > 0 && price > 0) {
        map[key].avg_price = (prevQty * prevAvgPrice + qty * price) / map[key].total_quantity
      }
      if (map[key].total_amount_usd > 0) {
        map[key].avg_exchange_rate = map[key].total_amount_krw / map[key].total_amount_usd
      }
    })
    portfolio.filter(p => p.action === 'SELL').forEach(p => {
      const key = p.stock_code
      if (map[key]) {
        const qty = p.my_quantity || 0
        const ratio = map[key].total_quantity > 0 ? qty / map[key].total_quantity : 0
        map[key].total_quantity -= qty
        map[key].total_amount_usd -= map[key].total_amount_usd * ratio
        map[key].total_amount_krw -= map[key].total_amount_krw * ratio
        if (map[key].total_quantity <= 0) delete map[key]
      }
    })
    return Object.values(map)
  }

  const getTotalPortfolioStats = () => {
    const holdings = getHoldings()
    let totalInvestUSD = 0, totalInvestKRW = 0, totalCurrentUSD = 0, totalCurrentKRW = 0
    holdings.forEach(h => {
      const currentPrice = prices[h.stock_code]
      if (!currentPrice) return
      totalInvestUSD += h.total_amount_usd
      totalInvestKRW += h.total_amount_krw
      totalCurrentUSD += currentPrice * h.total_quantity
      totalCurrentKRW += currentPrice * h.total_quantity * exchangeRate
    })
    if (totalInvestUSD === 0) return null
    const profitUSD = totalCurrentUSD - totalInvestUSD
    const profitKRW = totalCurrentKRW - totalInvestKRW
    return {
      totalInvestUSD, totalInvestKRW, totalCurrentUSD, totalCurrentKRW,
      profitUSD, profitKRW,
      rateUSD: (profitUSD / totalInvestUSD) * 100,
      rateKRW: (profitKRW / totalInvestKRW) * 100
    }
  }

  const isInPortfolio = (orderId: number) => portfolio.some(p => p.order_id === orderId)

  const resetModal = () => {
    setMyQuantity('')
    setMyAmount('')
    setMyPrice('')
    setLastChanged(null)
    setAmountCurrency('USD')
  }

  const openBuyModal = (order: Order) => {
    const historicalPrice = historicalPrices[order.id] || null
    resetModal()
    setModal({ order, historicalPrice, mode: 'buy' })
    if (historicalPrice) setMyPrice(historicalPrice.toString())
  }

  const openAddBuyModal = (holding: HoldingSummary) => {
    resetModal()
    setModal({ order: null, historicalPrice: null, mode: 'buy', stock_code: holding.stock_code, stock_name: holding.stock_name, market: holding.market })
    if (prices[holding.stock_code]) setMyPrice(prices[holding.stock_code].toString())
  }

  const openSellModal = (holding: HoldingSummary) => {
    resetModal()
    setModal({ order: null, historicalPrice: null, mode: 'sell', stock_code: holding.stock_code, stock_name: holding.stock_name, market: holding.market })
    if (prices[holding.stock_code]) setMyPrice(prices[holding.stock_code].toString())
  }

  const saveToPortfolio = async () => {
    const supabase = createClient()  // ← 여기 추가
    if (!modal || !userId) return
    setSaving(true)
    const amountUSD = myAmount ? (amountCurrency === 'USD' ? parseFloat(myAmount) : parseFloat(myAmount) / exchangeRate) : null
    const payload: any = {
      user_id: userId,
      stock_code: modal.order?.stock_code || modal.stock_code,
      stock_name: modal.order?.stock_name || modal.stock_name,
      market: modal.order?.market || modal.market,
      action: modal.mode === 'buy' ? 'BUY' : 'SELL',
      my_quantity: myQuantity ? parseFloat(myQuantity) : null,
      my_amount: amountUSD,
      my_price: myPrice ? parseFloat(myPrice) : null,
      messaged_at: modal.order?.messaged_at || new Date().toISOString(),
      exchange_rate_at_purchase: exchangeRate
    }
    if (modal.order) payload.order_id = modal.order.id
    const { error } = await supabase.from('portfolios').insert(payload)
    if (!error) { fetchPortfolio(userId); setModal(null) }
    setSaving(false)
  }

  const removeFromPortfolio = async (orderId: number) => {
    const supabase = createClient()  // ← 여기 추가
    if (!userId) return
    await supabase.from('portfolios').delete().eq('order_id', orderId).eq('user_id', userId)
    fetchPortfolio(userId)
  }

  const getProfitRate = (order: Order) => {
    const currentPrice = prices[order.stock_code]
    const orderPrice = order.price_at_order || historicalPrices[order.id]
    if (!orderPrice || !currentPrice) return null
    const rate = ((currentPrice - orderPrice) / orderPrice) * 100
    return { rate: rate.toFixed(2), currentPrice, orderPrice, isHistorical: !order.price_at_order }
  }

  const getHoldingProfit = (holding: HoldingSummary) => {
    const currentPrice = prices[holding.stock_code]
    if (!currentPrice || !holding.avg_price) return null
    const rateUSD = ((currentPrice - holding.avg_price) / holding.avg_price) * 100
    const profitUSD = (currentPrice - holding.avg_price) * holding.total_quantity
    const currentKRW = currentPrice * holding.total_quantity * exchangeRate
    const profitKRW = currentKRW - holding.total_amount_krw
    const rateKRW = holding.total_amount_krw > 0 ? (profitKRW / holding.total_amount_krw) * 100 : 0
    return { rateUSD: rateUSD.toFixed(2), rateKRW: rateKRW.toFixed(2), currentPrice, profitUSD, profitKRW }
  }

  const formatUSD = (val: number) => `$${val.toLocaleString(undefined, {maximumFractionDigits: 2})}`
  const formatKRW = (val: number) => `₩${Math.round(val).toLocaleString()}`
  const formatWithKRW = (usd: number) => `${formatUSD(usd)} (≈ ${formatKRW(usd * exchangeRate)})`

  const handleLogout = async () => { 
  const supabase = createClient()
  await supabase.auth.signOut()
  router.push('/login') 
}

  const visibleOrders = orders.filter(o => {
    const matchFilter = filter === 'ALL' ? true : o.action === filter
    const matchHidden = showHidden ? true : !hiddenOrderIds.has(o.id)
    return matchFilter && matchHidden
  })

  const visibleNonHiddenCount = visibleOrders.filter(o => !hiddenOrderIds.has(o.id)).length
  const holdings = getHoldings()
  const totalStats = getTotalPortfolioStats()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">📈 Stock Tracker</h1>
        <div className="flex gap-3">
          <button onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white text-sm">관리자</button>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">로그아웃</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('feed')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'feed' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            📋 오더 피드
          </button>
          <button onClick={() => setTab('portfolio')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'portfolio' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            💼 내 포트폴리오 {holdings.length > 0 && <span className="ml-1 bg-blue-500 text-white text-xs px-1.5 rounded-full">{holdings.length}</span>}
          </button>
        </div>

        {tab === 'feed' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">전체 오더</p>
                <p className="text-2xl font-bold mt-1">{orders.length}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">BUY</p>
                <p className="text-2xl font-bold mt-1 text-green-400">{orders.filter(o => o.action === 'BUY').length}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">SELL</p>
                <p className="text-2xl font-bold mt-1 text-red-400">{orders.filter(o => o.action === 'SELL').length}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                {['ALL', 'BUY', 'SELL'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {f}
                  </button>
                ))}
              </div>
              {hiddenOrderIds.size > 0 && (
                <button onClick={() => setShowHidden(!showHidden)} className="text-gray-400 hover:text-white text-xs px-3 py-1.5 bg-gray-800 rounded-lg">
                  {showHidden ? '목록 접기' : `지운 항목 보기 (${hiddenOrderIds.size})`}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3 bg-gray-900 rounded-lg px-3 py-2 border border-gray-800">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === visibleNonHiddenCount}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <span className="text-gray-400 text-sm">
                {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : '전체 선택'}
              </span>
              <div className="flex gap-2 ml-auto">
                {selectedIds.size > 0 && (
                  <button onClick={hideSelected} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
                    ✕ 선택 지우기 ({selectedIds.size})
                  </button>
                )}
                <button onClick={hideAll} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
                  ✕ 전체 지우기
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 py-20">불러오는 중...</div>
            ) : (
              <div className="space-y-3">
                {visibleOrders.map(order => {
                  const profit = getProfitRate(order)
                  const isProfit = profit ? parseFloat(profit.rate) >= 0 : null
                  const inPortfolio = isInPortfolio(order.id)
                  const isHidden = hiddenOrderIds.has(order.id)
                  const isSelected = selectedIds.has(order.id)
                  return (
                    <div key={order.id} className={`bg-gray-900 rounded-xl p-4 border transition-opacity ${isHidden ? 'border-gray-700 opacity-40' : isSelected ? 'border-blue-600' : 'border-gray-800'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {!isHidden && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(order.id)}
                              className="w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0"
                            />
                          )}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.action === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                            {order.action}
                          </span>
                          <div>
                            <p className="font-semibold">
                              {order.stock_name || order.stock_code}
                              <span className="text-gray-500 text-xs ml-2">{order.market}</span>
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              {order.person_name} · {new Date(order.messaged_at).toLocaleString('ko-KR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {profit ? (
                            <div className="text-right">
                              <p className={`font-bold text-lg ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}{profit.rate}%
                              </p>
                              <p className="text-gray-400 text-xs">{formatWithKRW(profit.currentPrice)}</p>
                            </div>
                          ) : (
                            <p className="text-gray-600 text-xs">가격 조회 중...</p>
                          )}
                          {inPortfolio ? (
                            <button onClick={() => removeFromPortfolio(order.id)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg">
                              ✓ 담음
                            </button>
                          ) : (
                            <button onClick={() => openBuyModal(order)} className={`text-xs px-3 py-1.5 rounded-lg ${order.action === 'BUY' ? 'bg-green-800 hover:bg-green-700 text-green-200' : 'bg-red-900 hover:bg-red-800 text-red-200'}`}>
                              + 내 거래 추가
                            </button>
                          )}
                          <button
                            onClick={() => isHidden ? unhideOrder(order.id) : hideOrder(order.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg ${isHidden ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`}
                          >
                            {isHidden ? '↩ 되돌리기' : '✕ 지우기'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs">
                        {profit?.orderPrice && (
                          <p className="text-gray-400">
                            오더 당시 가격: <span className="text-yellow-400 font-medium">{formatWithKRW(profit.orderPrice)}</span>
                            {profit.isHistorical && <span className="text-gray-600 ml-1">(당일 종가)</span>}
                          </p>
                        )}
                        {order.quantity && (
                          <p className="text-gray-400">수량: <span className="text-white font-medium">{order.quantity}</span></p>
                        )}
                        {order.message_original && (
                          <p className="text-gray-500 italic col-span-2">"{order.message_original}"</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'portfolio' && (
          <div>
            {totalStats && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-700 mb-6">
                <p className="text-gray-400 text-sm mb-3">📊 전체 포트폴리오 합산</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">달러 기준 수익률</p>
                    <p className={`text-2xl font-bold ${totalStats.rateUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalStats.rateUSD >= 0 ? '+' : ''}{totalStats.rateUSD.toFixed(2)}%
                    </p>
                    <p className={`text-sm mt-1 ${totalStats.profitUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalStats.profitUSD >= 0 ? '+' : ''}{formatUSD(totalStats.profitUSD)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">원화 기준 수익률 (환차익 포함)</p>
                    <p className={`text-2xl font-bold ${totalStats.rateKRW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalStats.rateKRW >= 0 ? '+' : ''}{totalStats.rateKRW.toFixed(2)}%
                    </p>
                    <p className={`text-sm mt-1 ${totalStats.profitKRW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalStats.profitKRW >= 0 ? '+' : ''}{formatKRW(totalStats.profitKRW)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <p>투자원금: {formatUSD(totalStats.totalInvestUSD)} / {formatKRW(totalStats.totalInvestKRW)}</p>
                  <p>현재가치: {formatUSD(totalStats.totalCurrentUSD)} / {formatKRW(totalStats.totalCurrentKRW)}</p>
                  <p className="col-span-2">현재 환율: 1 USD = {formatKRW(exchangeRate)}</p>
                </div>
              </div>
            )}

            {holdings.length === 0 ? (
              <div className="text-center text-gray-500 py-20">
                <p className="text-4xl mb-3">💼</p>
                <p>보유 종목이 없어요</p>
                <p className="text-sm mt-2">오더 피드에서 "+ 내 거래 추가" 버튼을 눌러보세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {holdings.map(holding => {
                  const profit = getHoldingProfit(holding)
                  const isUSDProfit = profit ? parseFloat(profit.rateUSD) >= 0 : null
                  const isKRWProfit = profit ? parseFloat(profit.rateKRW) >= 0 : null
                  return (
                    <div key={holding.stock_code} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-lg">{holding.stock_name || holding.stock_code}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{holding.stock_code} · {holding.market}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {profit && (
                            <div className="text-right mr-2">
                              <div className="flex gap-3">
                                <div>
                                  <p className="text-gray-500 text-xs">USD</p>
                                  <p className={`font-bold text-lg ${isUSDProfit ? 'text-green-400' : 'text-red-400'}`}>
                                    {isUSDProfit ? '+' : ''}{profit.rateUSD}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs">KRW</p>
                                  <p className={`font-bold text-lg ${isKRWProfit ? 'text-green-400' : 'text-red-400'}`}>
                                    {isKRWProfit ? '+' : ''}{profit.rateKRW}%
                                  </p>
                                </div>
                              </div>
                              <p className="text-gray-400 text-xs">{formatWithKRW(profit.currentPrice)}</p>
                            </div>
                          )}
                          <button onClick={() => openAddBuyModal(holding)} className="bg-green-800 hover:bg-green-700 text-green-200 text-xs px-3 py-1.5 rounded-lg">
                            추가 매수
                          </button>
                          <button onClick={() => openSellModal(holding)} className="bg-red-900 hover:bg-red-800 text-red-200 text-xs px-3 py-1.5 rounded-lg">
                            매도 처리
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">보유 수량</p>
                          <p className="font-medium">{holding.total_quantity.toLocaleString(undefined, {maximumFractionDigits: 4})} 주</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">평균 단가</p>
                          <p className="font-medium text-sm">{holding.avg_price ? formatWithKRW(holding.avg_price) : '-'}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">투자원금</p>
                          <p className="font-medium text-sm">{holding.total_amount_usd ? formatUSD(holding.total_amount_usd) : '-'}</p>
                          <p className="text-gray-500 text-xs">{holding.total_amount_krw ? formatKRW(holding.total_amount_krw) : ''}</p>
                        </div>
                      </div>

                      {profit && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="bg-gray-800 rounded-lg p-3 text-sm">
                            <p className="text-gray-400 text-xs mb-1">달러 평가손익</p>
                            <p className={`font-bold ${isUSDProfit ? 'text-green-400' : 'text-red-400'}`}>
                              {isUSDProfit ? '+' : ''}{formatUSD(profit.profitUSD)}
                            </p>
                          </div>
                          <div className="bg-gray-800 rounded-lg p-3 text-sm">
                            <p className="text-gray-400 text-xs mb-1">원화 평가손익 (환차익포함)</p>
                            <p className={`font-bold ${isKRWProfit ? 'text-green-400' : 'text-red-400'}`}>
                              {isKRWProfit ? '+' : ''}{formatKRW(profit.profitKRW)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="font-bold text-lg mb-1">
              {modal.mode === 'buy' ? (modal.order ? '내 거래 추가' : '추가 매수') : '매도 처리'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              <span className={`font-bold ${modal.mode === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {modal.mode === 'buy' ? 'BUY' : 'SELL'}
              </span>
              {' '}{modal.order?.stock_name || modal.order?.stock_code || modal.stock_name || modal.stock_code}
              {modal.order && <span className="text-gray-500 ml-1">· {new Date(modal.order.messaged_at).toLocaleDateString('ko-KR')}</span>}
            </p>

            {modal.historicalPrice && (
              <p className="text-xs text-gray-500 mb-3 bg-gray-800 rounded-lg px-3 py-2">
                당일 종가: <span className="text-yellow-400">{formatWithKRW(modal.historicalPrice)}</span>
              </p>
            )}

            <p className="text-xs text-gray-500 mb-1">현재 환율: <span className="text-gray-300">1 USD = {formatKRW(exchangeRate)}</span></p>
            <p className="text-xs text-gray-500 mb-3">두 항목만 입력하면 나머지가 자동 계산돼요</p>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">{modal.mode === 'buy' ? '매수가' : '매도가'} (1주당 USD)</label>
                <input
                  type="number"
                  value={myPrice}
                  onChange={e => { setLastChanged('price'); setMyPrice(e.target.value) }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder={modal.historicalPrice ? modal.historicalPrice.toString() : "직접 입력"}
                />
                {myPrice && <p className="text-xs text-gray-500 mt-1">≈ {formatKRW(parseFloat(myPrice) * exchangeRate)}</p>}
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">수량 (주)</label>
                <input
                  type="number"
                  value={myQuantity}
                  onChange={e => { setLastChanged('qty'); setMyQuantity(e.target.value) }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="예: 10"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 text-sm">금액</label>
                  <div className="flex gap-1">
                    <button onClick={() => { setAmountCurrency('USD'); setMyAmount('') }} className={`text-xs px-2 py-0.5 rounded ${amountCurrency === 'USD' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>USD</button>
                    <button onClick={() => { setAmountCurrency('KRW'); setMyAmount('') }} className={`text-xs px-2 py-0.5 rounded ${amountCurrency === 'KRW' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>KRW</button>
                  </div>
                </div>
                <input
                  type="number"
                  value={myAmount}
                  onChange={e => { setLastChanged('amount'); setMyAmount(e.target.value) }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder={amountCurrency === 'USD' ? "예: 4192.63" : "예: 5785800"}
                />
                {myAmount && (
                  <p className="text-xs text-gray-500 mt-1">
                    {amountCurrency === 'USD' ? `≈ ${formatKRW(parseFloat(myAmount) * exchangeRate)}` : `≈ $${(parseFloat(myAmount) / exchangeRate).toFixed(2)}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2.5 text-sm">취소</button>
              <button
                onClick={saveToPortfolio}
                disabled={saving}
                className={`flex-1 ${modal.mode === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-700 hover:bg-red-600'} disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm`}
              >
                {saving ? '저장 중...' : modal.mode === 'buy' ? (modal.order ? '추가하기' : '매수 추가') : '매도 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
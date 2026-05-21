'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  email: string
  name: string
  is_approved: boolean
  is_admin: boolean
}

type Person = {
  id: number
  name: string
  description: string
}

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'persons' | 'input' | 'upload'>('input')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonDesc, setNewPersonDesc] = useState('')
  const [manualInput, setManualInput] = useState({
    person_name: '',
    stock_code: '',
    stock_name: '',
    market: 'KRX',
    action: 'BUY',
    price_at_order: '',
    quantity: '',
    amount: '',
    messaged_at: '',
    message_original: ''
  })
  const [priceLoading, setPriceLoading] = useState(false)
  const [kakaoText, setKakaoText] = useState('')
  const [parseResult, setParseResult] = useState<any[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchProfiles()
    fetchPersons()
  }, [])

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setProfiles(data)
  }

  const fetchPersons = async () => {
    const { data } = await supabase.from('persons').select('*')
    if (data) setPersons(data)
  }

  const approveUser = async (id: string, approve: boolean) => {
    await supabase.from('profiles').update({ is_approved: approve }).eq('id', id)
    fetchProfiles()
  }

  const addPerson = async () => {
    if (!newPersonName) return
    await supabase.from('persons').insert({ name: newPersonName, description: newPersonDesc })
    setNewPersonName('')
    setNewPersonDesc('')
    fetchPersons()
  }

  const deletePerson = async (id: number) => {
    await supabase.from('persons').delete().eq('id', id)
    fetchPersons()
  }

  const fetchCurrentPrice = async () => {
    if (!manualInput.stock_code) return
    setPriceLoading(true)
    try {
      const res = await fetch(`/api/stock-price?ticker=${manualInput.stock_code}&market=${manualInput.market}`)
      const data = await res.json()
      if (data.price) {
        setManualInput(prev => ({ ...prev, price_at_order: data.price.toString() }))
        setMessage(`✅ 현재가 조회 완료: ${data.price.toLocaleString()}`)
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('❌ 현재가 조회 실패')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (e) {
      setMessage('❌ 현재가 조회 실패')
      setTimeout(() => setMessage(''), 3000)
    }
    setPriceLoading(false)
  }

  const saveManualOrder = async () => {
    setSaving(true)
    const { error } = await supabase.from('orders').insert({
      person_name: manualInput.person_name,
      stock_code: manualInput.stock_code,
      stock_name: manualInput.stock_name,
      market: manualInput.market,
      action: manualInput.action,
      price_at_order: manualInput.price_at_order ? parseFloat(manualInput.price_at_order) : null,
      quantity: manualInput.quantity || null,
      message_original: manualInput.message_original,
      messaged_at: manualInput.messaged_at || new Date().toISOString()
    })
    if (error) {
      setMessage('❌ 저장 실패: ' + error.message)
    } else {
      setMessage('✅ 저장 완료!')
      setManualInput({
        person_name: '', stock_code: '', stock_name: '',
        market: 'KRX', action: 'BUY', price_at_order: '',
        quantity: '', amount: '', messaged_at: '', message_original: ''
      })
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const parseKakao = async () => {
    setParsing(true)
    setParseResult([])
    try {
      const res = await fetch('/api/parse-kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: kakaoText })
      })
      const data = await res.json()
      setParseResult(data.orders || [])
    } catch (e) {
      setMessage('❌ 파싱 실패')
    }
    setParsing(false)
  }

const saveAllParsed = async () => {
  setSaving(true)
  try {
    // market 값 보정
    const sanitized = parseResult.map(o => ({
      ...o,
      market: ['NASDAQ', 'NYSE', 'KRX'].includes(o.market) ? o.market : 'NASDAQ'
    }))

    const chunkSize = 10
    let totalSaved = 0
    for (let i = 0; i < sanitized.length; i += chunkSize) {
      const chunk = sanitized.slice(i, i + chunkSize)
      const { error } = await supabase.from('orders').insert(chunk)
      if (error) {
        setMessage('❌ 저장 실패: ' + error.message)
        setSaving(false)
        return
      }
      totalSaved += chunk.length
    }
    setMessage(`✅ ${totalSaved}개 저장 완료!`)
    setParseResult([])
    setKakaoText('')
  } catch (e) {
    setMessage('❌ 저장 실패')
  }
  setSaving(false)
  setTimeout(() => setMessage(''), 3000)
}

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">⚙️ 관리자 패널</h1>
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">
          ← 대시보드
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'input', label: '✏️ 수동 입력' },
            { key: 'upload', label: '📂 카카오톡 업로드' },
            { key: 'persons', label: '👤 인물 관리' },
            { key: 'users', label: '🔐 회원 승인' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm text-center">{message}</div>
        )}

        {/* 수동 입력 */}
        {tab === 'input' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-4">오더 수동 입력</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">인물명</label>
                <input
                  value={manualInput.person_name}
                  onChange={e => setManualInput({...manualInput, person_name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="이시온"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">시장</label>
                <select
                  value={manualInput.market}
                  onChange={e => setManualInput({...manualInput, market: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="KRX">KRX (한국)</option>
                  <option value="NYSE">NYSE (미국)</option>
                  <option value="NASDAQ">NASDAQ (미국)</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">종목코드 / 티커</label>
                <div className="flex gap-2">
                  <input
                    value={manualInput.stock_code}
                    onChange={e => setManualInput({...manualInput, stock_code: e.target.value})}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="KORU"
                  />
                  <button
                    onClick={fetchCurrentPrice}
                    disabled={priceLoading || !manualInput.stock_code}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap"
                  >
                    {priceLoading ? '조회중...' : '현재가 조회'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">종목명</label>
                <input
                  value={manualInput.stock_name}
                  onChange={e => setManualInput({...manualInput, stock_name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="KORU ETF"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">액션</label>
                <select
                  value={manualInput.action}
                  onChange={e => setManualInput({...manualInput, action: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">오더 당시 가격</label>
                <input
                  type="number"
                  value={manualInput.price_at_order}
                  onChange={e => setManualInput({...manualInput, price_at_order: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="자동조회 또는 직접 입력"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">수량 (주)</label>
                <input
                  value={manualInput.quantity}
                  onChange={e => setManualInput({...manualInput, quantity: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="90주 (선택)"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">금액</label>
                <input
                  value={manualInput.amount}
                  onChange={e => setManualInput({...manualInput, amount: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="1000만원 (선택)"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">메시지 시간</label>
                <input
                  type="datetime-local"
                  value={manualInput.messaged_at}
                  onChange={e => setManualInput({...manualInput, messaged_at: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">원문 메시지</label>
                <input
                  value={manualInput.message_original}
                  onChange={e => setManualInput({...manualInput, message_original: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="KORU 매수"
                />
              </div>
            </div>
            <button
              onClick={saveManualOrder}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold rounded-lg py-3 transition-colors"
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        )}

        {/* 카카오톡 업로드 */}
        {tab === 'upload' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-2">카카오톡 대화 내역 업로드</h2>
            <p className="text-gray-400 text-sm">카카오톡 대화 내보내기(.txt) 내용을 붙여넣어 주세요</p>
            <textarea
              value={kakaoText}
              onChange={e => setKakaoText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm h-48 resize-none"
              placeholder="카카오톡 대화 내용을 여기에 붙여넣으세요..."
            />
            <button
              onClick={parseKakao}
              disabled={parsing || !kakaoText}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white font-semibold rounded-lg py-3 transition-colors"
            >
              {parsing ? 'AI 파싱 중...' : '🤖 AI로 파싱하기'}
            </button>

            {parseResult.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">{parseResult.length}개 감지됨</p>
                {parseResult.map((o, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 text-sm flex justify-between">
                    <span>
                      <span className={`font-bold ${o.action === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                        {o.action}
                      </span>
                      {' '}{o.stock_name || o.stock_code} · {o.person_name}
                      {o.quantity && <span className="text-gray-400 ml-1">({o.quantity})</span>}
                    </span>
                    <span className="text-gray-500">{new Date(o.messaged_at).toLocaleString('ko-KR')}</span>
                  </div>
                ))}
                <button
                  onClick={saveAllParsed}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold rounded-lg py-3 transition-colors"
                >
                  {saving ? '저장 중...' : `✅ ${parseResult.length}개 전체 저장`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 인물 관리 */}
        {tab === 'persons' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-4">모니터링 인물 관리</h2>
            <div className="flex gap-2">
              <input
                value={newPersonName}
                onChange={e => setNewPersonName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="인물 이름"
              />
              <input
                value={newPersonDesc}
                onChange={e => setNewPersonDesc(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="설명 (선택)"
              />
              <button
                onClick={addPerson}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                추가
              </button>
            </div>
            <div className="space-y-2">
              {persons.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.description && <span className="text-gray-400 text-sm ml-2">{p.description}</span>}
                  </div>
                  <button
                    onClick={() => deletePerson(p.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 회원 승인 */}
        {tab === 'users' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-4">회원 승인 관리</h2>
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{p.name || '이름없음'}</span>
                    <span className="text-gray-400 text-sm ml-2">{p.email}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      p.is_approved ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                    }`}>
                      {p.is_approved ? '승인됨' : '대기중'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!p.is_approved && (
                      <button
                        onClick={() => approveUser(p.id, true)}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg"
                      >
                        승인
                      </button>
                    )}
                    {p.is_approved && (
                      <button
                        onClick={() => approveUser(p.id, false)}
                        className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-lg"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
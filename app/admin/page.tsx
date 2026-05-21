export const dynamic = 'force-dynamic'
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
        setMessage(`???ÑÏû¨Í∞Ä Ï°∞Ìöå ?ÑÎ£å: ${data.price.toLocaleString()}`)
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('???ÑÏû¨Í∞Ä Ï°∞Ìöå ?§Ìå®')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (e) {
      setMessage('???ÑÏû¨Í∞Ä Ï°∞Ìöå ?§Ìå®')
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
      setMessage('???Ä???§Ìå®: ' + error.message)
    } else {
      setMessage('???Ä???ÑÎ£å!')
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
      setMessage('???åÏã± ?§Ìå®')
    }
    setParsing(false)
  }

const saveAllParsed = async () => {
  setSaving(true)
  try {
    // market Í∞?Î≥¥Ï†ï
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
        setMessage('???Ä???§Ìå®: ' + error.message)
        setSaving(false)
        return
      }
      totalSaved += chunk.length
    }
    setMessage(`??${totalSaved}Í∞??Ä???ÑÎ£å!`)
    setParseResult([])
    setKakaoText('')
  } catch (e) {
    setMessage('???Ä???§Ìå®')
  }
  setSaving(false)
  setTimeout(() => setMessage(''), 3000)
}

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">?ôÔ∏è Í¥ÄÎ¶¨Ïûê ?®ÎÑê</h1>
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">
          ???Ä?úÎ≥¥??
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'input', label: '?èÔ∏è ?òÎèô ?ÖÎ†•' },
            { key: 'upload', label: '?ìÇ Ïπ¥Ïπ¥?§ÌÜ° ?ÖÎ°ú?? },
            { key: 'persons', label: '?ë§ ?∏Î¨º Í¥ÄÎ¶? },
            { key: 'users', label: '?îê ?åÏõê ?πÏù∏' },
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

        {/* ?òÎèô ?ÖÎ†• */}
        {tab === 'input' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-4">?§Îçî ?òÎèô ?ÖÎ†•</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">?∏Î¨ºÎ™?/label>
                <input
                  value={manualInput.person_name}
                  onChange={e => setManualInput({...manualInput, person_name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="?¥Ïãú??
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">?úÏû•</label>
                <select
                  value={manualInput.market}
                  onChange={e => setManualInput({...manualInput, market: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="KRX">KRX (?úÍµ≠)</option>
                  <option value="NYSE">NYSE (ÎØ∏Íµ≠)</option>
                  <option value="NASDAQ">NASDAQ (ÎØ∏Íµ≠)</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Ï¢ÖÎ™©ÏΩîÎìú / ?∞Ïª§</label>
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
                    {priceLoading ? 'Ï°∞ÌöåÏ§?..' : '?ÑÏû¨Í∞Ä Ï°∞Ìöå'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Ï¢ÖÎ™©Î™?/label>
                <input
                  value={manualInput.stock_name}
                  onChange={e => setManualInput({...manualInput, stock_name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="KORU ETF"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">?°ÏÖò</label>
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
                <label className="text-gray-400 text-sm mb-1 block">?§Îçî ?πÏãú Í∞ÄÍ≤?/label>
                <input
                  type="number"
                  value={manualInput.price_at_order}
                  onChange={e => setManualInput({...manualInput, price_at_order: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="?êÎèôÏ°∞Ìöå ?êÎäî ÏßÅÏ†ë ?ÖÎ†•"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">?òÎüâ (Ï£?</label>
                <input
                  value={manualInput.quantity}
                  onChange={e => setManualInput({...manualInput, quantity: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="90Ï£?(?†ÌÉù)"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Í∏àÏï°</label>
                <input
                  value={manualInput.amount}
                  onChange={e => setManualInput({...manualInput, amount: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="1000ÎßåÏõê (?†ÌÉù)"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Î©îÏãúÏßÄ ?úÍ∞Ñ</label>
                <input
                  type="datetime-local"
                  value={manualInput.messaged_at}
                  onChange={e => setManualInput({...manualInput, messaged_at: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">?êÎ¨∏ Î©îÏãúÏßÄ</label>
                <input
                  value={manualInput.message_original}
                  onChange={e => setManualInput({...manualInput, message_original: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="KORU Îß§Ïàò"
                />
              </div>
            </div>
            <button
              onClick={saveManualOrder}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold rounded-lg py-3 transition-colors"
            >
              {saving ? '?Ä??Ï§?..' : '?Ä?•ÌïòÍ∏?}
            </button>
          </div>
        )}

        {/* Ïπ¥Ïπ¥?§ÌÜ° ?ÖÎ°ú??*/}
        {tab === 'upload' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-2">Ïπ¥Ïπ¥?§ÌÜ° ?Ä???¥Ïó≠ ?ÖÎ°ú??/h2>
            <p className="text-gray-400 text-sm">Ïπ¥Ïπ¥?§ÌÜ° ?Ä???¥Î≥¥?¥Í∏∞(.txt) ?¥Ïö©??Î∂ôÏó¨?£Ïñ¥ Ï£ºÏÑ∏??/p>
            <textarea
              value={kakaoText}
              onChange={e => setKakaoText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm h-48 resize-none"
              placeholder="Ïπ¥Ïπ¥?§ÌÜ° ?Ä???¥Ïö©???¨Í∏∞??Î∂ôÏó¨?£Ïúº?∏Ïöî..."
            />
            <button
              onClick={parseKakao}
              disabled={parsing || !kakaoText}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white font-semibold rounded-lg py-3 transition-colors"
            >
              {parsing ? 'AI ?åÏã± Ï§?..' : '?§ñ AIÎ°??åÏã±?òÍ∏∞'}
            </button>

            {parseResult.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">{parseResult.length}Í∞?Í∞êÏ???/p>
                {parseResult.map((o, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 text-sm flex justify-between">
                    <span>
                      <span className={`font-bold ${o.action === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                        {o.action}
                      </span>
                      {' '}{o.stock_name || o.stock_code} ¬∑ {o.person_name}
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
                  {saving ? '?Ä??Ï§?..' : `??${parseResult.length}Í∞??ÑÏ≤¥ ?Ä??}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ?∏Î¨º Í¥ÄÎ¶?*/}
        {tab === 'persons' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-4">Î™®Îãà?∞ÎßÅ ?∏Î¨º Í¥ÄÎ¶?/h2>
            <div className="flex gap-2">
              <input
                value={newPersonName}
                onChange={e => setNewPersonName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="?∏Î¨º ?¥Î¶Ñ"
              />
              <input
                value={newPersonDesc}
                onChange={e => setNewPersonDesc(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="?§Î™Ö (?†ÌÉù)"
              />
              <button
                onClick={addPerson}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Ï∂îÍ?
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
                    ??†ú
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ?åÏõê ?πÏù∏ */}
        {tab === 'users' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold text-lg mb-4">?åÏõê ?πÏù∏ Í¥ÄÎ¶?/h2>
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{p.name || '?¥Î¶Ñ?ÜÏùå'}</span>
                    <span className="text-gray-400 text-sm ml-2">{p.email}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      p.is_approved ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                    }`}>
                      {p.is_approved ? '?πÏù∏?? : '?ÄÍ∏∞Ï§ë'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!p.is_approved && (
                      <button
                        onClick={() => approveUser(p.id, true)}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg"
                      >
                        ?πÏù∏
                      </button>
                    )}
                    {p.is_approved && (
                      <button
                        onClick={() => approveUser(p.id, false)}
                        className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-lg"
                      >
                        Ï∑®ÏÜå
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

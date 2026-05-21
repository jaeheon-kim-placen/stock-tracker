export const dynamic = 'force-dynamic'
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      router.push('/reset-password' + hash)
    }
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('?´ë©”???ëŠ” ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">?“ˆ Stock Tracker</h1>
        <p className="text-gray-400 mb-8">ë¡œê·¸??/p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">?´ë©”??/label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">ë¹„ë?ë²ˆí˜¸</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="?¢â€¢â€¢â€¢â€¢â€¢â€¢â€?
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loading ? 'ë¡œê·¸??ì¤?..' : 'ë¡œê·¸??}
          </button>
        </div>

        <p className="text-gray-500 text-sm text-center mt-6">
          ê³„ì •???†ìœ¼? ê???{' '}
          <Link href="/register" className="text-blue-400 hover:underline">
            ?Œì›ê°€??? ì²­
          </Link>
        </p>
      </div>
    </div>
  )
}

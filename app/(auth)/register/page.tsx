'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-800 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">가입 신청 완료!</h2>
          <p className="text-gray-400 text-sm">관리자 승인 후 로그인하실 수 있습니다.</p>
          <Link href="/login" className="mt-6 inline-block text-blue-400 hover:underline text-sm">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">📈 Stock Tracker</h1>
        <p className="text-gray-400 mb-8">회원가입 신청</p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loading ? '처리 중...' : '가입 신청하기'}
          </button>
        </div>

        <p className="text-gray-500 text-sm text-center mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-blue-400 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
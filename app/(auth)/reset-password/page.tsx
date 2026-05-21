'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace('#', ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ error }) => {
        if (error) {
          setMessage('링크가 만료됐어요. 비밀번호 재설정을 다시 요청해주세요.')
        } else {
          setReady(true)
        }
      })
    } else {
      setMessage('잘못된 접근이에요. 이메일 링크를 다시 클릭해주세요.')
    }
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setMessage('비밀번호는 6자 이상이어야 해요.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage('오류: ' + error.message)
    } else {
      setMessage('비밀번호가 변경됐어요! 로그인 페이지로 이동합니다.')
      setTimeout(() => router.push('/login'), 2000)
    }
  }

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#0f172a'}}>
      <div style={{background:'#1e293b',padding:'2rem',borderRadius:'1rem',width:'100%',maxWidth:'400px'}}>
        <h1 style={{color:'white',marginBottom:'0.5rem'}}>🔐 새 비밀번호 설정</h1>
        {message && (
          <p style={{color: message.includes('오류') || message.includes('만료') || message.includes('잘못') ? '#f87171' : '#86efac', marginBottom:'1rem', fontSize:'0.9rem'}}>
            {message}
          </p>
        )}
        {ready && (
          <form onSubmit={handleReset}>
            <input
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{width:'100%',padding:'0.75rem',borderRadius:'0.5rem',border:'none',marginBottom:'1rem',background:'#334155',color:'white',boxSizing:'border-box'}}
            />
            <button type="submit" style={{width:'100%',padding:'0.75rem',borderRadius:'0.5rem',background:'#3b82f6',color:'white',border:'none',cursor:'pointer',fontSize:'1rem'}}>
              비밀번호 변경
            </button>
          </form>
        )}
        {!ready && !message && (
          <p style={{color:'#94a3b8'}}>링크 확인 중...</p>
        )}
      </div>
    </div>
  )
}
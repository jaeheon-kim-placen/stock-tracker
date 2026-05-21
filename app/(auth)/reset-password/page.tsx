'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
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
        <h1 style={{color:'white',marginBottom:'1.5rem'}}>새 비밀번호 설정</h1>
        {message && <p style={{color:'#86efac',marginBottom:'1rem'}}>{message}</p>}
        <form onSubmit={handleReset}>
          <input
            type="password"
            placeholder="새 비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{width:'100%',padding:'0.75rem',borderRadius:'0.5rem',border:'none',marginBottom:'1rem',background:'#334155',color:'white'}}
          />
          <button type="submit" style={{width:'100%',padding:'0.75rem',borderRadius:'0.5rem',background:'#3b82f6',color:'white',border:'none',cursor:'pointer'}}>
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  )
}
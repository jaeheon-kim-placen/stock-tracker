export const dynamic = 'force-dynamic'
'use client'

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
          setMessage('ë§í¬ê°€ ë§Œë£Œ?ì–´?? ë¹„ë?ë²ˆí˜¸ ?¬ì„¤?•ì„ ?¤ì‹œ ?”ì²­?´ì£¼?¸ìš”.')
        } else {
          setReady(true)
        }
      })
    } else {
      setMessage('?˜ëª»???‘ê·¼?´ì—?? ?´ë©”??ë§í¬ë¥??¤ì‹œ ?´ë¦­?´ì£¼?¸ìš”.')
    }
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setMessage('ë¹„ë?ë²ˆí˜¸??6???´ìƒ?´ì–´???´ìš”.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage('?¤ë¥˜: ' + error.message)
    } else {
      setMessage('ë¹„ë?ë²ˆí˜¸ê°€ ë³€ê²½ë?´ìš”! ë¡œê·¸???˜ì´ì§€ë¡??´ë™?©ë‹ˆ??')
      setTimeout(() => router.push('/login'), 2000)
    }
  }

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#0f172a'}}>
      <div style={{background:'#1e293b',padding:'2rem',borderRadius:'1rem',width:'100%',maxWidth:'400px'}}>
        <h1 style={{color:'white',marginBottom:'0.5rem'}}>?” ??ë¹„ë?ë²ˆí˜¸ ?¤ì •</h1>
        {message && (
          <p style={{color: message.includes('?¤ë¥˜') || message.includes('ë§Œë£Œ') || message.includes('?˜ëª»') ? '#f87171' : '#86efac', marginBottom:'1rem', fontSize:'0.9rem'}}>
            {message}
          </p>
        )}
        {ready && (
          <form onSubmit={handleReset}>
            <input
              type="password"
              placeholder="??ë¹„ë?ë²ˆí˜¸ (6???´ìƒ)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{width:'100%',padding:'0.75rem',borderRadius:'0.5rem',border:'none',marginBottom:'1rem',background:'#334155',color:'white',boxSizing:'border-box'}}
            />
            <button type="submit" style={{width:'100%',padding:'0.75rem',borderRadius:'0.5rem',background:'#3b82f6',color:'white',border:'none',cursor:'pointer',fontSize:'1rem'}}>
              ë¹„ë?ë²ˆí˜¸ ë³€ê²?
            </button>
          </form>
        )}
        {!ready && !message && (
          <p style={{color:'#94a3b8'}}>ë§í¬ ?•ì¸ ì¤?..</p>
        )}
      </div>
    </div>
  )
}

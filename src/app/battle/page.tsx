'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function generateCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map(b => b % 10)
    .join('')
}

export default function BattleLobbyPage() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'select' | 'join'>('select')
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '익명'
      setUserName(name)
    })
  }, [])

  function handleCreate() {
    const code = generateCode()
    sessionStorage.setItem(`battle_host_${code}`, 'true')
    router.push(`/battle/${code}`)
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 5) return
    router.push(`/battle/${code}`)
  }

  const inputStyle = {
    width: '100%', marginTop: 6, padding: '12px 14px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 12, color: 'var(--text)', fontSize: 15, outline: 'none',
  }

  return (
    <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-8 items-center w-full">
      <div style={{ width: '100%' }}>
        <button
          onClick={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
      </div>
      <div className="text-center">
        <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>⚔️</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>대전 모드</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          친구들과 같은 게임을 동시에!
        </div>
        {userName && (
          <div style={{ fontSize: 13, color: 'var(--amber)', marginTop: 8, fontWeight: 600 }}>
            {userName}으로 참가합니다
          </div>
        )}
      </div>

      {mode === 'join' && (
        <div className="glass p-5 w-full">
          <label style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 as const }}>방 코드</label>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.replace(/\D/g, ''))}
            placeholder="숫자 5자리 입력"
            maxLength={5}
            autoFocus
            style={{ ...inputStyle, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}
          />
        </div>
      )}

      {mode === 'select' ? (
        <div className="flex flex-col gap-3 w-full">
          <button className="btn-primary" onClick={handleCreate}>
            방 만들기
          </button>
          <button className="btn-secondary" onClick={() => setMode('join')}>
            코드로 입장
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <button
            className="btn-primary"
            onClick={handleJoin}
            disabled={joinCode.trim().length < 5}
          >
            입장하기
          </button>
          <button className="btn-secondary" onClick={() => setMode('select')}>
            뒤로
          </button>
        </div>
      )}
    </main>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function generateCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b % 10)
    .join('')
}

export default function BattleLobbyPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'select' | 'join'>('select')

  function handleCreate() {
    if (!name.trim()) return
    const code = generateCode()
    sessionStorage.setItem('battle_name', name.trim())
    sessionStorage.setItem(`battle_host_${code}`, 'true')
    router.push(`/battle/${code}`)
  }

  function handleJoin() {
    if (!name.trim()) return
    const code = joinCode.trim()
    if (code.length < 4) return
    sessionStorage.setItem('battle_name', name.trim())
    router.push(`/battle/${code}`)
  }

  const inputStyle = {
    width: '100%', marginTop: 6, padding: '12px 14px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 12, color: 'var(--text)', fontSize: 15, outline: 'none',
  }
  const labelStyle = { fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 as const }

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
      </div>

      <div className="glass p-5 w-full flex flex-col gap-4">
        <div>
          <label style={labelStyle}>닉네임</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            maxLength={10}
            style={inputStyle}
          />
        </div>
        {mode === 'join' && (
          <div>
            <label style={labelStyle}>방 코드</label>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.replace(/\D/g, ''))}
              placeholder="숫자 4자리 입력"
              maxLength={4}
              inputMode="numeric"
              autoFocus
              style={{ ...inputStyle, letterSpacing: '0.2em' }}
            />
          </div>
        )}
      </div>

      {mode === 'select' ? (
        <div className="flex flex-col gap-3 w-full">
          <button className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>
            방 만들기
          </button>
          <button className="btn-secondary" onClick={() => setMode('join')} disabled={!name.trim()}>
            코드로 입장
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <button
            className="btn-primary"
            onClick={handleJoin}
            disabled={!name.trim() || joinCode.trim().length < 4}
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

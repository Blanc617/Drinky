'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  myName: string
  players: { userId: string; name: string }[]
  isHost: boolean
}

type Role = '마피아' | '시민' | '경찰' | '의사'
type Phase = 'setup' | 'waiting' | 'revealed' | 'done'

const ROLE_STYLE: Record<Role, { emoji: string; color: string; bg: string; border: string; desc: string }> = {
  '마피아': { emoji: '🔪', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', desc: '밤에 시민을 한 명 제거하세요' },
  '시민':   { emoji: '👤', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: '#60a5fa', desc: '낮에 토론으로 마피아를 찾아내세요' },
  '경찰':   { emoji: '🔦', color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: '#facc15', desc: '밤에 한 명의 정체를 확인하세요' },
  '의사':   { emoji: '💉', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: '#4ade80', desc: '밤에 한 명을 마피아 공격에서 살리세요' },
}

const DEFAULT_COUNTS: Record<number, { 마피아: number; 경찰: number; 의사: number }> = {
  3:  { 마피아: 1, 경찰: 0, 의사: 0 },
  4:  { 마피아: 1, 경찰: 1, 의사: 0 },
  5:  { 마피아: 1, 경찰: 1, 의사: 0 },
  6:  { 마피아: 2, 경찰: 1, 의사: 0 },
  7:  { 마피아: 2, 경찰: 1, 의사: 1 },
  8:  { 마피아: 2, 경찰: 1, 의사: 1 },
  9:  { 마피아: 3, 경찰: 1, 의사: 1 },
  10: { 마피아: 3, 경찰: 1, 의사: 1 },
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MafiaGameBattle({ onComplete, roomCode, userId, myName, players, isHost }: Props) {
  const playerCount = players.length
  const defaultCount = DEFAULT_COUNTS[Math.min(Math.max(playerCount, 3), 10)] ?? DEFAULT_COUNTS[3]

  const [phase, setPhase] = useState<Phase>(isHost ? 'setup' : 'waiting')
  const [roleCounts, setRoleCounts] = useState(defaultCount)
  const [myRole, setMyRole] = useState<Role | null>(null)

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const citizenCount = playerCount - roleCounts.마피아 - roleCounts.경찰 - roleCounts.의사
  const isValid = citizenCount >= 1

  function adjustRole(role: '마피아' | '경찰' | '의사', delta: number) {
    setRoleCounts(prev => {
      const next = { ...prev, [role]: prev[role] + delta }
      if (role === '마피아') next[role] = Math.max(1, next[role])
      else next[role] = Math.max(0, next[role])
      return next
    })
  }

  function deal() {
    const roleArr: Role[] = [
      ...Array(roleCounts.마피아).fill('마피아') as Role[],
      ...Array(roleCounts.경찰).fill('경찰') as Role[],
      ...Array(roleCounts.의사).fill('의사') as Role[],
      ...Array(Math.max(0, citizenCount)).fill('시민') as Role[],
    ]
    const shuffledRoles = shuffle(roleArr)
    const assignments: Record<string, Role> = {}
    players.forEach((p, i) => { assignments[p.userId] = shuffledRoles[i] })

    channelRef.current?.send({
      type: 'broadcast',
      event: 'mafia_deal',
      payload: { assignments },
    })
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`mafia-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'mafia_deal' }, ({ payload }) => {
        const { assignments } = payload as { assignments: Record<string, Role> }
        const role = assignments[userId]
        if (role) {
          setMyRole(role)
          setPhase('revealed')
        }
      })
      .on('broadcast', { event: 'mafia_done' }, () => {
        setPhase('done')
        setTimeout(() => onCompleteRef.current(100), 500)
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 방장: 역할 구성 ──
  if (phase === 'setup') {
    const specialRoles: { role: '마피아' | '경찰' | '의사'; min: number }[] = [
      { role: '마피아', min: 1 },
      { role: '경찰',   min: 0 },
      { role: '의사',   min: 0 },
    ]
    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <div>
          <div style={{ fontSize: 44, marginBottom: 4, lineHeight: 1 }}>🕵️</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>역할 구성</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {playerCount}명 참여 중
          </div>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {specialRoles.map(({ role, min }) => {
            const s = ROLE_STYLE[role]
            const count = roleCounts[role]
            const canDec = count > min
            const canInc = citizenCount > 1
            return (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 12px', borderRadius: 12, background: s.bg, border: `1px solid ${s.border}40` }}>
                  <span style={{ fontSize: 18 }}>{s.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{role}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <button onClick={() => adjustRole(role, -1)} disabled={!canDec} style={{ width: 36, height: 36, borderRadius: '10px 0 0 10px', border: '1px solid var(--border)', borderRight: 'none', background: canDec ? 'var(--surface)' : 'var(--surface2)', color: canDec ? 'var(--text)' : 'var(--text-dim)', fontSize: 18, fontWeight: 700, cursor: canDec ? 'pointer' : 'default' }}>−</button>
                  <div style={{ width: 44, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none', background: 'var(--surface)', fontFamily: "'Bebas Neue'", fontSize: 22, color: s.color }}>{count}</div>
                  <button onClick={() => adjustRole(role, +1)} disabled={!canInc} style={{ width: 36, height: 36, borderRadius: '0 10px 10px 0', border: '1px solid var(--border)', borderLeft: 'none', background: canInc ? 'var(--surface)' : 'var(--surface2)', color: canInc ? 'var(--text)' : 'var(--text-dim)', fontSize: 18, fontWeight: 700, cursor: canInc ? 'pointer' : 'default' }}>+</button>
                </div>
              </div>
            )
          })}

          {/* 시민 자동 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 12px', borderRadius: 12, background: ROLE_STYLE['시민'].bg, border: `1px solid ${ROLE_STYLE['시민'].border}40` }}>
              <span style={{ fontSize: 18 }}>{ROLE_STYLE['시민'].emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: ROLE_STYLE['시민'].color }}>시민</span>
            </div>
            <div style={{ width: 116, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isValid ? ROLE_STYLE['시민'].border + '60' : '#ef444460'}`, borderRadius: 10, background: isValid ? ROLE_STYLE['시민'].bg : 'rgba(239,68,68,0.08)', fontFamily: "'Bebas Neue'", fontSize: 22, color: isValid ? ROLE_STYLE['시민'].color : '#ef4444', gap: 4 }}>
              {citizenCount}
              <span style={{ fontSize: 11, fontFamily: 'Pretendard', fontWeight: 600, opacity: 0.7 }}>자동</span>
            </div>
          </div>

          {!isValid && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>시민이 최소 1명 이상이어야 합니다</div>}
        </div>

        <button className="btn-primary" onClick={deal} disabled={!isValid} style={{ opacity: isValid ? 1 : 0.4, cursor: isValid ? 'pointer' : 'default' }}>
          역할 배분하기
        </button>
      </div>
    )
  }

  // ── 비방장: 대기 ──
  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 36 }}>🕵️</div>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>방장이 역할을 배분하는 중...</div>
      </div>
    )
  }

  // ── 역할 공개 ──
  if (phase === 'revealed' && myRole) {
    const s = ROLE_STYLE[myRole]
    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <style>{`@keyframes flipIn { from { transform: perspective(600px) rotateY(-90deg); opacity: 0 } to { transform: perspective(600px) rotateY(0deg); opacity: 1 } }`}</style>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>나의 역할</div>
        <div style={{ width: 200, height: 280, borderRadius: 24, background: s.bg, border: `2px solid ${s.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 0 32px ${s.border}40, 0 8px 32px rgba(0,0,0,0.2)`, animation: 'flipIn 0.35s ease' }}>
          <span style={{ fontSize: 56, lineHeight: 1 }}>{s.emoji}</span>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 40, letterSpacing: '0.05em', color: s.color, textShadow: `0 0 20px ${s.border}80` }}>{myRole}</span>
          <span style={{ fontSize: 12, color: s.color, opacity: 0.8, padding: '0 20px', lineHeight: 1.5, textAlign: 'center' }}>{s.desc}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          다른 플레이어가 보지 못하도록<br />혼자 확인하세요
        </div>
        {isHost && (
          <button
            className="btn-primary"
            onClick={() => channelRef.current?.send({ type: 'broadcast', event: 'mafia_done', payload: {} })}
          >
            게임 시작 →
          </button>
        )}
        {!isHost && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>방장이 게임을 시작할 때까지 기다리세요</div>
        )}
      </div>
    )
  }

  // ── done ──
  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      <div style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)', fontSize: 64 }}>🎮</div>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: 'var(--amber)', letterSpacing: '0.05em' }}>게임 시작!</div>
      <div className="glass p-4 w-full flex flex-col gap-3" style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>진행 방법</div>
        {[
          ['🌙 밤', '눈 감기 → 마피아 손 들기 → 대상 지목 → 경찰/의사 순서로 진행'],
          ['☀️ 낮', '탈락자 발표 → 토론 → 투표 → 최다 득표자 탈락'],
          ['🏆 승리', '마피아 전멸 (시민 승) 또는 마피아 수 ≥ 시민 수 (마피아 승)'],
        ].map(([p, desc]) => (
          <div key={p as string} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--amber)' }}>{p}</span>
            <span style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

interface Props {
  onComplete: (score: number) => void
}

type Role = '마피아' | '시민' | '경찰' | '의사'
type Phase = 'setup' | 'deal' | 'done'
type DealState = 'waiting' | 'revealed'

const ROLE_STYLE: Record<Role, { emoji: string; color: string; bg: string; border: string; desc: string }> = {
  '마피아': { emoji: '🔪', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: '#ef4444', desc: '밤에 시민을 한 명 제거하세요' },
  '시민':   { emoji: '👤', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: '#60a5fa', desc: '낮에 토론으로 마피아를 찾아내세요' },
  '경찰':   { emoji: '🔦', color: '#facc15', bg: 'rgba(250,204,21,0.12)', border: '#facc15', desc: '밤에 한 명의 정체를 확인하세요' },
  '의사':   { emoji: '💉', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: '#4ade80', desc: '밤에 한 명을 마피아 공격에서 살리세요' },
}


function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DEFAULT_COUNTS: Record<number, { 마피아: number; 경찰: number; 의사: number }> = {
  4:  { 마피아: 1, 경찰: 1, 의사: 0 },
  5:  { 마피아: 1, 경찰: 1, 의사: 0 },
  6:  { 마피아: 2, 경찰: 1, 의사: 0 },
  7:  { 마피아: 2, 경찰: 1, 의사: 1 },
  8:  { 마피아: 2, 경찰: 1, 의사: 1 },
  9:  { 마피아: 3, 경찰: 1, 의사: 1 },
  10: { 마피아: 3, 경찰: 1, 의사: 1 },
}

export default function MafiaGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [playerCount, setPlayerCount] = useState(6)
  const [roleCounts, setRoleCounts] = useState(DEFAULT_COUNTS[6])
  const [roles, setRoles] = useState<Role[]>([])
  const [current, setCurrent] = useState(0)
  const [dealState, setDealState] = useState<DealState>('waiting')

  function handlePlayerCount(n: number) {
    setPlayerCount(n)
    setRoleCounts(DEFAULT_COUNTS[n])
  }

  function adjustRole(role: '마피아' | '경찰' | '의사', delta: number) {
    setRoleCounts(prev => {
      const next = { ...prev, [role]: prev[role] + delta }
      if (role === '마피아') next[role] = Math.max(1, next[role])
      else next[role] = Math.max(0, next[role])
      return next
    })
  }

  function startDeal() {
    const citizen = playerCount - roleCounts.마피아 - roleCounts.경찰 - roleCounts.의사
    const arr: Role[] = [
      ...Array(roleCounts.마피아).fill('마피아') as Role[],
      ...Array(roleCounts.경찰).fill('경찰') as Role[],
      ...Array(roleCounts.의사).fill('의사') as Role[],
      ...Array(citizen).fill('시민') as Role[],
    ]
    setRoles(shuffle(arr))
    setCurrent(0)
    setDealState('waiting')
    setPhase('deal')
  }

  function revealCard() {
    setDealState('revealed')
  }

  function confirmAndNext() {
    setDealState('waiting')
    if (current + 1 >= playerCount) {
      setPhase('done')
    } else {
      setCurrent(c => c + 1)
    }
  }

  // ── setup ──
  if (phase === 'setup') {
    const citizenCount = playerCount - roleCounts.마피아 - roleCounts.경찰 - roleCounts.의사
    const isValid = citizenCount >= 1
    const specialRoles: { role: '마피아' | '경찰' | '의사'; min: number }[] = [
      { role: '마피아', min: 1 },
      { role: '경찰',   min: 0 },
      { role: '의사',   min: 0 },
    ]

    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🕵️</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>마피아게임</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            역할을 비밀 배분하고<br />
            <strong style={{ color: 'var(--text)' }}>마피아를 찾아내세요!</strong>
          </p>
        </div>

        {/* 인원 선택 */}
        <div className="glass p-4 w-full flex flex-col gap-3">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>인원 수</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[4, 5, 6, 7, 8, 9, 10].map(n => (
              <button key={n} onClick={() => handlePlayerCount(n)} style={{
                width: 40, height: 40, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                border: playerCount === n ? '2px solid var(--amber)' : '1px solid var(--border)',
                background: playerCount === n ? 'var(--amber-light)' : 'var(--surface)',
                color: playerCount === n ? '#92400e' : 'var(--text-muted)',
                boxShadow: playerCount === n ? '0 0 10px var(--amber-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 역할 수 조정 */}
        <div className="glass p-4 w-full flex flex-col gap-3">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>역할 구성</div>

          {specialRoles.map(({ role, min }) => {
            const s = ROLE_STYLE[role]
            const count = roleCounts[role]
            const canDec = count > min
            const canInc = citizenCount > 1  // 시민 최소 1명 보장
            return (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* 역할 라벨 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, flex: 1,
                  padding: '8px 12px', borderRadius: 12,
                  background: s.bg, border: `1px solid ${s.border}40`,
                }}>
                  <span style={{ fontSize: 18 }}>{s.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{role}</span>
                </div>
                {/* 스테퍼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <button
                    onClick={() => adjustRole(role, -1)}
                    disabled={!canDec}
                    style={{
                      width: 36, height: 36, borderRadius: '10px 0 0 10px',
                      border: '1px solid var(--border)', borderRight: 'none',
                      background: canDec ? 'var(--surface)' : 'var(--surface2)',
                      color: canDec ? 'var(--text)' : 'var(--text-dim)',
                      fontSize: 18, fontWeight: 700, cursor: canDec ? 'pointer' : 'default',
                    }}>−</button>
                  <div style={{
                    width: 44, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none',
                    background: 'var(--surface)',
                    fontFamily: "'Bebas Neue'", fontSize: 22, color: s.color,
                  }}>
                    {count}
                  </div>
                  <button
                    onClick={() => adjustRole(role, +1)}
                    disabled={!canInc}
                    style={{
                      width: 36, height: 36, borderRadius: '0 10px 10px 0',
                      border: '1px solid var(--border)', borderLeft: 'none',
                      background: canInc ? 'var(--surface)' : 'var(--surface2)',
                      color: canInc ? 'var(--text)' : 'var(--text-dim)',
                      fontSize: 18, fontWeight: 700, cursor: canInc ? 'pointer' : 'default',
                    }}>+</button>
                </div>
              </div>
            )
          })}

          {/* 시민 (자동) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flex: 1,
              padding: '8px 12px', borderRadius: 12,
              background: ROLE_STYLE['시민'].bg, border: `1px solid ${ROLE_STYLE['시민'].border}40`,
            }}>
              <span style={{ fontSize: 18 }}>{ROLE_STYLE['시민'].emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: ROLE_STYLE['시민'].color }}>시민</span>
            </div>
            <div style={{
              width: 116, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${isValid ? ROLE_STYLE['시민'].border + '60' : '#ef444460'}`,
              borderRadius: 10,
              background: isValid ? ROLE_STYLE['시민'].bg : 'rgba(239,68,68,0.08)',
              fontFamily: "'Bebas Neue'", fontSize: 22,
              color: isValid ? ROLE_STYLE['시민'].color : '#ef4444',
              gap: 4,
            }}>
              {citizenCount}
              <span style={{ fontSize: 11, fontFamily: 'Pretendard', fontWeight: 600, opacity: 0.7 }}>자동</span>
            </div>
          </div>

          {!isValid && (
            <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingTop: 4 }}>
              시민이 최소 1명 이상이어야 합니다
            </div>
          )}
        </div>

        <button className="btn-primary" onClick={startDeal} disabled={!isValid}
          style={{ opacity: isValid ? 1 : 0.4, cursor: isValid ? 'pointer' : 'default' }}>
          역할 배분 시작
        </button>
      </div>
    )
  }

  // ── deal ──
  if (phase === 'deal') {
    const role = roles[current]
    const s = role ? ROLE_STYLE[role] : null

    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <style>{`
          @keyframes flipIn {
            from { transform: perspective(600px) rotateY(-90deg); opacity: 0 }
            to   { transform: perspective(600px) rotateY(0deg);   opacity: 1 }
          }
          @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        `}</style>

        {/* 진행 표시 */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
            <span>역할 배분</span>
            <span>{current + 1} / {playerCount}</span>
          </div>
          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, background: 'var(--amber)',
              width: `${((current) / playerCount) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <div style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>
          플레이어 {current + 1}번
        </div>

        {/* 카드 */}
        {dealState === 'waiting' ? (
          <button onClick={revealCard} style={{
            width: 200, height: 280, borderRadius: 24,
            background: 'linear-gradient(135deg, #1a1714, #2a2520)',
            border: '2px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            transition: 'transform 0.15s ease',
          }}>
            <span style={{ fontSize: 52 }}>🂠</span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>탭해서 확인</span>
          </button>
        ) : (
          <div style={{
            width: 200, height: 280, borderRadius: 24,
            background: s?.bg, border: `2px solid ${s?.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, boxShadow: `0 0 32px ${s?.border}40, 0 8px 32px rgba(0,0,0,0.2)`,
            animation: 'flipIn 0.35s ease',
          }}>
            <span style={{ fontSize: 56, lineHeight: 1 }}>{s?.emoji}</span>
            <span style={{
              fontFamily: "'Bebas Neue'", fontSize: 40, letterSpacing: '0.05em',
              color: s?.color, textShadow: `0 0 20px ${s?.border}80`,
            }}>{role}</span>
            <span style={{ fontSize: 12, color: s?.color, opacity: 0.8, padding: '0 20px', lineHeight: 1.5, textAlign: 'center' }}>
              {s?.desc}
            </span>
          </div>
        )}

        {dealState === 'revealed' && (
          <button onClick={confirmAndNext} className="btn-primary" style={{ animation: 'popIn 0.25s ease', marginTop: 4 }}>
            {current + 1 < playerCount ? `확인했습니다 → 플레이어 ${current + 2}번` : '확인했습니다 → 게임 시작'}
          </button>
        )}

        {dealState === 'waiting' && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            다른 플레이어가 보지 못하도록<br />혼자 확인하세요
          </p>
        )}
      </div>
    )
  }

  // ── done ──
  return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      <div style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)', fontSize: 72 }}>🎮</div>
      <div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: '0.05em',
          background: 'linear-gradient(135deg, var(--amber), #f97316)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          역할 배분 완료!
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
          모든 플레이어가 역할을 확인했습니다.
        </p>
      </div>
      <div className="glass p-4 w-full flex flex-col gap-3" style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>진행 방법</div>
        {[
          ['🌙 밤', '눈 감기 → 마피아 손 들기 → 대상 지목 → 경찰/의사 순서로 진행'],
          ['☀️ 낮', '탈락자 발표 → 토론 → 투표 → 최다 득표자 탈락'],
          ['🏆 승리', '마피아 전멸 (시민 승) 또는 마피아 수 ≥ 시민 수 (마피아 승)'],
        ].map(([phase, desc]) => (
          <div key={phase as string} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--amber)' }}>{phase}</span>
            <span style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</span>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={() => onComplete(100)}>완료</button>
    </div>
  )
}

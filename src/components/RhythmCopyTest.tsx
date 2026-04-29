'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 3
const TAP_COUNT = 5
const SHORT = 350 // ms
const LONG = 800  // ms

type Phase = 'intro' | 'showing' | 'waiting' | 'copying' | 'feedback' | 'result'

function generatePattern(): number[] {
  return Array.from({ length: TAP_COUNT - 1 }, () => Math.random() < 0.5 ? SHORT : LONG)
}

function scoreIntervals(original: number[], user: number[]): number {
  const len = Math.min(original.length, user.length)
  if (len === 0) return 0
  let totalError = 0
  for (let i = 0; i < len; i++) {
    totalError += Math.abs(original[i] - user[i]) / original[i]
  }
  return Math.max(0, Math.round((1 - totalError / len) * 100))
}

export default function RhythmCopyTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [userTaps, setUserTaps] = useState(0)
  const [lastScore, setLastScore] = useState<number | null>(null)

  const isPracticeRef = useRef(false)
  const patternRef = useRef<number[]>([])
  const userTimestampsRef = useRef<number[]>([])
  const roundRef = useRef(0)
  const scoresRef = useRef<number[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finishGame = useCallback(() => {
    const avg = scoresRef.current.length > 0
      ? Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length)
      : 0
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(avg), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (isPracticeRef.current && roundNum >= 1) { finishGame(); return }
    if (roundNum >= ROUNDS) { finishGame(); return }

    roundRef.current = roundNum
    setRound(roundNum)
    setUserTaps(0)
    setLastScore(null)
    setActiveIndex(null)
    userTimestampsRef.current = []

    const pattern = generatePattern()
    patternRef.current = pattern
    setPhase('showing')

    // 패턴 보여주기
    let delay = 500
    for (let i = 0; i < TAP_COUNT; i++) {
      const d = delay
      const idx = i
      timeoutRef.current = setTimeout(() => {
        setActiveIndex(idx)
        setTimeout(() => setActiveIndex(null), 180)
      }, d)
      if (i < TAP_COUNT - 1) delay += pattern[i]
    }

    // 입력 단계로 전환
    timeoutRef.current = setTimeout(() => {
      setPhase('waiting')
      setTimeout(() => {
        userTimestampsRef.current = []
        setUserTaps(0)
        setPhase('copying')
      }, 700)
    }, delay + 350)
  }, [finishGame])

  function handleTap() {
    if (phase !== 'copying') return
    const now = Date.now()
    userTimestampsRef.current.push(now)
    const count = userTimestampsRef.current.length
    setUserTaps(count)

    if (count >= TAP_COUNT) {
      const userIntervals: number[] = []
      for (let i = 1; i < userTimestampsRef.current.length; i++) {
        userIntervals.push(userTimestampsRef.current[i] - userTimestampsRef.current[i - 1])
      }
      const score = scoreIntervals(patternRef.current, userIntervals)
      scoresRef.current.push(score)
      setLastScore(score)
      setPhase('feedback')
      setTimeout(() => startRound(roundRef.current + 1), 1400)
    }
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🥁</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>리듬 따라치기</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            리듬 패턴을 보여줄게요<br />
            같은 <strong style={{ color: '#f0f0f0' }}>간격으로</strong> 따라 탭하세요!
          </p>
        </div>
        <div className="glass p-4 w-full" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          짧은 간격(●●) = {SHORT}ms · 긴 간격(● ●) = {LONG}ms<br />
          패턴을 보고 — 똑같은 리듬으로 5번 탭!
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROUNDS}라운드</div>
        <button className="btn-secondary" onClick={() => { isPracticeRef.current = true; startRound(0) }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startRound(0) }}>시작하기</button>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const avg = scoresRef.current.length > 0
      ? Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length)
      : 0
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {avg}<span style={{ fontSize: 32 }}>점</span>
        </div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── showing / waiting / copying / feedback ──
  const statusMap: Record<string, { text: string; color: string }> = {
    showing:  { text: '패턴을 기억하세요...', color: 'var(--text-muted)' },
    waiting:  { text: '준비...', color: 'var(--amber)' },
    copying:  { text: '따라 탭하세요!', color: '#4ade80' },
    feedback: { text: '', color: 'var(--text-dim)' },
  }
  const status = statusMap[phase] ?? { text: '', color: 'var(--text-dim)' }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        {phase === 'copying' && <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{userTaps} / {TAP_COUNT}</span>}
      </div>

      {/* 상태 텍스트 */}
      <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && lastScore !== null ? (
          <span style={{
            fontSize: 16, fontWeight: 700,
            color: lastScore >= 80 ? '#4ade80' : lastScore >= 55 ? 'var(--amber)' : '#ef4444',
          }}>
            {lastScore >= 80 ? '🎯 완벽!' : lastScore >= 55 ? '👍 좋아요!' : '😬 아쉽'} {lastScore}점
          </span>
        ) : (
          <span style={{ fontSize: 14, color: status.color, fontWeight: 600 }}>{status.text}</span>
        )}
      </div>

      {/* 도트 표시 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', height: 72, padding: '0 8px' }}>
        {Array.from({ length: TAP_COUNT }).map((_, i) => {
          const isActive = activeIndex === i
          const isTapped = (phase === 'copying' || phase === 'feedback') && i < userTaps
          return (
            <div key={i} style={{
              width: isActive ? 54 : 42, height: isActive ? 54 : 42,
              borderRadius: '50%',
              background: isActive
                ? 'var(--amber)'
                : isTapped
                ? '#4ade80'
                : 'var(--surface2)',
              border: isActive ? 'none' : '2px solid var(--border)',
              boxShadow: isActive ? '0 0 20px rgba(245,158,11,0.6)' : isTapped ? '0 0 10px rgba(74,222,128,0.3)' : 'none',
              transition: 'all 0.1s ease',
            }} />
          )
        })}
      </div>

      {/* 탭 버튼 */}
      <button
        onPointerDown={handleTap}
        disabled={phase !== 'copying'}
        style={{
          width: '100%', height: 170, borderRadius: 24,
          background: phase === 'copying' ? 'rgba(232,137,12,0.08)' : 'var(--surface)',
          border: phase === 'copying' ? '2px solid var(--amber)' : '1px solid var(--border)',
          cursor: phase === 'copying' ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: phase === 'copying' ? '0 0 24px rgba(232,137,12,0.15)' : 'none',
          transition: 'all 0.2s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 52 }}>
          {phase === 'copying' ? '🥁' : phase === 'showing' ? '👀' : phase === 'waiting' ? '⏳' : '✅'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          {phase === 'copying' ? `${TAP_COUNT}번 탭` : ''}
        </span>
      </button>
    </div>
  )
}

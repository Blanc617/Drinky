'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const LIVES = 3
const LEVEL_UP_EVERY = 5
const SPEEDS = [900, 720, 580, 470, 380, 310, 260, 220] // ms per turn

type Side = 'left' | 'right'
type Phase = 'intro' | 'playing' | 'result'

export default function RhythmTapTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [active, setActive] = useState<Side>('left')
  const [lives, setLives] = useState(LIVES)
  const [hits, setHits] = useState(0)
  const [feedback, setFeedback] = useState<{ side: Side; ok: boolean } | null>(null)

  const isPracticeRef = useRef(false)
  const livesRef = useRef(LIVES)
  const hitsRef = useRef(0)
  const activeRef = useRef<Side>('left')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneRef = useRef(false)
  const feedbackRef = useRef(false)

  const getSpeed = () => {
    const level = Math.floor(hitsRef.current / LEVEL_UP_EVERY)
    return SPEEDS[Math.min(level, SPEEDS.length - 1)]
  }

  const finishGame = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    const score = Math.min(100, Math.round(hitsRef.current * 2.5))
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const scheduleNext = useCallback((nextSide: Side) => {
    activeRef.current = nextSide
    setActive(nextSide)
    feedbackRef.current = false

    const speed = getSpeed()
    timerRef.current = setTimeout(() => {
      if (feedbackRef.current) return
      // 시간 초과 = 미스
      livesRef.current--
      setLives(livesRef.current)
      setFeedback({ side: nextSide, ok: false })
      feedbackRef.current = true
      setTimeout(() => {
        setFeedback(null)
        if (livesRef.current <= 0) { finishGame(); return }
        scheduleNext(nextSide === 'left' ? 'right' : 'left')
      }, 400)
    }, speed)
  }, [finishGame])

  function startGame() {
    doneRef.current = false
    livesRef.current = LIVES
    hitsRef.current = 0
    setLives(LIVES)
    setHits(0)
    setFeedback(null)
    feedbackRef.current = false
    setPhase('playing')
    const startSide: Side = Math.random() < 0.5 ? 'left' : 'right'
    scheduleNext(startSide)
  }

  function handleTap(side: Side) {
    if (phase !== 'playing' || feedbackRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    feedbackRef.current = true

    const isCorrect = side === activeRef.current
    setFeedback({ side, ok: isCorrect })

    if (isCorrect) {
      hitsRef.current++
      setHits(hitsRef.current)
    } else {
      livesRef.current--
      setLives(livesRef.current)
    }

    setTimeout(() => {
      setFeedback(null)
      if (livesRef.current <= 0) { finishGame(); return }
      scheduleNext(activeRef.current === 'left' ? 'right' : 'left')
    }, 250)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>👈👉</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>연타 리듬</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            빛나는 쪽 버튼을 탭하세요<br />
            속도가 점점 <strong style={{ color: '#f0f0f0' }}>빨라집니다!</strong>
          </p>
        </div>
        <div className="glass p-4 w-full flex flex-col gap-2" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <div>❤️ x {LIVES} · 시간 초과 또는 반대쪽 탭 = 하트 -1</div>
          <div>매 {LEVEL_UP_EVERY}회마다 속도 증가</div>
        </div>
        <button className="btn-secondary" onClick={() => { isPracticeRef.current = true; startGame() }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startGame() }}>시작하기</button>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const level = Math.floor(hitsRef.current / LEVEL_UP_EVERY) + 1
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {hitsRef.current}<span style={{ fontSize: 32 }}>회</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>최고 레벨 {level}</div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── playing ──
  const level = Math.floor(hits / LEVEL_UP_EVERY) + 1

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* 상단 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ fontSize: 22, letterSpacing: 2 }}>
          {Array.from({ length: LIVES }).map((_, i) => (
            <span key={i}>{i < lives ? '❤️' : '🖤'}</span>
          ))}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: 'var(--amber)', lineHeight: 1 }}>{hits}회</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Lv.{level}</div>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%', marginTop: 8 }}>
        {(['left', 'right'] as Side[]).map((side) => {
          const isActive = active === side && !feedback
          const isFeedback = feedback?.side === side
          const isOk = isFeedback && feedback?.ok
          const isFail = isFeedback && !feedback?.ok
          const isWrongSide = feedback && !feedback.ok && feedback.side !== side && active === side

          return (
            <button
              key={side}
              onPointerDown={() => handleTap(side)}
              style={{
                height: 200, borderRadius: 24,
                border: isActive
                  ? '3px solid var(--amber)'
                  : isOk ? '3px solid #4ade80'
                  : isFail || isWrongSide ? '3px solid #ef4444'
                  : '1px solid var(--border)',
                background: isActive
                  ? 'rgba(232,137,12,0.12)'
                  : isOk ? 'rgba(74,222,128,0.12)'
                  : isFail ? 'rgba(239,68,68,0.1)'
                  : 'var(--surface)',
                boxShadow: isActive ? '0 0 30px rgba(232,137,12,0.25)' : 'none',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 52,
                transition: 'all 0.1s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isOk
                ? <span style={{ fontSize: 48 }}>✓</span>
                : isFail
                ? <span style={{ fontSize: 48 }}>✗</span>
                : isActive
                ? (side === 'left' ? '👈' : '👉')
                : <span style={{ fontSize: 36, opacity: 0.2 }}>{side === 'left' ? '←' : '→'}</span>
              }
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>빛나는 쪽을 탭!</div>
    </div>
  )
}

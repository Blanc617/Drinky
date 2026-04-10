'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const COLORS = [
  { id: 0, label: '빨강', hex: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
  { id: 1, label: '파랑', hex: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
  { id: 2, label: '초록', hex: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
  { id: 3, label: '노랑', hex: '#eab308', glow: 'rgba(234,179,8,0.5)' },
]

const ROUNDS = 3

function generateRound() {
  const wordIdx = Math.floor(Math.random() * COLORS.length)
  let inkIdx = Math.floor(Math.random() * COLORS.length)
  // 글자 뜻과 잉크색이 항상 다르게
  while (inkIdx === wordIdx) {
    inkIdx = Math.floor(Math.random() * COLORS.length)
  }
  return { wordIdx, inkIdx }
}

type Phase = 'intro' | 'playing' | 'feedback' | 'result'

export default function StroopTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [current, setCurrent] = useState(generateRound())
  const [correct, setCorrect] = useState(0)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [lastOk, setLastOk] = useState(true)
  const [tappedId, setTappedId] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(3)
  const showTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundRef = useRef(0)
  const correctRef = useRef(0)
  const timesRef = useRef<number[]>([])

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const times = timesRef.current
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 3000
    // 정확도 70% + 속도 30% 반영
    const accuracy = (correctRef.current / ROUNDS) * 100
    const speedBonus = Math.max(0, (1500 - avgTime) / 1500 * 30)
    const score = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    setPhase('result')
    setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (roundNum >= ROUNDS) { finishGame(); return }
    const next = generateRound()
    setCurrent(next)
    setTappedId(null)
    setTimeLeft(3)
    showTimeRef.current = Date.now()
    setPhase('playing')

    // 1.5초 타임아웃
    if (timerRef.current) clearInterval(timerRef.current)
    let t = 1.5
    timerRef.current = setInterval(() => {
      t -= 0.1
      setTimeLeft(Math.max(0, t))
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        // 시간 초과 → 오답 처리
        setLastOk(false)
        setPhase('feedback')
        const next2 = roundNum + 1
        roundRef.current = next2
        setTimeout(() => {
          setRound(next2)
          startRound(next2)
        }, 700)
      }
    }, 100)
  }, [finishGame])

  function handleTap(colorId: number) {
    if (phase !== 'playing') return
    if (timerRef.current) clearInterval(timerRef.current)

    const rt = Date.now() - showTimeRef.current
    const isCorrect = colorId === current.inkIdx

    setTappedId(colorId)
    setLastOk(isCorrect)

    if (isCorrect) {
      correctRef.current += 1
      setCorrect((c) => c + 1)
      timesRef.current = [...timesRef.current, rt]
      setReactionTimes((prev) => [...prev, rt])
    }

    setPhase('feedback')
    const next = roundRef.current + 1
    roundRef.current = next
    setTimeout(() => {
      setRound(next)
      startRound(next)
    }, 700)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🎨🧩</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            스트룹 테스트
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            글자의 <strong style={{ color: 'var(--text)' }}>색깔</strong>을 탭하세요<br />
            글자 뜻에 속으면 안돼요!
          </p>
        </div>

        {/* 예시 */}
        <div className="glass p-5 w-full flex flex-col items-center gap-4">
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>예시</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#3b82f6', letterSpacing: '0.05em' }}>
            빨강
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            → <span style={{ color: '#3b82f6', fontWeight: 700 }}>파랑</span> 버튼을 탭하세요
          </div>
        </div>

        <button className="btn-primary" onClick={() => { roundRef.current = 0; correctRef.current = 0; timesRef.current = []; startRound(0) }}>
          시작하기
        </button>
      </div>
    )
  }

  if (phase === 'result') {
    const times = timesRef.current
    const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
    const accuracy = Math.round((correctRef.current / ROUNDS) * 100)
    const speedBonus = Math.max(0, Math.round((1500 - avgTime) / 1500 * 30))
    const finalScore = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))

    return (
      <div className="flex flex-col items-center gap-5 text-center w-full">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          스트룹 테스트 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {finalScore}<span style={{ fontSize: 32 }}>점</span>
        </div>
        <div className="glass p-4 w-full flex flex-col gap-2">
          <div className="flex justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>정확도</span>
            <span style={{ fontWeight: 700 }}>{accuracy}%</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>평균 반응</span>
            <span style={{ fontWeight: 700 }}>{avgTime}ms</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>다음 테스트로 이동 중...</div>
      </div>
    )
  }

  const inkColor = COLORS[current.inkIdx]
  const progressPct = (timeLeft / 3) * 100

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* 라운드 + 타임바 */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-between" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          <span>{round + 1} / {ROUNDS}</span>
          <span style={{ color: correct > 0 ? '#4ade80' : 'var(--text-dim)' }}>{correct} 정답</span>
        </div>
        <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: timeLeft > 1.5 ? '#22c55e' : timeLeft > 0.8 ? '#f59e0b' : '#ef4444',
            width: `${progressPct}%`,
            transition: 'width 0.1s linear, background 0.3s ease',
            boxShadow: `0 0 8px ${timeLeft > 1.5 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
          }} />
        </div>
      </div>

      {/* 메인 단어 */}
      <div style={{
        fontSize: 64, fontWeight: 900,
        color: inkColor.hex,
        textShadow: `0 0 30px ${inkColor.glow}`,
        letterSpacing: '0.05em',
        minHeight: 80, display: 'flex', alignItems: 'center',
        animation: phase === 'playing' ? 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}>
        {COLORS[current.wordIdx].label}
      </div>

      {/* 힌트 */}
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        글자 색깔을 탭하세요
      </div>

      {/* 색깔 버튼 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
        {COLORS.map((color) => {
          const isTapped = tappedId === color.id
          const isCorrectAnswer = color.id === current.inkIdx
          const showResult = phase === 'feedback' && isTapped

          return (
            <button
              key={color.id}
              onClick={() => handleTap(color.id)}
              disabled={phase !== 'playing'}
              style={{
                height: 72, borderRadius: 16, border: 'none',
                cursor: phase === 'playing' ? 'pointer' : 'default',
                background: color.hex,
                opacity: phase === 'feedback'
                  ? isTapped
                    ? 1
                    : isCorrectAnswer
                    ? 0.9
                    : 0.2
                  : 0.65,
                boxShadow: showResult
                  ? lastOk
                    ? `0 0 0 3px var(--border), 0 0 20px ${color.glow}`
                    : `0 0 0 3px var(--border), 0 0 20px rgba(239,68,68,0.6)`
                  : phase === 'feedback' && isCorrectAnswer && !lastOk
                  ? `0 0 0 3px var(--border)`
                  : 'none',
                transform: isTapped && phase === 'feedback' ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.15s ease',
                fontFamily: "'Bebas Neue'",
                fontSize: 20,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: '0.05em',
              }}
            >
              {color.label}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes popIn { from { transform: scale(0.8); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  )
}

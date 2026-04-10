'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 4
const TIME_LIMIT = 1.5 // seconds

const GESTURES = [
  { id: 'rock',     emoji: '✊', label: '주먹' },
  { id: 'scissors', emoji: '✌️', label: '가위' },
  { id: 'paper',    emoji: '🖐️', label: '보'   },
]

// 지는 제스처 매핑: 화면에 나온 걸 보고 져야 하는 걸 탭
const LOSER_OF: Record<string, string> = {
  rock:     'scissors', // 주먹이 나오면 → 가위를 탭
  scissors: 'paper',    // 가위가 나오면 → 보를 탭
  paper:    'rock',     // 보가 나오면   → 주먹을 탭
}

type Phase = 'intro' | 'countdown' | 'playing' | 'feedback' | 'result'

export default function RpsLoserTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(3)
  const [round, setRound] = useState(0)
  const [current, setCurrent] = useState<typeof GESTURES[0] | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | 'timeout' | null>(null)
  const [correct, setCorrect] = useState(0)
  const [tapped, setTapped] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const correctRef = useRef(0)
  const timesRef = useRef<number[]>([])
  const roundStartRef = useRef(0)
  const roundRef = useRef(0)

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const accuracy = (correctRef.current / ROUNDS) * 100
    const avgTime = timesRef.current.length > 0
      ? timesRef.current.reduce((a, b) => a + b, 0) / timesRef.current.length
      : TIME_LIMIT * 1000
    const speedBonus = Math.max(0, ((TIME_LIMIT * 1000 - avgTime) / (TIME_LIMIT * 1000)) * 30)
    const score = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    setPhase('result')
    setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (roundNum >= ROUNDS) { finishGame(); return }
    roundRef.current = roundNum
    const gesture = GESTURES[Math.floor(Math.random() * GESTURES.length)]
    setCurrent(gesture)
    setTapped(null)
    setLastResult(null)
    setTimeLeft(TIME_LIMIT)
    setRound(roundNum)
    roundStartRef.current = Date.now()
    setPhase('playing')

    if (timerRef.current) clearInterval(timerRef.current)
    let t = TIME_LIMIT
    timerRef.current = setInterval(() => {
      t -= 0.05
      setTimeLeft(Math.max(0, t))
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setLastResult('timeout')
        setPhase('feedback')
        setTimeout(() => startRound(roundRef.current + 1), 900)
      }
    }, 50)
  }, [finishGame])

  function handleTap(gestureId: string) {
    if (phase !== 'playing' || !current) return
    if (timerRef.current) clearInterval(timerRef.current)

    const elapsed = Date.now() - roundStartRef.current
    const isCorrect = gestureId === LOSER_OF[current.id]

    setTapped(gestureId)
    if (isCorrect) {
      correctRef.current += 1
      setCorrect(c => c + 1)
      timesRef.current.push(elapsed)
      setLastResult('correct')
    } else {
      setLastResult('wrong')
    }
    setPhase('feedback')
    setTimeout(() => startRound(roundRef.current + 1), 900)
  }

  function startCountdown() {
    setPhase('countdown')
    setCountdown(3)
    let count = 3
    const timer = setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) { clearInterval(timer); startRound(0) }
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>✊✌️🖐️</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            지는 가위바위보
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            화면에 나온 손 모양에<br />
            <strong style={{ color: '#f0f0f0' }}>지는 것</strong>을 탭하세요!
          </p>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {[
            { show: '✊ 주먹', arrow: '→', answer: '✌️ 가위' },
            { show: '✌️ 가위', arrow: '→', answer: '🖐️ 보' },
            { show: '🖐️ 보',   arrow: '→', answer: '✊ 주먹' },
          ].map((ex) => (
            <div key={ex.show} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15 }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{ex.show}</span>
              <span style={{ color: 'var(--text-dim)' }}>{ex.arrow}</span>
              <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{ex.answer}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>제한시간 {TIME_LIMIT}초 · {ROUNDS}라운드</div>
        <button className="btn-primary" onClick={startCountdown}>시작하기</button>
      </div>
    )
  }

  // ── countdown ──
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>준비하세요</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 120, color: 'var(--amber)', lineHeight: 1,
          textShadow: '0 0 40px rgba(245,158,11,0.6)',
          animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {countdown}
        </div>
        <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const accuracy = Math.round((correctRef.current / ROUNDS) * 100)
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          테스트 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {correctRef.current}<span style={{ fontSize: 32 }}>/{ROUNDS}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>정답률 {accuracy}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // ── playing / feedback ──
  const circumference = 2 * Math.PI * 42
  const feedbackColor = lastResult === 'correct' ? '#4ade80' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>

      {/* 라운드 / 정답 카운터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span style={{ color: correct > 0 ? '#4ade80' : 'var(--text-dim)' }}>{correct} 정답</span>
      </div>

      {/* 타이머 링 */}
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface2)" strokeWidth="5"/>
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={phase === 'feedback' ? feedbackColor : 'var(--amber)'}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - timeLeft / TIME_LIMIT)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 5px ${phase === 'feedback' ? feedbackColor : 'rgba(245,158,11,0.5)'})` }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'var(--text-muted)', fontWeight: 600,
        }}>
          {timeLeft.toFixed(1)}
        </div>
      </div>

      {/* 현재 제스처 */}
      <div style={{
        fontSize: 90, lineHeight: 1, textAlign: 'center',
        animation: phase === 'feedback' && lastResult !== 'correct' ? 'shake 0.4s ease' : 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        filter: phase === 'feedback' ? `drop-shadow(0 0 20px ${feedbackColor})` : 'none',
      }}>
        {current?.emoji}
      </div>

      {/* 피드백 텍스트 */}
      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && (
          <span style={{ fontSize: 15, fontWeight: 700, color: feedbackColor }}>
            {lastResult === 'correct' ? '✓ 정답!' : lastResult === 'timeout' ? '⏱ 시간 초과' : '✗ 오답'}
          </span>
        )}
        {phase === 'playing' && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>지는 걸 탭하세요</span>
        )}
      </div>

      {/* 선택 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%' }}>
        {GESTURES.map((g) => {
          const isTapped = tapped === g.id
          const isCorrectAnswer = current ? g.id === LOSER_OF[current.id] : false
          const showCorrect = phase === 'feedback' && isCorrectAnswer
          const showWrong = phase === 'feedback' && isTapped && !isCorrectAnswer

          return (
            <button
              key={g.id}
              onClick={() => handleTap(g.id)}
              disabled={phase === 'feedback'}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '14px 8px', borderRadius: 16, cursor: phase === 'playing' ? 'pointer' : 'default',
                border: showCorrect ? '2px solid #4ade80' : showWrong ? '2px solid #ef4444' : '1px solid var(--border)',
                background: showCorrect ? 'rgba(74,222,128,0.12)' : showWrong ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                transition: 'all 0.15s ease',
                boxShadow: showCorrect ? '0 0 16px rgba(74,222,128,0.3)' : showWrong ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
              }}
            >
              <span style={{ fontSize: 36 }}>{g.emoji}</span>
              <span style={{ fontSize: 12, color: showCorrect ? '#4ade80' : showWrong ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                {g.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

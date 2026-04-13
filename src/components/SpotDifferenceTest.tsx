'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 4
const TIME_LIMITS = [5, 4.5, 4, 3]
const GRID_SIZE = 9 // 3×3

// 10개 = 9칸 + 교체용 1개 여유
const COLORS = [
  '#ef4444','#3b82f6','#22c55e','#eab308','#a855f7',
  '#f97316','#ec4899','#06b6d4','#84cc16','#f43f5e',
]

type Phase = 'intro' | 'playing' | 'feedback' | 'result'

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function generateGrids() {
  // 9칸 모두 고유한 색상 사용
  const shuffled = shuffle(COLORS)
  const left = shuffled.slice(0, GRID_SIZE)
  const right = [...left]
  const diffIndex = Math.floor(Math.random() * GRID_SIZE)
  // 교체 색은 left에 없는 색 중 하나
  const leftSet = new Set(left)
  const available = COLORS.filter(c => !leftSet.has(c))
  right[diffIndex] = available[Math.floor(Math.random() * available.length)]
  return { left, right, diffIndex }
}

export default function SpotDifferenceTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [grids, setGrids] = useState<{ left: string[]; right: string[]; diffIndex: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMITS[0])
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | 'timeout' | null>(null)
  const [tapped, setTapped] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const correctRef = useRef(0)
  const timesRef = useRef<number[]>([])
  const roundStartRef = useRef(0)
  const roundRef = useRef(0)
  const isPracticeRef = useRef(false)

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const accuracy = (correctRef.current / ROUNDS) * 100
    const avgTimeLimit = TIME_LIMITS.reduce((a, b) => a + b, 0) / TIME_LIMITS.length
    const avgTime = timesRef.current.length > 0
      ? timesRef.current.reduce((a, b) => a + b, 0) / timesRef.current.length
      : avgTimeLimit * 1000
    const speedBonus = Math.max(0, ((avgTimeLimit * 1000 - avgTime) / (avgTimeLimit * 1000)) * 30)
    const score = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (isPracticeRef.current && roundNum >= 1) { finishGame(); return }
    if (roundNum >= ROUNDS) { finishGame(); return }
    roundRef.current = roundNum
    setGrids(generateGrids())
    setTapped(null)
    setLastResult(null)
    const timeLimit = TIME_LIMITS[roundNum]
    setTimeLeft(timeLimit)
    setRound(roundNum)
    roundStartRef.current = Date.now()
    setPhase('playing')

    if (timerRef.current) clearInterval(timerRef.current)
    let t = timeLimit
    timerRef.current = setInterval(() => {
      t -= 0.1
      setTimeLeft(Math.max(0, t))
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setLastResult('timeout')
        setPhase('feedback')
        setTimeout(() => startRound(roundRef.current + 1), 1000)
      }
    }, 100)
  }, [finishGame])

  function handleTap(index: number) {
    if (phase !== 'playing' || !grids) return
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsed = Date.now() - roundStartRef.current
    const isCorrect = index === grids.diffIndex
    setTapped(index)
    if (isCorrect) {
      correctRef.current += 1
      setCorrect(c => c + 1)
      timesRef.current.push(elapsed)
      setLastResult('correct')
    } else {
      setLastResult('wrong')
    }
    setPhase('feedback')
    setTimeout(() => startRound(roundRef.current + 1), 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🔍</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>틀린 그림 찾기</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            왼쪽(원본)과 오른쪽을 비교해서<br />
            <strong style={{ color: '#f0f0f0' }}>색이 다른 칸</strong>을 오른쪽에서 탭하세요
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>5 → 4.5 → 4 → 3초 · {ROUNDS}라운드</div>
        <button className="btn-secondary" style={{ marginBottom: 0 }} onClick={() => {
          isPracticeRef.current = true
          startRound(0)
        }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startRound(0) }}>시작하기</button>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {correctRef.current}<span style={{ fontSize: 32 }}>/{ROUNDS}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>정답률 {Math.round(correctRef.current / ROUNDS * 100)}%</div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── playing / feedback ──
  const feedbackColor = lastResult === 'correct' ? '#4ade80' : '#ef4444'
  const circumference = 2 * Math.PI * 42

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span style={{ color: correct > 0 ? '#4ade80' : 'var(--text-dim)' }}>{correct} 정답</span>
      </div>

      {/* 타이머 링 */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg width="80" height="80" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface2)" strokeWidth="5"/>
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={phase === 'feedback' ? feedbackColor : 'var(--amber)'}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - timeLeft / TIME_LIMITS[round])}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear', filter: `drop-shadow(0 0 4px ${phase === 'feedback' ? feedbackColor : 'rgba(245,158,11,0.5)'})` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          {Math.ceil(timeLeft)}
        </div>
      </div>

      {/* 두 그리드 */}
      {grids && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          {/* 왼쪽: 원본 */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>원본</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {grids.left.map((color, i) => (
                <div key={i} style={{ width: 56, height: 56, borderRadius: 12, background: color, border: '2px solid transparent' }} />
              ))}
            </div>
          </div>

          <div style={{ fontSize: 18, color: 'var(--text-dim)', fontWeight: 700 }}>→</div>

          {/* 오른쪽: 찾기 */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--amber)', textAlign: 'center', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>탭!</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {grids.right.map((color, i) => {
                const isCorrectCell = i === grids.diffIndex
                const isTappedCell = tapped === i
                let border = '2px solid transparent'
                if (phase === 'feedback') {
                  if (isCorrectCell) border = '2px solid #4ade80'
                  else if (isTappedCell) border = '2px solid #ef4444'
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleTap(i)}
                    disabled={phase === 'feedback'}
                    style={{
                      width: 56, height: 56, borderRadius: 12, background: color, border,
                      cursor: phase === 'playing' ? 'pointer' : 'default',
                      transition: 'border 0.15s ease',
                      boxShadow: phase === 'feedback' && isCorrectCell ? '0 0 12px rgba(74,222,128,0.4)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && (
          <span style={{ fontSize: 15, fontWeight: 700, color: feedbackColor }}>
            {lastResult === 'correct' ? '✓ 정답!' : lastResult === 'timeout' ? '⏱ 시간 초과' : '✗ 오답'}
          </span>
        )}
        {phase === 'playing' && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>오른쪽에서 다른 칸을 탭하세요</span>}
      </div>
    </div>
  )
}

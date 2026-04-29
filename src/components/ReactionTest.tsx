'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
}

type Phase = 'intro' | 'playing' | 'result'
type CellState = 'idle' | 'mole' | 'bomb'

const GRID_SIZE = 9
const ROUNDS = 5
const DISPLAY_DURATION = 600 // 두더지/폭탄 표시 시간 (ms)
const ROUND_DELAYS = [200, 180, 160, 160, 160] // 라운드별 대기 간격 (ms)

export default function ReactionTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [cells, setCells] = useState<CellState[]>(Array(GRID_SIZE).fill('idle'))
  const [round, setRound] = useState(0)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [misses, setMisses] = useState(0)
  const [lastFeedback, setLastFeedback] = useState<{ index: number; ok: boolean } | null>(null)
  const [score, setScore] = useState(0)
  const showTimeRef = useRef(0)
  const activeIndexRef = useRef(-1)
  const activeTypeRef = useRef<'mole' | 'bomb'>('mole')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundRef = useRef(0)
  const reactedRef = useRef(false)
  const isPracticeRef = useRef(false)

  const finishGame = useCallback((times: number[], missCount: number) => {
    setPhase('result')
    const correct = ROUNDS - missCount
    const accuracy = (correct / ROUNDS) * 100
    const avg = times.length > 0
      ? times.reduce((a, b) => a + b, 0) / times.length
      : DISPLAY_DURATION
    const speedBonus = Math.max(0, (DISPLAY_DURATION - avg) / DISPLAY_DURATION * 30)
    const finalScore = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    setScore(finalScore)
    if (!isPracticeRef.current) setTimeout(() => onComplete(finalScore), 1500)
  }, [onComplete])

  const runRound = useCallback((currentRound: number, prevTimes: number[], prevMisses: number) => {
    if (isPracticeRef.current && currentRound >= 1) {
      finishGame(prevTimes, prevMisses)
      return
    }
    if (currentRound >= ROUNDS) {
      finishGame(prevTimes, prevMisses)
      return
    }

    const delay = ROUND_DELAYS[currentRound] ?? 160
    timeoutRef.current = setTimeout(() => {
      const isMole = Math.random() > 0.3
      const idx = Math.floor(Math.random() * GRID_SIZE)
      activeIndexRef.current = idx
      activeTypeRef.current = isMole ? 'mole' : 'bomb'
      reactedRef.current = false
      showTimeRef.current = Date.now()

      setCells((prev) => {
        const next = [...prev]
        next[idx] = isMole ? 'mole' : 'bomb'
        return next
      })

      // 시간 초과 시 자동 처리
      timeoutRef.current = setTimeout(() => {
        setCells(Array(GRID_SIZE).fill('idle'))
        activeIndexRef.current = -1
        setLastFeedback(null)
        if (!reactedRef.current) {
          reactedRef.current = true
          if (isMole) {
            // 두더지 놓침 → 패널티
            const newMisses = prevMisses + 1
            setMisses(newMisses)
            roundRef.current = currentRound + 1
            setRound(currentRound + 1)
            runRound(currentRound + 1, prevTimes, newMisses)
          } else {
            // 폭탄 자동 소멸 → 정상
            roundRef.current = currentRound + 1
            setRound(currentRound + 1)
            runRound(currentRound + 1, prevTimes, prevMisses)
          }
        }
      }, DISPLAY_DURATION)
    }, delay)
  }, [finishGame])

  function handleCellTap(index: number) {
    if (phase !== 'playing') return
    if (activeIndexRef.current !== index) return
    if (reactedRef.current) return
    reactedRef.current = true

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const type = activeTypeRef.current
    setCells(Array(GRID_SIZE).fill('idle'))

    if (type === 'mole') {
      const rt = Date.now() - showTimeRef.current
      const newTimes = [...reactionTimes, rt]
      setReactionTimes(newTimes)
      setLastFeedback({ index, ok: true })
      const next = roundRef.current + 1
      roundRef.current = next
      setRound(next)
      setTimeout(() => {
        setLastFeedback(null)
        runRound(next, newTimes, misses)
      }, 300)
    } else {
      // 폭탄 탭 → 패널티
      const newMisses = misses + 1
      setMisses(newMisses)
      setLastFeedback({ index, ok: false })
      const next = roundRef.current + 1
      roundRef.current = next
      setRound(next)
      setTimeout(() => {
        setLastFeedback(null)
        runRound(next, reactionTimes, newMisses)
      }, 300)
    }
  }

  function startGame() {
    roundRef.current = 0
    setRound(0)
    setReactionTimes([])
    setMisses(0)
    setPhase('playing')
    runRound(0, [], 0)
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🐹🔨</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            두더지 잡기
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            두더지(🟢)가 나오면 빠르게 탭!<br />
            폭탄(💣)은 절대 탭하지 마세요
          </p>
        </div>
        <div className="glass p-4 w-full flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🐹</div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>두더지 → 빠르게 탭</span>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💣</div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>폭탄 → 탭하면 패널티</span>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => { isPracticeRef.current = true; startGame() }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startGame() }}>시작하기</button>
      </div>
    )
  }

  if (phase === 'result') {
    const correct = ROUNDS - misses
    const accuracy = Math.round((correct / ROUNDS) * 100)
    const avg = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : DISPLAY_DURATION
    const speedBonus = Math.max(0, Math.round((DISPLAY_DURATION - avg) / DISPLAY_DURATION * 30))
    const finalScore = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          두더지 잡기 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 72, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {finalScore}<span style={{ fontSize: 28 }}>점</span>
        </div>
        <div className="glass p-4 w-full flex flex-col gap-2">
          <div className="flex justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>정확도</span>
            <span style={{ fontWeight: 700 }}>{accuracy}%</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>평균 반응</span>
            <span style={{ fontWeight: 700 }}>{avg}ms</span>
          </div>
        </div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>다음 테스트로 이동 중...</div>
        }
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex justify-between w-full" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round} / {ROUNDS}</span>
        {misses > 0 && <span style={{ color: '#f87171' }}>실수 {misses}회</span>}
      </div>

      {/* 3x3 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        {cells.map((cell, i) => {
          const isFeedback = lastFeedback?.index === i
          return (
            <button
              key={i}
              onClick={() => handleCellTap(i)}
              style={{
                aspectRatio: '1',
                borderRadius: 16,
                border: 'none',
                cursor: 'pointer',
                background: cell === 'mole'
                  ? '#22c55e'
                  : cell === 'bomb'
                  ? '#ef4444'
                  : 'var(--surface2)',
                boxShadow: cell === 'mole'
                  ? '0 0 20px rgba(34,197,94,0.5)'
                  : cell === 'bomb'
                  ? '0 0 20px rgba(239,68,68,0.5)'
                  : isFeedback
                  ? lastFeedback?.ok
                    ? '0 0 20px rgba(34,197,94,0.4)'
                    : '0 0 20px rgba(239,68,68,0.4)'
                  : 'none',
                fontSize: 32,
                transition: 'all 0.1s ease',
                transform: cell !== 'idle' ? 'scale(1.05)' : 'scale(1)',
                animation: cell !== 'idle' ? 'popIn 0.15s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              }}
            >
              {cell === 'mole' ? '🐹' : cell === 'bomb' ? '💣' : ''}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes popIn { from { transform: scale(0.6); opacity:0 } to { transform: scale(1.05); opacity:1 } }
      `}</style>
    </div>
  )
}

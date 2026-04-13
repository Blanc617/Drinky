'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 5
const CYCLE = 1800 // ms for one full grow-shrink cycle

type Phase = 'intro' | 'countdown' | 'playing' | 'feedback' | 'result'

function getGrade(error: number): { label: string; color: string } {
  if (error < 50)  return { label: 'PERFECT', color: '#4ade80' }
  if (error < 130) return { label: 'GREAT',   color: 'var(--amber)' }
  if (error < 280) return { label: 'GOOD',    color: '#60a5fa' }
  return              { label: 'MISS',    color: '#ef4444' }
}

export default function BeatTimingTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(3)
  const [round, setRound] = useState(0)
  const [circleSize, setCircleSize] = useState(0) // 0~1
  const [grade, setGrade] = useState<{ label: string; color: string } | null>(null)
  const [totalScore, setTotalScore] = useState(0)

  const isPracticeRef = useRef(false)
  const animRef = useRef<number | null>(null)
  const cycleStartRef = useRef(0)
  const roundRef = useRef(0)
  const scoresRef = useRef<number[]>([])
  const tappedRef = useRef(false)

  const finishGame = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const avg = scoresRef.current.length > 0
      ? scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length
      : 0
    const finalScore = Math.round(avg)
    setTotalScore(finalScore)
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(finalScore), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (isPracticeRef.current && roundNum >= 1) { finishGame(); return }
    if (roundNum >= ROUNDS) { finishGame(); return }

    roundRef.current = roundNum
    tappedRef.current = false
    setRound(roundNum)
    setGrade(null)
    setCircleSize(0)
    setPhase('playing')

    cycleStartRef.current = performance.now()
    const animate = (now: number) => {
      const elapsed = (now - cycleStartRef.current) % CYCLE
      const t = elapsed / CYCLE
      const s = Math.sin(t * Math.PI) // 0 → 1 → 0
      setCircleSize(s)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
  }, [finishGame])

  function handleTap() {
    if (phase !== 'playing' || tappedRef.current) return
    tappedRef.current = true
    if (animRef.current) cancelAnimationFrame(animRef.current)

    const now = performance.now()
    const elapsed = (now - cycleStartRef.current) % CYCLE
    const t = elapsed / CYCLE
    const s = Math.sin(t * Math.PI)
    const errorRatio = Math.abs(1 - s)
    const errorMs = Math.round(errorRatio * (CYCLE / 2))
    const roundScore = Math.round((1 - errorRatio) * 100)
    scoresRef.current.push(roundScore)

    const g = getGrade(errorMs)
    setGrade(g)
    setCircleSize(s)
    setPhase('feedback')
    setTimeout(() => startRound(roundRef.current + 1), 1000)
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

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🎯</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>박자 맞추기</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            원이 커졌다 작아져요<br />
            <strong style={{ color: '#f0f0f0' }}>가장 클 때</strong> 탭하세요!
          </p>
        </div>
        <div className="glass p-4 w-full flex flex-col gap-2" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <div>🟢 PERFECT &lt; 50ms · GREAT &lt; 130ms · GOOD &lt; 280ms</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROUNDS}라운드</div>
        <button className="btn-secondary" onClick={() => { isPracticeRef.current = true; startCountdown() }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startCountdown() }}>시작하기</button>
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
        }}>{countdown}</div>
        <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {totalScore}<span style={{ fontSize: 32 }}>점</span>
        </div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── playing / feedback ──
  const MIN_SIZE = 50
  const MAX_SIZE = 190
  const TARGET_SIZE = MAX_SIZE
  const currentSize = MIN_SIZE + circleSize * (MAX_SIZE - MIN_SIZE)
  const glowColor = grade?.color ?? 'rgba(245,158,11,0.5)'

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span>{scoresRef.current.length > 0 ? `평균 ${Math.round(scoresRef.current.reduce((a,b)=>a+b,0)/scoresRef.current.length)}점` : ''}</span>
      </div>

      {/* 탭 영역 */}
      <button
        onPointerDown={handleTap}
        disabled={phase === 'feedback'}
        style={{
          position: 'relative', width: '100%', height: 360,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 24, cursor: phase === 'playing' ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent', overflow: 'hidden',
        }}
      >
        {/* 목표 링 */}
        <div style={{
          position: 'absolute',
          width: TARGET_SIZE, height: TARGET_SIZE, borderRadius: '50%',
          border: '3px dashed var(--border)', opacity: 0.6,
          pointerEvents: 'none',
        }} />

        {/* 커지는 원 */}
        <div style={{
          width: currentSize, height: currentSize, borderRadius: '50%',
          background: phase === 'feedback'
            ? grade?.color
            : `radial-gradient(circle, var(--amber) 30%, #f97316)`,
          boxShadow: `0 0 ${circleSize * 50}px ${phase === 'feedback' ? glowColor : 'rgba(245,158,11,0.4)'}`,
          transition: phase === 'feedback' ? 'background 0.2s ease' : 'none',
          pointerEvents: 'none',
        }} />

        {/* 등급 텍스트 */}
        {phase === 'feedback' && grade && (
          <div style={{
            position: 'absolute',
            fontSize: 30, fontWeight: 900, letterSpacing: '0.05em',
            color: grade.color,
            textShadow: `0 0 20px ${grade.color}80`,
            animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            pointerEvents: 'none',
          }}>
            {grade.label}
          </div>
        )}
      </button>

      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        {phase === 'playing' ? '원이 가장 클 때 탭!' : ''}
      </div>
    </div>
  )
}

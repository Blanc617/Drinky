'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const DURATION = 7000

export default function BalanceTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'measuring' | 'result'>('intro')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(10)
  const [score, setScore] = useState(0)
  const variancesRef = useRef<number[]>([])
  const startTimeRef = useRef(0)

  function handleMotion(event: DeviceMotionEvent) {
    const acc = event.accelerationIncludingGravity
    if (!acc) return
    const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)
    variancesRef.current.push(magnitude)
  }

  function startMeasuring() {
    variancesRef.current = []
    startTimeRef.current = Date.now()
    window.addEventListener('devicemotion', handleMotion)
    setPhase('measuring')
  }

  useEffect(() => {
    if (phase !== 'measuring') return
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = parseFloat(Math.max(0, (DURATION - elapsed) / 1000).toFixed(1))
      setTimeLeft(remaining)
      if (elapsed >= DURATION) {
        clearInterval(timer)
        window.removeEventListener('devicemotion', handleMotion)
        const data = variancesRef.current
        if (data.length === 0) { onComplete(50); return }
        const mean = data.reduce((a, b) => a + b, 0) / data.length
        const variance = data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length
        const raw = Math.max(0, 100 - variance * 2)
        const finalScore = Math.min(100, Math.round(raw))
        setScore(finalScore)
        setPhase('result')
        setTimeout(() => onComplete(finalScore), 1500)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [phase])

  async function requestPermissionAndStart() {
    const DeviceMotionEventWithPermission = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<string>
    }
    if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
      const permission = await DeviceMotionEventWithPermission.requestPermission()
      if (permission !== 'granted') { alert('기기 움직임 권한이 필요합니다.'); return }
    }
    startCountdown()
  }

  function startCountdown() {
    setPhase('countdown')
    setCountdown(3)
    let count = 3
    const timer = setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) { clearInterval(timer); startMeasuring() }
    }, 1000)
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 48, color: 'var(--amber)', letterSpacing: '0.05em' }}>
            균형 테스트
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
            폰을 손에 들고<br />
            <strong style={{ color: 'var(--text)' }}>한 발로 7초</strong> 서있으세요
          </p>
        </div>
        <div className="glass p-4 w-full flex items-center gap-3">
          <div style={{ fontSize: 32 }}>🦶</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            흔들림이 적을수록 높은 점수.<br />최대한 가만히!
          </div>
        </div>
        <button className="btn-primary" onClick={requestPermissionAndStart}>시작하기</button>
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>한 발로 준비하세요</div>
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

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          균형 테스트 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {score}<span style={{ fontSize: 32 }}>점</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // measuring
  const circumference = 2 * Math.PI * 45

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>가만히 서있으세요</div>
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <svg width="180" height="180" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface2)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="var(--amber)" strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (timeLeft / 7)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear', filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.6))' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bebas Neue'", fontSize: 56, color: 'var(--text)',
        }}>
          {timeLeft}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>움직이지 마세요</div>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props { onComplete: (score: number) => void }

const ROUNDS = 6
const MIN_DELAY = 1500
const MAX_DELAY = 4500
const FAKE_CHANCE = 0.35
const FAKE_DURATION = 850
const SIGNAL_TIMEOUT = 2000

type RoundResult = 'success' | 'early' | 'false_alarm' | 'timeout'
type Phase = 'intro' | 'countdown' | 'waiting' | 'fake' | 'signal' | 'feedback' | 'result'

export default function TimingChallenge({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(3)
  const [round, setRound] = useState(0)
  const [lastResult, setLastResult] = useState<RoundResult | null>(null)
  const [successCount, setSuccessCount] = useState(0)
  const [lastRT, setLastRT] = useState<number | null>(null)

  const phaseRef = useRef<Phase>('intro')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signalTimeRef = useRef(0)
  const successRef = useRef(0)
  const rtListRef = useRef<number[]>([])
  const roundRef = useRef(0)

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  function setPhaseSync(p: Phase) {
    phaseRef.current = p
    setPhase(p)
  }

  const finishGame = useCallback(() => {
    clearTimer()
    const acc = (successRef.current / ROUNDS) * 100
    const avgRT = rtListRef.current.length > 0
      ? rtListRef.current.reduce((a, b) => a + b, 0) / rtListRef.current.length
      : SIGNAL_TIMEOUT
    const speedBonus = Math.max(0, ((SIGNAL_TIMEOUT - avgRT) / SIGNAL_TIMEOUT) * 30)
    const score = Math.min(100, Math.round(acc * 0.7 + speedBonus))
    setPhaseSync('result')
    setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (roundNum >= ROUNDS) { finishGame(); return }
    clearTimer()
    roundRef.current = roundNum
    setRound(roundNum)
    setLastResult(null)
    setLastRT(null)
    setPhaseSync('waiting')

    function scheduleSignal() {
      const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)
      timerRef.current = setTimeout(() => {
        if (Math.random() < FAKE_CHANCE) {
          // fake signal
          setPhaseSync('fake')
          timerRef.current = setTimeout(() => {
            if (phaseRef.current === 'fake') {
              setPhaseSync('waiting')
              scheduleSignal()
            }
          }, FAKE_DURATION)
        } else {
          // real signal
          signalTimeRef.current = Date.now()
          setPhaseSync('signal')
          timerRef.current = setTimeout(() => {
            if (phaseRef.current === 'signal') endRound('timeout')
          }, SIGNAL_TIMEOUT)
        }
      }, delay)
    }

    function endRound(result: RoundResult, rt?: number) {
      clearTimer()
      if (result === 'success' && rt !== undefined) {
        successRef.current++
        setSuccessCount(s => s + 1)
        rtListRef.current.push(rt)
        setLastRT(rt)
      }
      setLastResult(result)
      setPhaseSync('feedback')
      timerRef.current = setTimeout(() => startRound(roundRef.current + 1), 1000)
    }

    // expose endRound for tap handler
    tapRef.current = () => {
      const p = phaseRef.current
      if (p === 'waiting') endRound('early')
      else if (p === 'fake') endRound('false_alarm')
      else if (p === 'signal') endRound('success', Date.now() - signalTimeRef.current)
    }

    scheduleSignal()
  }, [finishGame])

  const tapRef = useRef<() => void>(() => {})

  function handleTap() {
    if (phaseRef.current === 'waiting' || phaseRef.current === 'fake' || phaseRef.current === 'signal') {
      tapRef.current()
    }
  }

  function startCountdown() {
    setPhase('countdown')
    setCountdown(3)
    successRef.current = 0
    rtListRef.current = []
    setSuccessCount(0)
    let c = 3
    const t = setInterval(() => {
      c--
      setCountdown(c)
      if (c === 0) { clearInterval(t); startRound(0) }
    }, 1000)
  }

  useEffect(() => () => clearTimer(), [])

  // ── intro ──
  if (phase === 'intro') return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      <div>
        <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>⚡</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em', background: 'linear-gradient(135deg, var(--amber), #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          타이밍 챌린지
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text)' }}>지금!</strong> 이 나타나는 순간 탭하세요.<br />
          빠를수록 고득점!
        </p>
      </div>
      <div className="glass p-4 w-full flex flex-col gap-3">
        {[
          { icon: '✅', text: '지금! → 최대한 빨리 탭' },
          { icon: '🚫', text: '잠깐! → 탭하면 실패' },
          { icon: '⚠️', text: '신호 전 탭 → 실패' },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ color: 'var(--text-muted)' }}>{text}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROUNDS}라운드</div>
      <button className="btn-primary" onClick={startCountdown}>시작하기</button>
    </div>
  )

  // ── countdown ──
  if (phase === 'countdown') return (
    <div className="flex flex-col items-center gap-4 text-center">
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>준비하세요</div>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 120, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 40px rgba(245,158,11,0.6)', animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {countdown}
      </div>
    </div>
  )

  // ── result ──
  if (phase === 'result') {
    const avgRT = rtListRef.current.length > 0
      ? Math.round(rtListRef.current.reduce((a, b) => a + b, 0) / rtListRef.current.length)
      : null
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {successRef.current}<span style={{ fontSize: 32 }}>/{ROUNDS}</span>
        </div>
        {avgRT && <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>평균 반응속도 {avgRT}ms</div>}
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // ── playing phases ──
  const isWaiting = phase === 'waiting'
  const isFake = phase === 'fake'
  const isSignal = phase === 'signal'
  const isFeedback = phase === 'feedback'

  const signalColor = isSignal ? '#4ade80' : isFake ? '#ef4444' : 'var(--amber)'
  const signalText = isSignal ? '지금!' : isFake ? '잠깐!' : '준비...'
  const feedbackColor = lastResult === 'success' ? '#4ade80' : '#ef4444'

  return (
    <div
      onClick={handleTap}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <style>{`
        @keyframes popIn    { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes pulse    { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.5; transform: scale(0.96) } }
        @keyframes explode  { from { transform: scale(0.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes shake    { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span style={{ color: successCount > 0 ? '#4ade80' : 'var(--text-dim)' }}>{successCount} 성공</span>
      </div>

      {/* 메인 신호 */}
      <div style={{
        width: '100%', aspectRatio: '1', maxWidth: 260,
        borderRadius: 32,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        border: isFeedback
          ? `2px solid ${feedbackColor}`
          : isSignal ? '2px solid #4ade80'
          : isFake ? '2px solid #ef4444'
          : '1px solid var(--border)',
        background: isFeedback
          ? `${feedbackColor}15`
          : isSignal ? 'rgba(74,222,128,0.1)'
          : isFake ? 'rgba(239,68,68,0.1)'
          : 'var(--surface)',
        boxShadow: isSignal ? '0 0 40px rgba(74,222,128,0.35)'
          : isFake ? '0 0 40px rgba(239,68,68,0.35)'
          : 'none',
        animation: isSignal ? 'explode 0.2s cubic-bezier(0.34,1.56,0.64,1)'
          : isFake ? 'popIn 0.15s ease'
          : isWaiting ? 'pulse 1.8s ease infinite'
          : 'none',
        transition: 'background 0.15s, border 0.15s',
      }}>
        {isFeedback ? (
          <>
            <span style={{ fontSize: 52 }}>
              {lastResult === 'success' ? '⚡' : lastResult === 'early' ? '🙈' : lastResult === 'false_alarm' ? '🤦' : '🐌'}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: feedbackColor }}>
              {lastResult === 'success' ? `${lastRT}ms` : lastResult === 'early' ? '너무 빨라!' : lastResult === 'false_alarm' ? '낚였다!' : '너무 늦어!'}
            </span>
          </>
        ) : (
          <span style={{
            fontFamily: "'Bebas Neue'", fontSize: 72, lineHeight: 1,
            color: isSignal ? '#4ade80' : isFake ? '#ef4444' : 'var(--text-dim)',
            textShadow: isSignal ? '0 0 30px rgba(74,222,128,0.8)' : isFake ? '0 0 30px rgba(239,68,68,0.8)' : 'none',
            letterSpacing: '0.03em',
          }}>
            {signalText}
          </span>
        )}
      </div>

      {!isFeedback && (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.6 }}>
          {isSignal ? '지금 탭하세요!' : isFake ? '탭하지 마세요!' : '화면을 주시하세요...'}
        </p>
      )}
    </div>
  )
}

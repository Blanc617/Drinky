'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { shuffle } from '@/lib/utils'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 5
const ROUND_MS = 3500
const BOT_EMOJIS = ['🐱', '🐶', '🐰']

type SlotStatus = 'free' | 'glowing' | 'claimed' | 'player' | 'collision'
interface Slot { status: SlotStatus; botIdx?: number }

type Phase = 'intro' | 'countdown' | 'playing' | 'feedback' | 'result'
type RoundResult = 'success' | 'collision' | 'fail'


export default function NunchiGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(3)
  const [round, setRound] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [slots, setSlots] = useState<Slot[]>([
    { status: 'free' },
    { status: 'free' },
    { status: 'free' },
    { status: 'free' },
  ])
  const [lastResult, setLastResult] = useState<RoundResult | null>(null)
  const [timeLeft, setTimeLeft] = useState(ROUND_MS / 1000)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const botTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const successRef = useRef(0)
  const roundRef = useRef(0)
  const tapHandlerRef = useRef<(i: number) => void>(() => {})
  const slotsRef = useRef<Slot[]>([
    { status: 'free' },
    { status: 'free' },
    { status: 'free' },
    { status: 'free' },
  ])

  function clearAll() {
    if (timerRef.current) clearInterval(timerRef.current)
    botTimers.current.forEach(clearTimeout)
    botTimers.current = []
    tapHandlerRef.current = () => {}
  }

  const finishGame = useCallback(() => {
    clearAll()
    const score = Math.round((successRef.current / ROUNDS) * 100)
    setPhase('result')
    setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (roundNum >= ROUNDS) { finishGame(); return }
    roundRef.current = roundNum
    setRound(roundNum)
    setLastResult(null)

    const order = shuffle([0, 1, 2, 3])
    // 봇 3개가 앞 3 슬롯(order[0..2]) 담당, 플레이어는 order[3]
    const freeIdx = order[3]

    const initSlots: Slot[] = [
      { status: 'free' },
      { status: 'free' },
      { status: 'free' },
      { status: 'free' },
    ]
    slotsRef.current = initSlots
    setSlots([...initSlots])
    setTimeLeft(ROUND_MS / 1000)
    setPhase('playing')

    let over = false

    function endRound(result: RoundResult) {
      if (over) return
      over = true
      clearAll()
      setLastResult(result)
      if (result === 'success') {
        successRef.current++
        setSuccessCount(s => s + 1)
      }
      setPhase('feedback')
      setTimeout(() => startRound(roundNum + 1), 1200)
    }

    tapHandlerRef.current = (i: number) => {
      const s = slotsRef.current[i]
      if (s.status === 'free' || s.status === 'glowing') {
        if (s.status === 'glowing') {
          endRound('collision')
        } else {
          // free slot
          if (i === freeIdx) {
            const updated = slotsRef.current.map((sl, idx) =>
              idx === i ? { ...sl, status: 'player' as SlotStatus } : sl
            )
            slotsRef.current = updated
            setSlots([...updated])
            endRound('success')
          } else {
            const updated = slotsRef.current.map((sl, idx) =>
              idx === i ? { ...sl, status: 'collision' as SlotStatus } : sl
            )
            slotsRef.current = updated
            setSlots([...updated])
            endRound('collision')
          }
        }
      }
    }

    // 봇 타이머
    for (let b = 0; b < 3; b++) {
      const slotIdx = order[b]
      const botIdx = b
      const delay = 500 + Math.random() * 1800

      const glowTimer = setTimeout(() => {
        if (over) return
        const updated = slotsRef.current.map((sl, idx) =>
          idx === slotIdx ? { ...sl, status: 'glowing' as SlotStatus, botIdx } : sl
        )
        slotsRef.current = updated
        setSlots([...updated])

        const claimTimer = setTimeout(() => {
          if (over) return
          const updated2 = slotsRef.current.map((sl, idx) =>
            idx === slotIdx ? { ...sl, status: 'claimed' as SlotStatus, botIdx } : sl
          )
          slotsRef.current = updated2
          setSlots([...updated2])
        }, 450)
        botTimers.current.push(claimTimer)
      }, delay)
      botTimers.current.push(glowTimer)
    }

    // 라운드 타이머
    if (timerRef.current) clearInterval(timerRef.current)
    let t = ROUND_MS / 1000
    timerRef.current = setInterval(() => {
      t -= 0.05
      setTimeLeft(Math.max(0, t))
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        endRound('fail')
      }
    }, 50)
  }, [finishGame])

  function handleSlotTap(i: number) {
    if (phase !== 'playing') return
    tapHandlerRef.current(i)
  }

  function startCountdown() {
    setPhase('countdown')
    setCountdown(3)
    successRef.current = 0
    setSuccessCount(0)
    let count = 3
    const timer = setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) { clearInterval(timer); startRound(0) }
    }, 1000)
  }

  useEffect(() => () => { clearAll() }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>👀</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            눈치게임
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            봇들이 번호를 차지하기 전에<br />
            <strong style={{ color: '#f0f0f0' }}>남은 1개</strong>를 빠르게 탭하세요!
          </p>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {[
            { icon: '🟠', desc: '번쩍이는 슬롯 → 충돌 주의' },
            { icon: '⬛', desc: '어두운 슬롯 → 이미 가져감' },
            { icon: '🟢', desc: '빈 슬롯 → 탭하세요' },
          ].map((ex) => (
            <div key={ex.icon} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ fontSize: 20 }}>{ex.icon}</span>
              <span style={{ color: 'var(--text-muted)' }}>{ex.desc}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROUNDS}라운드</div>
        <button className="btn-primary" onClick={startCountdown}>시작하기</button>
      </div>
    )
  }

  // ── countdown ──
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>준비하세요</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 120, color: 'var(--amber)', lineHeight: 1,
          textShadow: '0 0 40px rgba(245,158,11,0.6)',
          animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {countdown}
        </div>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const accuracy = Math.round((successRef.current / ROUNDS) * 100)
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          테스트 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {successRef.current}<span style={{ fontSize: 32 }}>/{ROUNDS}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>성공률 {accuracy}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // ── playing / feedback ──
  const circumference = 2 * Math.PI * 42
  const feedbackColor =
    lastResult === 'success' ? '#4ade80' :
    lastResult === 'collision' ? '#ef4444' :
    lastResult === 'fail' ? '#f97316' : 'var(--amber)'

  function getSlotStyle(s: Slot): React.CSSProperties {
    const base: React.CSSProperties = {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, borderRadius: 16, cursor: phase === 'playing' ? 'pointer' : 'default',
      aspectRatio: '1', transition: 'all 0.15s ease',
      background: 'var(--surface)',
    }
    switch (s.status) {
      case 'free':
        return { ...base, border: '1px solid var(--border)' }
      case 'glowing':
        return { ...base, border: '2px solid var(--amber)', background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 16px rgba(245,158,11,0.5)' }
      case 'claimed':
        return { ...base, border: '1px solid var(--border)', opacity: 0.45 }
      case 'player':
        return { ...base, border: '2px solid #4ade80', background: 'rgba(74,222,128,0.1)', boxShadow: '0 0 16px rgba(74,222,128,0.4)' }
      case 'collision':
        return { ...base, border: '2px solid #ef4444', background: 'rgba(239,68,68,0.1)', boxShadow: '0 0 16px rgba(239,68,68,0.4)' }
      default:
        return { ...base, border: '1px solid var(--border)' }
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 10px rgba(245,158,11,0.4) } 50% { box-shadow: 0 0 28px rgba(245,158,11,0.9) } }
      `}</style>

      {/* 라운드 / 성공 카운터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span style={{ color: successCount > 0 ? '#4ade80' : 'var(--text-dim)' }}>{successCount} 성공</span>
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
            strokeDashoffset={circumference * (1 - timeLeft / (ROUND_MS / 1000))}
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

      {/* 피드백 텍스트 */}
      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && (
          <span style={{ fontSize: 15, fontWeight: 700, color: feedbackColor }}>
            {lastResult === 'success' ? '✓ 눈치 챙겼다!' : lastResult === 'collision' ? '💥 충돌!' : '⏱ 눈치 없음'}
          </span>
        )}
        {phase === 'playing' && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>남은 번호를 탭하세요</span>
        )}
      </div>

      {/* 2x2 슬롯 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
        {slots.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSlotTap(i)}
            disabled={phase === 'feedback'}
            style={getSlotStyle(s)}
          >
            {s.status === 'free' && (
              <>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 52, color: 'var(--amber)', lineHeight: 1 }}>{i + 1}</span>
              </>
            )}
            {s.status === 'glowing' && (
              <>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 52, color: 'var(--amber)', lineHeight: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 22 }}>{BOT_EMOJIS[s.botIdx ?? 0]}</span>
              </>
            )}
            {s.status === 'claimed' && (
              <>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 52, color: 'var(--text-dim)', lineHeight: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 22 }}>{BOT_EMOJIS[s.botIdx ?? 0]}</span>
              </>
            )}
            {s.status === 'player' && (
              <>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 52, color: '#4ade80', lineHeight: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 22 }}>🙋</span>
              </>
            )}
            {s.status === 'collision' && (
              <>
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: 52, color: '#ef4444', lineHeight: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 22 }}>💥</span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
  autoStart?: boolean
  rounds?: number
}

const NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1)
const TIME_LIMIT = 1

function isClap(n: number): boolean {
  return String(n).split('').some(d => ['3', '6', '9'].includes(d))
}

type Phase = 'intro' | 'countdown' | 'playing' | 'feedback' | 'result'
type RoundResult = 'correct' | 'wrong' | 'timeout'

export default function ThreeSixNineGame({ onComplete, autoStart, rounds }: Props) {
  const playNumbers = NUMBERS.slice(0, rounds ?? NUMBERS.length)
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(3)
  const [roundIdx, setRoundIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [lastResult, setLastResult] = useState<RoundResult | null>(null)
  const [tappedClap, setTappedClap] = useState<boolean | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const correctRef = useRef(0)
  const timesRef = useRef<number[]>([])
  const roundStartRef = useRef(0)
  const roundIdxRef = useRef(0)

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const accuracy = (correctRef.current / playNumbers.length) * 100
    const avgTime = timesRef.current.length > 0
      ? timesRef.current.reduce((a, b) => a + b, 0) / timesRef.current.length
      : TIME_LIMIT * 1000
    const speedBonus = Math.max(0, ((TIME_LIMIT * 1000 - avgTime) / (TIME_LIMIT * 1000)) * 30)
    const score = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    setPhase('result')
    setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((idx: number) => {
    if (idx >= playNumbers.length) { finishGame(); return }
    roundIdxRef.current = idx
    setRoundIdx(idx)
    setTappedClap(null)
    setLastResult(null)
    setTimeLeft(TIME_LIMIT)
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
        setTimeout(() => startRound(roundIdxRef.current + 1), 900)
      }
    }, 50)
  }, [finishGame])

  function handleTap(didClap: boolean) {
    if (phase !== 'playing') return
    if (timerRef.current) clearInterval(timerRef.current)

    const currentNum = NUMBERS[roundIdxRef.current]
    const elapsed = Date.now() - roundStartRef.current
    const correct = isClap(currentNum) === didClap

    setTappedClap(didClap)
    if (correct) {
      correctRef.current += 1
      setCorrectCount(c => c + 1)
      timesRef.current.push(elapsed)
      setLastResult('correct')
    } else {
      setLastResult('wrong')
    }
    setPhase('feedback')
    setTimeout(() => startRound(roundIdxRef.current + 1), 900)
  }

  function startCountdown() {
    setPhase('countdown')
    setCountdown(3)
    correctRef.current = 0
    timesRef.current = []
    setCorrectCount(0)
    let count = 3
    const timer = setInterval(() => {
      count--
      setCountdown(count)
      if (count === 0) { clearInterval(timer); startRound(0) }
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])
  useEffect(() => { if (autoStart) startCountdown() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 44, marginBottom: 4, lineHeight: 1 }}>3️⃣6️⃣9️⃣</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            369 게임
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            3·6·9가 들어간 숫자면 👏박수,<br />
            아니면 🔢숫자 버튼을 탭하세요!
          </p>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {[
            { nums: '1, 2, 4, 5 …', result: '🔢 숫자 버튼' },
            { nums: '3, 6, 9 …', result: '👏 박수' },
            { nums: '13, 16 …', result: '👏 박수' },
          ].map((ex) => (
            <div key={ex.nums} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{ex.nums}</span>
              <span style={{ color: 'var(--text)' }}>→ {ex.result}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>제한시간 {TIME_LIMIT}초 · {playNumbers.length}라운드</div>
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
    const accuracy = Math.round((correctRef.current / NUMBERS.length) * 100)
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          테스트 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {correctRef.current}<span style={{ fontSize: 32 }}>/{playNumbers.length}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>정답률 {accuracy}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // ── playing / feedback ──
  const circumference = 2 * Math.PI * 42
  const currentNum = playNumbers[roundIdx]
  const shouldClap = isClap(currentNum)
  const feedbackColor = lastResult === 'correct' ? '#4ade80' : '#ef4444'

  // 버튼 피드백 스타일 결정
  function getNumberBtnStyle(): React.CSSProperties {
    const base: React.CSSProperties = {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '18px 8px', borderRadius: 16, cursor: phase === 'playing' ? 'pointer' : 'default',
      background: 'var(--surface)', transition: 'all 0.15s ease', flex: 1,
    }
    if (phase === 'feedback') {
      if (!shouldClap) {
        // 정답이 숫자 버튼
        return { ...base, border: '2px solid #4ade80', background: 'rgba(74,222,128,0.12)', boxShadow: '0 0 16px rgba(74,222,128,0.3)' }
      }
      if (tappedClap === false && lastResult === 'wrong') {
        // 오답으로 숫자 버튼 탭
        return { ...base, border: '2px solid #ef4444', background: 'rgba(239,68,68,0.12)', boxShadow: '0 0 16px rgba(239,68,68,0.3)' }
      }
    }
    return { ...base, border: '1px solid var(--border)' }
  }

  function getClapBtnStyle(): React.CSSProperties {
    const base: React.CSSProperties = {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '18px 8px', borderRadius: 16, cursor: phase === 'playing' ? 'pointer' : 'default',
      background: 'var(--surface)', transition: 'all 0.15s ease', flex: 1,
    }
    if (phase === 'feedback') {
      if (shouldClap) {
        // 정답이 박수 버튼
        return { ...base, border: '2px solid #4ade80', background: 'rgba(74,222,128,0.12)', boxShadow: '0 0 16px rgba(74,222,128,0.3)' }
      }
      if (tappedClap === true && lastResult === 'wrong') {
        // 오답으로 박수 버튼 탭
        return { ...base, border: '2px solid #ef4444', background: 'rgba(239,68,68,0.12)', boxShadow: '0 0 16px rgba(239,68,68,0.3)' }
      }
    }
    return { ...base, border: '1px solid var(--border)' }
  }

  function getNumberBtnTextColor(): string {
    if (phase === 'feedback') {
      if (!shouldClap) return '#4ade80'
      if (tappedClap === false && lastResult === 'wrong') return '#ef4444'
    }
    return 'var(--text-muted)'
  }

  function getClapBtnTextColor(): string {
    if (phase === 'feedback') {
      if (shouldClap) return '#4ade80'
      if (tappedClap === true && lastResult === 'wrong') return '#ef4444'
    }
    return 'var(--text-muted)'
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>

      {/* 라운드 / 정답 카운터 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{roundIdx + 1} / {playNumbers.length}</span>
        <span style={{ color: correctCount > 0 ? '#4ade80' : 'var(--text-dim)' }}>{correctCount} 정답</span>
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

      {/* 현재 숫자 */}
      <div style={{
        fontFamily: "'Bebas Neue'", fontSize: 110, color: 'var(--amber)', lineHeight: 1, textAlign: 'center',
        textShadow: '0 0 30px rgba(245,158,11,0.5)',
        animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {currentNum}
      </div>

      {/* 피드백 텍스트 */}
      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && lastResult !== null && (
          <span style={{ fontSize: 15, fontWeight: 700, color: feedbackColor }}>
            {lastResult === 'correct'
              ? `✓ 정답! (${shouldClap ? '👏 박수' : '🔢 숫자'})`
              : lastResult === 'timeout'
                ? '⏱ 시간 초과'
                : `✗ 오답 (정답: ${shouldClap ? '👏 박수' : '🔢 숫자'})`
            }
          </span>
        )}
        {phase === 'playing' && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>숫자인가요, 박수인가요?</span>
        )}
      </div>

      {/* 선택 버튼 */}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onClick={() => handleTap(false)}
          disabled={phase === 'feedback'}
          style={getNumberBtnStyle()}
        >
          <span style={{ fontSize: 32 }}>🔢</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: getNumberBtnTextColor() }}>숫자</span>
        </button>
        <button
          onClick={() => handleTap(true)}
          disabled={phase === 'feedback'}
          style={getClapBtnStyle()}
        >
          <span style={{ fontSize: 32 }}>👏</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: getClapBtnTextColor() }}>박수</span>
        </button>
      </div>
    </div>
  )
}

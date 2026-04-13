'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Q, QUESTION_POOL } from './choSeongQuestions'

interface Props {
  onComplete: (score: number) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const ROUND_COUNT = 4
const TIME_LIMIT = 7

type Phase = 'intro' | 'countdown' | 'playing' | 'feedback' | 'result'
type RoundResult = 'answered' | 'timeout'

export default function ChoSeongGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(3)
  const [roundIdx, setRoundIdx] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [lastResult, setLastResult] = useState<RoundResult | null>(null)
  const [input, setInput] = useState('')
  const [submittedWord, setSubmittedWord] = useState('')

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const answeredRef   = useRef(0)
  const timesRef      = useRef<number[]>([])
  const roundStartRef = useRef(0)
  const roundIdxRef   = useRef(0)
  const questionsRef  = useRef<Q[]>([])

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const ratio = answeredRef.current / ROUND_COUNT
    const avgTime = timesRef.current.length > 0
      ? timesRef.current.reduce((a, b) => a + b, 0) / timesRef.current.length
      : TIME_LIMIT * 1000
    const speedBonus = Math.max(0, ((TIME_LIMIT * 1000 - avgTime) / (TIME_LIMIT * 1000)) * 30)
    const score = Math.min(100, Math.round(ratio * 70 + speedBonus))
    setPhase('result')
    setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((idx: number) => {
    if (idx >= ROUND_COUNT) { finishGame(); return }
    roundIdxRef.current = idx
    setRoundIdx(idx)
    setInput('')
    setSubmittedWord('')
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
        setTimeout(() => startRound(roundIdxRef.current + 1), 1000)
      }
    }, 50)
  }, [finishGame])

  function handleSubmit() {
    if (phase !== 'playing') return
    if (timerRef.current) clearInterval(timerRef.current)

    const word = input.trim()
    const elapsed = Date.now() - roundStartRef.current

    if (word.length > 0) {
      answeredRef.current += 1
      setAnsweredCount(c => c + 1)
      timesRef.current.push(elapsed)
      setLastResult('answered')
    } else {
      setLastResult('timeout')
    }
    setSubmittedWord(word)
    setPhase('feedback')
    setTimeout(() => startRound(roundIdxRef.current + 1), 1000)
  }

  function startCountdown() {
    questionsRef.current = shuffle(QUESTION_POOL).slice(0, ROUND_COUNT)
    setPhase('countdown')
    setCountdown(3)
    answeredRef.current = 0
    timesRef.current = []
    setAnsweredCount(0)
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
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🔤</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>초성게임</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            초성을 보고 해당하는 단어를<br />
            <strong style={{ color: '#f0f0f0' }}>직접 타이핑</strong>하세요!
          </p>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {[
            { pat: 'ㄴ ㅈ ㄱ', ex: '냉장고, 낙지국 …' },
            { pat: 'ㅅ ㄹ',    ex: '사랑, 소리, 서류 …' },
          ].map(({ pat, ex }) => (
            <div key={pat} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: 'var(--amber)', letterSpacing: '0.2em', width: 72, flexShrink: 0 }}>{pat}</span>
              <span style={{ color: 'var(--text-muted)', textAlign: 'left' }}>{ex}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>초성에 맞는 단어를 빠르게 입력!</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>제한시간 {TIME_LIMIT}초 · {ROUND_COUNT}문제 (매번 랜덤)</div>
        <button className="btn-primary" onClick={startCountdown}>시작하기</button>
      </div>
    )
  }

  // ── countdown ──
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <style>{`@keyframes popIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>준비하세요</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 120, color: 'var(--amber)', lineHeight: 1,
          textShadow: '0 0 40px rgba(245,158,11,0.6)',
          animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>{countdown}</div>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {answeredRef.current}<span style={{ fontSize: 32 }}>/{ROUND_COUNT}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>답변 완료 {Math.round((answeredRef.current / ROUND_COUNT) * 100)}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // ── playing / feedback ──
  const currentQ = questionsRef.current[roundIdx] ?? QUESTION_POOL[0]
  const isAnswered = lastResult === 'answered'
  const feedbackColor = isAnswered ? '#4ade80' : '#ef4444'
  const circumference = 2 * Math.PI * 28

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <style>{`@keyframes popIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

      {/* 상단: 라운드 | 타이머 | 답변 수 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{roundIdx + 1} / {ROUND_COUNT}</span>

        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <svg width="52" height="52" viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="30" cy="30" r="28" fill="none" stroke="var(--surface2)" strokeWidth="4"/>
            <circle
              cx="30" cy="30" r="28" fill="none"
              stroke={phase === 'feedback' ? feedbackColor : 'var(--amber)'}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - timeLeft / TIME_LIMIT)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.05s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
          }}>
            {timeLeft.toFixed(1)}
          </div>
        </div>

        <span style={{ fontSize: 13, color: answeredCount > 0 ? '#4ade80' : 'var(--text-dim)' }}>{answeredCount} 답변</span>
      </div>

      {/* 초성 */}
      <div style={{
        fontSize: Math.max(40, 56 - (currentQ.pattern.length - 2) * 8),
        fontWeight: 800, color: 'var(--amber)',
        letterSpacing: '0.3em', textAlign: 'center',
        textShadow: '0 0 20px rgba(245,158,11,0.4)',
        padding: '4px 0', whiteSpace: 'nowrap',
        animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {currentQ.display}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        {currentQ.pattern.length}글자 · 초성에 맞는 단어를 입력
      </div>

      {/* 피드백 */}
      <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && lastResult && (
          <span style={{ fontSize: 14, fontWeight: 700, color: feedbackColor }}>
            {lastResult === 'answered' ? `✓ 제출: "${submittedWord}"` : '⏱ 시간 초과'}
          </span>
        )}
      </div>

      {/* 입력창 */}
      {phase === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) handleSubmit() }}
            placeholder={`${currentQ.pattern.length}글자 단어 입력…`}
            autoFocus
            maxLength={12}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 14, color: 'var(--text)', fontSize: 16,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            onPointerDown={handleSubmit}
            disabled={!input.trim()}
            className="btn-primary"
            style={{ width: '100%', padding: '13px', borderRadius: 14, fontSize: 15 }}
          >
            확인
          </button>
        </div>
      )}

      {phase === 'feedback' && (
        <div style={{
          width: '100%', padding: '12px', borderRadius: 14,
          background: 'var(--surface2)', border: `1px solid ${feedbackColor}40`,
          fontSize: 16, color: feedbackColor, textAlign: 'center', fontWeight: 600,
        }}>
          {submittedWord || '(시간 초과)'}
        </div>
      )}
    </div>
  )
}

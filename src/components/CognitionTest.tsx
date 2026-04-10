'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const COLORS = [
  { id: 0, name: '빨강', bg: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
  { id: 1, name: '파랑', bg: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
  { id: 2, name: '초록', bg: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
  { id: 3, name: '노랑', bg: '#eab308', glow: 'rgba(234,179,8,0.5)' },
]

const START_LENGTH = 4
const MAX_ROUNDS = 3 // 최대 3라운드

type Phase = 'intro' | 'showing' | 'input' | 'feedback' | 'result'

export default function CognitionTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [activeColor, setActiveColor] = useState<number | null>(null)
  const [round, setRound] = useState(0)
  const [correctRounds, setCorrectRounds] = useState(0)
  const [lastOk, setLastOk] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function generateSequence(length: number): number[] {
    return Array.from({ length }, () => Math.floor(Math.random() * 4))
  }

  async function showSequence(seq: number[]) {
    setPhase('showing')
    setUserInput([])

    for (let i = 0; i < seq.length; i++) {
      await new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(() => {
          setActiveColor(seq[i])
          timeoutRef.current = setTimeout(() => {
            setActiveColor(null)
            resolve()
          }, 500)
        }, i === 0 ? 500 : 300)
      })
      await new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(resolve, 200)
      })
    }

    setPhase('input')
  }

  function startRound(roundNum: number) {
    const len = START_LENGTH + roundNum
    const seq = generateSequence(len)
    setSequence(seq)
    showSequence(seq)
  }

  function handleColorTap(colorId: number) {
    if (phase !== 'input') return

    setActiveColor(colorId)
    setTimeout(() => setActiveColor(null), 150)

    const newInput = [...userInput, colorId]
    setUserInput(newInput)

    // 현재 입력이 틀렸는지 확인
    if (newInput[newInput.length - 1] !== sequence[newInput.length - 1]) {
      // 틀림
      setLastOk(false)
      setPhase('feedback')
      const next = round + 1
      setTimeout(() => {
        if (next >= MAX_ROUNDS) {
          const score = Math.round((correctRounds / MAX_ROUNDS) * 100)
          setPhase('result')
          setTimeout(() => onComplete(score), 1200)
        } else {
          setRound(next)
          startRound(next)
        }
      }, 1000)
      return
    }

    // 전체 시퀀스 완료
    if (newInput.length === sequence.length) {
      const newCorrect = correctRounds + 1
      setCorrectRounds(newCorrect)
      setLastOk(true)
      setPhase('feedback')
      const next = round + 1
      setTimeout(() => {
        if (next >= MAX_ROUNDS) {
          const score = Math.round((newCorrect / MAX_ROUNDS) * 100)
          setPhase('result')
          setTimeout(() => onComplete(score), 1200)
        } else {
          setRound(next)
          startRound(next)
        }
      }, 1000)
    }
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🔴🔵🟢🟡</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            사이먼 게임
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            색깔이 순서대로 빛납니다<br />
            같은 순서로 탭하세요
          </p>
        </div>
        <div className="glass p-4 w-full flex flex-col gap-2">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            총 {MAX_ROUNDS}라운드 · 라운드마다 한 칸씩 늘어납니다
          </div>
        </div>
        <button className="btn-primary" onClick={() => startRound(0)}>시작하기</button>
      </div>
    )
  }

  if (phase === 'result') {
    const score = Math.round((correctRounds / MAX_ROUNDS) * 100)
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          사이먼 게임 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {score}<span style={{ fontSize: 32 }}>%</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {correctRounds} / {MAX_ROUNDS} 라운드 성공
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>다음 테스트로 이동 중...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* 라운드 / 상태 */}
      <div className="flex flex-col items-center gap-1">
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          라운드 {round + 1} / {MAX_ROUNDS}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {phase === 'showing' && '잘 보세요...'}
          {phase === 'input' && `${userInput.length} / ${sequence.length} 입력 중`}
          {phase === 'feedback' && (lastOk ? '✓ 정답!' : '✗ 틀렸습니다')}
        </div>
      </div>

      {/* 시퀀스 점 표시 */}
      <div className="flex gap-2">
        {sequence.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < userInput.length ? 'var(--amber)' : 'var(--surface2)',
            border: '1px solid var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* 2x2 색깔 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
        {COLORS.map((color) => {
          const isActive = activeColor === color.id
          const isDisabled = phase === 'showing' || phase === 'feedback'
          return (
            <button
              key={color.id}
              onClick={() => handleColorTap(color.id)}
              disabled={isDisabled}
              style={{
                height: 120, borderRadius: 20, border: 'none',
                cursor: isDisabled ? 'default' : 'pointer',
                background: color.bg,
                opacity: isActive ? 1 : isDisabled ? 0.35 : 0.55,
                boxShadow: isActive ? `0 0 30px ${color.glow}, 0 0 60px ${color.glow}` : 'none',
                transform: isActive ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 0.1s ease',
              }}
            />
          )
        })}
      </div>

      {/* 피드백 */}
      {phase === 'feedback' && (
        <div style={{
          fontSize: 18, fontWeight: 700,
          color: lastOk ? '#4ade80' : '#f87171',
          animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {lastOk ? '완벽해요! 🎉' : '아쉽네요 😅'}
        </div>
      )}

      <style>{`
        @keyframes popIn { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  )
}

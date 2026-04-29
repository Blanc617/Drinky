'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onComplete: (score: number) => void
}

const GAME_DURATION = 20   // seconds
const SPAWN_INTERVAL = 700 // ms
const TICK = 50            // ms per animation step

interface FallingItem {
  id: number
  x: number     // % from left (5~80)
  y: number     // % from top (-15 ~ 112)
  type: 'beer' | 'water'
  speed: number // % per tick
}

type Phase = 'intro' | 'playing' | 'result'

export default function FallingCatchTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [items, setItems] = useState<FallingItem[]>([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [hits, setHits] = useState(0)
  const [mistakes, setMistakes] = useState(0)

  const hitsRef = useRef(0)
  const mistakesRef = useRef(0)
  const missesRef = useRef(0)
  const nextIdRef = useRef(0)
  const doneRef = useRef(false)
  const isPracticeRef = useRef(false)

  const fallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAll = useCallback(() => {
    if (fallTimerRef.current) clearInterval(fallTimerRef.current)
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    if (gameTimerRef.current) clearInterval(gameTimerRef.current)
  }, [])

  const finishGame = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    clearAll()
    const total = hitsRef.current + missesRef.current
    const accuracy = total > 0 ? hitsRef.current / total : 0
    const mistakePenalty = Math.min(0.5, mistakesRef.current * 0.05)
    const score = Math.round(Math.max(0, accuracy - mistakePenalty) * 100)
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(score), 1500)
  }, [clearAll, onComplete])

  function startGame() {
    doneRef.current = false
    hitsRef.current = 0
    mistakesRef.current = 0
    missesRef.current = 0
    nextIdRef.current = 0
    setHits(0)
    setMistakes(0)
    setItems([])
    setTimeLeft(GAME_DURATION)
    setPhase('playing')

    const spawn = () => {
      const type: 'beer' | 'water' = Math.random() < 0.6 ? 'beer' : 'water'
      setItems(prev => [...prev, {
        id: nextIdRef.current++,
        x: 5 + Math.random() * 75,
        y: -15,
        type,
        speed: 3.5 + Math.random() * 2.5,
      }])
    }
    spawn()
    spawnTimerRef.current = setInterval(spawn, SPAWN_INTERVAL)

    fallTimerRef.current = setInterval(() => {
      setItems(prev =>
        prev
          .map(it => ({ ...it, y: it.y + it.speed }))
          .filter(it => {
            if (it.y > 112) {
              if (it.type === 'beer') missesRef.current++
              return false
            }
            return true
          })
      )
    }, TICK)

    let t = GAME_DURATION
    gameTimerRef.current = setInterval(() => {
      t--
      setTimeLeft(t)
      if (t <= 0) finishGame()
    }, 1000)
  }

  function handleTap(id: number, type: 'beer' | 'water') {
    setItems(prev => prev.filter(it => it.id !== id))
    if (type === 'beer') {
      hitsRef.current++
      setHits(h => h + 1)
    } else {
      mistakesRef.current++
      setMistakes(m => m + 1)
    }
  }

  useEffect(() => () => clearAll(), [clearAll])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🍺</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            술이 내린다
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            하늘에서 내려오는 것 중<br />
            <strong style={{ color: '#f0f0f0' }}>🍺 맥주만</strong> 탭하세요!<br />
            <span style={{ color: '#60a5fa' }}>💧 물</span>을 탭하면 감점
          </p>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {[
            { emoji: '🍺', label: '맥주', desc: '탭!', color: 'var(--amber)' },
            { emoji: '💧', label: '물',   desc: '무시!', color: '#60a5fa' },
          ].map(({ emoji, label, desc, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15 }}>
              <span style={{ fontSize: 28 }}>{emoji}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
              <span style={{ marginLeft: 'auto', color, fontWeight: 700 }}>{desc}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>제한시간 {GAME_DURATION}초</div>
        <button className="btn-secondary" style={{ marginBottom: 0 }} onClick={() => {
          isPracticeRef.current = true
          startGame()
        }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startGame() }}>시작하기</button>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const total = hitsRef.current + missesRef.current
    const accuracy = total > 0 ? Math.round(hitsRef.current / total * 100) : 0
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', justifyContent: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 2 }}>맥주 캐치</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 56, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 20px rgba(245,158,11,0.5)' }}>{hitsRef.current}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 2 }}>물 탭 (감점)</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 56, color: '#60a5fa', lineHeight: 1 }}>{mistakesRef.current}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>캐치율 {accuracy}%</div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── playing ──
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* 상단 스탯 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20 }}>🍺</span>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: 'var(--amber)', lineHeight: 1 }}>{hits}</span>
        </div>

        {/* 타이머 */}
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 36, lineHeight: 1,
          color: timeLeft <= 5 ? '#ef4444' : 'var(--text)',
          textShadow: timeLeft <= 5 ? '0 0 16px rgba(239,68,68,0.5)' : 'none',
          transition: 'color 0.3s ease',
        }}>
          {timeLeft}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: mistakes > 0 ? '#ef4444' : 'var(--text-dim)', lineHeight: 1 }}>-{mistakes}</span>
          <span style={{ fontSize: 20 }}>💧</span>
        </div>
      </div>

      {/* 낙하 영역 */}
      <div style={{
        position: 'relative', width: '100%', height: 420,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, overflow: 'hidden',
      }}>
        {/* 배경 힌트 텍스트 */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64, opacity: 0.04, pointerEvents: 'none', userSelect: 'none',
        }}>
          🍺
        </div>

        {items.map(item => (
          <button
            key={item.id}
            onPointerDown={() => handleTap(item.id, item.type)}
            style={{
              position: 'absolute',
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: 42,
              lineHeight: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transform: 'translateX(-50%)',
              filter: item.type === 'water'
                ? 'drop-shadow(0 2px 6px rgba(96,165,250,0.4))'
                : 'drop-shadow(0 2px 8px rgba(245,158,11,0.35))',
              transition: 'top 0s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {item.type === 'beer' ? '🍺' : '💧'}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>🍺만 탭! 💧는 무시!</div>
    </div>
  )
}

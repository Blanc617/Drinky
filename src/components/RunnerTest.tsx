'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onComplete: (score: number) => void
}

// ── 상수 ──────────────────────────────────────────────
const TICK         = 16    // ms per frame
const GROUND       = 28    // game 하단으로부터 지면 높이 (px)
const CHAR_X       = 64    // 캐릭터 고정 x위치
const CHAR_W       = 38
const CHAR_H_STAND = 52
const CHAR_H_SLIDE = 26
const JUMP_VY      = -11   // 점프 초기 속도
const GRAVITY      = 1.1
const INITIAL_SPD  = 3.2
const SPD_INC      = 0.0012
const LIVES        = 3

// LOW obstacle: 지면 위 장애물 → 점프해야 함
// bottom = GROUND, height = 54 → top = GROUND+54 = 82
const LOW_H        = 54
// HIGH obstacle: 공중 장애물 → 슬라이딩해야 함
// bottom = GROUND+28 = 56, height = 24 → top = 80
// 슬라이딩 char top = GROUND+CHAR_H_SLIDE = 28+26 = 54 → 54 < 56 (통과)
// 서있는 char top = GROUND+CHAR_H_STAND = 28+52 = 80 → 80 > 56 (충돌)
const HIGH_BOTTOM  = GROUND + 28
const HIGH_H       = 24

interface Obs {
  id: number
  x: number
  type: 'low' | 'high'
  passed?: boolean
}

type Action = 'run' | 'jump' | 'slide'
type Phase  = 'intro' | 'countdown' | 'playing' | 'result'

export default function RunnerTest({ onComplete }: Props) {
  const [phase,    setPhase]    = useState<Phase>('intro')
  const [cdCount,  setCdCount]  = useState(3)
  const [charBottom, setCharBottom] = useState(GROUND)
  const [action,   setAction]   = useState<Action>('run')
  const [obstacles, setObstacles] = useState<Obs[]>([])
  const [score,    setScore]    = useState(0)
  const [lives,    setLives]    = useState(LIVES)
  const [flash,    setFlash]    = useState(false)
  const [cleared,  setCleared]  = useState(0)
  const [gameWidth, setGameWidth] = useState(320)

  const isPracticeRef   = useRef(false)
  const doneRef         = useRef(false)
  const scoreRef        = useRef(0)
  const livesRef        = useRef(LIVES)
  const charBotRef      = useRef(GROUND)
  const velYRef         = useRef(0)
  const actionRef       = useRef<Action>('run')
  const groundedRef     = useRef(true)
  const obstaclesRef    = useRef<Obs[]>([])
  const speedRef        = useRef(INITIAL_SPD)
  const nextIdRef       = useRef(0)
  const clearedRef      = useRef(0)
  const invincRef       = useRef(false)
  const slideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const invincTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameAreaRef     = useRef<HTMLDivElement>(null)

  const finishGame = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    if (tickRef.current)  clearInterval(tickRef.current)
    if (slideTimerRef.current)  clearTimeout(slideTimerRef.current)
    if (invincTimerRef.current) clearTimeout(invincTimerRef.current)
    const final = Math.min(100, Math.floor(scoreRef.current / 8))
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(final), 1500)
  }, [onComplete])

  const startLoop = useCallback(() => {
    const gw = gameAreaRef.current?.clientWidth ?? 320
    setGameWidth(gw)

    tickRef.current = setInterval(() => {
      speedRef.current += SPD_INC
      scoreRef.current += 1
      setScore(Math.floor(scoreRef.current / 6))

      // ── 점프 물리 ──
      if (!groundedRef.current) {
        velYRef.current += GRAVITY
        charBotRef.current = Math.max(GROUND, charBotRef.current - velYRef.current)
        if (charBotRef.current <= GROUND) {
          charBotRef.current = GROUND
          velYRef.current    = 0
          groundedRef.current = true
          if (actionRef.current === 'jump') {
            actionRef.current = 'run'
            setAction('run')
          }
        }
        setCharBottom(charBotRef.current)
      }

      // ── 장애물 이동 + 스폰 ──
      const spd = speedRef.current
      let obs = obstaclesRef.current.map(o => ({ ...o, x: o.x - spd }))
      // 캐릭터를 통과한 장애물 카운트
      obs.forEach(o => {
        if (!o.passed && o.x + 32 < CHAR_X) {
          o.passed = true
          clearedRef.current++
          setCleared(clearedRef.current)
        }
      })
      obs = obs.filter(o => o.x > -60)

      const lastX = obs.length > 0 ? Math.max(...obs.map(o => o.x)) : -999
      const minGap = Math.max(160, 280 - scoreRef.current * 0.08)
      if (lastX < gw - minGap) {
        obs = [...obs, {
          id:   nextIdRef.current++,
          x:    gw,
          type: Math.random() < 0.5 ? 'low' : 'high',
        }]
      }
      obstaclesRef.current = obs
      setObstacles([...obs])

      // ── 충돌 감지 ──
      if (!invincRef.current) {
        const charTop = charBotRef.current + (actionRef.current === 'slide' ? CHAR_H_SLIDE : CHAR_H_STAND)
        const charL = CHAR_X, charR = CHAR_X + CHAR_W

        for (const o of obs) {
          const obsL = o.x, obsR = o.x + 32
          const obsBot = o.type === 'low' ? GROUND : HIGH_BOTTOM
          const obsTop = obsBot + (o.type === 'low' ? LOW_H : HIGH_H)

          const overlapX = charR > obsL + 4 && charL < obsR - 4
          const overlapY = charTop > obsBot + 2 && charBotRef.current < obsTop - 2

          if (overlapX && overlapY) {
            livesRef.current--
            setLives(livesRef.current)
            setFlash(true)
            setTimeout(() => setFlash(false), 300)

            obstaclesRef.current = obstaclesRef.current.filter(x => x.id !== o.id)
            setObstacles([...obstaclesRef.current])

            if (livesRef.current <= 0) { finishGame(); return }

            invincRef.current = true
            if (invincTimerRef.current) clearTimeout(invincTimerRef.current)
            invincTimerRef.current = setTimeout(() => { invincRef.current = false }, 1400)
            break
          }
        }
      }
    }, TICK)
  }, [finishGame])

  function startGame() {
    doneRef.current     = false
    scoreRef.current    = 0
    livesRef.current    = LIVES
    charBotRef.current  = GROUND
    velYRef.current     = 0
    actionRef.current   = 'run'
    groundedRef.current = true
    invincRef.current   = false
    obstaclesRef.current = []
    speedRef.current    = INITIAL_SPD
    nextIdRef.current   = 0
    clearedRef.current  = 0
    setScore(0)
    setCleared(0)
    setLives(LIVES)
    setCharBottom(GROUND)
    setAction('run')
    setObstacles([])
    setFlash(false)
    setPhase('countdown')
    setCdCount(3)
    let c = 3
    const t = setInterval(() => {
      c--
      setCdCount(c)
      if (c === 0) { clearInterval(t); setPhase('playing'); startLoop() }
    }, 1000)
  }

  function handleJump() {
    if (phase !== 'playing' || !groundedRef.current) return
    groundedRef.current  = false
    velYRef.current      = JUMP_VY
    actionRef.current    = 'jump'
    setAction('jump')
  }

  function handleSlide() {
    if (phase !== 'playing' || !groundedRef.current) return
    if (actionRef.current === 'slide') return
    actionRef.current = 'slide'
    setAction('slide')
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    slideTimerRef.current = setTimeout(() => {
      if (actionRef.current === 'slide') { actionRef.current = 'run'; setAction('run') }
    }, 550)
  }

  useEffect(() => () => {
    if (tickRef.current)       clearInterval(tickRef.current)
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    if (invincTimerRef.current)clearTimeout(invincTimerRef.current)
  }, [])

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🏃</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>달리기 게임</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            장애물을 피해 최대한 멀리 달려요!
          </p>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {[
            { emoji: '🌵', label: '선인장 (낮은 장애물)', action: '점프 →', color: '#4ade80' },
            { emoji: '🦅', label: '독수리 (공중 장애물)', action: '← 슬라이딩', color: '#60a5fa' },
          ].map(({ emoji, label, action: act, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{ color: 'var(--text-muted)', flex: 1, textAlign: 'left' }}>{label}</span>
              <span style={{ color, fontWeight: 700 }}>{act}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>❤️ x {LIVES} · 속도가 점점 빨라집니다</div>
        <button className="btn-secondary" onClick={() => { isPracticeRef.current = true; startGame() }}>연습하기</button>
        <button className="btn-primary"   onClick={() => { isPracticeRef.current = false; startGame() }}>시작하기</button>
      </div>
    )
  }

  // ── countdown ──
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>준비하세요!</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 120, color: 'var(--amber)', lineHeight: 1,
          textShadow: '0 0 40px rgba(245,158,11,0.6)',
          animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>{cdCount}</div>
        <style>{`@keyframes popIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const final = Math.min(100, Math.floor(scoreRef.current / 8))
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>게임 오버</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {Math.floor(scoreRef.current / 6)}<span style={{ fontSize: 32 }}>m</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>점수 {final}</div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── playing ──
  const charH = action === 'slide' ? CHAR_H_SLIDE : CHAR_H_STAND
  const isInvinc = invincRef.current

  return (
    <div className="flex flex-col gap-4 w-full select-none">
      <style>{`
        @keyframes run { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(0.96)} }
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* 상단 HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 20, letterSpacing: 2 }}>
          {Array.from({ length: LIVES }).map((_, i) => <span key={i}>{i < lives ? '❤️' : '🖤'}</span>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: 'var(--amber)', lineHeight: 1 }}>{score}m</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>통과 {cleared}개</div>
        </div>
      </div>

      {/* 게임 영역 */}
      <div
        ref={gameAreaRef}
        style={{
          position: 'relative', width: '100%', height: 200,
          background: flash ? 'rgba(239,68,68,0.08)' : 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 20,
          overflow: 'hidden',
          transition: 'background 0.1s ease',
        }}
      >
        {/* 배경 구름 */}
        <div style={{ position: 'absolute', top: 20, left: '20%', fontSize: 28, opacity: 0.15 }}>☁️</div>
        <div style={{ position: 'absolute', top: 35, left: '65%', fontSize: 20, opacity: 0.12 }}>☁️</div>

        {/* 지면 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: GROUND,
          background: 'linear-gradient(to bottom, #78716c, #57534e)',
          borderTop: '2px solid #a8a29e',
        }} />

        {/* 달리는 선 (지면 위) */}
        <div style={{
          position: 'absolute', bottom: GROUND, left: 0, right: 0,
          height: 1, background: 'rgba(168,162,158,0.3)',
        }} />

        {/* 캐릭터 */}
        <div style={{
          position: 'absolute',
          left: CHAR_X,
          bottom: charBottom,
          width: CHAR_W,
          height: charH,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: action === 'slide' ? 22 : 30,
          transition: 'height 0.08s ease',
          opacity: isInvinc ? 0.5 : 1,
          animation: action === 'run' ? 'run 0.35s ease infinite' : 'none',
          filter: isInvinc ? 'brightness(1.5)' : 'none',
        }}>
          {action === 'jump' ? '🦘' : action === 'slide' ? '🤸' : '🏃'}
        </div>

        {/* 장애물 */}
        {obstacles.map(o => {
          const isLow = o.type === 'low'
          return (
            <div
              key={o.id}
              style={{
                position: 'absolute',
                left: o.x,
                bottom: isLow ? GROUND : HIGH_BOTTOM,
                width: 32,
                height: isLow ? LOW_H : HIGH_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isLow ? 28 : 24,
              }}
            >
              {isLow ? '🌵' : '🦅'}
            </div>
          )
        })}

        {/* 장애물 힌트 표시 */}
        {obstacles.filter(o => o.x < gameWidth * 0.75 && o.x > CHAR_X + 40).slice(0, 1).map(o => (
          <div key={`hint-${o.id}`} style={{
            position: 'absolute', bottom: 200 - 20, left: o.x + 8,
            fontSize: 11, fontWeight: 700,
            color: o.type === 'low' ? '#4ade80' : '#60a5fa',
            opacity: Math.max(0, 1 - (o.x - CHAR_X) / (gameWidth * 0.4)),
          }}>
            {o.type === 'low' ? '점프!' : '슬라이딩!'}
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button
          onPointerDown={handleSlide}
          style={{
            height: 90, borderRadius: 20,
            background: action === 'slide' ? 'rgba(96,165,250,0.15)' : 'var(--surface)',
            border: action === 'slide' ? '2px solid #60a5fa' : '1px solid var(--border)',
            boxShadow: action === 'slide' ? '0 0 20px rgba(96,165,250,0.3)' : 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'all 0.1s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 30 }}>🤸</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>슬라이딩</span>
        </button>
        <button
          onPointerDown={handleJump}
          style={{
            height: 90, borderRadius: 20,
            background: action === 'jump' ? 'rgba(74,222,128,0.15)' : 'var(--surface)',
            border: action === 'jump' ? '2px solid #4ade80' : '1px solid var(--border)',
            boxShadow: action === 'jump' ? '0 0 20px rgba(74,222,128,0.3)' : 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'all 0.1s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 30 }}>🦘</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>점프</span>
        </button>
      </div>
    </div>
  )
}

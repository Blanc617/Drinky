'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  myName: string
  players: { userId: string; name: string }[]
  isHost: boolean
  rounds: number
}

const ROUND_TIME = 5
const SHOW_DELAY = 3000

interface ClaimEntry {
  slotIdx: number
  userId: string
  name: string
  order: number  // 수신 순서 (0-indexed)
}

type Phase = 'intro' | 'playing' | 'showing' | 'result'

export default function NunchiGameBattle({ onComplete, roomCode, userId, myName, players, isHost, rounds }: Props) {
  const playerCount = players.length
  const slotCount = playerCount

  const [phase, setPhase] = useState<Phase>('intro')
  const [totalRounds, setTotalRounds] = useState(rounds)
  const [round, setRound] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [roundClaims, setRoundClaims] = useState<ClaimEntry[]>([])
  const [myChoice, setMyChoice] = useState<number | null>(null)
  const [myPoints, setMyPoints] = useState(0)
  const [lastResult, setLastResult] = useState<'success' | 'collision' | 'missed' | null>(null)
  const [lastPoints, setLastPoints] = useState(0)
  const [collisionNames, setCollisionNames] = useState<string[]>([])
  const [showCountdown, setShowCountdown] = useState(0)

  const phaseRef        = useRef<Phase>('intro')
  const roundRef        = useRef(0)
  const totalRoundsRef  = useRef(rounds)
  const roundClaimsRef  = useRef<ClaimEntry[]>([])
  const myChoiceRef     = useRef<number | null>(null)
  const submittedRef    = useRef(false)
  const myPointsRef     = useRef(0)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef      = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const onCompleteRef   = useRef(onComplete)
  const advanceRef      = useRef<() => void>(() => {})
  const playerCountRef  = useRef(playerCount)

  onCompleteRef.current = onComplete

  function setPhaseSync(p: Phase) {
    phaseRef.current = p
    setPhase(p)
  }

  function startRound(r: number) {
    if (r >= totalRoundsRef.current) {
      setPhaseSync('result')
      const maxPts = totalRoundsRef.current * playerCountRef.current
      const score = maxPts > 0 ? Math.min(100, Math.round((myPointsRef.current / maxPts) * 100)) : 0
      setTimeout(() => onCompleteRef.current(score), 1500)
      return
    }
    roundRef.current = r
    setRound(r)
    roundClaimsRef.current = []
    setRoundClaims([])
    myChoiceRef.current = null
    setMyChoice(null)
    submittedRef.current = false
    setLastResult(null)
    setLastPoints(0)
    setCollisionNames([])
    setTimeLeft(ROUND_TIME)
    setPhaseSync('playing')

    let t = ROUND_TIME
    timerRef.current = setInterval(() => {
      t--
      setTimeLeft(t)
      if (t <= 0) {
        clearInterval(timerRef.current!)
        advanceRef.current()
      }
    }, 1000)
  }

  function endRound() {
    if (phaseRef.current === 'showing') return
    if (timerRef.current) clearInterval(timerRef.current)
    setPhaseSync('showing')

    const showDelaySeconds = Math.round(SHOW_DELAY / 1000)
    setShowCountdown(showDelaySeconds)
    let cd = showDelaySeconds
    const cdInterval = setInterval(() => {
      cd--
      setShowCountdown(cd)
      if (cd <= 0) clearInterval(cdInterval)
    }, 1000)

    const claims = roundClaimsRef.current
    const uniqueClaims = claims
      .filter(c => claims.filter(x => x.slotIdx === c.slotIdx).length === 1)
      .sort((a, b) => a.order - b.order)

    const mySlot = myChoiceRef.current
    if (mySlot === null) {
      setLastResult('missed')
      setLastPoints(0)
    } else {
      const claimersOnMySlot = claims.filter(c => c.slotIdx === mySlot)
      if (claimersOnMySlot.length > 1) {
        const others = claimersOnMySlot
          .filter(c => c.userId !== userId)
          .map(c => c.name)
        setCollisionNames(others)
        setLastResult('collision')
        setLastPoints(0)
      } else {
        const rank = uniqueClaims.findIndex(c => c.userId === userId) + 1
        const pts = uniqueClaims.length - rank + 1
        myPointsRef.current += pts
        setMyPoints(myPointsRef.current)
        setLastResult('success')
        setLastPoints(pts)
      }
    }

    setTimeout(() => startRound(roundRef.current + 1), SHOW_DELAY)
  }

  advanceRef.current = endRound

  function handleSlotTap(slotIdx: number) {
    if (phaseRef.current !== 'playing') return
    if (submittedRef.current) return
    // 실제 눈치게임: 어떤 번호든 자유 선택 가능
    submittedRef.current = true
    myChoiceRef.current = slotIdx
    setMyChoice(slotIdx)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'nunchi_claim',
      payload: { round: roundRef.current, slotIdx, userId, name: myName },
    })
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`nunchi-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'nunchi_start' }, ({ payload }) => {
        const { rounds: r } = payload as { rounds: number }
        totalRoundsRef.current = r
        setTotalRounds(r)
        startRound(0)
      })
      .on('broadcast', { event: 'nunchi_claim' }, ({ payload }) => {
        const { round: r, slotIdx, userId: uid, name } = payload as {
          round: number; slotIdx: number; userId: string; name: string
        }
        if (r !== roundRef.current || phaseRef.current !== 'playing') return

        const order = roundClaimsRef.current.length
        const entry: ClaimEntry = { slotIdx, userId: uid, name, order }
        roundClaimsRef.current = [...roundClaimsRef.current, entry]
        setRoundClaims([...roundClaimsRef.current])

        const uniqueSubmitters = new Set(roundClaimsRef.current.map(c => c.userId))
        if (uniqueSubmitters.size >= playerCountRef.current) {
          advanceRef.current()
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isHost) {
          await channel.send({
            type: 'broadcast',
            event: 'nunchi_start',
            payload: { rounds: totalRoundsRef.current },
          })
        }
      })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      channel.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>게임 준비 중...</div>
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: '#64748b', letterSpacing: '0.05em' }}>
          게임 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: '#f59e0b', lineHeight: 1 }}>
          {myPointsRef.current}<span style={{ fontSize: 32 }}>점</span>
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>결과 저장 중...</div>
      </div>
    )
  }

  const isShowing = phase === 'showing'
  const cols = slotCount <= 4 ? 2 : 3

  const slotClaims: ClaimEntry[][] = Array.from({ length: slotCount }, (_, i) =>
    roundClaims.filter(c => c.slotIdx === i)
  )

  // Timer bar width
  const timerPct = isShowing ? 0 : (timeLeft / ROUND_TIME) * 100
  const timerColor = timeLeft <= 2 ? '#ef4444' : timeLeft <= 3 ? '#f97316' : '#3b82f6'

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* Header: round + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>
          ROUND {round + 1} / {totalRounds}
        </div>
        <div style={{
          background: myPoints > 0 ? '#f0fdf4' : '#f8fafc',
          border: `1.5px solid ${myPoints > 0 ? '#86efac' : '#e2e8f0'}`,
          borderRadius: 20, padding: '3px 12px',
          fontSize: 13, fontWeight: 700,
          color: myPoints > 0 ? '#15803d' : '#94a3b8',
        }}>
          {myPoints}점
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${timerPct}%`,
          background: timerColor,
          transition: 'width 0.9s linear, background 0.3s',
        }} />
      </div>

      {/* Timer number + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {!isShowing ? (
          <div style={{
            fontFamily: "'Bebas Neue'", fontSize: 42, lineHeight: 1,
            color: timeLeft <= 2 ? '#ef4444' : '#1e293b',
            transition: 'color 0.3s',
          }}>
            {timeLeft}
          </div>
        ) : (
          <div style={{ fontSize: 22 }}>✓</div>
        )}
      </div>

      {/* Rule hint — only before first choice */}
      {!isShowing && myChoice === null && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10, padding: '8px 14px',
          fontSize: 12, color: '#1d4ed8', fontWeight: 600,
          textAlign: 'center', lineHeight: 1.7,
        }}>
          번호를 하나 선점하세요 — 혼자 골라야 점수!<br />
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
            아무 번호나 선택 가능 · 혼자 선택해야 점수 · 빠를수록 높은 순위
          </span>
        </div>
      )}

      {/* Waiting hint after choice */}
      {!isShowing && myChoice !== null && (
        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', fontWeight: 500 }}>
          선택 완료 · 다른 플레이어 기다리는 중...<br />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>혼자 선점 성공 시 순위대로 점수 — 1위가 최고점</span>
        </div>
      )}

      {/* Result banner */}
      {isShowing && lastResult && (
        <div style={{
          borderRadius: 12, padding: '8px 20px',
          fontSize: 15, fontWeight: 700, textAlign: 'center',
          background:
            lastResult === 'success'   ? '#f0fdf4' :
            lastResult === 'collision' ? '#fff1f2' : '#fff7ed',
          border: `1.5px solid ${
            lastResult === 'success'   ? '#86efac' :
            lastResult === 'collision' ? '#fecaca' : '#fed7aa'
          }`,
          color:
            lastResult === 'success'   ? '#15803d' :
            lastResult === 'collision' ? '#b91c1c' : '#c2410c',
        }}>
          {lastResult === 'success'
            ? `✓ 성공! +${lastPoints}점`
            : lastResult === 'collision'
            ? `💥 ${collisionNames.length > 0 ? collisionNames.join(', ') + '와(과) 충돌!' : '충돌!'} +0점`
            : '⏱ 선택 안 함 · +0점'}
        </div>
      )}
      {isShowing && (
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          {showCountdown}초 후 다음 라운드
        </div>
      )}

      {/* Slot grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 10, width: '100%',
      }}>
        {slotClaims.map((claimers, i) => {
          const isMyChoice = myChoice === i
          const isCollision = isShowing && claimers.length > 1
          const isSafe      = isShowing && claimers.length === 1
          const isEmpty     = isShowing && claimers.length === 0
          const taken       = !isShowing && claimers.length > 0

          // Colour scheme
          let bg = '#ffffff'
          let border = '1.5px solid #e2e8f0'
          let numColor = '#334155'
          let shadow = '0 1px 4px rgba(0,0,0,0.06)'

          const submitted = myChoice !== null
          if (submitted && !isMyChoice && !isShowing) {
            bg = '#f8fafc'; border = '1.5px solid #e2e8f0'; numColor = '#cbd5e1'
          } else if (!isShowing && isMyChoice) {
            bg = '#eff6ff'; border = '2px solid #3b82f6'; numColor = '#1d4ed8'
            shadow = '0 0 0 4px rgba(59,130,246,0.15)'
          } else if (!isShowing && taken) {
            bg = '#fff7ed'; border = '1.5px solid #fed7aa'; numColor = '#f97316'
          } else if (isShowing) {
            if (isCollision) { bg = '#fff1f2'; border = '2px solid #fca5a5'; numColor = '#ef4444' }
            else if (isSafe) { bg = '#f0fdf4'; border = '2px solid #86efac'; numColor = '#16a34a' }
            else if (isEmpty){ bg = '#f8fafc'; border = '1.5px solid #e2e8f0'; numColor = '#cbd5e1' }
          }

          const nameList = claimers.map(c => c.userId === userId ? '나' : c.name)

          return (
            <button
              key={i}
              onClick={() => handleSlotTap(i)}
              disabled={isShowing || myChoice !== null}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, borderRadius: 18,
                aspectRatio: '1',
                border, background: bg, boxShadow: shadow,
                cursor: isShowing || myChoice !== null ? 'default' : 'pointer',
                opacity: (myChoice !== null && !isMyChoice && !isShowing) ? 0.4 : 1,
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                padding: 8,
              }}
            >
              {/* Big number */}
              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 48, lineHeight: 1, color: numColor, transition: 'color 0.2s' }}>
                {i + 1}
              </span>
              {/* Status icon overlay (showing phase) */}
              {isShowing && !isEmpty && (
                <span style={{
                  position: 'absolute', top: 6, right: 8,
                  fontSize: 14,
                }}>
                  {isCollision ? '💥' : '✓'}
                </span>
              )}

              {/* Player name chips */}
              {claimers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 3, maxWidth: '100%' }}>
                  {nameList.map((n, ni) => (
                    <span key={ni} style={{
                      fontSize: 10, fontWeight: 700,
                      background: isShowing
                        ? (isCollision ? '#fecaca' : '#bbf7d0')
                        : (isMyChoice ? '#dbeafe' : '#f1f5f9'),
                      color: isShowing
                        ? (isCollision ? '#991b1b' : '#166534')
                        : (isMyChoice ? '#1e40af' : '#64748b'),
                      borderRadius: 6, padding: '1px 5px',
                      maxWidth: 60, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

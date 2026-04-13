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
const SHOW_DELAY = 2500

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

    const claims = roundClaimsRef.current
    // 고유 슬롯(충돌 없는 슬롯)만 추린 뒤 수신 순서(order)로 정렬
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
        setLastResult('collision')
        setLastPoints(0)
      } else {
        // 고유 선택자 중 내 순위 (0-indexed → 1-indexed)
        const rank = uniqueClaims.findIndex(c => c.userId === userId) + 1
        const pts = uniqueClaims.length - rank + 1  // 1등=uniqueCount점, 꼴찌=1점
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

        const order = roundClaimsRef.current.length  // 수신 순서
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

  // ── intro: 대기 ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>게임 준비 중...</div>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          게임 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {myPointsRef.current}<span style={{ fontSize: 32 }}>점</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  // ── playing / showing ──
  const isShowing = phase === 'showing'
  const cols = slotCount <= 4 ? 2 : 3

  const slotClaims: ClaimEntry[][] = Array.from({ length: slotCount }, (_, i) =>
    roundClaims.filter(c => c.slotIdx === i)
  )

  const resultColor =
    lastResult === 'success' ? '#4ade80' :
    lastResult === 'collision' ? '#ef4444' : '#f97316'

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: 13 }}>
        <span style={{ color: 'var(--text-dim)' }}>{round + 1} / {totalRounds}</span>
        <span style={{
          fontFamily: "'Bebas Neue'", fontSize: 28, lineHeight: 1,
          color: timeLeft <= 2 ? '#ef4444' : 'var(--amber)',
          transition: 'color 0.3s',
        }}>
          {isShowing ? '✓' : timeLeft}
        </span>
        <span style={{ color: myPoints > 0 ? '#4ade80' : 'var(--text-dim)', fontWeight: 700 }}>
          {myPoints}점
        </span>
      </div>

      {isShowing && lastResult && (
        <div style={{ fontSize: 16, fontWeight: 700, color: resultColor, textAlign: 'center' }}>
          {lastResult === 'success' ? `✓ 성공! +${lastPoints}점` :
           lastResult === 'collision' ? '💥 충돌! +0점' : '⏱ 선택 안 함 +0점'}
        </div>
      )}
      {!isShowing && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
          {myChoice !== null ? '제출 완료 — 다른 플레이어 기다리는 중...' : '번호를 선점하세요!'}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12, width: '100%',
      }}>
        {slotClaims.map((claimers, i) => {
          const isMyChoice = myChoice === i
          const isCollision = isShowing && claimers.length > 1
          const isSafe = isShowing && claimers.length === 1

          let border = '1px solid var(--border)'
          let bg = 'var(--surface)'
          let numColor = 'var(--text-muted)'

          if (!isShowing && isMyChoice) {
            border = '2px solid var(--amber)'
            bg = 'rgba(245,158,11,0.1)'
            numColor = 'var(--amber)'
          } else if (isShowing) {
            if (isCollision) { border = '2px solid #ef4444'; bg = 'rgba(239,68,68,0.1)'; numColor = '#ef4444' }
            else if (isSafe)  { border = '2px solid #4ade80'; bg = 'rgba(74,222,128,0.1)'; numColor = '#4ade80' }
          }

          return (
            <button
              key={i}
              onClick={() => handleSlotTap(i)}
              disabled={isShowing || myChoice !== null}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, borderRadius: 16, aspectRatio: '1',
                border, background: bg,
                cursor: isShowing || myChoice !== null ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                padding: 8,
              }}
            >
              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 52, lineHeight: 1, color: numColor }}>
                {i + 1}
              </span>
              {isShowing && claimers.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  color: isCollision ? '#ef4444' : '#4ade80',
                  overflow: 'hidden', maxWidth: '100%',
                }}>
                  {isCollision ? '💥 ' : '✓ '}
                  {claimers.map(c => c.userId === userId ? '나' : c.name).join(', ')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

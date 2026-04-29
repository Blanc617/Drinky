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
  playerOrder?: string[]
}

function isClap(n: number): boolean {
  return String(n).split('').some(d => ['3', '6', '9'].includes(d))
}

const TIME_LIMIT = 3

type Phase = 'intro' | 'playing' | 'feedback' | 'result'

type RoundPlayerStat = { correct: number; mistakes: number }
type RoundStat = { roundNum: number; perPlayer: Record<string, RoundPlayerStat> }

export default function ThreeSixNineBattle({ onComplete, roomCode, userId, myName, players, isHost, rounds, playerOrder: playerOrderProp }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentNum, setCurrentNum] = useState(1)
  const [currentTurnUserId, setCurrentTurnUserId] = useState('')
  const [totalMistakes, setTotalMistakes] = useState(0)
  const [myMistakes, setMyMistakes] = useState(0)
  const [myCorrect, setMyCorrect] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [feedback, setFeedback] = useState<{ correct: boolean; playerName: string; shouldClap: boolean; didClap: boolean | null } | null>(null)
  const [combo, setCombo] = useState(0)
  const [playerOrderState, setPlayerOrderState] = useState<string[]>([])
  const [roundCountdown, setRoundCountdown] = useState<number | null>(null)
  const [startCountdown, setStartCountdown] = useState<number | null>(null)
  const startCountdownRef = useRef<number | null>(null)

  const phaseRef           = useRef<Phase>('intro')
  const currentNumRef      = useRef(1)
  const currentTurnRef     = useRef('')
  const playerOrderRef     = useRef<string[]>([])
  const totalMistakesRef   = useRef(0)
  const myMistakesRef      = useRef(0)
  const myCorrectRef       = useRef(0)
  const comboRef           = useRef(0)
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef         = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const onCompleteRef      = useRef(onComplete)
  const playersRef         = useRef(players)
  const roundsRef          = useRef(rounds)
  const answeredRef        = useRef(false)
  const currentRoundStatsRef = useRef<Record<string, RoundPlayerStat>>({})
  const allRoundStatsRef     = useRef<RoundStat[]>([])
  const roundNumRef          = useRef(1)

  function initCurrentRound() {
    const stats: Record<string, RoundPlayerStat> = {}
    playersRef.current.forEach(p => { stats[p.userId] = { correct: 0, mistakes: 0 } })
    currentRoundStatsRef.current = stats
  }

  onCompleteRef.current = onComplete
  playersRef.current = players

  function setPhaseSync(p: Phase) { phaseRef.current = p; setPhase(p) }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function startTurn(num: number, turnUserId: string) {
    currentNumRef.current = num
    currentTurnRef.current = turnUserId
    answeredRef.current = false
    setCurrentNum(num)
    setCurrentTurnUserId(turnUserId)
    setFeedback(null)
    setTimeLeft(TIME_LIMIT)
    setPhaseSync('playing')

    stopTimer()
    let t = TIME_LIMIT
    timerRef.current = setInterval(() => {
      t -= 0.05
      setTimeLeft(Math.max(0, t))
      if (t <= 0) {
        stopTimer()
        if (answeredRef.current) return
        if (startCountdownRef.current !== null) return
        if (currentTurnRef.current !== userId) return
        answeredRef.current = true
        channelRef.current?.send({
          type: 'broadcast',
          event: '369_answer',
          payload: { num: currentNumRef.current, correct: false, userId, didClap: null },
        })
      }
    }, 50)
  }

  function handleAnswer(didClap: boolean) {
    if (phaseRef.current !== 'playing') return
    if (startCountdownRef.current !== null) return
    if (currentTurnRef.current !== userId) return
    if (answeredRef.current) return
    answeredRef.current = true
    stopTimer()

    const correct = isClap(currentNumRef.current) === didClap
    channelRef.current?.send({
      type: 'broadcast',
      event: '369_answer',
      payload: { num: currentNumRef.current, correct, userId, didClap },
    })
  }

  function processAnswer(answerUserId: string, num: number, correct: boolean, didClap: boolean | null) {
    if (phaseRef.current !== 'playing') return
    if (num !== currentNumRef.current) return
    stopTimer()

    const playerName = playersRef.current.find(p => p.userId === answerUserId)?.name ?? '?'
    const isMe = answerUserId === userId
    const shouldClap = isClap(num)

    if (!currentRoundStatsRef.current[answerUserId]) {
      currentRoundStatsRef.current[answerUserId] = { correct: 0, mistakes: 0 }
    }

    if (correct) {
      if (isMe) {
        myCorrectRef.current++
        setMyCorrect(myCorrectRef.current)
        comboRef.current++
        setCombo(comboRef.current)
      }
      currentRoundStatsRef.current[answerUserId].correct++
    } else {
      totalMistakesRef.current++
      setTotalMistakes(totalMistakesRef.current)
      if (isMe) {
        myMistakesRef.current++
        setMyMistakes(myMistakesRef.current)
        comboRef.current = 0
        setCombo(0)
      }
      currentRoundStatsRef.current[answerUserId].mistakes++

      allRoundStatsRef.current.push({
        roundNum: roundNumRef.current,
        perPlayer: JSON.parse(JSON.stringify(currentRoundStatsRef.current)),
      })
    }

    setFeedback({ correct, playerName, shouldClap, didClap })
    setPhaseSync('feedback')

    const delay = correct ? 300 : 2000

    if (!correct && totalMistakesRef.current >= roundsRef.current) {
      setTimeout(() => {
        sessionStorage.setItem(`369_stats_${roomCode}`, JSON.stringify(allRoundStatsRef.current))
        const totalCorrect = myCorrectRef.current
        const totalMistakesCount = myMistakesRef.current
        const score = (9999 - totalMistakesCount) * 10000 + totalCorrect
        onCompleteRef.current(score)
      }, delay)
    } else {
      const order = playerOrderRef.current
      const curIdx = order.indexOf(currentTurnRef.current)
      const nextTurnUserId = order[(curIdx + 1) % order.length]
      if (correct) {
        setTimeout(() => startTurn(currentNumRef.current + 1, nextTurnUserId), delay)
      } else {
        roundNumRef.current++
        initCurrentRound()
        setTimeout(() => {
          setRoundCountdown(3)
          setTimeout(() => setRoundCountdown(2), 1000)
          setTimeout(() => setRoundCountdown(1), 2000)
          setTimeout(() => { setRoundCountdown(null); startTurn(1, nextTurnUserId) }, 3000)
        }, delay)
      }
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`369-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: '369_start' }, ({ payload }) => {
        const { rounds: r, playerOrder } = payload as { rounds: number; playerOrder: string[] }
        roundsRef.current = r
        playerOrderRef.current = playerOrder
        setPlayerOrderState(playerOrder)
        initCurrentRound()

        // 게임 화면 미리 표시 (타이머 없이)
        currentNumRef.current = 1
        currentTurnRef.current = playerOrder[0]
        setCurrentNum(1)
        setCurrentTurnUserId(playerOrder[0])
        setPhaseSync('playing')

        // 4-3-2-1 카운트다운 후 실제 시작
        const setCD = (v: number | null) => { startCountdownRef.current = v; setStartCountdown(v) }
        setCD(4)
        setTimeout(() => setCD(3), 1000)
        setTimeout(() => setCD(2), 2000)
        setTimeout(() => setCD(1), 3000)
        setTimeout(() => { setCD(null); startTurn(1, playerOrder[0]) }, 4000)
      })
      .on('broadcast', { event: '369_answer' }, ({ payload }) => {
        const { num, correct, userId: answerUserId, didClap } = payload as { num: number; correct: boolean; userId: string; didClap: boolean | null }
        processAnswer(answerUserId, num, correct, didClap ?? null)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && isHost) {
          setTimeout(async () => {
            const playerOrder = playerOrderProp ?? playersRef.current.map(p => p.userId)
            await channel.send({
              type: 'broadcast',
              event: '369_start',
              payload: { rounds, playerOrder },
            })
          }, 1500)
        }
      })

    return () => {
      stopTimer()
      channel.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isMyTurn = currentTurnUserId === userId
  const currentPlayerName = players.find(p => p.userId === currentTurnUserId)?.name ?? '?'
  const feedbackColor = feedback?.correct ? '#4ade80' : '#ef4444'
  const circumference = 2 * Math.PI * 34

  // Derive display colors based on phase only — no clap hints during play
  const numColor = phase === 'feedback' ? feedbackColor : 'var(--amber)'
  const numGlow  = phase === 'feedback' ? `0 0 30px ${feedbackColor}80` : '0 0 30px rgba(245,158,11,0.5)'
  const timerStroke = phase === 'feedback' ? feedbackColor : 'var(--amber)'

  function buildFeedbackText() {
    if (!feedback) return null
    const correctLabel = feedback.shouldClap ? '박수 👏' : '숫자 🔢'
    if (feedback.correct) {
      return `✓ ${feedback.playerName} 정답!`
    }
    if (feedback.didClap === null) {
      return `✗ ${feedback.playerName} 시간 초과! 정답은 ${correctLabel}`
    }
    return `✗ ${feedback.playerName} 틀림! 정답은 ${correctLabel}`
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>게임 준비 중...</div>
      </div>
    )
  }

  const isStarting = startCountdown !== null

  return (
    <div
      className="flex flex-col items-center gap-6 w-full"
      style={{
        position: 'relative',
        borderRadius: 20,
        outline: !isStarting && isMyTurn && phase === 'playing' ? '2px solid var(--amber)' : '2px solid transparent',
        outlineOffset: 8,
        transition: 'outline-color 0.25s ease',
      }}
    >
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes cntPop { from { transform: scale(1.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes cd-drain { from { stroke-dashoffset: 0 } to { stroke-dashoffset: 264 } }
      `}</style>

      {/* 게임 시작 카운트다운 오버레이 */}
      {isStarting && (
        <div style={{
          position: 'absolute', inset: '-12px', zIndex: 30,
          borderRadius: 24,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.1em' }}>
            {isMyTurn ? '⚡ 내가 먼저 시작!' : `${players.find(p => p.userId === currentTurnUserId)?.name ?? '?'}부터 시작`}
          </div>

          {/* 원형 카운트다운 */}
          <div style={{ position: 'relative', width: 110, height: 110 }}>
            <svg key={startCountdown} width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
              {/* 배경 원 */}
              <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7"/>
              {/* 드레인 원 */}
              <circle
                cx="55" cy="55" r="42" fill="none"
                stroke="var(--amber)"
                strokeWidth="7"
                strokeDasharray="264"
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{ animation: 'cd-drain 1s linear forwards', filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.7))' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 72, color: '#ffffff', lineHeight: 1, textShadow: '0 0 24px rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.4)' }}>
                {startCountdown}
              </span>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>준비하세요!</div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', textAlign: 'center' }}>
        ROUND {roundNumRef.current} / {roundsRef.current} &nbsp;·&nbsp; 틀린 횟수 {totalMistakes} / {rounds}
      </div>

      {/* 순서 스트립 */}
      {playerOrderState.length > 0 && (
        <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          {playerOrderState.map((uid, idx) => {
            const isActive = uid === currentTurnUserId && phase === 'playing'
            const isMe = uid === userId
            const name = players.find(p => p.userId === uid)?.name ?? '?'
            return (
              <div key={uid} style={{
                padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: isActive || isMe ? 700 : 500,
                background: isActive ? 'rgba(245,158,11,0.18)' : isMe ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.05)',
                border: isActive ? '1.5px solid rgba(245,158,11,0.7)' : isMe ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid rgba(255,255,255,0.1)',
                color: isActive ? 'var(--amber)' : isMe ? 'rgba(245,158,11,0.75)' : 'var(--text-dim)',
                boxShadow: isActive ? '0 0 10px rgba(245,158,11,0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}>
                {idx + 1}. {name}{isMe ? ' (나)' : ''}
              </div>
            )
          })}
        </div>
      )}

      {/* 내 차례 강조 배너 */}
      {isMyTurn && phase === 'playing' && (
        <div style={{ width: '100%', padding: '10px 16px', borderRadius: 14, textAlign: 'center', background: 'rgba(245,158,11,0.14)', border: '2px solid rgba(245,158,11,0.55)', fontSize: 16, fontWeight: 900, color: 'var(--amber)', letterSpacing: '0.04em', boxShadow: '0 0 18px rgba(245,158,11,0.18)', animation: 'popIn 0.2s ease' }}>
          ⚡ 내 차례!
        </div>
      )}

      {/* 라운드 준비 카운트다운 */}
      {roundCountdown !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>다음 라운드 준비</div>
          <div key={roundCountdown} style={{ fontFamily: "'Bebas Neue'", fontSize: 96, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 40px rgba(245,158,11,0.6)', animation: 'cntPop 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {roundCountdown}
          </div>
        </div>
      )}

      <div style={{ position: 'relative', width: 80, height: 80, opacity: roundCountdown !== null ? 0 : isMyTurn && phase === 'playing' ? 1 : 0.2 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface2)" strokeWidth="4"/>
          <circle
            cx="40" cy="40" r="34" fill="none"
            stroke={timerStroke}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - timeLeft / TIME_LIMIT)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.05s linear', filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {Math.ceil(timeLeft)}
        </div>
      </div>

      {/* Big number */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: roundCountdown !== null ? 0 : 1, transition: 'opacity 0.2s' }}>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 110,
          color: numColor,
          lineHeight: 1, textAlign: 'center',
          textShadow: numGlow,
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          position: 'relative',
        }}>
          {currentNum}
        </div>
      </div>

      <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && feedback && (
          <span style={{ fontSize: 14, fontWeight: 700, color: feedbackColor, textAlign: 'center' }}>
            {buildFeedbackText()}
          </span>
        )}
        {phase === 'playing' && !isMyTurn && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>⏳ {currentPlayerName} 차례...</span>
        )}
        {phase === 'playing' && isMyTurn && (
          <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 700 }}>숫자? 박수?</span>
        )}
      </div>

      {/* Combo indicator: shown when my consecutive correct answers >= 2 */}
      {combo >= 2 && (
        <div style={{
          fontSize: combo >= 5 ? 18 : 14,
          fontWeight: 700,
          color: combo >= 5 ? '#f97316' : '#fbbf24',
          textShadow: combo >= 5 ? '0 0 12px rgba(249,115,22,0.6)' : 'none',
          textAlign: 'center',
          transition: 'all 0.2s ease',
        }}>
          🔥 {combo}연속 정답!
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, width: '100%', opacity: roundCountdown !== null ? 0.3 : 1, pointerEvents: roundCountdown !== null ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        <button
          onClick={() => handleAnswer(false)}
          disabled={isStarting || !isMyTurn || phase !== 'playing'}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '18px 8px', borderRadius: 16, flex: 1,
            cursor: isMyTurn && phase === 'playing' ? 'pointer' : 'default',
            background: 'var(--surface)', border: '1px solid var(--border)',
            opacity: isMyTurn && phase === 'playing' ? 1 : 0.35,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 32 }}>🔢</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>숫자</span>
        </button>
        <button
          onClick={() => handleAnswer(true)}
          disabled={isStarting || !isMyTurn || phase !== 'playing'}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '18px 8px', borderRadius: 16, flex: 1,
            cursor: isMyTurn && phase === 'playing' ? 'pointer' : 'default',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            opacity: isMyTurn && phase === 'playing' ? 1 : 0.35,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 32 }}>👏</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>박수</span>
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
        내 정답 {myCorrect}개 · 틀림 {myMistakes}번
      </div>
    </div>
  )
}

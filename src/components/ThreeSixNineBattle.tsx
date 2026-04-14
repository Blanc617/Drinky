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

const TIME_LIMIT = 1

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
  const [feedback, setFeedback] = useState<{ correct: boolean; playerName: string; shouldClap: boolean; didClap: boolean } | null>(null)
  const [combo, setCombo] = useState(0)

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
        if (currentTurnRef.current !== userId) return
        answeredRef.current = true
        channelRef.current?.send({
          type: 'broadcast',
          event: '369_answer',
          payload: { num: currentNumRef.current, correct: false, userId },
        })
      }
    }, 50)
  }

  function handleAnswer(didClap: boolean) {
    if (phaseRef.current !== 'playing') return
    if (currentTurnRef.current !== userId) return
    if (answeredRef.current) return
    answeredRef.current = true
    stopTimer()

    const correct = isClap(currentNumRef.current) === didClap
    channelRef.current?.send({
      type: 'broadcast',
      event: '369_answer',
      payload: { num: currentNumRef.current, correct, userId },
    })
  }

  function processAnswer(answerUserId: string, num: number, correct: boolean) {
    if (phaseRef.current !== 'playing') return
    if (num !== currentNumRef.current) return
    stopTimer()

    const playerName = playersRef.current.find(p => p.userId === answerUserId)?.name ?? '?'
    const isMe = answerUserId === userId
    const shouldClap = isClap(num)
    // deduce what the player actually chose from correct + shouldClap
    const didClap = correct ? shouldClap : !shouldClap

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

    const delay = correct ? 300 : 1200

    if (!correct && totalMistakesRef.current >= roundsRef.current) {
      setTimeout(() => {
        setPhaseSync('result')
        sessionStorage.setItem(`369_stats_${roomCode}`, JSON.stringify(allRoundStatsRef.current))
        const totalCorrect = myCorrectRef.current
        const totalMistakesCount = myMistakesRef.current
        const score = (9999 - totalMistakesCount) * 10000 + totalCorrect
        setTimeout(() => onCompleteRef.current(score), 1500)
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
        setTimeout(() => startTurn(1, nextTurnUserId), delay)
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
        initCurrentRound()
        startTurn(1, playerOrder[0])
      })
      .on('broadcast', { event: '369_answer' }, ({ payload }) => {
        const { num, correct, userId: answerUserId } = payload as { num: number; correct: boolean; userId: string }
        processAnswer(answerUserId, num, correct)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isHost) {
          const playerOrder = playerOrderProp ?? playersRef.current.map(p => p.userId)
          await channel.send({
            type: 'broadcast',
            event: '369_start',
            payload: { rounds, playerOrder },
          })
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

  // Whether the current number is a clap number (only meaningful in playing phase)
  const clapHint = phase === 'playing' && isClap(currentNum)

  // Derive display colors based on phase and clap hint
  const numColor = phase === 'feedback'
    ? feedbackColor
    : clapHint
      ? '#ef4444'
      : 'var(--amber)'

  const numGlow = phase === 'feedback'
    ? `0 0 30px ${feedbackColor}80`
    : clapHint
      ? '0 0 40px rgba(239,68,68,0.55)'
      : '0 0 30px rgba(245,158,11,0.5)'

  const timerStroke = phase === 'feedback'
    ? feedbackColor
    : clapHint
      ? '#ef4444'
      : 'var(--amber)'

  function buildFeedbackText() {
    if (!feedback) return null
    const choiceLabel = feedback.didClap ? '👏 박수' : '🔢 숫자'
    const correctLabel = feedback.shouldClap ? '👏 박수' : '🔢 숫자'
    if (feedback.correct) {
      return `✓ ${feedback.playerName} 정답! (${choiceLabel})`
    }
    return `✗ ${feedback.playerName} 틀림! ${choiceLabel} 눌렀는데 사실은 ${correctLabel}`
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>게임 준비 중...</div>
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          게임 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {myCorrectRef.current}<span style={{ fontSize: 32 }}>정답</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{myMistakesRef.current}번 틀림</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center gap-6 w-full"
      style={{
        borderRadius: 20,
        outline: isMyTurn && phase === 'playing' ? '2px solid var(--amber)' : '2px solid transparent',
        outlineOffset: 8,
        transition: 'outline-color 0.25s ease',
      }}
    >
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em', textAlign: 'center' }}>
        ROUND {roundNumRef.current} / {roundsRef.current}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>틀린 횟수 {totalMistakes} / {rounds}</span>
        <span style={{ color: isMyTurn ? 'var(--amber)' : 'var(--text-muted)', fontWeight: isMyTurn ? 700 : 400 }}>
          {isMyTurn ? '⚡ 내 차례!' : `${currentPlayerName}의 차례`}
        </span>
        <span style={{ color: myCorrect > 0 ? '#4ade80' : 'var(--text-dim)' }}>내 {myCorrect}정답</span>
      </div>

      <div style={{ position: 'relative', width: 80, height: 80, opacity: isMyTurn && phase === 'playing' ? 1 : 0.2 }}>
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

      {/* Big number with optional red glow background for clap numbers */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {clapHint && (
          <div style={{
            position: 'absolute',
            inset: '-12px -20px',
            borderRadius: 20,
            background: 'rgba(239,68,68,0.08)',
            boxShadow: '0 0 32px 8px rgba(239,68,68,0.18)',
            pointerEvents: 'none',
          }} />
        )}
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
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{currentPlayerName} 기다리는 중...</span>
        )}
        {phase === 'playing' && isMyTurn && (
          <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 700 }}>숫자인가요, 박수인가요?</span>
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

      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onClick={() => handleAnswer(false)}
          disabled={!isMyTurn || phase !== 'playing'}
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
        {/* 박수 button glows red when current number is a clap number */}
        <button
          onClick={() => handleAnswer(true)}
          disabled={!isMyTurn || phase !== 'playing'}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '18px 8px', borderRadius: 16, flex: 1,
            cursor: isMyTurn && phase === 'playing' ? 'pointer' : 'default',
            background: clapHint && isMyTurn && phase === 'playing'
              ? 'rgba(239,68,68,0.10)'
              : 'var(--surface)',
            border: clapHint && isMyTurn && phase === 'playing'
              ? '1px solid rgba(239,68,68,0.5)'
              : '1px solid var(--border)',
            boxShadow: clapHint && isMyTurn && phase === 'playing'
              ? '0 0 14px rgba(239,68,68,0.28)'
              : 'none',
            opacity: isMyTurn && phase === 'playing' ? 1 : 0.35,
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 32 }}>👏</span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: clapHint && isMyTurn && phase === 'playing' ? '#ef4444' : 'var(--text-muted)',
          }}>박수</span>
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
        내 정답 {myCorrect}개 · 틀림 {myMistakes}번
      </div>
    </div>
  )
}

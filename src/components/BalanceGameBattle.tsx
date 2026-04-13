'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALL_QUESTIONS } from './BalanceGame'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  players: { userId: string; name: string }[]
  isHost: boolean
  rounds: number
}

type Phase = 'waiting' | 'voting' | 'reveal'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function BalanceGameBattle({ onComplete, roomCode, userId, players, isHost, rounds }: Props) {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [questions, setQuestions] = useState<typeof ALL_QUESTIONS>([])
  const [questionIdx, setQuestionIdx] = useState(0)
  const [myVote, setMyVote] = useState<'A' | 'B' | null>(null)
  // userId → 'A' | 'B'
  const [voteMap, setVoteMap] = useState<Record<string, 'A' | 'B'>>({})
  const [majorityScore, setMajorityScore] = useState(0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null)
  const voteMapRef = useRef<Record<string, 'A' | 'B'>>({})
  const isHostRef = useRef(isHost)
  const playerCountRef = useRef(players.length)
  const questionsRef = useRef<typeof ALL_QUESTIONS>([])
  const questionIdxRef = useRef(0)
  const majorityScoreRef = useRef(0)
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishedRef = useRef(false)

  isHostRef.current = isHost
  playerCountRef.current = players.length

  function checkReveal() {
    const totalVoted = Object.keys(voteMapRef.current).length
    if (totalVoted >= playerCountRef.current) {
      setPhase('reveal')

      // Update majority score for self
      const vm = voteMapRef.current
      const aCount = Object.values(vm).filter(v => v === 'A').length
      const bCount = Object.values(vm).filter(v => v === 'B').length
      const myV = vm[userId]
      if (myV) {
        const isMajority = (myV === 'A' && aCount >= bCount) || (myV === 'B' && bCount > aCount)
        if (isMajority) {
          majorityScoreRef.current += 1
          setMajorityScore(majorityScoreRef.current)
        }
      }

      // Host schedules next question after 4s
      if (isHostRef.current) {
        nextTimerRef.current = setTimeout(() => {
          const nextIdx = questionIdxRef.current + 1
          if (nextIdx >= questionsRef.current.length) {
            channelRef.current?.send({ type: 'broadcast', event: 'bg_done', payload: {} })
          } else {
            channelRef.current?.send({
              type: 'broadcast',
              event: 'bg_next',
              payload: { questionIdx: nextIdx },
            })
          }
        }, 4000)
      }
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`balance:${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'bg_init' }, ({ payload }) => {
        const qs = payload.questions as typeof ALL_QUESTIONS
        questionsRef.current = qs
        setQuestions(qs)
        voteMapRef.current = {}
        setVoteMap({})
        setMyVote(null)
        questionIdxRef.current = 0
        setQuestionIdx(0)
        setPhase('voting')
      })
      .on('broadcast', { event: 'bg_vote' }, ({ payload }) => {
        const { userId: voterId, vote, questionIdx: voteIdx } = payload as { userId: string; vote: 'A' | 'B'; questionIdx: number }
        if (voteIdx !== questionIdxRef.current) return
        voteMapRef.current = { ...voteMapRef.current, [voterId]: vote }
        setVoteMap({ ...voteMapRef.current })
        checkReveal()
      })
      .on('broadcast', { event: 'bg_next' }, ({ payload }) => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
        const nextIdx = payload.questionIdx as number
        questionIdxRef.current = nextIdx
        setQuestionIdx(nextIdx)
        voteMapRef.current = {}
        setVoteMap({})
        setMyVote(null)
        setPhase('voting')
      })
      .on('broadcast', { event: 'bg_done' }, () => {
        if (finishedRef.current) return
        finishedRef.current = true
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
        const score = Math.round((majorityScoreRef.current / questionsRef.current.length) * 100)
        onComplete(score)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isHostRef.current) {
          // Host sends the shuffled question list to everyone
          const qs = shuffle(ALL_QUESTIONS).slice(0, rounds)
          channel.send({
            type: 'broadcast',
            event: 'bg_init',
            payload: { questions: qs },
          })
        }
      })

    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  function castVote(vote: 'A' | 'B') {
    if (myVote !== null || phase !== 'voting') return
    setMyVote(vote)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'bg_vote',
      payload: { userId, vote, questionIdx: questionIdxRef.current },
    })
  }

  const q = questions[questionIdx]
  const aCount = Object.values(voteMap).filter(v => v === 'A').length
  const bCount = Object.values(voteMap).filter(v => v === 'B').length
  const minority: 'A' | 'B' | 'tie' = aCount < bCount ? 'A' : bCount < aCount ? 'B' : 'tie'

  if (phase === 'waiting' || !q) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 32 }}>⚖️</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>게임 준비 중...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{`
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>

      {/* 진행 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{questionIdx + 1} / {questions.length}</span>
        {phase === 'voting' && <span>{Object.keys(voteMap).length}/{players.length} 투표 완료</span>}
        {phase === 'reveal' && <span style={{ color: '#4ade80' }}>결과 공개</span>}
      </div>
      <div style={{ height: 4, width: '100%', background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--amber)', borderRadius: 99, width: `${(questionIdx / questions.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* 이모지 */}
      <div style={{ fontSize: 40, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>{q.emoji}</div>

      {/* 투표 단계 */}
      {phase === 'voting' && (
        <>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
            {myVote ? '투표 완료! 다른 플레이어 기다리는 중...' : '하나를 선택하세요'}
          </div>

          {(['A', 'B'] as const).map(side => {
            const text = side === 'A' ? q.a : q.b
            const color = side === 'A' ? '#60a5fa' : '#fb923c'
            const voted = myVote === side
            const disabled = myVote !== null

            return (
              <button
                key={side}
                onClick={() => castVote(side)}
                disabled={disabled}
                style={{
                  width: '100%', padding: '20px 16px', borderRadius: 20,
                  border: voted ? `2px solid ${color}` : disabled ? '1px solid var(--border)' : `2px solid ${color}80`,
                  background: voted ? `${color}20` : disabled ? 'var(--surface)' : `${color}08`,
                  cursor: disabled ? 'default' : 'pointer',
                  textAlign: 'left', transition: 'all 0.15s ease',
                  opacity: disabled && !voted ? 0.4 : 1,
                  boxShadow: voted ? `0 0 16px ${color}40` : 'none',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.08em', marginBottom: 6 }}>{side}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
                {voted && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color }}>✓ 내 선택</div>}
              </button>
            )
          })}

          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {Object.keys(voteMap).length}명 투표 · {players.length - Object.keys(voteMap).length}명 대기 중
          </div>
        </>
      )}

      {/* 결과 단계 */}
      {phase === 'reveal' && (
        <>
          {(['A', 'B'] as const).map(side => {
            const count = side === 'A' ? aCount : bCount
            const text = side === 'A' ? q.a : q.b
            const color = side === 'A' ? '#60a5fa' : '#fb923c'
            const isMinority = minority === side
            const isMajority = minority !== 'tie' && minority !== side
            const myChoice = voteMap[userId] === side

            return (
              <div key={side} style={{
                width: '100%', padding: '16px 20px', borderRadius: 20,
                border: isMinority ? '2px solid rgba(255,255,255,0.15)' : isMajority ? `2px solid ${color}` : `1px solid ${color}40`,
                background: isMinority ? 'rgba(255,255,255,0.04)' : isMajority ? `${color}18` : 'var(--surface)',
                boxShadow: isMajority ? `0 0 24px ${color}30` : 'none',
                animation: 'fadeUp 0.35s ease',
                opacity: isMinority ? 0.75 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isMajority ? color : 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>{side}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: isMajority ? 'var(--text)' : 'var(--text-muted)', lineHeight: 1.4 }}>{text}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0, color: isMajority ? color : 'var(--text-dim)' }}>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 44, lineHeight: 1, textShadow: isMajority ? `0 0 15px ${color}60` : 'none' }}>{count}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>명</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {players.filter(p => voteMap[p.userId] === side).map(p => (
                    <span key={p.userId} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: isMajority ? `${color}20` : 'rgba(255,255,255,0.06)',
                      color: isMajority ? color : 'var(--text-dim)',
                      border: p.userId === userId ? `1px solid ${color}` : 'none',
                    }}>{p.name}</span>
                  ))}
                  {isMinority && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginLeft: 4 }}>🍺 벌칙!</span>}
                </div>
                {myChoice && isMajority && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color }}>✓ 다수 의견 (나 포함)</div>
                )}
                {myChoice && isMinority && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#f87171' }}>소수 의견 → 벌칙!</div>
                )}
              </div>
            )
          })}

          {minority === 'tie' && (
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', textAlign: 'center' }}>
              🤝 동점! 모두 벌칙
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
            {questionIdx + 1 < questions.length ? '잠시 후 다음 질문으로...' : '게임 마무리 중...'}
          </div>
        </>
      )}
    </div>
  )
}

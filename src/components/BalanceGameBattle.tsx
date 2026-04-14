'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALL_QUESTIONS } from './BalanceGame'
import { shuffle } from '@/lib/utils'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  players: { userId: string; name: string }[]
  isHost: boolean
  rounds: number
}

type Phase = 'setup' | 'waiting' | 'voting' | 'reveal'

interface CustomQuestion {
  id: string
  emoji: string
  a: string
  b: string
}

export default function BalanceGameBattle({ onComplete, roomCode, userId, players, isHost, rounds }: Props) {
  const [phase, setPhase] = useState<Phase>(isHost ? 'setup' : 'waiting')
  const [questions, setQuestions] = useState<typeof ALL_QUESTIONS>([])
  const [questionIdx, setQuestionIdx] = useState(0)
  const [myVote, setMyVote] = useState<'A' | 'B' | null>(null)
  const [voteMap, setVoteMap] = useState<Record<string, 'A' | 'B'>>({})
  const [majorityScore, setMajorityScore] = useState(0)

  // Setup phase state
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [newEmoji, setNewEmoji] = useState('')
  const [newA, setNewA] = useState('')
  const [newB, setNewB] = useState('')

  const channelRef = useRef<RealtimeChannel | null>(null)
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
      if (isHostRef.current) {
        nextTimerRef.current = setTimeout(() => {
          const nextIdx = questionIdxRef.current + 1
          if (nextIdx >= questionsRef.current.length) {
            channelRef.current?.send({ type: 'broadcast', event: 'bg_done', payload: {} })
          } else {
            channelRef.current?.send({ type: 'broadcast', event: 'bg_next', payload: { questionIdx: nextIdx } })
          }
        }, 4000)
      }
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`balance:${roomCode}`, { config: { broadcast: { self: true } } })
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
      .subscribe()

    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  function castVote(vote: 'A' | 'B') {
    if (myVote !== null || phase !== 'voting') return
    setMyVote(vote)
    channelRef.current?.send({ type: 'broadcast', event: 'bg_vote', payload: { userId, vote, questionIdx: questionIdxRef.current } })
  }

  function addCustomQuestion() {
    const emoji = newEmoji.trim() || '❓'
    const a = newA.trim()
    const b = newB.trim()
    if (!a || !b) return
    setCustomQuestions(prev => [...prev, { id: crypto.randomUUID(), emoji, a, b }])
    setNewEmoji('')
    setNewA('')
    setNewB('')
  }

  function removeCustomQuestion(id: string) {
    setCustomQuestions(prev => prev.filter(cq => cq.id !== id))
  }

  function startGame() {
    const customQs = customQuestions.map(({ emoji, a, b }) => ({ emoji, a, b }))
    const remaining = Math.max(0, rounds - customQs.length)
    const defaultQs = shuffle(ALL_QUESTIONS).slice(0, remaining)
    const qs = [...customQs, ...defaultQs]
    channelRef.current?.send({ type: 'broadcast', event: 'bg_init', payload: { questions: qs } })
  }

  const q = questions[questionIdx]
  const aCount = Object.values(voteMap).filter(v => v === 'A').length
  const bCount = Object.values(voteMap).filter(v => v === 'B').length
  const totalVoted = Object.keys(voteMap).length
  const minority: 'A' | 'B' | 'tie' = aCount < bCount ? 'A' : bCount < aCount ? 'B' : 'tie'

  // Setup phase — host configures the game
  if (phase === 'setup' && isHost) {
    const canAdd = newA.trim().length > 0 && newB.trim().length > 0
    return (
      <div className="flex flex-col gap-4 w-full">
        <style>{`
          @keyframes fadeUp { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        `}</style>

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>⚙️ 게임 설정</div>

        {/* Default questions info */}
        <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(232,137,12,0.08)', border: '1px solid rgba(232,137,12,0.25)', fontSize: 13, color: 'var(--amber)', fontWeight: 600, textAlign: 'center' }}>
          기본 {ALL_QUESTIONS.length}개 문항 중 {Math.max(0, rounds - customQuestions.length)}개 사용
          {customQuestions.length > 0 && ` (커스텀 ${customQuestions.length}개 우선 포함)`}
        </div>

        {/* Custom question input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>커스텀 문항 추가</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              placeholder="😀"
              maxLength={2}
              style={{ width: 52, flexShrink: 0, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 18, textAlign: 'center', outline: 'none' }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={newA}
                onChange={e => setNewA(e.target.value)}
                placeholder="A 선택지"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.06)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
              />
              <input
                value={newB}
                onChange={e => setNewB(e.target.value)}
                placeholder="B 선택지"
                onKeyDown={e => e.key === 'Enter' && addCustomQuestion()}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.06)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
              />
            </div>
          </div>
          <button
            onClick={addCustomQuestion}
            disabled={!canAdd}
            style={{ padding: '9px', borderRadius: 10, border: 'none', background: canAdd ? 'var(--amber)' : 'var(--surface2)', color: canAdd ? '#000' : 'var(--text-dim)', fontWeight: 700, fontSize: 13, cursor: canAdd ? 'pointer' : 'default', transition: 'all 0.15s' }}
          >
            + 추가
          </button>
        </div>

        {/* Custom questions list */}
        {customQuestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>추가된 커스텀 문항 ({customQuestions.length}개)</div>
            {customQuestions.map(cq => (
              <div key={cq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', animation: 'fadeUp 0.2s ease' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{cq.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>A: {cq.a}</div>
                  <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>B: {cq.b}</div>
                </div>
                <button
                  onClick={() => removeCustomQuestion(cq.id)}
                  style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer' }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Start button */}
        <button
          onClick={startGame}
          style={{ marginTop: 4, padding: '14px', borderRadius: 16, border: 'none', background: 'var(--amber)', color: '#000', fontWeight: 800, fontSize: 16, cursor: 'pointer', letterSpacing: '0.02em' }}
        >
          게임 시작 🚀
        </button>
      </div>
    )
  }

  // Waiting / setup (non-host) screen
  if (phase === 'setup' || phase === 'waiting' || !q) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 32 }}>⚖️</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
          {phase === 'setup' || phase === 'waiting' ? '방장이 게임을 설정하는 중...' : '게임 준비 중...'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{`
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>

      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{questionIdx + 1} / {questions.length}</span>
        {phase === 'voting' && <span>{totalVoted}/{players.length} 투표 완료</span>}
        {phase === 'reveal' && <span style={{ color: '#4ade80' }}>결과 공개</span>}
      </div>
      <div style={{ height: 4, width: '100%', background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--amber)', borderRadius: 99, width: `${(questionIdx / questions.length) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', background: 'rgba(232,137,12,0.1)', border: '1px solid rgba(232,137,12,0.3)', borderRadius: 99, padding: '5px 14px', letterSpacing: '0.02em' }}>
        둘 다 싫지만 하나를 고른다면?
      </div>

      <div style={{ fontSize: 40, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>{q.emoji}</div>

      {/* Voting phase */}
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
            const sideCount = side === 'A' ? aCount : bCount

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.08em' }}>{side}</div>
                  {myVote !== null && (
                    <div style={{ fontSize: 12, fontWeight: 700, color, background: `${color}18`, borderRadius: 99, padding: '2px 9px' }}>
                      {sideCount}명
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
                {voted && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color }}>✓ 내 선택</div>}
              </button>
            )
          })}

          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {myVote === null
              ? `${totalVoted}명 투표 · ${players.length - totalVoted}명 대기 중`
              : `A: ${aCount}명  B: ${bCount}명 · ${players.length - totalVoted}명 대기 중`}
          </div>
        </>
      )}

      {/* Reveal phase */}
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
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {players.filter(p => voteMap[p.userId] === side).map(p => (
                    <span key={p.userId} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: isMajority ? `${color}20` : 'rgba(255,255,255,0.06)',
                      color: isMajority ? color : 'var(--text-dim)',
                      border: p.userId === userId ? `1px solid ${color}` : 'none',
                    }}>{p.name}</span>
                  ))}
                  {isMinority && (
                    <span style={{
                      fontSize: 13, fontWeight: 800, padding: '3px 10px', borderRadius: 99,
                      background: 'rgba(248,113,113,0.15)', border: '1.5px solid rgba(248,113,113,0.5)',
                      color: '#f87171', marginLeft: 2,
                    }}>
                      🍺 벌칙!
                    </span>
                  )}
                </div>
                {myChoice && isMajority && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color }}>✓ 다수 의견 (나 포함)</div>
                )}
                {myChoice && isMinority && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#f87171' }}>소수 의견 🍺</div>
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

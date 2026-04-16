'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Q, QUESTION_POOL, POOL_2, POOL_3 } from './choSeongQuestions'
import { shuffle } from '@/lib/utils'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  myName: string
  isHost: boolean
  rounds?: number
  difficulty?: '2글자' | '3글자' | '섞기'
}

const ROUND_COUNT = 4
const ROUND_TIME = 7
const SHOW_DELAY = 3000

type Difficulty = '2글자' | '3글자' | '섞기'

interface AnswerEntry {
  userId: string
  name: string
  word: string
  rank: number
  ts: number
}


export default function ChoSeongBattle({ onComplete, roomCode, userId, myName, isHost, rounds, difficulty: difficultyProp }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>(difficultyProp ?? '섞기')
  const [ready, setReady] = useState(false)
  const [qIdx, setQIdx] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'showing'>('playing')
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState<AnswerEntry[]>([])
  const [totalPoints, setTotalPoints] = useState(0)

  const questionsRef    = useRef<Q[]>([])
  const qIdxRef         = useRef(0)
  const phaseRef        = useRef<'playing' | 'showing'>('playing')
  const submittedRef    = useRef(false)
  const answersRef      = useRef<AnswerEntry[]>([])
  const rankRef         = useRef(0)
  const totalPointsRef  = useRef(0)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef   = useRef(onComplete)
  const channelRef      = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const advanceRef      = useRef<() => void>(() => {})

  onCompleteRef.current = onComplete

  function startGame(questions: Q[]) {
    questionsRef.current = questions
    setReady(true)

    let t = ROUND_TIME
    timerRef.current = setInterval(() => {
      t--
      setTimeLeft(t)
      if (t <= 0) { clearInterval(timerRef.current!); advanceRef.current() }
    }, 1000)
  }

  function submitAnswer() {
    if (submittedRef.current || phaseRef.current !== 'playing') return
    const word = input.trim()
    if (!word) return
    submittedRef.current = true
    setSubmitted(true)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'cs_answer',
      payload: { qIdx: qIdxRef.current, userId, name: myName, word, ts: Date.now() },
    })
  }

  function handleHostStart() {
    const pool =
      difficulty === '2글자' ? POOL_2
      : difficulty === '3글자' ? POOL_3
      : QUESTION_POOL
    const questions = shuffle(pool).slice(0, rounds ?? ROUND_COUNT)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cs_init',
      payload: { questions },
    })
  }

  useEffect(() => {
    function advance() {
      if (phaseRef.current === 'showing') return
      if (timerRef.current) clearInterval(timerRef.current)
      phaseRef.current = 'showing'
      setPhase('showing')

      setTimeout(() => {
        const next = qIdxRef.current + 1

        if (next >= questionsRef.current.length) {
          const max = questionsRef.current.length * 3
          const score = Math.min(100, Math.round((totalPointsRef.current / max) * 100))
          onCompleteRef.current(score)
          return
        }

        qIdxRef.current = next
        setQIdx(next)
        answersRef.current = []
        setAnswers([])
        rankRef.current = 0
        submittedRef.current = false
        setSubmitted(false)
        setInput('')
        phaseRef.current = 'playing'
        setPhase('playing')
        setTimeLeft(ROUND_TIME)

        let t = ROUND_TIME
        timerRef.current = setInterval(() => {
          t--
          setTimeLeft(t)
          if (t <= 0) { clearInterval(timerRef.current!); advanceRef.current() }
        }, 1000)
      }, SHOW_DELAY)
    }
    advanceRef.current = advance

    const supabase = createClient()
    const channel = supabase.channel(`choseong-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'cs_init' }, ({ payload }) => {
        const { questions } = payload as { questions: Q[] }
        startGame(questions)
      })
      .on('broadcast', { event: 'cs_answer' }, ({ payload }) => {
        const { qIdx: pIdx, userId: uid, name, word, ts } = payload as {
          qIdx: number; userId: string; name: string; word: string; ts: number
        }
        if (pIdx !== qIdxRef.current || !word) return

        // 중복 단어는 rank 미증가, 점수 미부여
        const isDuplicate = answersRef.current.some(a => a.word === word)

        let rank = 0  // 0 = 중복 (순위 없음)
        if (!isDuplicate) {
          rankRef.current++
          rank = rankRef.current
          if (uid === userId) {
            const pts = Math.max(0, 4 - rank)
            totalPointsRef.current += pts
            setTotalPoints(totalPointsRef.current)
          }
        }

        const entry: AnswerEntry = { userId: uid, name, word, rank, ts }
        answersRef.current = [...answersRef.current, entry]
        setAnswers([...answersRef.current])
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && isHost) {
          setTimeout(() => handleHostStart(), 1500)
        }
      })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      channel.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>문제 준비 중...</div>
      </div>
    )
  }

  const q = questionsRef.current[qIdx]
  const medals = ['🥇', '🥈', '🥉']
  const isShowing = phase === 'showing'

  // ── Duplicate detection ────────────────────────────────────────
  const wordCounts: Record<string, number> = {}
  for (const a of answers) {
    wordCounts[a.word] = (wordCounts[a.word] ?? 0) + 1
  }

  // ── Most common word stat ──────────────────────────────────────
  let topWord: string | null = null
  let topCount = 0
  for (const [word, count] of Object.entries(wordCounts)) {
    if (count > topCount) { topCount = count; topWord = word }
  }
  const showTopStat = isShowing && topWord !== null && topCount >= 2

  return (
    <div className="flex flex-col gap-4 w-full">
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
          ROUND {qIdx + 1} / {questionsRef.current.length}
        </div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 32, lineHeight: 1,
          color: timeLeft <= 3 ? '#ef4444' : 'var(--amber)',
          textShadow: timeLeft <= 3 ? '0 0 12px rgba(239,68,68,0.6)' : 'none',
          transition: 'color 0.3s',
        }}>
          {isShowing ? '✓' : timeLeft}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
          {totalPoints}점
        </div>
      </div>

      <div style={{
        textAlign: 'center', padding: '12px 0 8px',
        fontFamily: "'Bebas Neue'",
        fontSize: Math.max(48, 72 - (q.pattern.length - 2) * 12),
        color: 'var(--amber)',
        letterSpacing: '0.35em', lineHeight: 1, whiteSpace: 'nowrap',
        textShadow: '0 0 40px rgba(245,158,11,0.45)',
      }}>
        {q.display}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
        {q.pattern.length}글자 · 빠르게 제출할수록 높은 점수!
      </div>

      {!isShowing && !submitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) submitAnswer() }}
            placeholder={`${q.pattern.length}글자 단어 입력…`}
            autoFocus
            maxLength={12}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 14, color: 'var(--text)', fontSize: 16, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onPointerDown={submitAnswer}
            disabled={!input.trim()}
            className="btn-primary"
            style={{ width: '100%', padding: '13px', borderRadius: 14, fontSize: 15 }}
          >
            제출
          </button>
        </div>
      )}

      {!isShowing && submitted && (
        <div style={{
          padding: '12px', borderRadius: 12, textAlign: 'center',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div>제출 완료 ✓ — 다른 플레이어 기다리는 중...</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            남은 시간: {timeLeft}초
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        실시간 현황 ({answers.length}명 제출)
      </div>

      <div className="flex flex-col gap-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
        {answers.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-dim)', padding: '12px 0' }}>
            아직 제출 없음...
          </div>
        )}
        {answers.map((a) => {
          const isDuplicate = wordCounts[a.word] >= 2
          return (
            <div
              key={`${a.userId}-${a.ts}`}
              className="glass p-3"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                border: a.userId === userId ? '1px solid var(--amber)' : '1px solid var(--border)',
                animation: 'slideIn 0.2s ease',
              }}
            >
              <span style={{ fontSize: 22, width: 34, textAlign: 'center', flexShrink: 0 }}>
                {a.rank === 0 ? '—' : (medals[a.rank - 1] ?? `${a.rank}위`)}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: a.userId === userId ? 700 : 400 }}>
                {a.name}{a.userId === userId ? ' (나)' : ''}
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--amber)' }}>{a.word}</span>
              {isDuplicate && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px',
                  borderRadius: 6, background: 'rgba(245,158,11,0.18)',
                  color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.4)',
                  flexShrink: 0,
                }}>
                  💬 중복
                </span>
              )}
            </div>
          )
        })}
      </div>

      {showTopStat && (
        <div style={{
          textAlign: 'center', fontSize: 13, color: 'var(--text-muted)',
          padding: '6px 10px', borderRadius: 10,
          background: 'var(--surface2)', border: '1px solid var(--border)',
        }}>
          🏆 최다 답변: &lsquo;{topWord}&rsquo; ({topCount}명)
        </div>
      )}

      {isShowing && (
        <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--amber)', fontWeight: 600, padding: '4px 0' }}>
          {qIdx + 1 < questionsRef.current.length ? '잠시 후 다음 문제...' : '최종 집계 중...'}
        </div>
      )}
    </div>
  )
}

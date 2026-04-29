'use client'

import { useState, useRef, useCallback } from 'react'
import { shuffle } from '@/lib/utils'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 5
const TIME_LIMIT = 2.5

const ALL_QUESTIONS = [
  { country: '호주', capital: '캔버라', wrong: ['시드니', '멜버른', '브리즈번'] },
  { country: '캐나다', capital: '오타와', wrong: ['토론토', '밴쿠버', '몬트리올'] },
  { country: '브라질', capital: '브라질리아', wrong: ['상파울루', '리우데자네이루', '살바도르'] },
  { country: '터키', capital: '앙카라', wrong: ['이스탄불', '이즈미르', '부르사'] },
  { country: '스위스', capital: '베른', wrong: ['취리히', '제네바', '바젤'] },
  { country: '남아프리카공화국', capital: '프리토리아', wrong: ['케이프타운', '요하네스버그', '더반'] },
  { country: '뉴질랜드', capital: '웰링턴', wrong: ['오클랜드', '크라이스트처치', '해밀턴'] },
  { country: '카자흐스탄', capital: '아스타나', wrong: ['알마티', '샴켄트', '카라간다'] },
  { country: '미얀마', capital: '네피도', wrong: ['양곤', '만달레이', '바고'] },
  { country: '파키스탄', capital: '이슬라마바드', wrong: ['카라치', '라호르', '페샤와르'] },
  { country: '나이지리아', capital: '아부자', wrong: ['라고스', '카노', '이바단'] },
  { country: '모로코', capital: '라바트', wrong: ['카사블랑카', '마라케시', '페스'] },
  { country: '말레이시아', capital: '쿠알라룸푸르', wrong: ['페낭', '조호르바루', '코타키나발루'] },
  { country: '필리핀', capital: '마닐라', wrong: ['세부', '다바오', '퀘존시티'] },
  { country: '인도네시아', capital: '자카르타', wrong: ['수라바야', '반둥', '메단'] },
  { country: '우크라이나', capital: '키이우', wrong: ['하르키우', '오데사', '리비우'] },
  { country: '체코', capital: '프라하', wrong: ['브르노', '오스트라바', '플젠'] },
  { country: '헝가리', capital: '부다페스트', wrong: ['데브레첸', '미슈콜츠', '페치'] },
  { country: '루마니아', capital: '부쿠레슈티', wrong: ['클루지나포카', '티미쇼아라', '이아시'] },
  { country: '콜롬비아', capital: '보고타', wrong: ['메데진', '칼리', '바랑키야'] },
  { country: '베네수엘라', capital: '카라카스', wrong: ['마라카이보', '발렌시아', '바르키시메토'] },
  { country: '페루', capital: '리마', wrong: ['아레키파', '트루히요', '쿠스코'] },
  { country: '케냐', capital: '나이로비', wrong: ['몸바사', '키수무', '나쿠루'] },
  { country: '에티오피아', capital: '아디스아바바', wrong: ['디레다와', '곤다르', '메켈레'] },
  { country: '탄자니아', capital: '도도마', wrong: ['다르에스살람', '잔지바르', '아루샤'] },
]


function pickQuestions(n: number) {
  return shuffle(ALL_QUESTIONS).slice(0, n).map(q => ({
    country: q.country,
    capital: q.capital,
    options: shuffle([q.capital, ...q.wrong.slice(0, 3)]),
  }))
}

type Phase = 'intro' | 'playing' | 'feedback' | 'result'

export default function CapitalQuizTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [questions] = useState(() => pickQuestions(ROUNDS))
  const [round, setRound] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [selected, setSelected] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | 'timeout' | null>(null)
  const [correct, setCorrect] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const correctRef = useRef(0)
  const timesRef = useRef<number[]>([])
  const roundStartRef = useRef(0)
  const roundRef = useRef(0)
  const isPracticeRef = useRef(false)

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const accuracy = (correctRef.current / ROUNDS) * 100
    const avgTime = timesRef.current.length > 0
      ? timesRef.current.reduce((a, b) => a + b, 0) / timesRef.current.length
      : TIME_LIMIT * 1000
    const speedBonus = Math.max(0, ((TIME_LIMIT * 1000 - avgTime) / (TIME_LIMIT * 1000)) * 30)
    const score = Math.min(100, Math.round(accuracy * 0.7 + speedBonus))
    setPhase('result')
    if (!isPracticeRef.current) setTimeout(() => onComplete(score), 1500)
  }, [onComplete])

  const startRound = useCallback((roundNum: number) => {
    if (isPracticeRef.current && roundNum >= 1) { finishGame(); return }
    if (roundNum >= ROUNDS) { finishGame(); return }
    roundRef.current = roundNum
    setSelected(null)
    setLastResult(null)
    setTimeLeft(TIME_LIMIT)
    setRound(roundNum)
    roundStartRef.current = Date.now()
    setPhase('playing')

    if (timerRef.current) clearInterval(timerRef.current)
    let t = TIME_LIMIT
    timerRef.current = setInterval(() => {
      t -= 0.1
      setTimeLeft(Math.max(0, t))
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setLastResult('timeout')
        setPhase('feedback')
        setTimeout(() => startRound(roundRef.current + 1), 1200)
      }
    }, 100)
  }, [finishGame])

  function handleSelect(option: string) {
    if (phase !== 'playing') return
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsed = Date.now() - roundStartRef.current
    const isCorrect = option === questions[round].capital
    setSelected(option)
    if (isCorrect) {
      correctRef.current += 1
      setCorrect(c => c + 1)
      timesRef.current.push(elapsed)
      setLastResult('correct')
    } else {
      setLastResult('wrong')
    }
    setPhase('feedback')
    setTimeout(() => startRound(roundRef.current + 1), 1200)
  }

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🌍</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>수도 맞추기</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            나라 이름을 보고<br />
            <strong style={{ color: '#f0f0f0' }}>수도</strong>를 선택하세요
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>제한시간 {TIME_LIMIT}초 · {ROUNDS}문제</div>
        <button className="btn-secondary" style={{ marginBottom: 0 }} onClick={() => {
          isPracticeRef.current = true
          startRound(0)
        }}>연습하기</button>
        <button className="btn-primary" onClick={() => { isPracticeRef.current = false; startRound(0) }}>시작하기</button>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>테스트 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {correctRef.current}<span style={{ fontSize: 32 }}>/{ROUNDS}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>정답률 {Math.round(correctRef.current / ROUNDS * 100)}%</div>
        {isPracticeRef.current
          ? <button className="btn-secondary" onClick={() => { isPracticeRef.current = false; setPhase('intro') }}>돌아가기</button>
          : <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
        }
      </div>
    )
  }

  // ── playing / feedback ──
  const q = questions[round]
  const feedbackColor = lastResult === 'correct' ? '#4ade80' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span style={{ color: correct > 0 ? '#4ade80' : 'var(--text-dim)' }}>{correct} 정답</span>
      </div>

      {/* 타이머 바 */}
      <div style={{ width: '100%', height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(timeLeft / TIME_LIMIT) * 100}%`,
          background: phase === 'feedback' ? feedbackColor : timeLeft > 1 ? 'var(--amber)' : '#ef4444',
          borderRadius: 99,
          transition: 'width 0.1s linear, background 0.2s ease',
          boxShadow: `0 0 8px ${phase === 'feedback' ? feedbackColor + '80' : 'var(--amber-glow)'}`,
        }} />
      </div>

      {/* 나라 이름 */}
      <div className="glass p-6 w-full text-center">
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>수도는 어디일까요?</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text)' }}>{q.country}</div>
      </div>

      {/* 선택지 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
        {q.options.map((opt) => {
          const isSelected = selected === opt
          const isCorrect = opt === q.capital
          let bg = 'var(--surface)'
          let border = '1px solid var(--border)'
          let color = 'var(--text)'
          let shadow = 'none'
          if (phase === 'feedback') {
            if (isCorrect) { bg = 'rgba(74,222,128,0.12)'; border = '2px solid #4ade80'; color = '#4ade80'; shadow = '0 0 14px rgba(74,222,128,0.25)' }
            else if (isSelected) { bg = 'rgba(239,68,68,0.12)'; border = '2px solid #ef4444'; color = '#ef4444'; shadow = '0 0 14px rgba(239,68,68,0.25)' }
          }
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={phase === 'feedback'}
              style={{
                padding: '16px 10px', borderRadius: 16, background: bg, border, color,
                fontSize: 14, fontWeight: 600, cursor: phase === 'playing' ? 'pointer' : 'default',
                transition: 'all 0.15s ease', textAlign: 'center', minHeight: 56, boxShadow: shadow,
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>

      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {phase === 'feedback' && (
          <span style={{ fontSize: 14, fontWeight: 700, color: feedbackColor }}>
            {lastResult === 'correct'
              ? '✓ 정답!'
              : lastResult === 'timeout'
              ? <span>⏱ 시간 초과 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>정답: {q.capital}</span></span>
              : <span>✗ 오답 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>정답: {q.capital}</span></span>
            }
          </span>
        )}
      </div>
    </div>
  )
}

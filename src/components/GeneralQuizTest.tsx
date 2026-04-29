'use client'

import { useState, useRef, useCallback } from 'react'
import { shuffle } from '@/lib/utils'

interface Props {
  onComplete: (score: number) => void
}

const ROUNDS = 5
const TIME_LIMIT = 3.5

const ALL_QUESTIONS = [
  { q: '태양계에서 가장 큰 행성은?', a: '목성', wrong: ['토성', '천왕성', '해왕성'] },
  { q: '인체에서 가장 큰 장기는?', a: '간', wrong: ['심장', '폐', '위'] },
  { q: '피카소의 국적은?', a: '스페인', wrong: ['프랑스', '이탈리아', '포르투갈'] },
  { q: '빛의 속도는 약 몇 km/s?', a: '30만 km/s', wrong: ['3만 km/s', '300만 km/s', '3000만 km/s'] },
  { q: '원소 주기율표에서 금의 원소 기호는?', a: 'Au', wrong: ['Ag', 'Fe', 'Cu'] },
  { q: '한국의 국보 1호는?', a: '숭례문', wrong: ['불국사', '첨성대', '경복궁'] },
  { q: '세계에서 가장 긴 강은?', a: '나일강', wrong: ['아마존강', '양쯔강', '미시시피강'] },
  { q: '셰익스피어의 작품이 아닌 것은?', a: '레미제라블', wrong: ['햄릿', '오셀로', '로미오와 줄리엣'] },
  { q: '물의 화학식은?', a: 'H₂O', wrong: ['CO₂', 'NaCl', 'O₂'] },
  { q: '올림픽은 몇 년마다 열리나요?', a: '4년', wrong: ['2년', '3년', '5년'] },
  { q: '지구에서 달까지 빛이 도달하는 시간은?', a: '약 1.3초', wrong: ['약 8분', '약 4초', '약 30초'] },
  { q: '뉴턴이 정립한 운동 법칙은 총 몇 가지?', a: '3가지', wrong: ['2가지', '4가지', '5가지'] },
  { q: '성인 인간의 뼈는 총 몇 개?', a: '206개', wrong: ['186개', '226개', '246개'] },
  { q: '세계에서 가장 높은 산은?', a: '에베레스트', wrong: ['K2', '칸첸중가', '로체'] },
  { q: '모나리자를 그린 화가는?', a: '레오나르도 다빈치', wrong: ['미켈란젤로', '라파엘로', '보티첼리'] },
  { q: '지구에서 가장 깊은 해구는?', a: '마리아나 해구', wrong: ['필리핀 해구', '통가 해구', '남샌드위치 해구'] },
  { q: '한국 최초의 우주인은?', a: '이소연', wrong: ['유호준', '고산', '김연아'] },
  { q: '소설 "어린 왕자"의 작가는?', a: '생텍쥐페리', wrong: ['카뮈', '사르트르', '플로베르'] },
  { q: '인류 최초로 달을 밟은 사람은?', a: '닐 암스트롱', wrong: ['버즈 올드린', '존 글렌', '유리 가가린'] },
  { q: '대한민국 헌법 제1조 1항: 대한민국은 ___이다?', a: '민주공화국', wrong: ['연방공화국', '입헌군주국', '사회주의국가'] },
]


function pickQuestions(n: number) {
  return shuffle(ALL_QUESTIONS).slice(0, n).map(q => ({
    q: q.q,
    a: q.a,
    options: shuffle([q.a, ...q.wrong.slice(0, 3)]),
  }))
}

type Phase = 'intro' | 'playing' | 'feedback' | 'result'

export default function GeneralQuizTest({ onComplete }: Props) {
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
    const speedBonus = Math.max(0, ((TIME_LIMIT * 1000 - avgTime) / (TIME_LIMIT * 1000)) * 20)
    const score = Math.min(100, Math.round(accuracy * 0.8 + speedBonus))
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
        setTimeout(() => startRound(roundRef.current + 1), 1500)
      }
    }, 100)
  }, [finishGame])

  function handleSelect(option: string) {
    if (phase !== 'playing') return
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsed = Date.now() - roundStartRef.current
    const isCorrect = option === questions[round].a
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
    setTimeout(() => startRound(roundRef.current + 1), 1500)
  }

  // ── intro ──
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🧠</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>상식 퀴즈</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            다양한 상식 문제를 풀어보세요<br />
            <strong style={{ color: '#f0f0f0' }}>취하면 아는 것도 헷갈립니다</strong>
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
    <div className="flex flex-col items-center gap-5 w-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{round + 1} / {ROUNDS}</span>
        <span style={{ color: correct > 0 ? '#4ade80' : 'var(--text-dim)' }}>{correct} 정답</span>
      </div>

      {/* 타이머 바 */}
      <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(timeLeft / TIME_LIMIT) * 100}%`,
          background: timeLeft > 1.5 ? 'var(--amber)' : '#ef4444',
          borderRadius: 99,
          transition: 'width 0.1s linear, background 0.3s ease',
          boxShadow: `0 0 8px ${timeLeft > 5 ? 'var(--amber-glow)' : 'rgba(239,68,68,0.4)'}`,
        }} />
      </div>

      {/* 문제 */}
      <div className="glass p-5 w-full text-center" style={{ minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.6 }}>{q.q}</div>
      </div>

      {/* 선택지 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
        {q.options.map((opt) => {
          const isSelected = selected === opt
          const isCorrect = opt === q.a
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
                padding: '14px 10px', borderRadius: 14, background: bg, border, color,
                fontSize: 13, fontWeight: 600, cursor: phase === 'playing' ? 'pointer' : 'default',
                transition: 'all 0.15s ease', textAlign: 'center', minHeight: 56, boxShadow: shadow,
                lineHeight: 1.4,
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
              ? <span>⏱ 시간 초과 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({q.a})</span></span>
              : <span>✗ 오답 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>정답: {q.a}</span></span>
            }
          </span>
        )}
      </div>
    </div>
  )
}

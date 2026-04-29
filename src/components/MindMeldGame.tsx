'use client'

import { useState, useRef, useEffect } from 'react'
import { shuffle } from '@/lib/utils'

interface Props { onComplete: (score: number) => void }

interface Topic { text: string; emoji: string }

const ALL_TOPICS: Topic[] = [
  // ── 음식 & 야식 ──
  { emoji: '🍗', text: '야식으로 최고인 음식은?' },
  { emoji: '🍿', text: '편의점 최애 과자는?' },
  { emoji: '🍶', text: '소주 안주 최고는?' },
  { emoji: '🌙', text: '새벽 3시에 먹고 싶은 것은?' },
  { emoji: '🍜', text: '라면 하면 떠오르는 브랜드는?' },
  { emoji: '🍕', text: '피자 토핑 하면 떠오르는 것은?' },
  { emoji: '🥞', text: '아침밥 하면 떠오르는 음식은?' },
  { emoji: '🍱', text: '도시락 반찬 하면 떠오르는 것은?' },
  { emoji: '🧃', text: '학교 앞 분식 하면 떠오르는 것은?' },
  { emoji: '🍦', text: '여름 하면 떠오르는 아이스크림은?' },
  { emoji: '☕', text: '카페 음료 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🍺', text: '맥주 안주 최고는?' },
  { emoji: '🥐', text: '빵집 하면 제일 먼저 떠오르는 빵은?' },
  { emoji: '🍣', text: '회식 메뉴로 최고는?' },
  { emoji: '🌮', text: '외국 음식 하면 제일 먼저 떠오르는 것은?' },

  // ── 브랜드 & 문화 ──
  { emoji: '🐔', text: '치킨 브랜드 하면?' },
  { emoji: '👟', text: '운동화 브랜드 하면?' },
  { emoji: '🎮', text: '어렸을 때 즐겨하던 게임은?' },
  { emoji: '📱', text: '스마트폰 하면 제일 먼저 떠오르는 브랜드는?' },
  { emoji: '🏪', text: '편의점 하면 제일 먼저 떠오르는 브랜드는?' },
  { emoji: '🎵', text: '노래방 하면 제일 먼저 떠오르는 노래는?' },
  { emoji: '🍔', text: '패스트푸드 하면 떠오르는 것은?' },
  { emoji: '🎤', text: '한국 가수 하면 제일 먼저 떠오르는 이름은?' },
  { emoji: '🏢', text: '대기업 하면 제일 먼저 떠오르는 회사는?' },
  { emoji: '👗', text: '옷 브랜드 하면 제일 먼저 떠오르는 것은?' },

  // ── 계절 & 자연 ──
  { emoji: '☀️', text: '여름 하면?' },
  { emoji: '❄️', text: '겨울 하면?' },
  { emoji: '🌸', text: '봄 하면?' },
  { emoji: '🍂', text: '가을 하면?' },
  { emoji: '🌊', text: '바다 하면 떠오르는 것은?' },
  { emoji: '⛰️', text: '산 하면 떠오르는 것은?' },
  { emoji: '🌅', text: '일출 하면 떠오르는 장소는?' },
  { emoji: '🌙', text: '밤하늘 하면 떠오르는 것은?' },
  { emoji: '🌈', text: '무지개 하면 떠오르는 것은?' },
  { emoji: '🌺', text: '꽃 하면 제일 먼저 떠오르는 것은?' },

  // ── 감정 & 상황 ──
  { emoji: '😤', text: '스트레스 풀리는 방법은?' },
  { emoji: '💰', text: '로또 당첨되면 제일 먼저 할 것은?' },
  { emoji: '❤️', text: '지금 가장 보고 싶은 사람 유형은?' },
  { emoji: '👻', text: '무서운 것 하면?' },
  { emoji: '😂', text: '배꼽 잡고 웃긴 상황 하면?' },
  { emoji: '🥺', text: '눈물 나는 순간 하면?' },
  { emoji: '😍', text: '한눈에 반했던 사람의 특징은?' },
  { emoji: '🤢', text: '음식 중 제일 먹기 싫은 것은?' },
  { emoji: '😎', text: '멋있어 보이는 직업 하면?' },
  { emoji: '🤯', text: '살면서 제일 놀랐던 순간 유형은?' },

  // ── 여행 & 장소 ──
  { emoji: '✈️', text: '죽기 전에 꼭 가봐야 할 나라는?' },
  { emoji: '🏠', text: '살고 싶은 동네는?' },
  { emoji: '🌍', text: '유럽 하면 제일 먼저 떠오르는 나라는?' },
  { emoji: '🗼', text: '해외여행 하면 제일 먼저 떠오르는 도시는?' },
  { emoji: '🏝️', text: '힐링 여행 하면 떠오르는 장소는?' },
  { emoji: '🎡', text: '놀이공원 하면 제일 먼저 떠오르는 놀이기구는?' },
  { emoji: '🏟️', text: '스포츠 경기장 하면 떠오르는 종목은?' },
  { emoji: '🏫', text: '학교 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🚇', text: '지하철 하면 떠오르는 이미지는?' },
  { emoji: '🌃', text: '야경 명소 하면 떠오르는 곳은?' },

  // ── 동물 & 자연 ──
  { emoji: '🐶', text: '강아지 이름 하면?' },
  { emoji: '🐱', text: '고양이 이름 하면?' },
  { emoji: '🦁', text: '동물원 하면 제일 먼저 보러 가는 동물은?' },
  { emoji: '🐬', text: '바다 동물 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🦋', text: '곤충 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🐻', text: '귀여운 동물 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🦊', text: '영리한 동물 하면 떠오르는 것은?' },
  { emoji: '🐧', text: '추운 나라 동물 하면?' },
  { emoji: '🦅', text: '새 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🐙', text: '이상하게 생긴 동물 하면?' },

  // ── 엔터테인먼트 ──
  { emoji: '🎬', text: '인생 영화는?' },
  { emoji: '📚', text: '인생 책 또는 웹툰은?' },
  { emoji: '⭐', text: '요즘 가장 인기 있는 아이돌은?' },
  { emoji: '🎂', text: '케이크 맛은?' },
  { emoji: '🎲', text: '보드게임 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🎭', text: '뮤지컬 하면 제일 먼저 떠오르는 작품은?' },
  { emoji: '📺', text: '최근에 본 드라마/예능 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🎸', text: '악기 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🖼️', text: '미술 하면 제일 먼저 떠오르는 화가나 작품은?' },
  { emoji: '🃏', text: '카드 게임 하면 제일 먼저 떠오르는 것은?' },

  // ── 학교 & 일상 ──
  { emoji: '📝', text: '시험 하면 제일 먼저 떠오르는 과목은?' },
  { emoji: '🏃', text: '체육 시간 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🎒', text: '소풍 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🥗', text: '급식 하면 제일 먼저 떠오르는 메뉴는?' },
  { emoji: '🖊️', text: '필기구 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '⏰', text: '알람 소리 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🚿', text: '아침 루틴 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🛒', text: '마트 하면 제일 먼저 가는 코너는?' },
  { emoji: '💊', text: '약 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🧴', text: '화장품 하면 제일 먼저 떠오르는 것은?' },

  // ── 색 & 숫자 연상 ──
  { emoji: '🔴', text: '빨간색 하면 떠오르는 것은?' },
  { emoji: '🔵', text: '파란색 하면 떠오르는 것은?' },
  { emoji: '🟡', text: '노란색 하면 떠오르는 것은?' },
  { emoji: '🟢', text: '초록색 하면 떠오르는 것은?' },
  { emoji: '⚫', text: '검은색 하면 떠오르는 것은?' },
  { emoji: '⚪', text: '하얀색 하면 떠오르는 것은?' },
  { emoji: '🔢', text: '숫자 7 하면 떠오르는 것은?' },
  { emoji: '💯', text: '숫자 100 하면 떠오르는 것은?' },
  { emoji: '🔟', text: '숫자 1 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🎯', text: '숫자 3 하면 떠오르는 것은?' },

  // ── 직업 & 꿈 ──
  { emoji: '💪', text: '가장 힘든 운동은?' },
  { emoji: '🇰🇷', text: '한국 대표 음식 하면?' },
  { emoji: '👨‍🍳', text: '요리사 하면 제일 먼저 떠오르는 음식은?' },
  { emoji: '👮', text: '경찰 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '👨‍⚕️', text: '의사 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🚀', text: '우주 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '⚽', text: '스포츠 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🎓', text: '졸업 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '💼', text: '직장인 하면 제일 먼저 떠오르는 것은?' },
  { emoji: '🏆', text: '상 하면 제일 먼저 떠오르는 것은?' },
]


const ROUNDS = 8
type Phase = 'intro' | 'topic' | 'countdown' | 'p1_input' | 'p2_input' | 'reveal' | 'result'

export default function MindMeldGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [topics, setTopics] = useState<Topic[]>([])
  const [roundIdx, setRoundIdx] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [p1Answer, setP1Answer] = useState('')
  const [p2Answer, setP2Answer] = useState('')
  const [matchCount, setMatchCount] = useState(0)

  const matchRef = useRef(0)
  const p1InputRef = useRef<HTMLInputElement>(null)
  const p2InputRef = useRef<HTMLInputElement>(null)

  function startGame() {
    const picked = shuffle(ALL_TOPICS).slice(0, ROUNDS)
    setTopics(picked)
    setRoundIdx(0)
    setMatchCount(0)
    matchRef.current = 0
    setPhase('topic')
  }

  function startCountdown() {
    setPhase('countdown')
    setCountdown(3)
    let c = 3
    const t = setInterval(() => {
      c--
      setCountdown(c)
      if (c === 0) {
        clearInterval(t)
        setP1Answer('')
        setP2Answer('')
        setPhase('p1_input')
        setTimeout(() => p1InputRef.current?.focus(), 100)
      }
    }, 1000)
  }

  function submitP1() {
    if (!p1Answer.trim()) return
    setPhase('p2_input')
    setTimeout(() => p2InputRef.current?.focus(), 100)
  }

  function submitP2() {
    if (!p2Answer.trim()) return
    setPhase('reveal')
  }

  function judgeMatch(matched: boolean) {
    if (matched) {
      matchRef.current++
      setMatchCount(m => m + 1)
    }
    const next = roundIdx + 1
    if (next >= ROUNDS) {
      const score = Math.round((matchRef.current / ROUNDS) * 100)
      setPhase('result')
      setTimeout(() => onComplete(score), 1500)
    } else {
      setRoundIdx(next)
      setPhase('topic')
    }
  }

  const topic = topics[roundIdx]

  // ── intro ──
  if (phase === 'intro') return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      <div>
        <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🧠</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em', background: 'linear-gradient(135deg, var(--amber), #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          이심전심
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
          주제를 보고 <strong style={{ color: 'var(--text)' }}>동시에 같은 단어</strong>를 말하면 성공!<br />
          두 명씩 번갈아 도전하세요
        </p>
      </div>
      <div className="glass p-4 w-full flex flex-col gap-3">
        {[
          ['1', '주제를 함께 확인'],
          ['2', '카운트다운에 맞춰 동시에 말하기'],
          ['3', '각자 입력 후 결과 확인'],
        ].map(([n, text]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 99, background: 'var(--amber)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>{n}</div>
            <span style={{ color: 'var(--text-muted)' }}>{text}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROUNDS}라운드</div>
      <button className="btn-primary" onClick={startGame}>시작하기</button>
    </div>
  )

  // ── topic ──
  if (phase === 'topic' && topic) return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      <style>{`@keyframes popIn { from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{roundIdx + 1} / {ROUNDS}</span>
        <span style={{ color: matchCount > 0 ? '#4ade80' : 'var(--text-dim)' }}>{matchCount} 일치</span>
      </div>
      <div style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)', fontSize: 72, lineHeight: 1 }}>{topic.emoji}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.4,
        textAlign: 'center', padding: '0 8px',
      }}>{topic.text}</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        주제를 함께 확인하고<br />카운트다운에 맞춰 동시에 말하세요!
      </p>
      <button className="btn-primary" onClick={startCountdown}>준비됐어요!</button>
    </div>
  )

  // ── countdown ──
  if (phase === 'countdown') return (
    <div className="flex flex-col items-center gap-6 text-center">
      <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      <div style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 600 }}>{topic?.text}</div>
      <div style={{
        fontFamily: "'Bebas Neue'",
        fontSize: countdown === 0 ? 72 : 120,
        lineHeight: 1,
        color: countdown === 0 ? '#4ade80' : 'var(--amber)',
        textShadow: countdown === 0 ? '0 0 40px rgba(74,222,128,0.7)' : '0 0 40px rgba(245,158,11,0.6)',
        animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        letterSpacing: countdown === 0 ? '0.02em' : '0',
      }}>
        {countdown === 0 ? '말해!' : countdown}
      </div>
    </div>
  )

  // ── p1_input ──
  if (phase === 'p1_input' && topic) return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div style={{ fontSize: 36 }}>{topic.emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{topic.text}</div>
      <div className="glass p-4 w-full flex flex-col gap-4">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          플레이어 1번 — 방금 뭐라고 했나요?
        </div>
        <input
          ref={p1InputRef}
          value={p1Answer}
          onChange={e => setP1Answer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitP1()}
          placeholder="입력하세요..."
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            fontSize: 18, fontWeight: 700, color: 'var(--text)',
            textAlign: 'center', outline: 'none',
          }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>플레이어 2번은 보지 마세요 👀</p>
      </div>
      <button className="btn-primary" onClick={submitP1} disabled={!p1Answer.trim()}
        style={{ opacity: p1Answer.trim() ? 1 : 0.4 }}>
        확인 → 플레이어 2번
      </button>
    </div>
  )

  // ── p2_input ──
  if (phase === 'p2_input' && topic) return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div style={{ fontSize: 36 }}>{topic.emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{topic.text}</div>
      <div className="glass p-4 w-full flex flex-col gap-4">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          플레이어 2번 — 방금 뭐라고 했나요?
        </div>
        <input
          ref={p2InputRef}
          value={p2Answer}
          onChange={e => setP2Answer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitP2()}
          placeholder="입력하세요..."
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            fontSize: 18, fontWeight: 700, color: 'var(--text)',
            textAlign: 'center', outline: 'none',
          }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>플레이어 1번 입력 완료 ✓</p>
      </div>
      <button className="btn-primary" onClick={submitP2} disabled={!p2Answer.trim()}
        style={{ opacity: p2Answer.trim() ? 1 : 0.4 }}>
        결과 공개
      </button>
    </div>
  )

  // ── reveal ──
  if (phase === 'reveal' && topic) {
    const normalizedP1 = p1Answer.trim().toLowerCase()
    const normalizedP2 = p2Answer.trim().toLowerCase()
    const autoMatch = normalizedP1 === normalizedP2

    return (
      <div className="flex flex-col items-center gap-5 text-center w-full">
        <style>{`
          @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
          <span>{roundIdx + 1} / {ROUNDS}</span>
          <span style={{ color: matchCount > 0 ? '#4ade80' : 'var(--text-dim)' }}>{matchCount} 일치</span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>{topic.text}</div>

        {/* 두 답변 */}
        <div style={{ display: 'flex', gap: 12, width: '100%', animation: 'fadeUp 0.35s ease' }}>
          {[{ label: 'P1', answer: p1Answer, color: '#60a5fa' }, { label: 'P2', answer: p2Answer, color: '#fb923c' }].map(({ label, answer, color }) => (
            <div key={label} style={{
              flex: 1, padding: '16px 12px', borderRadius: 20,
              border: `2px solid ${color}60`, background: `${color}10`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.06em' }}>{label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>{answer}</span>
            </div>
          ))}
        </div>

        {/* 자동 일치 감지 */}
        {autoMatch && (
          <div style={{
            fontSize: 32, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            color: '#4ade80', fontWeight: 800,
          }}>
            🎉 자동 일치!
          </div>
        )}

        {/* 직접 판정 */}
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {autoMatch ? '축하합니다! 완벽히 일치했어요.' : '말한 단어가 같았나요?'}
        </p>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button onClick={() => judgeMatch(true)} style={{
            flex: 1, padding: '16px', borderRadius: 16, cursor: 'pointer',
            border: '2px solid #4ade80', background: 'rgba(74,222,128,0.1)',
            fontSize: 15, fontWeight: 700, color: '#4ade80',
            transition: 'all 0.15s ease',
          }}>🎉 일치!</button>
          <button onClick={() => judgeMatch(false)} style={{
            flex: 1, padding: '16px', borderRadius: 16, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 15, fontWeight: 700, color: 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}>❌ 불일치</button>
        </div>
      </div>
    )
  }

  // ── result ──
  if (phase === 'result') {
    const pct = Math.round((matchRef.current / ROUNDS) * 100)
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>게임 완료</div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {matchRef.current}<span style={{ fontSize: 32 }}>/{ROUNDS}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>일치율 {pct}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>결과 저장 중...</div>
      </div>
    )
  }

  return null
}

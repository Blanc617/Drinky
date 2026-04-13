'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  onComplete: (score: number) => void
}

type Phase = 'setup' | 'deal' | 'discuss' | 'reveal'
type DealState = 'waiting' | 'revealed'

const CATEGORIES: Record<string, string[]> = {
  '🍖 음식': [
    '삼겹살', '피자', '라면', '떡볶이', '치킨', '삼계탕', '짜장면', '냉면', '된장찌개', '불고기',
    '순대', '김밥', '비빔밥', '갈비', '보쌈', '족발', '파전', '닭발', '감자탕', '순두부찌개',
    '곱창', '마라탕', '샤브샤브', '초밥', '타코야키',
  ],
  '🍺 음료': [
    '소주', '맥주', '커피', '콜라', '막걸리', '와인', '에너지드링크', '아이스티', '사이다', '보드카',
    '위스키', '복숭아 아이스티', '레모네이드', '버블티', '우유', '오렌지주스', '녹차', '홍차', '아메리카노', '라떼',
    '탄산수', '이온음료', '식혜', '수정과', '매실차',
  ],
  '📍 장소': [
    '카페', '노래방', '영화관', '도서관', '헬스장', '편의점', '해변', '놀이공원', '지하철역', '공항',
    '백화점', '찜질방', '야구장', '캠핑장', '수영장', '동물원', '스키장', '워터파크', '마트', '공원',
    '독서실', '피시방', '찜닭집', '고깃집', '술집',
  ],
  '🐾 동물': [
    '강아지', '고양이', '사자', '토끼', '펭귄', '코끼리', '기린', '상어', '악어', '원숭이',
    '판다', '북극곰', '늑대', '여우', '다람쥐', '수달', '고릴라', '돌고래', '문어', '앵무새',
    '카멜레온', '치타', '하마', '코알라', '플라밍고',
  ],
  '💼 직업': [
    '의사', '요리사', '선생님', '경찰관', '유튜버', '소방관', '변호사', '프로게이머', '아이돌', '배달부',
    '파일럿', '간호사', '작가', '디자이너', '스타트업 대표', '번역가', '건축가', '약사', '공무원', '개발자',
    '운동선수', '매니저', '웨이터', '헤어디자이너', '상담사',
  ],
  '⚽ 스포츠': [
    '축구', '농구', '야구', '수영', '볼링', '골프', '배드민턴', '탁구', '스키', '클라이밍',
    '테니스', '복싱', '태권도', '육상', '사이클', '서핑', '발레', '요가', '헬스', '크로스핏',
    '피겨스케이팅', '배구', '핸드볼', '유도', '승마',
  ],
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function LiarGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [playerCount, setPlayerCount] = useState(5)
  const [selectedCat, setSelectedCat] = useState<string>('랜덤')
  const [keyword, setKeyword] = useState('')
  const [liarIdx, setLiarIdx] = useState(0)
  const [current, setCurrent] = useState(0)
  const [dealState, setDealState] = useState<DealState>('waiting')
  const [timeLeft, setTimeLeft] = useState(0)
  const [liarRevealed, setLiarRevealed] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startDeal() {
    const catKey = selectedCat === '랜덤'
      ? pick(Object.keys(CATEGORIES))
      : selectedCat
    const word = pick(CATEGORIES[catKey])
    const liar = Math.floor(Math.random() * playerCount)
    setKeyword(word)
    setLiarIdx(liar)
    setCurrent(0)
    setDealState('waiting')
    setPhase('deal')
  }

  function revealCard() {
    setDealState('revealed')
  }

  function confirmAndNext() {
    setDealState('waiting')
    if (current + 1 >= playerCount) {
      const discuss = playerCount * 30
      setTimeLeft(discuss)
      setLiarRevealed(false)
      setPhase('discuss')
    } else {
      setCurrent(c => c + 1)
    }
  }

  useEffect(() => {
    if (phase !== 'discuss') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const catKeys = ['랜덤', ...Object.keys(CATEGORIES)]

  // ── setup ──
  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>🤥</div>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, var(--amber), #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>라이어게임</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
            한 명만 주제를 모릅니다.<br />
            <strong style={{ color: 'var(--text)' }}>라이어를 찾아내세요!</strong>
          </p>
        </div>

        {/* 인원 선택 */}
        <div className="glass p-4 w-full flex flex-col gap-4">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>인원 수</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} onClick={() => setPlayerCount(n)} style={{
                width: 40, height: 40, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                border: playerCount === n ? '2px solid var(--amber)' : '1px solid var(--border)',
                background: playerCount === n ? 'var(--amber-light)' : 'var(--surface)',
                color: playerCount === n ? '#92400e' : 'var(--text-muted)',
                boxShadow: playerCount === n ? '0 0 10px var(--amber-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 카테고리 선택 */}
        <div className="glass p-4 w-full flex flex-col gap-3">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>카테고리</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {catKeys.map(cat => (
              <button key={cat} onClick={() => setSelectedCat(cat)} style={{
                padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: selectedCat === cat ? '2px solid var(--amber)' : '1px solid var(--border)',
                background: selectedCat === cat ? 'var(--amber-light)' : 'var(--surface)',
                color: selectedCat === cat ? '#92400e' : 'var(--text-muted)',
                boxShadow: selectedCat === cat ? '0 0 10px var(--amber-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={startDeal}>카드 배분 시작</button>
      </div>
    )
  }

  // ── deal ──
  if (phase === 'deal') {
    const isLiar = current === liarIdx

    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <style>{`
          @keyframes flipIn {
            from { transform: perspective(600px) rotateY(-90deg); opacity: 0 }
            to   { transform: perspective(600px) rotateY(0deg);   opacity: 1 }
          }
          @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        `}</style>

        {/* 진행 표시 */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
            <span>카드 배분</span>
            <span>{current + 1} / {playerCount}</span>
          </div>
          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, background: 'var(--amber)',
              width: `${(current / playerCount) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <div style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>
          플레이어 {current + 1}번
        </div>

        {/* 카드 */}
        {dealState === 'waiting' ? (
          <button onClick={revealCard} style={{
            width: 200, height: 280, borderRadius: 24,
            background: 'linear-gradient(135deg, #1a1714, #2a2520)',
            border: '2px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <span style={{ fontSize: 52 }}>🂠</span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>탭해서 확인</span>
          </button>
        ) : isLiar ? (
          <div style={{
            width: 200, height: 280, borderRadius: 24,
            background: 'rgba(239,68,68,0.12)', border: '2px solid #ef4444',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, boxShadow: '0 0 32px rgba(239,68,68,0.3), 0 8px 32px rgba(0,0,0,0.2)',
            animation: 'flipIn 0.35s ease',
          }}>
            <span style={{ fontSize: 56, lineHeight: 1 }}>🤥</span>
            <span style={{
              fontFamily: "'Bebas Neue'", fontSize: 36, letterSpacing: '0.05em',
              color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.6)',
            }}>라이어!</span>
            <span style={{ fontSize: 12, color: '#ef4444', opacity: 0.8, padding: '0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              주제를 모릅니다.<br />다른 플레이어의 설명을<br />잘 듣고 속여보세요!
            </span>
          </div>
        ) : (
          <div style={{
            width: 200, height: 280, borderRadius: 24,
            background: 'rgba(96,165,250,0.12)', border: '2px solid #60a5fa',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, boxShadow: '0 0 32px rgba(96,165,250,0.3), 0 8px 32px rgba(0,0,0,0.2)',
            animation: 'flipIn 0.35s ease',
          }}>
            <span style={{ fontSize: 38, lineHeight: 1 }}>🔍</span>
            <span style={{ fontSize: 12, color: '#60a5fa', opacity: 0.8 }}>이번 주제</span>
            <span style={{
              fontFamily: "'Bebas Neue'", fontSize: 40, letterSpacing: '0.05em',
              color: '#60a5fa', textShadow: '0 0 20px rgba(96,165,250,0.6)',
            }}>{keyword}</span>
            <span style={{ fontSize: 12, color: '#60a5fa', opacity: 0.8, padding: '0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              주제를 직접 말하지 말고<br />돌아가며 설명하세요
            </span>
          </div>
        )}

        {dealState === 'revealed' && (
          <button onClick={confirmAndNext} className="btn-primary" style={{ animation: 'popIn 0.25s ease', marginTop: 4 }}>
            {current + 1 < playerCount ? `확인했습니다 → 플레이어 ${current + 2}번` : '확인했습니다 → 토론 시작'}
          </button>
        )}

        {dealState === 'waiting' && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            다른 플레이어가 보지 못하도록<br />혼자 확인하세요
          </p>
        )}
      </div>
    )
  }

  // ── discuss ──
  if (phase === 'discuss') {
    const mins = Math.floor(timeLeft / 60)
    const secs = timeLeft % 60
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`
    const progress = timeLeft / (playerCount * 30)
    const circumference = 2 * Math.PI * 52

    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>토론 중</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4, lineHeight: 1.6 }}>
            한 명씩 돌아가며 주제를 설명하세요<br />
            <strong style={{ color: 'var(--text)' }}>직접 말하면 안 됩니다!</strong>
          </p>
        </div>

        {/* 큰 타이머 */}
        <div style={{ position: 'relative', width: 130, height: 130 }}>
          <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="65" cy="65" r="52" fill="none" stroke="var(--surface2)" strokeWidth="6" />
            <circle cx="65" cy="65" r="52" fill="none"
              stroke={timeLeft < 30 ? '#ef4444' : 'var(--amber)'}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease',
                filter: `drop-shadow(0 0 6px ${timeLeft < 30 ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'})`,
              }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: "'Bebas Neue'", fontSize: 34, lineHeight: 1,
              color: timeLeft < 30 ? '#ef4444' : 'var(--amber)',
            }}>{timeStr}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>남음</span>
          </div>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-2" style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>진행 순서</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            1. 플레이어 1번부터 순서대로 설명<br />
            2. 라이어는 모르는 척 자연스럽게 설명<br />
            3. 토론 후 의심스러운 사람에게 투표
          </div>
        </div>

        <button className="btn-primary" onClick={() => {
          if (timerRef.current) clearInterval(timerRef.current)
          setPhase('reveal')
        }}>
          투표 종료 → 정체 공개
        </button>
      </div>
    )
  }

  // ── reveal ──
  return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes fadeUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>정체 공개</div>

      {!liarRevealed ? (
        <>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            투표 결과를 먼저 발표한 뒤<br />아래 버튼으로 정체를 공개하세요
          </p>
          <button
            onClick={() => setLiarRevealed(true)}
            style={{
              width: 200, height: 200, borderRadius: 32,
              background: 'rgba(239,68,68,0.12)', border: '2px solid #ef4444',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer',
              boxShadow: '0 0 32px rgba(239,68,68,0.2)',
              fontSize: 52, transition: 'transform 0.15s ease',
            }}
          >
            🤥
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>탭해서 공개</span>
          </button>
        </>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease' }}>
          {/* 라이어 공개 */}
          <div style={{
            padding: '20px', borderRadius: 20,
            background: 'rgba(239,68,68,0.12)', border: '2px solid #ef4444',
            boxShadow: '0 0 24px rgba(239,68,68,0.2)',
          }}>
            <div style={{ fontSize: 13, color: '#ef4444', opacity: 0.8, marginBottom: 4 }}>라이어는...</div>
            <div style={{
              fontFamily: "'Bebas Neue'", fontSize: 52, color: '#ef4444',
              textShadow: '0 0 20px rgba(239,68,68,0.6)', lineHeight: 1,
            }}>
              플레이어 {liarIdx + 1}번 🤥
            </div>
          </div>

          {/* 정답 키워드 */}
          <div style={{
            padding: '20px', borderRadius: 20,
            background: 'rgba(96,165,250,0.12)', border: '2px solid #60a5fa',
            boxShadow: '0 0 24px rgba(96,165,250,0.2)',
          }}>
            <div style={{ fontSize: 13, color: '#60a5fa', opacity: 0.8, marginBottom: 4 }}>이번 주제는...</div>
            <div style={{
              fontFamily: "'Bebas Neue'", fontSize: 52, color: '#60a5fa',
              textShadow: '0 0 20px rgba(96,165,250,0.6)', lineHeight: 1,
            }}>
              {keyword}
            </div>
          </div>

          {/* 라이어 최후 발언 */}
          <div className="glass p-4" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            라이어가 주제를 맞추면 역전승!<br />
            <strong style={{ color: 'var(--text)' }}>라이어: </strong>주제를 말할 기회가 있습니다
          </div>

          <button className="btn-primary" onClick={() => onComplete(100)}>완료</button>
        </div>
      )}
    </div>
  )
}

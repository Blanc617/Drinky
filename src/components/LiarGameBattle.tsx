'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  myName: string
  players: { userId: string; name: string }[]
  isHost: boolean
  rounds?: number
}

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

type Phase = 'waiting' | 'dealing' | 'countdown' | 'discuss' | 'vote' | 'reveal'

export default function LiarGameBattle({ onComplete, roomCode, userId, players, isHost, rounds = 1 }: Props) {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [selectedCat, setSelectedCat] = useState('랜덤')
  const [keyword, setKeyword] = useState('')
  const [liarUserId, setLiarUserId] = useState('')
  const [cardRevealed, setCardRevealed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmCount, setConfirmCount] = useState(0)
  const [cdCount, setCdCount] = useState(3)
  const [timeLeft, setTimeLeft] = useState(0)
  // voterId → targetUserId
  const [voteMap, setVoteMap] = useState<Record<string, string>>({})
  const [myVote, setMyVote] = useState<string | null>(null)
  const [liarRevealed, setLiarRevealed] = useState(false)

  // Drumroll reveal animation states
  const [drumrolling, setDrumrolling] = useState(false)
  const [drumrollCount, setDrumrollCount] = useState(0)

  // Vote-based scoring states
  const [liarWon, setLiarWon] = useState<boolean | null>(null)
  const [liarGuess, setLiarGuess] = useState('')
  const [guessResult, setGuessResult] = useState<'correct' | 'wrong' | null>(null)

  const [currentRound, setCurrentRound] = useState(1)
  const accScoreRef = useRef(0)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const confirmCountRef = useRef(0)
  const voteMapRef = useRef<Record<string, string>>({})
  const playerCountRef = useRef(players.length)
  const isHostRef = useRef(isHost)

  isHostRef.current = isHost
  playerCountRef.current = players.length

  const isLiar = userId === liarUserId
  // Clamped discuss time: minimum 1 min, maximum 3 min
  const DISCUSS_TIME = Math.max(60, Math.min(180, players.length * 30))

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`liar-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'liar_start' }, ({ payload }: { payload: { keyword: string; liarUserId: string } }) => {
        setKeyword(payload.keyword)
        setLiarUserId(payload.liarUserId)
        setCardRevealed(false)
        setConfirmed(false)
        confirmCountRef.current = 0
        setConfirmCount(0)
        setPhase('dealing')
      })
      .on('broadcast', { event: 'liar_confirmed' }, () => {
        if (!isHostRef.current) return
        confirmCountRef.current++
        setConfirmCount(confirmCountRef.current)
        if (confirmCountRef.current >= playerCountRef.current) {
          const discussTime = Math.max(60, Math.min(180, playerCountRef.current * 30))
          channel.send({ type: 'broadcast', event: 'liar_discuss', payload: { discussTime } })
        }
      })
      .on('broadcast', { event: 'liar_discuss' }, ({ payload }: { payload: { discussTime: number } }) => {
        if (timerRef.current) clearInterval(timerRef.current)
        // 카운트다운 후 토론 시작
        setCdCount(3)
        setPhase('countdown')
        let c = 3
        timerRef.current = setInterval(() => {
          c--
          setCdCount(c)
          if (c <= 0) {
            clearInterval(timerRef.current!)
            timerRef.current = null
            setTimeLeft(payload.discussTime)
            setPhase('discuss')

            let t = payload.discussTime
            timerRef.current = setInterval(() => {
              t--
              setTimeLeft(t)
              if (t <= 0) {
                clearInterval(timerRef.current!)
                timerRef.current = null
                if (isHostRef.current) {
                  channel.send({ type: 'broadcast', event: 'liar_vote_start', payload: {} })
                }
              }
            }, 1000)
          }
        }, 1000)
      })
      .on('broadcast', { event: 'liar_vote_start' }, () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        voteMapRef.current = {}
        setVoteMap({})
        setMyVote(null)
        setPhase('vote')
      })
      .on('broadcast', { event: 'liar_vote' }, ({ payload }: { payload: { voterId: string; targetUserId: string } }) => {
        voteMapRef.current = { ...voteMapRef.current, [payload.voterId]: payload.targetUserId }
        setVoteMap({ ...voteMapRef.current })
        if (Object.keys(voteMapRef.current).length >= playerCountRef.current) {
          setPhase('reveal')
        }
      })
      .on('broadcast', { event: 'liar_guess_result' }, ({ payload }: { payload: { result: 'correct' | 'wrong' } }) => {
        if (isLiar) return // 라이어는 로컬에서 이미 처리
        setGuessResult(payload.result)
        if (payload.result === 'correct') setLiarWon(true)
      })
      .on('broadcast', { event: 'liar_reveal' }, () => {
        setLiarRevealed(false)
        setPhase('reveal')
      })
      .on('broadcast', { event: 'liar_next_round' }, ({ payload }: { payload: { round: number } }) => {
        setCurrentRound(payload.round)
        setPhase('waiting')
        setKeyword('')
        setLiarUserId('')
        setCardRevealed(false)
        setConfirmed(false)
        setConfirmCount(0)
        confirmCountRef.current = 0
        setVoteMap({})
        setMyVote(null)
        voteMapRef.current = {}
        setLiarRevealed(false)
        setDrumrolling(false)
        setDrumrollCount(0)
        setLiarWon(null)
        setLiarGuess('')
        setGuessResult(null)
      })
      .subscribe()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStart() {
    const catKey = selectedCat === '랜덤' ? pick(Object.keys(CATEGORIES)) : selectedCat
    const word = pick(CATEGORIES[catKey])
    const liar = players[Math.floor(Math.random() * players.length)].userId
    channelRef.current?.send({
      type: 'broadcast',
      event: 'liar_start',
      payload: { keyword: word, liarUserId: liar },
    })
  }

  function handleConfirm() {
    setConfirmed(true)
    channelRef.current?.send({ type: 'broadcast', event: 'liar_confirmed', payload: {} })
  }

  function handleStartVote() {
    channelRef.current?.send({ type: 'broadcast', event: 'liar_vote_start', payload: {} })
  }

  function handleVote(targetUserId: string) {
    if (myVote) return
    setMyVote(targetUserId)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'liar_vote',
      payload: { voterId: userId, targetUserId },
    })
  }

  function handleRevealTap(currentLiarUserId: string, currentVoteMap: Record<string, string>) {
    if (drumrolling || liarRevealed) return
    setDrumrolling(true)
    setDrumrollCount(0)

    let count = 0
    const interval = setInterval(() => {
      count++
      setDrumrollCount(count)
      if (count >= 3) {
        clearInterval(interval)
        setDrumrolling(false)
        setLiarRevealed(true)

        // Compute winner based on votes
        const tally: Record<string, number> = {}
        for (const target of Object.values(currentVoteMap)) {
          tally[target] = (tally[target] ?? 0) + 1
        }
        let accusedId = ''
        let maxVotesFound = 0
        for (const [uid, votes] of Object.entries(tally)) {
          if (votes > maxVotesFound) {
            maxVotesFound = votes
            accusedId = uid
          }
        }
        const accusedIsLiar = accusedId === currentLiarUserId
        // If accused IS the liar → civilians win (liarWon = false)
        // If accused is NOT the liar → liar escapes (liarWon = true)
        setLiarWon(!accusedIsLiar)
      }
    }, 1000)
  }

  function handleLiarGuessSubmit() {
    const trimmed = liarGuess.trim().toLowerCase()
    const correct = trimmed === keyword.trim().toLowerCase()
    const result: 'correct' | 'wrong' = correct ? 'correct' : 'wrong'
    setGuessResult(result)
    if (correct) setLiarWon(true)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'liar_guess_result',
      payload: { result },
    })
  }

  function computeMyScore(won: boolean): number {
    if (isLiar) {
      return won ? 100 : 0
    } else {
      return won ? 0 : 100
    }
  }

  function handleRoundComplete() {
    const roundScore = computeMyScore(liarWon ?? false)
    accScoreRef.current += roundScore
    const nextRound = currentRound + 1
    if (nextRound <= rounds) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'liar_next_round',
        payload: { round: nextRound },
      })
    } else {
      onComplete(Math.round(accScoreRef.current / rounds))
    }
  }

  // ── waiting ──
  if (phase === 'waiting') {
    const catKeys = ['랜덤', ...Object.keys(CATEGORIES)]
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

        {isHost ? (
          <>
            <div className="glass p-4 w-full flex flex-col gap-3">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>카테고리</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {catKeys.map(cat => (
                  <button key={cat} onClick={() => setSelectedCat(cat)} style={{
                    padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: selectedCat === cat ? '2px solid var(--amber)' : '1px solid var(--border)',
                    background: selectedCat === cat ? 'rgba(232,137,12,0.12)' : 'var(--surface)',
                    color: selectedCat === cat ? 'var(--amber)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={handleStart}>카드 배분 시작</button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '16px 0' }}>
            방장이 게임을 시작하길 기다리는 중...
          </div>
        )}
      </div>
    )
  }

  // ── dealing ──
  if (phase === 'dealing') {
    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <style>{`
          @keyframes flipIn {
            from { transform: perspective(600px) rotateY(-90deg); opacity: 0 }
            to   { transform: perspective(600px) rotateY(0deg);   opacity: 1 }
          }
          @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        `}</style>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>내 카드</div>

        {!cardRevealed ? (
          <button onClick={() => setCardRevealed(true)} style={{
            width: 200, height: 280, borderRadius: 24,
            background: 'linear-gradient(135deg, #1a1714, #2a2520)',
            border: '1px solid var(--border)',
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
            background: 'var(--surface2)', border: '2px solid #ef4444',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, boxShadow: '0 0 20px rgba(239,68,68,0.15), 0 8px 32px rgba(0,0,0,0.2)',
            animation: 'flipIn 0.35s ease',
          }}>
            <span style={{ fontSize: 56, lineHeight: 1 }}>🤥</span>
            <span style={{
              fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: '0.05em',
              color: 'var(--amber)',
            }}>라이어!</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              주제를 모릅니다.<br />설명을 잘 듣고<br />속여보세요!
            </span>
          </div>
        ) : (
          <div style={{
            width: 200, height: 280, borderRadius: 24,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            animation: 'flipIn 0.35s ease',
          }}>
            <span style={{ fontSize: 38, lineHeight: 1 }}>🔍</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>이번 단어</span>
            <span style={{
              fontSize: 26, fontWeight: 800,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
              textShadow: '0 0 20px rgba(255,255,255,0.15)',
            }}>{keyword}</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 20px', lineHeight: 1.6, textAlign: 'center' }}>
              직접 말하지 말고<br />돌아가며 설명하세요
            </span>
          </div>
        )}

        {cardRevealed && !confirmed && (
          <button onClick={handleConfirm} className="btn-primary" style={{ animation: 'popIn 0.25s ease', marginTop: 4 }}>
            확인했습니다
          </button>
        )}

        {confirmed && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {confirmCount} / {players.length}명 확인 완료
          </div>
        )}
      </div>
    )
  }

  // ── countdown ──
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 text-center w-full">
        <style>{`@keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>🤥 토론 시작!</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 140, color: 'var(--amber)', lineHeight: 1,
          textShadow: '0 0 50px rgba(245,158,11,0.7)',
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>{cdCount}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>토론을 시작하세요!</div>
      </div>
    )
  }

  // ── discuss ──
  if (phase === 'discuss') {
    const mins = Math.floor(timeLeft / 60)
    const secs = timeLeft % 60
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`
    const progress = timeLeft / DISCUSS_TIME
    const circumference = 2 * Math.PI * 52

    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>토론 중</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4, lineHeight: 1.6 }}>
            한 명씩 돌아가며 주제를 설명하세요<br />
            <strong style={{ color: 'var(--text)' }}>직접 말하면 안 됩니다!</strong>
          </p>
        </div>

        <div style={{ position: 'relative', width: 130, height: 130 }}>
          <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="65" cy="65" r="52" fill="none" stroke="var(--surface2)" strokeWidth="6" />
            <circle cx="65" cy="65" r="52" fill="none"
              stroke={timeLeft < 30 ? '#ef4444' : 'var(--amber)'}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.max(0, progress))}
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

        <div className="glass p-4 w-full flex flex-col gap-3" style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>발언 순서</div>
          <div className="flex flex-col gap-2">
            {players.map((p, i) => {
              const isMe = p.userId === userId
              return (
                <div key={p.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: isMe ? 'rgba(232,137,12,0.1)' : 'var(--surface2)',
                  border: isMe ? '1px solid var(--amber)' : '1px solid transparent',
                }}>
                  <span style={{
                    fontFamily: "'Bebas Neue'", fontSize: 18, lineHeight: 1,
                    color: isMe ? 'var(--amber)' : 'var(--text-dim)',
                    minWidth: 24, textAlign: 'center',
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: isMe ? 700 : 500, color: isMe ? 'var(--text)' : 'var(--text-muted)', flex: 1 }}>
                    {p.name}
                  </span>
                  {isMe && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>나</span>}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            라이어는 모르는 척 자연스럽게 설명하세요
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={handleStartVote}>
            투표 시작하기 →
          </button>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            방장이 투표를 시작하길 기다리는 중...
          </div>
        )}
      </div>
    )
  }

  // ── vote ──
  if (phase === 'vote') {
    const voteCount = Object.keys(voteMap).length
    // 득표 집계
    const tally: Record<string, number> = {}
    for (const target of Object.values(voteMap)) {
      tally[target] = (tally[target] ?? 0) + 1
    }

    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>라이어 투표</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            누가 라이어인 것 같나요?
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {players
            .filter(p => p.userId !== userId)
            .map(p => {
              const voted = myVote === p.userId
              return (
                <button
                  key={p.userId}
                  onClick={() => handleVote(p.userId)}
                  disabled={!!myVote}
                  style={{
                    padding: '14px 16px', borderRadius: 16, width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: voted ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                    border: voted ? '2px solid #ef4444' : '1px solid var(--border)',
                    cursor: myVote ? 'default' : 'pointer',
                    opacity: myVote && !voted ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                    WebkitTapHighlightColor: 'transparent',
                  } as React.CSSProperties}
                >
                  <span style={{ fontSize: 20 }}>{voted ? '🎯' : '👤'}</span>
                  <span style={{
                    flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 600,
                    color: voted ? '#ef4444' : 'var(--text)',
                  }}>{p.name}</span>
                  {myVote && tally[p.userId] !== undefined && (
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: voted ? '#ef4444' : 'var(--text-muted)',
                      animation: 'popIn 0.25s ease',
                    }}>
                      {tally[p.userId]}표
                    </span>
                  )}
                </button>
              )
            })}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          {voteCount} / {players.length}명 투표 완료
        </div>
      </div>
    )
  }

  // ── reveal ──
  // 득표 집계
  const tally: Record<string, number> = {}
  for (const target of Object.values(voteMap)) {
    tally[target] = (tally[target] ?? 0) + 1
  }
  const sortedByVotes = [...players].sort((a, b) => (tally[b.userId] ?? 0) - (tally[a.userId] ?? 0))

  // Find the most accused player
  let accusedId = ''
  let maxVotesFound = 0
  for (const [uid, votes] of Object.entries(tally)) {
    if (votes > maxVotesFound) {
      maxVotesFound = votes
      accusedId = uid
    }
  }

  // Drumroll dots (1–3)
  const dots = '.'.repeat(Math.min(drumrollCount, 3))

  return (
    <div className="flex flex-col items-center gap-5 text-center w-full" style={{ overflowY: 'auto', paddingBottom: 8 }}>
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes fadeUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>

      {/* 투표 결과 */}
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          투표 결과
        </div>
        <div className="flex flex-col gap-2 w-full">
          {sortedByVotes.map((p, i) => {
            const votes = tally[p.userId] ?? 0
            const maxVotes = tally[sortedByVotes[0].userId] ?? 0
            const isTop = votes === maxVotes && votes > 0
            return (
              <div key={p.userId} className="glass p-3" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                border: isTop && i === 0 ? '1px solid #ef4444' : '1px solid var(--border)',
                background: isTop && i === 0 ? 'rgba(239,68,68,0.06)' : 'var(--surface)',
              }}>
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
                  {p.userId === userId ? '🙋' : '👤'}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>
                  {p.name}{p.userId === userId ? ' (나)' : ''}
                </span>
                <span style={{
                  fontFamily: "'Bebas Neue'", fontSize: 22,
                  color: isTop && i === 0 ? '#ef4444' : 'var(--text-muted)',
                }}>
                  {votes}표
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 정체 공개 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', width: '100%', textAlign: 'left' }}>
        정체 공개
      </div>

      {!liarRevealed ? (
        <>
          {drumrolling ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <div style={{ fontSize: 40, animation: 'pulse 0.6s ease-in-out infinite' }}>🥁</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber)' }}>
                라이어는 바로<span style={{ display: 'inline-block', minWidth: 28 }}>{dots}</span>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                탭해서 라이어를 공개하세요
              </p>
              <button
                onClick={() => handleRevealTap(liarUserId, voteMap)}
                style={{
                  width: 120, height: 120, borderRadius: 24,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, cursor: 'pointer', fontSize: 40,
                  transition: 'transform 0.15s ease',
                }}
              >
                🤥
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>탭해서 공개</span>
              </button>
            </>
          )}
        </>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp 0.4s ease' }}>
          {/* Liar identity */}
          <div className="glass" style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid var(--border)', padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
              <span style={{ fontSize: 20 }}>🤥</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>라이어</span>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)', pointerEvents: 'none' }}>
              {players.find(p => p.userId === liarUserId)?.name ?? '???'}
            </span>
          </div>

          {/* Win/loss result (before liar guess) */}
          {liarWon !== null && guessResult === null && (
            <div className="glass" style={{
              animation: 'popIn 0.3s ease',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${liarWon ? '#f59e0b' : '#4ade80'}`,
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
            }}>
              <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>{liarWon ? '🤥' : '🎉'}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontSize: 18, fontWeight: 600, lineHeight: 1,
                  color: liarWon ? '#f59e0b' : '#4ade80',
                }}>
                  {liarWon ? '라이어 승리' : '시민 승리'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
                  {liarWon
                    ? '라이어가 투표에서 살아남았습니다'
                    : `${players.find(p => p.userId === accusedId)?.name ?? '???'}이(가) 라이어로 지목됐습니다`}
                </div>
              </div>
            </div>
          )}

          {/* Liar's guess input */}
          {isLiar && guessResult === null && (
            <div className="glass p-3" style={{ border: '1px solid var(--border)', textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 700, marginBottom: 6 }}>💡 최후의 기회 — 주제를 맞춰보세요</div>
              <input
                type="text"
                value={liarGuess}
                onChange={e => setLiarGuess(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && liarGuess.trim()) handleLiarGuessSubmit() }}
                placeholder="키워드 입력..."
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', marginBottom: 8,
                }}
              />
              <button
                onClick={() => { if (liarGuess.trim()) handleLiarGuessSubmit() }}
                disabled={!liarGuess.trim()}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  background: liarGuess.trim() ? 'var(--amber)' : 'var(--surface2)',
                  color: liarGuess.trim() ? '#1a1410' : 'var(--text-dim)',
                  fontWeight: 700, fontSize: 14, border: 'none',
                  cursor: liarGuess.trim() ? 'pointer' : 'default',
                }}
              >
                정답 제출
              </button>
            </div>
          )}

          {/* Keyword reveal + liar guessing indicator (non-liar, 결과 나오기 전만) */}
          {!isLiar && (
            <>
              <div className="glass" style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid var(--border)', padding: '10px 16px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginLeft: 32 }}>이번 단어</span>
                <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)', pointerEvents: 'none' }}>
                  {keyword}
                </span>
              </div>
              {guessResult === null && (
                <div className="glass p-3" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24, animation: 'pulse 1s ease-in-out infinite' }}>✏️</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>라이어가 정답을 맞추는 중...</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>결과를 기다려 주세요</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Guess result — 라이어/시민 시점 분리 */}
          {guessResult !== null && (() => {
            const liarCorrect = guessResult === 'correct'
            // 라이어 시점
            if (isLiar) {
              return liarCorrect ? (
                <div className="glass" style={{
                  animation: 'popIn 0.3s ease', border: '1px solid var(--border)',
                  borderLeft: '3px solid #f59e0b',
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                }}>
                  <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>🤥</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, color: '#f59e0b' }}>역전! 라이어 승리</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{`"${keyword}" 정답!`}</div>
                  </div>
                </div>
              ) : (
                <div className="glass" style={{
                  animation: 'popIn 0.3s ease', border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--text-dim)',
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                }}>
                  <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>😢</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 16 }}>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>땡!</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}> 정답은 </span>
                      <span style={{ color: 'var(--text)', fontWeight: 800 }}>"{keyword}"</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}> 입니다!</span>
                    </div>
                  </div>
                </div>
              )
            }
            // 시민 시점
            return liarCorrect ? (
              <div className="glass" style={{
                animation: 'popIn 0.3s ease', border: '1px solid var(--border)',
                borderLeft: '3px solid var(--text-dim)',
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              }}>
                <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>😱</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, color: 'var(--text-muted)' }}>라이어가 정답을 맞췄습니다</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{`정답: "${keyword}"`}</div>
                </div>
              </div>
            ) : (
              <div className="glass" style={{
                animation: 'popIn 0.3s ease', border: '1px solid var(--border)',
                borderLeft: '3px solid #4ade80',
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              }}>
                <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>🎉</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, color: '#4ade80' }}>라이어가 틀렸습니다!</div>
                </div>
              </div>
            )
          })()}

          <button
            onClick={handleRoundComplete}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {currentRound < rounds ? `다음 라운드 (${currentRound}/${rounds})` : '완료'}
          </button>
        </div>
      )}
    </div>
  )
}

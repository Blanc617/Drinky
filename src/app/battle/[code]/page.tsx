'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

import NunchiGame from '@/components/NunchiGame'
import ThreeSixNineGame from '@/components/ThreeSixNineGame'
import ChoSeongBattle from '@/components/ChoSeongBattle'

type GameKey = 'nunchi' | 'threesixnine' | 'choseong'
type Phase = 'lobby' | 'countdown' | 'playing' | 'results'

interface Player { userId: string; name: string; isHost: boolean }

const GAMES: { key: GameKey; emoji: string; label: string }[] = [
  { key: 'nunchi',       emoji: '👀', label: '눈치게임' },
  { key: 'threesixnine', emoji: '3️⃣', label: '369 게임' },
  { key: 'choseong',     emoji: '🔤', label: '초성게임' },
]

export default function BattleRoomPage() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.toUpperCase()

  // Identity — populated in mount effect to avoid SSR mismatch
  const [userId, setUserId] = useState('')
  const [myName, setMyName] = useState('')
  const [amHost, setAmHost] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [needsName, setNeedsName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // Room state
  const [phase, setPhase] = useState<Phase>('lobby')
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedGame, setSelectedGame] = useState<GameKey>('nunchi')
  const [countdown, setCountdown] = useState(3)
  const [doneMap, setDoneMap] = useState<Record<string, number>>({})
  const [myScore, setMyScore] = useState<number | null>(null)

  // Stable refs (avoid stale closures in channel callbacks)
  const channelRef      = useRef<RealtimeChannel | null>(null)
  const playersRef      = useRef<Player[]>([])
  const doneMapRef      = useRef<Record<string, number>>({})
  const startedCountRef = useRef(0)
  const selectedGameRef = useRef<GameKey>('nunchi')
  const autoFinishRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cdIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const userIdRef       = useRef('')

  // ── Mount: read identity from sessionStorage ──
  useEffect(() => {
    let id = sessionStorage.getItem('battle_userId')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('battle_userId', id)
    }
    userIdRef.current = id
    setUserId(id)

    const name = sessionStorage.getItem('battle_name')
    if (name) {
      setMyName(name)
    } else {
      setNeedsName(true)
    }

    setAmHost(sessionStorage.getItem(`battle_host_${code}`) === 'true')
    setMounted(true)
  }, [code])

  // ── All-done check ──
  const checkAllDone = useCallback(() => {
    const doneCount = Object.keys(doneMapRef.current).length
    if (startedCountRef.current > 0 && doneCount >= startedCountRef.current) {
      if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
      setTimeout(() => setPhase('results'), 1500)
    }
  }, [])

  // ── Subscribe to channel once identity is ready ──
  useEffect(() => {
    if (!userId || !myName) return

    const supabase = createClient()
    const channel = supabase.channel(`battle:${code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; isHost: boolean }>()
        const list: Player[] = Object.entries(state).map(([uid, arr]) => ({
          userId: uid,
          name: arr[0].name,
          isHost: arr[0].isHost,
        }))
        playersRef.current = list
        setPlayers([...list])
      })
      .on('broadcast', { event: 'game_select' }, ({ payload }) => {
        selectedGameRef.current = payload.gameKey
        setSelectedGame(payload.gameKey)
      })
      .on('broadcast', { event: 'start' }, ({ payload }) => {
        // Clear previous game state
        doneMapRef.current = {}
        setDoneMap({})
        setMyScore(null)
        selectedGameRef.current = payload.gameKey
        setSelectedGame(payload.gameKey)
        startedCountRef.current = playersRef.current.length

        // Start countdown
        setPhase('countdown')
        if (cdIntervalRef.current) clearInterval(cdIntervalRef.current)
        let c = 3
        setCountdown(c)
        cdIntervalRef.current = setInterval(() => {
          c--
          setCountdown(c)
          if (c === 0) {
            clearInterval(cdIntervalRef.current!)
            cdIntervalRef.current = null
            setPhase('playing')
            // Auto-advance to results after 2 minutes
            autoFinishRef.current = setTimeout(() => setPhase('results'), 120_000)
          }
        }, 1000)
      })
      .on('broadcast', { event: 'player_done' }, ({ payload }) => {
        const { userId: doneId, score } = payload as { userId: string; score: number }
        doneMapRef.current = { ...doneMapRef.current, [doneId]: score }
        setDoneMap({ ...doneMapRef.current })
        checkAllDone()
      })
      .on('broadcast', { event: 'restart' }, () => {
        if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
        doneMapRef.current = {}
        setDoneMap({})
        setMyScore(null)
        setPhase('lobby')
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: myName, isHost: amHost })
        }
      })

    return () => {
      if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
      if (cdIntervalRef.current) clearInterval(cdIntervalRef.current)
      channel.unsubscribe()
    }
  }, [userId, myName, amHost, code, checkAllDone])

  // ── Actions ──
  function handleSelectGame(key: GameKey) {
    if (!amHost) return
    setSelectedGame(key)
    selectedGameRef.current = key
    channelRef.current?.send({ type: 'broadcast', event: 'game_select', payload: { gameKey: key } })
  }

  function handleStart() {
    if (!amHost) return
    channelRef.current?.send({ type: 'broadcast', event: 'start', payload: { gameKey: selectedGame } })
  }

  function handleGameComplete(score: number) {
    setMyScore(score)
    const uid = userIdRef.current
    doneMapRef.current = { ...doneMapRef.current, [uid]: score }
    setDoneMap({ ...doneMapRef.current })
    channelRef.current?.send({ type: 'broadcast', event: 'player_done', payload: { userId: uid, score } })
    checkAllDone()
  }

  function handleRestart() {
    if (!amHost) return
    channelRef.current?.send({ type: 'broadcast', event: 'restart', payload: {} })
  }

  function handleNameSubmit() {
    const n = nameInput.trim() || '익명'
    sessionStorage.setItem('battle_name', n)
    setMyName(n)
    setNeedsName(false)
  }

  // ── Renders ──

  if (!mounted) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center">
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>연결 중...</div>
      </main>
    )
  }

  if (needsName) {
    return (
      <main className="flex flex-col flex-1 px-6 items-center justify-center gap-6 w-full">
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>닉네임을 입력하세요</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>방 코드: <strong style={{ color: 'var(--amber)' }}>{code}</strong></div>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && nameInput.trim() && handleNameSubmit()}
          placeholder="이름"
          maxLength={10}
          autoFocus
          style={{
            width: '100%', padding: '12px 16px',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12, color: 'var(--text)', fontSize: 16, outline: 'none',
          }}
        />
        <button className="btn-primary" onClick={handleNameSubmit} disabled={!nameInput.trim()}>
          입장하기
        </button>
      </main>
    )
  }

  // ── Countdown ──
  if (phase === 'countdown') {
    const game = GAMES.find(g => g.key === selectedGame)
    return (
      <main className="flex flex-col flex-1 items-center justify-center gap-6 px-6">
        <style>{`@keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>{game?.emoji} {game?.label}</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 140, color: 'var(--amber)',
          lineHeight: 1, textShadow: '0 0 50px rgba(245,158,11,0.7)',
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          key: countdown,
        } as React.CSSProperties}>{countdown}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>준비하세요!</div>
      </main>
    )
  }

  // ── Playing ──
  if (phase === 'playing') {
    const game = GAMES.find(g => g.key === selectedGame)
    const doneCount = Object.keys(doneMap).length

    // After submitting my score — show waiting screen
    if (myScore !== null) {
      return (
        <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-6">
          <div className="text-center">
            <div style={{ fontSize: 48 }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>
              내 점수: <span style={{ color: 'var(--amber)' }}>{myScore}점</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {doneCount} / {startedCountRef.current}명 완료
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {players.map(p => {
              const score = doneMap[p.userId]
              return (
                <div key={p.userId} className="glass p-3" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', flex: 1, fontWeight: p.userId === userId ? 600 : 400 }}>
                    {p.name}{p.userId === userId ? ' (나)' : ''}
                  </span>
                  {score !== undefined
                    ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{score}점 ✓</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>플레이 중...</span>
                  }
                </div>
              )
            })}
          </div>
        </main>
      )
    }

    // Playing the game
    return (
      <main className="flex flex-col flex-1 px-4 pt-4 pb-4 gap-3">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingBottom: 8, borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 18 }}>{game?.emoji}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{game?.label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {doneCount}/{startedCountRef.current} 완료
          </span>
        </div>
        <div className="flex flex-col flex-1 items-center justify-start pt-2">
          {selectedGame === 'nunchi'       && <NunchiGame       onComplete={handleGameComplete} />}
          {selectedGame === 'threesixnine' && <ThreeSixNineGame onComplete={handleGameComplete} />}
          {selectedGame === 'choseong'     && (
            <ChoSeongBattle
              onComplete={handleGameComplete}
              roomCode={code}
              userId={userId}
              myName={myName}
            />
          )}
        </div>
      </main>
    )
  }

  // ── Results ──
  if (phase === 'results') {
    const sorted = players
      .map(p => ({ ...p, score: doneMap[p.userId] ?? null }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    const medals = ['🥇', '🥈', '🥉']

    return (
      <main className="flex flex-col flex-1 px-6 pt-10 pb-8 gap-5">
        <div className="text-center">
          <div style={{ fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
            {GAMES.find(g => g.key === selectedGame)?.label} 결과
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {sorted.map((p, i) => (
            <div
              key={p.userId}
              className="glass p-4"
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                border: p.userId === userId ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: i === 0 ? 'rgba(245,158,11,0.06)' : 'var(--surface)',
              }}
            >
              <span style={{ fontSize: 26, width: 32, textAlign: 'center', flexShrink: 0 }}>
                {medals[i] ?? <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{i + 1}</span>}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                {p.userId === userId && <div style={{ fontSize: 11, color: 'var(--amber)' }}>나</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Bebas Neue'", fontSize: 30,
                  color: i === 0 ? 'var(--amber)' : 'var(--text-muted)',
                  lineHeight: 1,
                }}>
                  {p.score ?? '-'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>점</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto' }}>
          {amHost ? (
            <button className="btn-primary" onClick={handleRestart}>
              다시 하기
            </button>
          ) : (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-dim)', padding: '16px 0' }}>
              방장이 다음 게임을 선택 중...
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── Lobby ──
  const selGame = GAMES.find(g => g.key === selectedGame)!
  return (
    <main className="flex flex-col flex-1 px-6 pt-8 pb-8 gap-5" style={{ overflowY: 'auto' }}>
      {/* Room code banner */}
      <div className="glass p-4 text-center">
        <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 2 }}>방 코드</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 44, color: 'var(--amber)',
          letterSpacing: '0.25em', lineHeight: 1,
        }}>{code}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>친구에게 공유하세요</div>
      </div>

      {/* Player list */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          플레이어 ({players.length}명)
        </div>
        <div className="flex flex-col gap-2">
          {players.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
              연결 중...
            </div>
          )}
          {players.map(p => (
            <div key={p.userId} className="glass p-3" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{p.isHost ? '👑' : '👤'}</span>
              <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{p.name}</span>
              {p.userId === userId && (
                <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>나</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Game grid */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          게임 선택 {!amHost && <span style={{ fontWeight: 400, textTransform: 'none' as const }}>(방장만 가능)</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {GAMES.map(g => {
            const active = g.key === selectedGame
            return (
              <button
                key={g.key}
                onClick={() => handleSelectGame(g.key)}
                disabled={!amHost}
                style={{
                  padding: '10px 6px', borderRadius: 14,
                  background: active ? 'rgba(232,137,12,0.12)' : 'var(--surface)',
                  border: active ? '2px solid var(--amber)' : '1px solid var(--border)',
                  cursor: amHost ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  opacity: !amHost ? 0.55 : 1,
                  transition: 'all 0.12s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 22 }}>{g.emoji}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  color: active ? 'var(--amber)' : 'var(--text-muted)',
                }}>{g.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Start / wait */}
      <div style={{ marginTop: 4 }}>
        {amHost ? (
          <button className="btn-primary" onClick={handleStart}>
            {players.length < 2
              ? '플레이어 기다리는 중...'
              : `${selGame.emoji} ${selGame.label} 시작! (${players.length}명)`}
          </button>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-dim)', padding: '16px 0' }}>
            방장이 게임을 시작하길 기다리는 중...
          </div>
        )}
      </div>
    </main>
  )
}

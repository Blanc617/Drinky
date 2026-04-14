'use client'

import { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

import NunchiGameBattle from '@/components/NunchiGameBattle'
import ThreeSixNineBattle from '@/components/ThreeSixNineBattle'
import ChoSeongBattle from '@/components/ChoSeongBattle'
import LiarGameBattle from '@/components/LiarGameBattle'
import BalanceGameBattle from '@/components/BalanceGameBattle'
import MafiaGameBattle from '@/components/MafiaGameBattle'

type GameKey = 'nunchi' | 'threesixnine' | 'choseong' | 'liar' | 'balancegame' | 'mafia'
type Phase = 'lobby' | 'round_select' | 'countdown' | 'playing' | 'results'

interface Player { userId: string; name: string; isHost: boolean; avatarUrl?: string }

// ── Room state reducer ──────────────────────────────────────────
interface RoomState {
  phase: Phase
  players: Player[]
  selectedGame: GameKey
  selectedRounds: number
  playerOrder: string[]
  countdown: number
  doneMap: Record<string, number>
  myScore: number | null
  resultsCountdown: number
  channelStatus: string
}

type RoomAction =
  | { type: 'SET_PHASE';            phase: Phase }
  | { type: 'SET_PLAYERS';          players: Player[] }
  | { type: 'SET_GAME';             game: GameKey }
  | { type: 'SET_ROUNDS';           rounds: number }
  | { type: 'SET_PLAYER_ORDER';     order: string[] }
  | { type: 'SET_COUNTDOWN';        countdown: number }
  | { type: 'SET_DONE_MAP';         doneMap: Record<string, number> }
  | { type: 'SET_MY_SCORE';         score: number | null }
  | { type: 'SET_RESULTS_COUNTDOWN';countdown: number }
  | { type: 'SET_CHANNEL_STATUS';   status: string }
  | { type: 'GAME_INIT';            game: GameKey; rounds: number; order: string[] }
  | { type: 'RESTART' }

const initialRoomState: RoomState = {
  phase: 'lobby',
  players: [],
  selectedGame: 'nunchi',
  selectedRounds: 5,
  playerOrder: [],
  countdown: 3,
  doneMap: {},
  myScore: null,
  resultsCountdown: 5,
  channelStatus: 'connecting',
}

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'SET_PHASE':            return { ...state, phase: action.phase }
    case 'SET_PLAYERS':          return { ...state, players: action.players }
    case 'SET_GAME':             return { ...state, selectedGame: action.game }
    case 'SET_ROUNDS':           return { ...state, selectedRounds: action.rounds }
    case 'SET_PLAYER_ORDER':     return { ...state, playerOrder: action.order }
    case 'SET_COUNTDOWN':        return { ...state, countdown: action.countdown }
    case 'SET_DONE_MAP':         return { ...state, doneMap: action.doneMap }
    case 'SET_MY_SCORE':         return { ...state, myScore: action.score }
    case 'SET_RESULTS_COUNTDOWN':return { ...state, resultsCountdown: action.countdown }
    case 'SET_CHANNEL_STATUS':   return { ...state, channelStatus: action.status }
    case 'GAME_INIT':            return { ...state, selectedGame: action.game, selectedRounds: action.rounds, playerOrder: action.order, doneMap: {}, myScore: null }
    case 'RESTART':              return { ...state, phase: 'lobby', doneMap: {}, myScore: null }
    default:                     return state
  }
}

const GAMES: { key: GameKey; emoji: string; label: string }[] = [
  { key: 'nunchi',       emoji: '👀', label: '눈치게임' },
  { key: 'threesixnine', emoji: '3️⃣', label: '369 게임' },
  { key: 'choseong',     emoji: '🔤', label: '초성게임' },
  { key: 'liar',         emoji: '🤥', label: '라이어게임' },
  { key: 'balancegame',  emoji: '⚖️', label: '밸런스게임' },
  { key: 'mafia',        emoji: '🕵️', label: '마피아게임' },
]

export default function BattleRoomPage() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode.toUpperCase()
  const router = useRouter()

  // Identity — populated in mount effect to avoid SSR mismatch
  const [userId, setUserId] = useState('')
  const [myName, setMyName] = useState('')
  const [amHost, setAmHost] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [needsName, setNeedsName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null)

  // Drag UI state (local only, no need for reducer)
  const [orderDragIdx, setOrderDragIdx] = useState<number | null>(null)
  const [orderDragOver, setOrderDragOver] = useState<number | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)

  // Room state
  const [room, dispatch] = useReducer(roomReducer, initialRoomState)
  const { phase, players, selectedGame, selectedRounds, playerOrder, countdown, doneMap, myScore, resultsCountdown, channelStatus } = room
  const orderListRef = useRef<HTMLDivElement>(null)

  // Stable refs (avoid stale closures in channel callbacks)
  const channelRef      = useRef<RealtimeChannel | null>(null)
  const playersRef      = useRef<Player[]>([])
  const doneMapRef      = useRef<Record<string, number>>({})
  const startedCountRef = useRef(0)
  const selectedGameRef = useRef<GameKey>('nunchi')
  const selectedRoundsRef = useRef(5)
  const playerOrderRef    = useRef<string[]>([])
  const autoFinishRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cdIntervalRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const resultsCdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userIdRef           = useRef('')
  const amHostRef           = useRef(false)

  // ── Mount: read identity ──
  // battle_userId / battle_host_CODE: sessionStorage (탭별 독립 → 같은 기기 다탭 지원)
  // battle_name: localStorage (탭 닫아도 이름 기억)
  useEffect(() => {
    let id = sessionStorage.getItem('battle_userId')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('battle_userId', id)
    }
    userIdRef.current = id
    setUserId(id)

    const name = localStorage.getItem('battle_name')
    if (name) {
      setMyName(name)
    } else {
      setNeedsName(true)
    }

    const isHost = sessionStorage.getItem(`battle_host_${code}`) === 'true'
    amHostRef.current = isHost
    setAmHost(isHost)

    // 프로필 사진 가져오기
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setMyAvatarUrl(data.user?.user_metadata?.avatar_url ?? null)
    })

    setMounted(true)
  }, [code])

  // ── All-done check ──
  const checkAllDone = useCallback(() => {
    const doneCount = Object.keys(doneMapRef.current).length
    if (startedCountRef.current > 0 && doneCount >= startedCountRef.current) {
      if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
      setTimeout(() => dispatch({ type: 'SET_PHASE', phase: 'results' }), 1500)
    }
  }, [])

  // ── Auto-return to lobby after results ──
  useEffect(() => {
    if (phase !== 'results') {
      if (resultsCdIntervalRef.current) {
        clearInterval(resultsCdIntervalRef.current)
        resultsCdIntervalRef.current = null
      }
      return
    }
    dispatch({ type: 'SET_RESULTS_COUNTDOWN', countdown: 5 })
    let c = 5
    resultsCdIntervalRef.current = setInterval(() => {
      c--
      dispatch({ type: 'SET_RESULTS_COUNTDOWN', countdown: c })
      if (c <= 0) {
        clearInterval(resultsCdIntervalRef.current!)
        resultsCdIntervalRef.current = null
        if (amHostRef.current) {
          channelRef.current?.send({ type: 'broadcast', event: 'restart', payload: {} })
        }
      }
    }, 1000)
    return () => {
      if (resultsCdIntervalRef.current) clearInterval(resultsCdIntervalRef.current)
    }
  }, [phase])

  // ── Subscribe to channel once identity is ready ──
  useEffect(() => {
    if (!userId || !myName) return

    dispatch({ type: 'SET_CHANNEL_STATUS', status: 'connecting' })
    const supabase = createClient()
    const channel = supabase.channel(`battle:${code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    })
    channelRef.current = channel

    function syncPlayers() {
      const state = channel.presenceState<{ name: string; isHost: boolean; avatarUrl?: string }>()
      const list: Player[] = Object.entries(state)
        .filter(([, arr]) => arr.length > 0)
        .map(([uid, arr]) => ({
          userId: uid,
          name: arr[0].name,
          isHost: arr[0].isHost,
          avatarUrl: arr[0].avatarUrl,
        }))
      playersRef.current = list
      dispatch({ type: 'SET_PLAYERS', players: [...list] })
    }

    channel
      .on('presence', { event: 'sync' }, syncPlayers)
      .on('presence', { event: 'join' }, syncPlayers)
      .on('presence', { event: 'leave' }, syncPlayers)
      .on('broadcast', { event: 'game_select' }, ({ payload }) => {
        selectedGameRef.current = payload.gameKey
        dispatch({ type: 'SET_GAME', game: payload.gameKey })
      })
      .on('broadcast', { event: 'round_select' }, ({ payload }) => {
        selectedGameRef.current = payload.gameKey
        const order = playersRef.current.map(p => p.userId)
        playerOrderRef.current = order
        dispatch({ type: 'SET_GAME', game: payload.gameKey })
        dispatch({ type: 'SET_PLAYER_ORDER', order })
        dispatch({ type: 'SET_PHASE', phase: 'round_select' })
      })
      .on('broadcast', { event: 'cancel_round_select' }, () => {
        dispatch({ type: 'SET_PHASE', phase: 'lobby' })
      })
      .on('broadcast', { event: 'start' }, ({ payload }) => {
        doneMapRef.current = {}
        selectedGameRef.current = payload.gameKey
        startedCountRef.current = playersRef.current.length
        const rounds: number = payload.rounds ?? 5
        selectedRoundsRef.current = rounds
        const order: string[] = payload.playerOrder ?? playersRef.current.map((p: Player) => p.userId)
        playerOrderRef.current = order
        dispatch({ type: 'GAME_INIT', game: payload.gameKey, rounds, order })

        // 라이어 게임은 자체 카운트다운이 있으므로 바로 playing으로
        if (payload.gameKey === 'liar') {
          dispatch({ type: 'SET_PHASE', phase: 'playing' })
          autoFinishRef.current = setTimeout(() => dispatch({ type: 'SET_PHASE', phase: 'results' }), 600_000)
          return
        }

        // 절대 시각 기준 카운트다운 — 모든 클라이언트가 동일 시점에 게임 시작
        const startAt: number = payload.startAt ?? Date.now() + 4000
        dispatch({ type: 'SET_PHASE', phase: 'countdown' })
        if (cdIntervalRef.current) clearInterval(cdIntervalRef.current)

        cdIntervalRef.current = setInterval(() => {
          const remaining = Math.ceil((startAt - Date.now()) / 1000)
          if (remaining > 0) {
            dispatch({ type: 'SET_COUNTDOWN', countdown: remaining })
          } else {
            clearInterval(cdIntervalRef.current!)
            cdIntervalRef.current = null
            dispatch({ type: 'SET_PHASE', phase: 'playing' })
            autoFinishRef.current = setTimeout(() => dispatch({ type: 'SET_PHASE', phase: 'results' }), 120_000)
          }
        }, 100)
      })
      .on('broadcast', { event: 'player_done' }, ({ payload }) => {
        const { userId: doneId, score } = payload as { userId: string; score: number }
        doneMapRef.current = { ...doneMapRef.current, [doneId]: score }
        dispatch({ type: 'SET_DONE_MAP', doneMap: { ...doneMapRef.current } })
        checkAllDone()
      })
      .on('broadcast', { event: 'restart' }, () => {
        if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
        doneMapRef.current = {}
        dispatch({ type: 'RESTART' })
      })
      .subscribe(async (status, err) => {
        console.log('[Battle] channel status:', status, err ?? '')
        if (status === 'SUBSCRIBED') {
          dispatch({ type: 'SET_CHANNEL_STATUS', status: 'connected' })
          await channel.track({ name: myName, isHost: amHostRef.current, avatarUrl: myAvatarUrl ?? undefined })
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Battle] channel error:', err)
          dispatch({ type: 'SET_CHANNEL_STATUS', status: 'error' })
        } else if (status === 'TIMED_OUT') {
          dispatch({ type: 'SET_CHANNEL_STATUS', status: 'timeout' })
        } else if (status === 'CLOSED') {
          dispatch({ type: 'SET_CHANNEL_STATUS', status: 'closed' })
        }
      })

    return () => {
      if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
      if (cdIntervalRef.current) clearInterval(cdIntervalRef.current)
      if (resultsCdIntervalRef.current) clearInterval(resultsCdIntervalRef.current)
      supabase.removeChannel(channel)
    }
  }, [userId, myName, code, checkAllDone])

  // ── Actions ──
  function handleSelectGame(key: GameKey) {
    if (!amHost) return
    dispatch({ type: 'SET_GAME', game: key })
    selectedGameRef.current = key
    channelRef.current?.send({ type: 'broadcast', event: 'game_select', payload: { gameKey: key } })
  }

  function handleStart() {
    if (!amHost) return
    channelRef.current?.send({ type: 'broadcast', event: 'round_select', payload: { gameKey: selectedGame } })
  }

  function handleConfirmRounds(n: number) {
    if (!amHost) return
    selectedRoundsRef.current = n
    dispatch({ type: 'SET_ROUNDS', rounds: n })
    const startAt = Date.now() + 4000
    channelRef.current?.send({ type: 'broadcast', event: 'start', payload: { gameKey: selectedGame, startAt, rounds: n, playerOrder: playerOrderRef.current } })
  }

  function handleGameComplete(score: number) {
    dispatch({ type: 'SET_MY_SCORE', score })
    const uid = userIdRef.current
    doneMapRef.current = { ...doneMapRef.current, [uid]: score }
    dispatch({ type: 'SET_DONE_MAP', doneMap: { ...doneMapRef.current } })
    channelRef.current?.send({ type: 'broadcast', event: 'player_done', payload: { userId: uid, score } })
    checkAllDone()
  }

  function handleNameSubmit() {
    const n = nameInput.trim() || '익명'
    localStorage.setItem('battle_name', n)
    setMyName(n)
    setNeedsName(false)
  }

  function Avatar({ player, size = 28 }: { player: Player; size?: number }) {
    if (player.avatarUrl) {
      return (
        <img
          src={player.avatarUrl}
          alt={player.name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
        />
      )
    }
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, lineHeight: 1,
      }}>
        {player.isHost ? '👑' : '👤'}
      </div>
    )
  }

  function handleRestart() {
    if (resultsCdIntervalRef.current) {
      clearInterval(resultsCdIntervalRef.current)
      resultsCdIntervalRef.current = null
    }
    if (amHost) {
      channelRef.current?.send({ type: 'broadcast', event: 'restart', payload: {} })
    } else {
      // 비방장은 자기 화면만 로비로 이동 (방장 카운트다운이 만료되면 어차피 전체 이동)
      doneMapRef.current = {}
      dispatch({ type: 'RESTART' })
    }
  }

  function handleSameGame() {
    if (!amHost) return
    if (resultsCdIntervalRef.current) {
      clearInterval(resultsCdIntervalRef.current)
      resultsCdIntervalRef.current = null
    }
    const gameKey = selectedGameRef.current
    channelRef.current?.send({
      type: 'broadcast',
      event: 'round_select',
      payload: { gameKey },
    })
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
      <main className="flex flex-col flex-1 px-6 pt-8 pb-8 gap-6 w-full">
        <button
          onClick={() => router.push('/')}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
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
        </div>
      </main>
    )
  }

  // ── Round Select ──
  if (phase === 'round_select') {
    const selGame = GAMES.find(g => g.key === selectedGame)!
    function handleCancelRoundSelect() {
      if (amHost) {
        channelRef.current?.send({ type: 'broadcast', event: 'cancel_round_select', payload: {} })
      } else {
        dispatch({ type: 'SET_PHASE', phase: 'lobby' })
      }
    }
    return (
      <main className="flex flex-col flex-1 px-6 pt-8 pb-8 gap-8">
        <button
          onClick={handleCancelRoundSelect}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>{selGame.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{selGame.label}</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
            {amHost ? '라운드 수를 선택하세요' : '방장이 라운드를 선택하는 중...'}
          </div>
        </div>
        {amHost ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, width: '100%' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => dispatch({ type: 'SET_ROUNDS', rounds: n })}
                  style={{
                    padding: '14px 0',
                    borderRadius: 14,
                    background: selectedRounds === n ? 'rgba(232,137,12,0.12)' : 'var(--surface)',
                    border: selectedRounds === n ? '2px solid var(--amber)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    transition: 'all 0.12s ease',
                    WebkitTapHighlightColor: 'transparent',
                  } as React.CSSProperties}
                >
                  <span style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: selectedRounds === n ? 'var(--amber)' : 'var(--text-muted)', lineHeight: 1 }}>{n}</span>
                </button>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
              선택: <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{selectedRounds}라운드</span>
            </div>

            {/* 플레이어 순서 (턴제 게임만) */}
            {(['threesixnine', 'choseong'] as GameKey[]).includes(selectedGame) && playerOrder.length > 1 && (
              <div className="flex flex-col gap-2">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>플레이어 순서</span>
                  <button
                    onClick={() => {
                      const shuffled = [...playerOrder].sort(() => Math.random() - 0.5)
                      playerOrderRef.current = shuffled
                      dispatch({ type: 'SET_PLAYER_ORDER', order: shuffled })
                    }}
                    style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >🔀 랜덤</button>
                </div>
                <div ref={orderListRef} className="flex flex-col gap-2">
                {playerOrder.map((uid, i) => {
                  const player = players.find(p => p.userId === uid)
                  if (!player) return null
                  const isMe = uid === userId
                  const isDragging = orderDragIdx === i
                  const isTarget = orderDragOver === i && orderDragIdx !== null && orderDragIdx !== i
                  return (
                    <div
                      key={uid}
                      data-order-i={i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        opacity: isDragging ? 0.4 : 1,
                        transition: 'opacity 0.15s ease, transform 0.1s ease',
                        transform: isTarget ? 'translateY(-3px)' : 'none',
                      }}
                    >
                      {/* 드래그 핸들 */}
                      <div
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId)
                          setOrderDragIdx(i)
                          setOrderDragOver(i)
                        }}
                        onPointerMove={(e) => {
                          if (orderDragIdx === null) return
                          const container = orderListRef.current
                          if (!container) return
                          const items = container.querySelectorAll('[data-order-i]')
                          for (const item of Array.from(items)) {
                            const rect = (item as HTMLElement).getBoundingClientRect()
                            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                              setOrderDragOver(parseInt((item as HTMLElement).dataset.orderI!))
                              break
                            }
                          }
                        }}
                        onPointerUp={() => {
                          if (orderDragIdx !== null && orderDragOver !== null && orderDragIdx !== orderDragOver) {
                            const next = [...playerOrder]
                            const [moved] = next.splice(orderDragIdx, 1)
                            next.splice(orderDragOver, 0, moved)
                            playerOrderRef.current = next
                            dispatch({ type: 'SET_PLAYER_ORDER', order: next })
                          }
                          setOrderDragIdx(null)
                          setOrderDragOver(null)
                        }}
                        onPointerCancel={() => { setOrderDragIdx(null); setOrderDragOver(null) }}
                        style={{ cursor: 'grab', touchAction: 'none', padding: '4px 6px', color: 'var(--text-dim)', fontSize: 16, userSelect: 'none', flexShrink: 0 }}
                      >
                        ☰
                      </div>
                      <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: 'var(--amber)', width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <div style={{
                        flex: 1, padding: '9px 12px', borderRadius: 10,
                        background: 'var(--surface)', fontSize: 14, fontWeight: isMe ? 700 : 400,
                        border: isTarget ? '1.5px dashed var(--amber)' : isMe ? '1.5px solid var(--amber)' : '1px solid var(--border)',
                        color: 'var(--text)',
                        transition: 'border 0.1s ease',
                      }}>
                        {player.name}{isMe ? ' (나)' : ''}
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={() => handleConfirmRounds(selectedRounds)}>
              확인 →
            </button>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
            잠시만 기다려주세요...
          </div>
        )}
      </main>
    )
  }

  // ── Countdown ──
  if (phase === 'countdown') {
    const game = GAMES.find(g => g.key === selectedGame)
    return (
      <main className="flex flex-col flex-1 px-6 pt-8 pb-8">
        <style>{`@keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <button
          onClick={() => dispatch({ type: 'SET_PHASE', phase: 'lobby' })}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>{game?.emoji} {game?.label}</div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 140, color: 'var(--amber)',
          lineHeight: 1, textShadow: '0 0 50px rgba(245,158,11,0.7)',
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          key: countdown,
        } as React.CSSProperties}>{countdown}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>준비하세요!</div>
        </div>
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
        <main className="flex flex-col flex-1 px-6 pt-8 pb-8 gap-6">
          <button
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'lobby' })}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ←
          </button>
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
        {confirmExit && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px',
          }}>
            <div className="glass p-6" style={{ width: '100%', maxWidth: 320, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>정말 나가시겠어요?</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>게임에서 나가면 0점 처리됩니다.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmExit(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
                >
                  취소
                </button>
                <button
                  onClick={() => { setConfirmExit(false); handleGameComplete(0) }}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: '#ef4444', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}
                >
                  나가기
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingBottom: 8, borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setConfirmExit(true)}
            style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ←
          </button>
          <span style={{ fontSize: 18 }}>{game?.emoji}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{game?.label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {doneCount}/{startedCountRef.current} 완료
          </span>
        </div>
        <div className="flex flex-col flex-1 items-center justify-start pt-2">
          {selectedGame === 'nunchi'       && <NunchiGameBattle  onComplete={handleGameComplete} roomCode={code} userId={userId} myName={myName} players={players} isHost={amHost} rounds={selectedRounds} />}
          {selectedGame === 'threesixnine' && <ThreeSixNineBattle onComplete={handleGameComplete} roomCode={code} userId={userId} myName={myName} players={players} isHost={amHost} rounds={selectedRounds} playerOrder={playerOrder.length > 0 ? playerOrder : undefined} />}
          {selectedGame === 'choseong'     && (
            <ChoSeongBattle
              onComplete={handleGameComplete}
              roomCode={code}
              userId={userId}
              myName={myName}
              isHost={amHost}
              rounds={selectedRounds}
            />
          )}
          {selectedGame === 'liar'        && <LiarGameBattle    onComplete={handleGameComplete} roomCode={code} userId={userId} myName={myName} players={players} isHost={amHost} rounds={selectedRounds} />}
          {selectedGame === 'balancegame' && <BalanceGameBattle onComplete={handleGameComplete} roomCode={code} userId={userId} players={players} isHost={amHost} rounds={selectedRounds} />}
          {selectedGame === 'mafia'       && <MafiaGameBattle    onComplete={handleGameComplete} roomCode={code} userId={userId} myName={myName} players={players} isHost={amHost} />}
        </div>
      </main>
    )
  }

  // ── Results ──
  if (phase === 'results') {
    const is369 = selectedGame === 'threesixnine'

    function decode369(score: number) {
      const mistakes = 9999 - Math.floor(score / 10000)
      const correct = score % 10000
      return { correct, mistakes }
    }

    type RoundStat = { roundNum: number; perPlayer: Record<string, { correct: number; mistakes: number }> }
    let roundStats: RoundStat[] = []
    if (is369) {
      try {
        const raw = sessionStorage.getItem(`369_stats_${code}`)
        if (raw) roundStats = JSON.parse(raw)
      } catch {}
    }

    const sorted = players
      .map(p => ({ ...p, score: doneMap[p.userId] ?? null }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    const medals = ['🥇', '🥈', '🥉']

    return (
      <main className="flex flex-col flex-1 px-6 pt-8 pb-8 gap-5" style={{ overflowY: 'auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          ←
        </button>
        <div className="text-center" style={{ marginTop: 4 }}>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
            {GAMES.find(g => g.key === selectedGame)?.label} 결과
          </div>
        </div>

        {/* 전체 순위 */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            🏆 전체 순위
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
                <Avatar player={p} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                  {p.userId === userId && <div style={{ fontSize: 11, color: 'var(--amber)' }}>나</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {is369 && p.score !== null ? (() => {
                    const { correct, mistakes } = decode369(p.score)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? 'var(--amber)' : 'var(--text)', lineHeight: 1 }}>
                          <span style={{ color: '#4ade80' }}>정답 {correct}</span>
                          <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>·</span>
                          <span style={{ color: mistakes > 0 ? '#ef4444' : 'var(--text-dim)' }}>오답 {mistakes}</span>
                        </div>
                      </div>
                    )
                  })() : (
                    <>
                      <div style={{
                        fontFamily: "'Bebas Neue'", fontSize: 30,
                        color: i === 0 ? 'var(--amber)' : 'var(--text-muted)',
                        lineHeight: 1,
                      }}>
                        {p.score ?? '-'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>점</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 369 라운드별 기록 */}
        {is369 && roundStats.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              📋 라운드별 기록
            </div>
            <div className="flex flex-col gap-3">
              {roundStats.map((round) => {
                const roundSorted = players
                  .map(p => ({ ...p, stat: round.perPlayer[p.userId] ?? { correct: 0, mistakes: 0 } }))
                  .sort((a, b) => a.stat.mistakes - b.stat.mistakes || b.stat.correct - a.stat.correct)
                return (
                  <div key={round.roundNum} className="glass p-4">
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 10 }}>
                      라운드 {round.roundNum}
                    </div>
                    <div className="flex flex-col gap-2">
                      {roundSorted.map((p, i) => (
                        <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 16, textAlign: 'right' }}>{i + 1}</span>
                          <span style={{
                            flex: 1, fontSize: 14,
                            fontWeight: p.userId === userId ? 700 : 400,
                            color: p.userId === userId ? 'var(--amber)' : 'var(--text)',
                          }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>정답 {p.stat.correct}</span>
                          {p.stat.mistakes > 0 && (
                            <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>💀 오답</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          {amHost && (
            <button
              className="btn-primary"
              onClick={handleSameGame}
              style={{ background: '#fff', color: '#000' }}
            >
              🔄 같은 게임 한 판 더
            </button>
          )}
          <button className="btn-primary" onClick={handleRestart}>
            🎮 다른 게임하러 가기
          </button>
          {amHost && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
              {resultsCountdown}초 후 전체 자동 이동
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
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/')}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
      </div>
      {/* Logo + Wordmark */}
      <style>{`
        @keyframes bFloat {
          0%, 100% { transform: translateY(0) rotate(-10deg); }
          50%       { transform: translateY(-6px) rotate(-10deg); }
        }
        @keyframes bGlowPulse {
          0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.6;  transform: translate(-50%, -50%) scale(1.08); }
        }
        .b-bottle-float { animation: bFloat 3.2s ease-in-out infinite; }
        .b-glow-behind  { animation: bGlowPulse 3.2s ease-in-out infinite; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 4 }}>
        <div style={{ position: 'relative', width: 36, height: 50 }}>
          <div className="b-glow-behind" style={{
            position: 'absolute',
            width: 90, height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 68%)',
            top: '50%', left: '50%',
            pointerEvents: 'none',
          }}/>
          <div className="b-bottle-float" style={{ filter: 'drop-shadow(0 6px 14px rgba(34,197,94,0.45))' }}>
        <svg width="36" height="50" viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bCapGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#166534"/>
              <stop offset="100%" stopColor="#14532d"/>
            </linearGradient>
            <linearGradient id="bBottleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#86efac"/>
              <stop offset="60%" stopColor="#22c55e"/>
              <stop offset="100%" stopColor="#16a34a"/>
            </linearGradient>
            <linearGradient id="bLiquidGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.7"/>
              <stop offset="100%" stopColor="#14532d" stopOpacity="0.95"/>
            </linearGradient>
            <linearGradient id="bShineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.35)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
            </linearGradient>
            <clipPath id="bBodyClip">
              <path d="M32 32 C32 32 16 40 15 50 L15 96 Q15 101 20 101 L60 101 Q65 101 65 96 L65 50 C64 40 48 32 48 32 Z"/>
            </clipPath>
            <filter id="bSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <rect x="29" y="3" width="22" height="12" rx="4" fill="url(#bCapGrad)"/>
          <rect x="31" y="5" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.15)"/>
          <rect x="30" y="14" width="20" height="20" rx="3" fill="url(#bBottleGrad)"/>
          <rect x="32" y="15" width="6" height="14" rx="3" fill="url(#bShineGrad)"/>
          <path d="M32 32 C32 32 16 40 15 50 L15 96 Q15 101 20 101 L60 101 Q65 101 65 96 L65 50 C64 40 48 32 48 32 Z" fill="url(#bBottleGrad)"/>
          <rect x="15" y="64" width="50" height="37" clipPath="url(#bBodyClip)" fill="url(#bLiquidGrad)"/>
          <path d="M15 64 Q28 60 40 64 Q52 68 65 64" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="none" clipPath="url(#bBodyClip)"/>
          <rect x="20" y="62" width="40" height="28" rx="5" fill="rgba(0,0,0,0.18)"/>
          <rect x="20" y="62" width="40" height="28" rx="5" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
          <circle cx="31" cy="73" r="3" fill="white"/>
          <circle cx="49" cy="73" r="3" fill="white"/>
          <circle cx="32" cy="73.8" r="1.5" fill="#1a0800"/>
          <circle cx="50" cy="73.8" r="1.5" fill="#1a0800"/>
          <circle cx="32.8" cy="72.5" r="0.6" fill="white"/>
          <circle cx="50.8" cy="72.5" r="0.6" fill="white"/>
          <path d="M30 80 Q40 87 50 80" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <ellipse cx="25" cy="78" rx="4" ry="2.5" fill="rgba(255,100,80,0.3)"/>
          <ellipse cx="55" cy="78" rx="4" ry="2.5" fill="rgba(255,100,80,0.3)"/>
          <path d="M33 36 C32 42 31 52 33 62" stroke="rgba(255,255,255,0.4)" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="70" cy="78" r="3.5" fill="rgba(34,197,94,0.35)" filter="url(#bSoftGlow)"/>
          <circle cx="74" cy="65" r="2.5" fill="rgba(34,197,94,0.25)"/>
          <circle cx="71" cy="53" r="1.8" fill="rgba(34,197,94,0.18)"/>
          <circle cx="9"  cy="72" r="2.5" fill="rgba(34,197,94,0.28)"/>
          <circle cx="7"  cy="59" r="3.5" fill="rgba(34,197,94,0.2)" filter="url(#bSoftGlow)"/>
          <circle cx="10" cy="48" r="1.5" fill="rgba(34,197,94,0.15)"/>
        </svg>
          </div>
        </div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 36,
          lineHeight: 1,
          letterSpacing: '0.06em',
          color: '#f59e0b',
          textShadow: '0 0 24px rgba(245,158,11,0.4)',
        }}>
          DRINKY
        </div>
      </div>

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
            <div style={{ fontSize: 13, color: channelStatus === 'error' || channelStatus === 'timeout' ? '#ef4444' : 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
              {channelStatus === 'connecting' && '연결 중...'}
              {channelStatus === 'connected' && '접속 완료 — 플레이어 동기화 중...'}
              {channelStatus === 'error' && '연결 오류 — 새로고침 해주세요'}
              {channelStatus === 'timeout' && '연결 시간 초과 — 새로고침 해주세요'}
              {channelStatus === 'closed' && '연결이 끊어졌습니다'}
            </div>
          )}
          {players.map(p => (
            <div key={p.userId} className="glass p-3" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar player={p} size={28} />
              <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{p.name}</span>
              {p.isHost && <span style={{ fontSize: 11, color: 'var(--amber)' }}>👑</span>}
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

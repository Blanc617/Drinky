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

interface Player { userId: string; name: string; isHost: boolean }

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
  { key: 'threesixnine', emoji: '👏', label: '369 게임' },
  { key: 'choseong',     emoji: 'ㄱㄴㄷ', label: '초성게임' },
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

  // 초성게임 글자 수 선택 (local only)
  const [choSeongDifficulty, setChoSeongDifficulty] = useState<'2글자' | '3글자' | '섞기'>('섞기')
  const choSeongDifficultyRef = useRef<'2글자' | '3글자' | '섞기'>('섞기')

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
  const channelReadyRef = useRef(false)
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
  const timeoutCountRef     = useRef(0)

  // ── Mount: read identity ──
  // battle_userId / battle_host_CODE / battle_name: sessionStorage (탭별 독립)
  // battle_name도 localStorage에 백업 (탭 닫아도 이름 제안으로 기억)
  useEffect(() => {
    let id = sessionStorage.getItem('battle_userId')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('battle_userId', id)
    }
    userIdRef.current = id
    setUserId(id)

    const sessionName = sessionStorage.getItem('battle_name')
    if (sessionName) {
      // 이 탭에서 이미 이름을 설정했으면 그대로 사용
      setMyName(sessionName)
    } else {
      // 새 탭이면 항상 이름 입력을 요구 (localStorage 값을 제안으로 pre-fill)
      const savedName = localStorage.getItem('battle_name')
      setNameInput(savedName || '')
      setNeedsName(true)
    }

    const isHost = sessionStorage.getItem(`battle_host_${code}`) === 'true'
    amHostRef.current = isHost
    setAmHost(isHost)

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

  // Auto-redirect removed — navigation is manual only

  // ── Subscribe to channel once identity is ready ──
  useEffect(() => {
    if (!userId || !myName) return

    dispatch({ type: 'SET_CHANNEL_STATUS', status: 'connecting' })
    const supabase = createClient()

    // JWT 만료 방지: 토큰 갱신 시 Realtime에 반영 (토큰이 있는 경우에만)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
    })
    supabase.auth.startAutoRefresh()
    // 30분마다 강제 갱신 (로그인 세션이 있는 경우 대비)
    const tokenRefreshTimer = setInterval(async () => {
      const { data } = await supabase.auth.refreshSession()
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token)
      }
    }, 30 * 60 * 1000)

    const channel = supabase.channel(`battle:${code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    })
    channelRef.current = channel

    function syncPlayers() {
      const state = channel.presenceState<{ name: string; isHost: boolean }>()
      const list: Player[] = Object.entries(state)
        .filter(([, arr]) => arr.length > 0)
        .map(([uid, arr]) => ({
          userId: uid,
          name: arr[0].name,
          isHost: arr[0].isHost,
        }))
      list.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0))
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
        if (payload.choSeongDifficulty) {
          choSeongDifficultyRef.current = payload.choSeongDifficulty
          setChoSeongDifficulty(payload.choSeongDifficulty)
        }
        dispatch({ type: 'GAME_INIT', game: payload.gameKey, rounds, order })

        // 라이어/마피아는 자체 카운트다운이 있으므로 바로 playing으로
        if (payload.gameKey === 'liar' || payload.gameKey === 'mafia') {
          dispatch({ type: 'SET_PHASE', phase: 'playing' })
          autoFinishRef.current = setTimeout(() => dispatch({ type: 'SET_PHASE', phase: 'results' }), 1_800_000)
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
          channelReadyRef.current = true
          timeoutCountRef.current = 0
          dispatch({ type: 'SET_CHANNEL_STATUS', status: 'connected' })
          await channel.track({ name: myName, isHost: amHostRef.current })
        } else if (status === 'CHANNEL_ERROR') {
          channelReadyRef.current = false
          if (err) console.error('[Battle] channel error:', err)
          const errStr = String(err ?? '')
          if (errStr.includes('InvalidJWTToken') || errStr.includes('expired')) {
            // 토큰 만료 → 갱신 후 Realtime에 반영하면 자동 재연결됨
            supabase.auth.refreshSession().then(({ data }) => {
              supabase.realtime.setAuth(data.session?.access_token ?? null)
            })
          } else if (err) {
            dispatch({ type: 'SET_CHANNEL_STATUS', status: 'error' })
          }
        } else if (status === 'TIMED_OUT') {
          channelReadyRef.current = false
          timeoutCountRef.current++
          // Supabase auto-retries on TIMED_OUT — only show error after 3 consecutive timeouts
          if (timeoutCountRef.current >= 3) {
            dispatch({ type: 'SET_CHANNEL_STATUS', status: 'timeout' })
          } else {
            dispatch({ type: 'SET_CHANNEL_STATUS', status: 'connecting' })
          }
        } else if (status === 'CLOSED') {
          channelReadyRef.current = false
          dispatch({ type: 'SET_CHANNEL_STATUS', status: 'closed' })
        }
      })

    return () => {
      channelReadyRef.current = false
      if (autoFinishRef.current) clearTimeout(autoFinishRef.current)
      if (cdIntervalRef.current) clearInterval(cdIntervalRef.current)
      if (resultsCdIntervalRef.current) clearInterval(resultsCdIntervalRef.current)
      clearInterval(tokenRefreshTimer)
      authSub.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [userId, myName, code, checkAllDone])

  // ── Actions ──
  function bcast(payload: { type: 'broadcast'; event: string; payload: Record<string, unknown> }) {
    if (!channelReadyRef.current) return
    channelRef.current?.send(payload)
  }
  function handleSelectGame(key: GameKey) {
    if (!amHost) return
    dispatch({ type: 'SET_GAME', game: key })
    selectedGameRef.current = key
    bcast({ type: 'broadcast', event: 'game_select', payload: { gameKey: key } })
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
    channelRef.current?.send({ type: 'broadcast', event: 'start', payload: { gameKey: selectedGame, startAt, rounds: n, playerOrder: playerOrderRef.current, choSeongDifficulty: choSeongDifficultyRef.current } })
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
    sessionStorage.setItem('battle_name', n)
    setMyName(n)
    setNeedsName(false)
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

            {/* 초성게임 글자 수 선택 */}
            {selectedGame === 'choseong' && (
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>글자 수</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['2글자', '3글자', '섞기'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => { setChoSeongDifficulty(d); choSeongDifficultyRef.current = d }}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                        border: choSeongDifficulty === d ? '2px solid var(--amber)' : '2px solid var(--border)',
                        background: choSeongDifficulty === d ? 'rgba(245,158,11,0.12)' : 'var(--surface)',
                        color: choSeongDifficulty === d ? 'var(--amber)' : 'var(--text-muted)',
                      }}
                    >{d}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 플레이어 순서 (턴제 게임만) */}
            {selectedGame === 'threesixnine' && playerOrder.length > 1 && (
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
    const is369 = selectedGame === 'threesixnine'
    const firstPlayerId = is369 && playerOrder.length > 0 ? playerOrder[0] : null
    const amFirst = firstPlayerId === userId
    return (
      <main className="flex flex-col flex-1 px-6 pt-8 pb-8">
        <style>{`@keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <button
          onClick={() => dispatch({ type: 'SET_PHASE', phase: 'lobby' })}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 24, gap: 0 }}>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 16 }}>{game?.emoji} {game?.label}</div>
          <div style={{
            fontFamily: "'Bebas Neue'", fontSize: 140, color: 'var(--amber)',
            lineHeight: 1, textShadow: '0 0 50px rgba(245,158,11,0.7)',
            animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            key: countdown,
          } as React.CSSProperties}>{countdown}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>준비하세요!</div>

          {/* 369 전용 순서 표시 */}
          {is369 && playerOrder.length > 0 && (
            <div style={{ width: '100%', marginTop: 28, borderRadius: 18, background: 'var(--surface)', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              {/* 박스 헤더 */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>순서</span>
                {amFirst ? (
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--amber)', background: 'rgba(245,158,11,0.13)', border: '1.5px solid rgba(245,158,11,0.4)', borderRadius: 99, padding: '3px 10px' }}>
                    🎯 내가 첫 번째!
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{players.find(p => p.userId === firstPlayerId)?.name}</span>부터 시작
                  </span>
                )}
              </div>
              {/* 순서 목록 */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {playerOrder.map((uid, i) => {
                  const isMe = uid === userId
                  const name = players.find(p => p.userId === uid)?.name ?? '?'
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: isMe ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${isMe ? 'rgba(245,158,11,0.45)' : 'transparent'}` }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: isMe ? 'var(--amber)' : 'var(--text-dim)', minWidth: 22, textAlign: 'center', background: isMe ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.06)', borderRadius: 7, padding: '2px 6px' }}>{i + 1}</span>
                      <span style={{ fontSize: 15, fontWeight: isMe ? 700 : 500, color: isMe ? 'var(--amber)' : 'var(--text)', flex: 1 }}>{name}</span>
                      {isMe && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: 99 }}>나</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── Playing ──
  if (phase === 'playing') {
    const game = GAMES.find(g => g.key === selectedGame)
    const doneCount = Object.keys(doneMap).length

    // After submitting my score — show minimal waiting screen
    if (myScore !== null) {
      return (
        <main className="flex flex-col flex-1 items-center justify-center gap-4 px-6">
          <div style={{ fontSize: 36 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>다른 플레이어를 기다리는 중...</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doneCount} / {startedCountRef.current}명 완료</div>
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
              difficulty={choSeongDifficulty}
            />
          )}
          {selectedGame === 'liar'        && <LiarGameBattle    onComplete={handleGameComplete} roomCode={code} userId={userId} myName={myName} players={players} isHost={amHost} rounds={selectedRounds} />}
          {selectedGame === 'balancegame' && <BalanceGameBattle onComplete={handleGameComplete} roomCode={code} userId={userId} players={players} isHost={amHost} rounds={selectedRounds} />}
          {selectedGame === 'mafia'       && <MafiaGameBattle    onComplete={handleGameComplete} roomCode={code} userId={userId} myName={myName} players={players} isHost={amHost} rounds={selectedRounds} />}
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

    // ── Game-specific config ──
    type GCfg = {
      accent: string; accentDim: string; accentGlow: string
      bg: string; trophy: string; achievement: string
      rankNameColor: string
      light: boolean
      renderScore: (score: number, i: number) => React.ReactNode
      renderFirstScore: (score: number) => React.ReactNode
    }
    const gcMap: Record<string, GCfg> = {
      mafia: {
        accent: '#f59e0b', accentDim: 'rgba(245,158,11,0.75)', accentGlow: 'rgba(245,158,11,0.3)',
        bg: 'linear-gradient(180deg, #1c2333 0%, #252e42 60%, #1c2333 100%)',
        trophy: '🕵️', achievement: '마피아 우승자',
        rankNameColor: '#fde68a', light: false,
        renderScore: (s, i) => (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{s}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>점</div>
          </div>
        ),
        renderFirstScore: (s) => <div style={{ fontSize: 13, color: '#f59e0b', marginTop: 4 }}>{s}점</div>,
      },
      nunchi: {
        accent: '#059669', accentDim: 'rgba(5,150,105,0.7)', accentGlow: 'rgba(5,150,105,0.2)',
        bg: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
        trophy: '👁️', achievement: '눈치왕',
        rankNameColor: '#065f46', light: true,
        renderScore: (s, i) => (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? '#059669' : '#94a3b8', lineHeight: 1 }}>{s}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>%</div>
          </div>
        ),
        renderFirstScore: (s) => <div style={{ fontSize: 13, color: '#059669', marginTop: 4 }}>{s}% 정확도</div>,
      },
      threesixnine: {
        accent: '#d97706', accentDim: 'rgba(217,119,6,0.7)', accentGlow: 'rgba(217,119,6,0.2)',
        bg: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
        trophy: '🎯', achievement: '369 마스터',
        rankNameColor: '#92400e', light: true,
        renderScore: (s, _i) => {
          const { correct, mistakes } = decode369(s)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>정답 {correct}</span>
              <span style={{ fontSize: 11, color: mistakes > 0 ? '#dc2626' : '#94a3b8', fontWeight: 600 }}>오답 {mistakes}</span>
            </div>
          )
        },
        renderFirstScore: (s) => {
          const { correct, mistakes } = decode369(s)
          return <div style={{ fontSize: 13, color: '#d97706', marginTop: 4 }}>정답 {correct} · 오답 {mistakes}</div>
        },
      },
      choseong: {
        accent: '#7c3aed', accentDim: 'rgba(124,58,237,0.7)', accentGlow: 'rgba(124,58,237,0.2)',
        bg: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
        trophy: '🧠', achievement: '언어 천재',
        rankNameColor: '#4c1d95', light: true,
        renderScore: (s, i) => (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? '#7c3aed' : '#94a3b8', lineHeight: 1 }}>{s}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>점</div>
          </div>
        ),
        renderFirstScore: (s) => <div style={{ fontSize: 13, color: '#7c3aed', marginTop: 4 }}>{s}점</div>,
      },
      liar: {
        accent: '#dc2626', accentDim: 'rgba(220,38,38,0.65)', accentGlow: 'rgba(220,38,38,0.2)',
        bg: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)',
        trophy: '🃏', achievement: '최고의 라이어',
        rankNameColor: '#991b1b', light: true,
        renderScore: (s, i) => (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? '#dc2626' : '#94a3b8', lineHeight: 1 }}>{s}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>점</div>
          </div>
        ),
        renderFirstScore: (s) => <div style={{ fontSize: 13, color: '#dc2626', marginTop: 4 }}>{s}점</div>,
      },
      balancegame: {
        accent: '#0891b2', accentDim: 'rgba(8,145,178,0.7)', accentGlow: 'rgba(8,145,178,0.2)',
        bg: 'linear-gradient(180deg, #ecfeff 0%, #ffffff 100%)',
        trophy: '💬', achievement: '공감왕',
        rankNameColor: '#164e63', light: true,
        renderScore: (s, i) => (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? '#0891b2' : '#94a3b8', lineHeight: 1 }}>{s}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>/{selectedRounds}회</div>
          </div>
        ),
        renderFirstScore: (s) => <div style={{ fontSize: 13, color: '#0891b2', marginTop: 4 }}>{s}/{selectedRounds}회 공감</div>,
      },
    }
    const gc: GCfg = gcMap[selectedGame] ?? gcMap.mafia

    const sorted = players
      .map(p => ({ ...p, score: doneMap[p.userId] ?? null }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    const medals = ['🥇', '🥈', '🥉']

    const myRank = sorted.findIndex(p => p.userId === userId)
    const L = gc.light
    const txt      = L ? '#0f172a' : '#f1f5f9'
    const txtMuted = L ? '#64748b' : 'rgba(255,255,255,0.5)'
    const cardBg   = L ? '#ffffff' : '#2e4a6e'
    const cardBorder = (highlight: boolean) =>
      highlight ? `1.5px solid ${gc.accent}` : L ? '1px solid #e2e8f0' : '1px solid #3d4e6a'
    const rankColors = [gc.accent, L ? '#64748b' : '#94a3b8', L ? '#b45309' : '#b45309']
    const rankBg    = [L ? '#f8fcff' : '#2e4a6e', L ? '#f8fcff' : '#2e4a6e', L ? '#f8fcff' : '#2e4a6e']

    return (
      <main className="flex flex-col flex-1 pb-8 gap-0" style={{ overflowY: 'auto', background: gc.bg, position: 'relative' }}>
        <style>{`
          @keyframes rs-fadeUp { from { transform: translateY(18px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes rs-float  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        `}</style>

        {/* 게임 컬러 상단 바 */}
        {L && <div style={{ height: 5, background: gc.accent, flexShrink: 0 }} />}

        {/* 상단 헤더 */}
        <div style={{ position: 'relative', zIndex: 10, padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/')}
            style={{ width: 36, height: 36, borderRadius: 10, background: L ? '#f1f5f9' : 'rgba(255,255,255,0.06)', border: L ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: L ? '#475569' : 'rgba(255,255,255,0.7)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >←</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: gc.accentDim, letterSpacing: '0.22em', textTransform: 'uppercase' }}>RESULT</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: txt, marginTop: 2 }}>
              {GAMES.find(g => g.key === selectedGame)?.label}
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* 트로피 + 1위 */}
        {sorted[0] && (
          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '28px 20px 20px', animation: 'rs-fadeUp 0.5s ease' }}>
            <div style={{ fontSize: 52, display: 'inline-block', animation: 'rs-float 4s ease-in-out infinite' }}>{gc.trophy}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: gc.accentDim, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 10 }}>{gc.achievement}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: txt, marginTop: 4 }}>
              {sorted[0].name}
            </div>
            {sorted[0].score !== null && gc.renderFirstScore(sorted[0].score)}
          </div>
        )}

        {/* 내 순위 뱃지 */}
        {myRank >= 0 && myRank !== 0 && (
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', marginBottom: 4, animation: 'rs-fadeUp 0.4s ease 0.1s both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 99, background: `${gc.accent}15`, border: `1px solid ${gc.accent}50` }}>
              <span style={{ fontSize: 13 }}>{medals[myRank] ?? `${myRank + 1}위`}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: gc.accent }}>내 순위 {myRank + 1}위</span>
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div style={{ position: 'relative', zIndex: 10, margin: '12px 20px', height: 1, background: L ? '#e2e8f0' : `linear-gradient(90deg, transparent, ${gc.accent}4d, transparent)` }} />

        {/* 전체 순위 리스트 */}
        <div style={{ position: 'relative', zIndex: 10, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((p, i) => {
            const isMe = p.userId === userId
            const color = rankColors[i] ?? txtMuted
            const bg    = rankBg[i]    ?? cardBg
            return (
              <div
                key={p.userId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 16px', borderRadius: 16,
                  background: isMe ? (L ? `${gc.accent}12` : '#4a3a1a') : bg,
                  border: cardBorder(isMe),
                  boxShadow: isMe ? `0 2px 12px ${gc.accent}40` : L ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  animation: `rs-fadeUp 0.4s ease ${0.05 * i + 0.15}s both`,
                }}
              >
                <span style={{ fontSize: i < 3 ? 22 : 13, width: 28, textAlign: 'center', flexShrink: 0, color: i >= 3 ? txtMuted : color, fontWeight: 700 }}>
                  {medals[i] ?? i + 1}
                </span>
                <span style={{ fontSize: 18 }}>{p.isHost ? '👑' : '👤'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: isMe ? 700 : 500, color: isMe ? gc.rankNameColor : txt }}>
                    {p.name}{isMe ? ' (나)' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {p.score !== null ? gc.renderScore(p.score, i) : (
                    <div style={{ fontSize: 20, color: txtMuted, fontWeight: 700 }}>-</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 369 라운드별 기록 */}
        {is369 && roundStats.length > 0 && (
          <div style={{ position: 'relative', zIndex: 10, padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: txtMuted, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 2 }}>라운드별 기록</div>
            {roundStats.map((round) => {
              const roundSorted = players
                .map(p => ({ ...p, stat: round.perPlayer[p.userId] ?? { correct: 0, mistakes: 0 } }))
                .sort((a, b) => a.stat.mistakes - b.stat.mistakes || b.stat.correct - a.stat.correct)
              return (
                <div key={round.roundNum} style={{ borderRadius: 16, overflow: 'hidden', background: L ? '#fff8f0' : cardBg, border: L ? '1px solid #fde8cc' : cardBorder(false), boxShadow: L ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
                  {/* 라운드 헤더 */}
                  <div style={{ padding: '10px 16px', background: L ? '#fef3e2' : 'rgba(255,255,255,0.04)', borderBottom: L ? '1px solid #fde8cc' : '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 4, height: 16, borderRadius: 2, background: gc.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: L ? '#334155' : gc.accentDim, letterSpacing: '0.08em' }}>ROUND {round.roundNum}</span>
                  </div>
                  {/* 플레이어 행 */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {roundSorted.map((p, i) => {
                      const isMe = p.userId === userId
                      return (
                        <div key={p.userId} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 16px',
                          background: isMe ? (L ? `${gc.accent}10` : `${gc.accent}18`) : 'transparent',
                          borderBottom: i < roundSorted.length - 1 ? (L ? '1px solid #fde8cc' : '1px solid rgba(255,255,255,0.04)') : 'none',
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: txtMuted, minWidth: 18, textAlign: 'center' }}>{i + 1}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: isMe ? gc.accent : txt }}>
                            {p.name}{isMe ? ' (나)' : ''}
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', background: L ? '#dcfce7' : 'rgba(22,163,74,0.15)', padding: '2px 8px', borderRadius: 6, minWidth: 44, textAlign: 'center' }}>✓ {p.stat.correct}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: p.stat.mistakes > 0 ? '#dc2626' : txtMuted, background: p.stat.mistakes > 0 ? (L ? '#fee2e2' : 'rgba(220,38,38,0.15)') : 'transparent', padding: '2px 8px', borderRadius: 6, minWidth: 44, textAlign: 'center' }}>
                              {p.stat.mistakes > 0 ? `✗ ${p.stat.mistakes}` : '—'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 버튼 */}
        <div style={{ position: 'relative', zIndex: 10, padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {amHost && (
            <button
              onClick={handleSameGame}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: L ? gc.accent : 'rgba(255,255,255,0.08)', border: 'none', color: '#ffffff', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: L ? `0 2px 12px ${gc.accent}55` : 'none' }}
            >
              🔄 같은 게임 한 판 더
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleRestart}
          >
            🎮 다른 게임하러 가기
          </button>
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
              <span style={{ fontSize: 18 }}>{p.isHost ? '👑' : '👤'}</span>
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

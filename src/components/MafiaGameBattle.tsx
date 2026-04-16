'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { shuffle } from '@/lib/utils'

interface Props {
  onComplete: (score: number) => void
  roomCode: string
  userId: string
  myName: string
  players: { userId: string; name: string }[]
  isHost: boolean
  rounds: number
}

type Role = '마피아' | '시민' | '경찰' | '의사'
type Phase =
  | 'setup'
  | 'waiting'
  | 'revealed'
  | 'starting'
  | 'night'
  | 'day_announce'
  | 'day_discuss'
  | 'day_vote'
  | 'game_over'

const ROLE_STYLE: Record<Role, { emoji: string; color: string; bg: string; border: string; desc: string }> = {
  '마피아': { emoji: '🔪', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', desc: '밤에 시민을 한 명 제거하세요' },
  '시민':   { emoji: '👤', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: '#60a5fa', desc: '낮에 토론으로 마피아를 찾아내세요' },
  '경찰':   { emoji: '🔦', color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: '#facc15', desc: '밤에 한 명의 정체를 확인하세요' },
  '의사':   { emoji: '💉', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: '#4ade80', desc: '밤에 한 명을 마피아 공격에서 살리세요' },
}

const DEFAULT_COUNTS: Record<number, { 마피아: number; 경찰: number; 의사: number }> = {
  3:  { 마피아: 1, 경찰: 0, 의사: 0 },
  4:  { 마피아: 1, 경찰: 1, 의사: 0 },
  5:  { 마피아: 1, 경찰: 1, 의사: 0 },
  6:  { 마피아: 2, 경찰: 1, 의사: 0 },
  7:  { 마피아: 2, 경찰: 1, 의사: 1 },
  8:  { 마피아: 2, 경찰: 1, 의사: 1 },
  9:  { 마피아: 3, 경찰: 1, 의사: 1 },
  10: { 마피아: 3, 경찰: 1, 의사: 1 },
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getPlayerName(players: { userId: string; name: string }[], id: string): string {
  return players.find(p => p.userId === id)?.name ?? '???'
}

function checkWin(
  aliveIds: string[],
  assignments: Record<string, Role>,
): 'mafia' | 'citizens' | null {
  const aliveMafia = aliveIds.filter(id => assignments[id] === '마피아').length
  const aliveNonMafia = aliveIds.length - aliveMafia
  if (aliveMafia === 0) return 'citizens'
  if (aliveMafia >= aliveNonMafia) return 'mafia'
  return null
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MafiaGameBattle({ onComplete, roomCode, userId, myName, players, isHost, rounds }: Props) {
  // 게임 시작 시점의 플레이어 목록을 스냅샷: 게임 중 presence 이벤트로 인한 이름 변경 방지
  const [gamePlayers] = useState(players)
  const playerCount = gamePlayers.length
  const defaultCount = DEFAULT_COUNTS[Math.min(Math.max(playerCount, 3), 10)] ?? DEFAULT_COUNTS[3]

  // ── core state ──
  const [phase, setPhase] = useState<Phase>(isHost ? 'setup' : 'waiting')
  const [roleCounts, setRoleCounts] = useState(defaultCount)
  const [myRole, setMyRole] = useState<Role | null>(null)
  const [assignments, setAssignments] = useState<Record<string, Role>>({})
  const [aliveIds, setAliveIds] = useState<string[]>(gamePlayers.map(p => p.userId))
  const [dayNum, setDayNum] = useState(1)

  // ── night state ──
  const [nightActed, setNightActed] = useState(false)
  const [nightDeath, setNightDeath] = useState<string | null>(null)
  const [policeResult, setPoliceResult] = useState<{ targetId: string; isMafia: boolean } | null>(null)

  // ── day state ──
  const [dayVotedFor, setDayVotedFor] = useState<string | null>(null)
  const [dayVoteMap, setDayVoteMap] = useState<Record<string, string>>({})
  const [eliminated, setEliminated] = useState<string | null>(null)
  const [winner, setWinner] = useState<'mafia' | 'citizens' | null>(null)
  const [discussTimeLeft, setDiscussTimeLeft] = useState(60)
  const [startCountdown, setStartCountdown] = useState(3)
  const [dayVoteTied, setDayVoteTied] = useState(false)
  const [dayVoteTimeLeft, setDayVoteTimeLeft] = useState<number | null>(null)

  // ── round state ──
  const [currentRound, setCurrentRound] = useState(1)
  const [roundWins, setRoundWins] = useState(0)
  const [canFinish, setCanFinish] = useState(false)
  const currentRoundRef = useRef(1)
  const roundWinsRef = useRef(0)
  const roundsRef = useRef(rounds)

  // ── refs ──
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  // host collects night actions — mafiaVotes 배열로 다수결 처리
  const nightActionsRef = useRef<{ mafiaVotes?: { actorId: string; targetId: string }[]; police?: string; doctor?: string }>({})
  // stable refs for state used in callbacks
  const aliveIdsRef = useRef<string[]>(aliveIds)
  aliveIdsRef.current = aliveIds
  const assignmentsRef = useRef<Record<string, Role>>(assignments)
  assignmentsRef.current = assignments
  const dayVoteMapRef = useRef<Record<string, string>>(dayVoteMap)
  dayVoteMapRef.current = dayVoteMap
  const dayVoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase

  // ── setup helpers ──
  const citizenCount = playerCount - roleCounts.마피아 - roleCounts.경찰 - roleCounts.의사
  const isValid = citizenCount >= 1

  function adjustRole(role: '마피아' | '경찰' | '의사', delta: number) {
    setRoleCounts(prev => {
      const next = { ...prev, [role]: prev[role] + delta }
      if (role === '마피아') next[role] = Math.max(1, next[role])
      else next[role] = Math.max(0, next[role])
      return next
    })
  }

  function deal() {
    const roleArr: Role[] = [
      ...(Array(roleCounts.마피아).fill('마피아') as Role[]),
      ...(Array(roleCounts.경찰).fill('경찰') as Role[]),
      ...(Array(roleCounts.의사).fill('의사') as Role[]),
      ...(Array(Math.max(0, citizenCount)).fill('시민') as Role[]),
    ]
    const shuffledRoles = shuffle(roleArr)
    const newAssignments: Record<string, Role> = {}
    gamePlayers.forEach((p, i) => { newAssignments[p.userId] = shuffledRoles[i] })

    channelRef.current?.send({
      type: 'broadcast',
      event: 'mafia_deal',
      payload: { assignments: newAssignments },
    })
  }

  // ── host: resolve night ──
  const resolveNight = useCallback((alive: string[], assign: Record<string, Role>) => {
    const actions = nightActionsRef.current
    const alivePolice = alive.find(id => assign[id] === '경찰')
    const aliveDoctor = alive.find(id => assign[id] === '의사')
    const aliveMafiaCount = alive.filter(id => assign[id] === '마피아').length

    const needPolice = !!alivePolice
    const needDoctor = !!aliveDoctor
    const mafiaVotes = actions.mafiaVotes ?? []
    const hasAll =
      mafiaVotes.length >= aliveMafiaCount &&
      (!needPolice || actions.police !== undefined) &&
      (!needDoctor || actions.doctor !== undefined)

    if (!hasAll) return

    // 마피아 투표 다수결로 타겟 결정 — 동점 시 랜덤
    let killedId: string | null = null
    if (mafiaVotes.length > 0) {
      const tally: Record<string, number> = {}
      for (const { targetId } of mafiaVotes) tally[targetId] = (tally[targetId] ?? 0) + 1
      let maxV = 0; let tops: string[] = []
      for (const [id, count] of Object.entries(tally)) {
        if (count > maxV) { maxV = count; tops = [id] }
        else if (count === maxV) tops.push(id)
      }
      killedId = tops[Math.floor(Math.random() * tops.length)]
    }
    if (killedId && actions.doctor === killedId) killedId = null

    const policeId = alivePolice ?? ''
    const policeTargetId = actions.police ?? ''
    const isMafiaTarget = policeTargetId ? assign[policeTargetId] === '마피아' : false

    channelRef.current?.send({
      type: 'broadcast',
      event: 'mafia_night_result',
      payload: { killedId, policeId, policeTargetId, isMafiaTarget },
    })
  }, [])

  // ── host: resolve day vote ──
  const resolveDayVote = useCallback((voteMap: Record<string, string>, alive: string[], assign: Record<string, Role>, force = false) => {
    // check if all alive players voted (skip when forced by timeout)
    const totalVoters = alive.length
    const votesReceived = Object.keys(voteMap).filter(vid => alive.includes(vid)).length
    if (!force && votesReceived < totalVoters) return

    // tally
    const tally: Record<string, number> = {}
    Object.values(voteMap).forEach(targetId => {
      if (alive.includes(targetId)) {
        tally[targetId] = (tally[targetId] ?? 0) + 1
      }
    })

    let maxVotes = 0
    let topCandidates: string[] = []
    for (const [id, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; topCandidates = [id] }
      else if (count === maxVotes) topCandidates.push(id)
    }

    // tie → nobody eliminated
    const eliminatedId = topCandidates.length === 1 ? topCandidates[0] : null

    const newAlive = eliminatedId ? alive.filter(id => id !== eliminatedId) : [...alive]
    const w = checkWin(newAlive, assign)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'mafia_day_result',
      payload: { eliminatedId, winner: w },
    })
  }, [])

  // ── discuss timer ──
  useEffect(() => {
    if (phase !== 'day_discuss') return
    const DISCUSS_TIME = Math.max(60, Math.min(180, gamePlayers.length * 30))
    setDiscussTimeLeft(DISCUSS_TIME)
    const interval = setInterval(() => {
      setDiscussTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setPhase('day_vote')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  // ── day_vote 60초 타임아웃 ──
  useEffect(() => {
    if (phase !== 'day_vote') {
      if (dayVoteTimerRef.current) { clearInterval(dayVoteTimerRef.current); dayVoteTimerRef.current = null }
      setDayVoteTimeLeft(null)
      return
    }
    const VOTE_TIME = 60
    setDayVoteTimeLeft(VOTE_TIME)
    let t = VOTE_TIME
    dayVoteTimerRef.current = setInterval(() => {
      t--
      setDayVoteTimeLeft(t)
      if (t <= 0) {
        clearInterval(dayVoteTimerRef.current!)
        dayVoteTimerRef.current = null
        setDayVoteTimeLeft(null)
        if (isHost) {
          resolveDayVote(dayVoteMapRef.current, aliveIdsRef.current, assignmentsRef.current, true)
        }
      }
    }, 1000)
    return () => {
      if (dayVoteTimerRef.current) { clearInterval(dayVoteTimerRef.current); dayVoteTimerRef.current = null }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── broadcast channel ──
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`mafia-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
      // ── start countdown ──
      .on('broadcast', { event: 'mafia_start_countdown' }, () => {
        setStartCountdown(3)
        setPhase('starting')
        let n = 3
        const iv = setInterval(() => {
          n -= 1
          setStartCountdown(n)
          if (n <= 0) {
            clearInterval(iv)
            nightActionsRef.current = {}
            channelRef.current?.send({ type: 'broadcast', event: 'night_start', payload: { dayNum: 1 } })
          }
        }, 1000)
      })

      // ── role deal ──
      .on('broadcast', { event: 'mafia_deal' }, ({ payload }) => {
        const { assignments: a } = payload as { assignments: Record<string, Role> }
        const role = a[userId]
        if (role) {
          setMyRole(role)
          setAssignments(a)
          assignmentsRef.current = a
          setPhase('revealed')
        }
      })

      // ── night start ──
      .on('broadcast', { event: 'night_start' }, ({ payload }) => {
        const { dayNum: d } = payload as { dayNum: number }
        setDayNum(d)
        setNightActed(false)
        setPoliceResult(null)
        nightActionsRef.current = {}

        // citizens auto-submit immediately (host needs to know)
        const myCurrentRole = assignmentsRef.current[userId]
        if (myCurrentRole === '시민') {
          // citizen has no action — host will skip waiting for them
          // set nightActed so UI shows waiting screen
          setNightActed(true)
        }

        setPhase('night')
      })

      // ── night action (host collects) ──
      .on('broadcast', { event: 'mafia_night_action' }, ({ payload }) => {
        if (!isHost) return
        const { role, targetId, actorId } = payload as { role: Role; targetId: string; actorId: string }
        const actions = nightActionsRef.current
        if (role === '마피아') {
          const existing = actions.mafiaVotes ?? []
          // 같은 액터의 중복 투표 방지 (마지막 선택으로 덮어씀)
          const filtered = existing.filter(v => v.actorId !== actorId)
          actions.mafiaVotes = [...filtered, { actorId, targetId }]
        }
        if (role === '경찰') actions.police = targetId
        if (role === '의사') actions.doctor = targetId
        resolveNight(aliveIdsRef.current, assignmentsRef.current)
      })

      // ── night result ──
      .on('broadcast', { event: 'mafia_night_result' }, ({ payload }) => {
        const { killedId, policeId, policeTargetId, isMafiaTarget } =
          payload as { killedId: string | null; policeId: string; policeTargetId: string; isMafiaTarget: boolean }

        setNightDeath(killedId)

        if (policeTargetId && userId === policeId) {
          setPoliceResult({ targetId: policeTargetId, isMafia: isMafiaTarget })
        }

        setAliveIds(prev => {
          const next = killedId ? prev.filter(id => id !== killedId) : [...prev]
          aliveIdsRef.current = next
          return next
        })

        setPhase('day_announce')

        // all clients auto-advance to day_discuss after 4s
        setTimeout(() => {
          setPhase('day_discuss')
          setDayVoteMap({})
          setDayVotedFor(null)
          dayVoteMapRef.current = {}
        }, 4000)
      })

      // ── day vote ──
      .on('broadcast', { event: 'mafia_day_vote' }, ({ payload }) => {
        const { voterId, targetId } = payload as { voterId: string; targetId: string }
        setDayVoteMap(prev => {
          const next = { ...prev, [voterId]: targetId }
          dayVoteMapRef.current = next
          if (isHost) {
            resolveDayVote(next, aliveIdsRef.current, assignmentsRef.current)
          }
          return next
        })
      })

      // ── day result ──
      .on('broadcast', { event: 'mafia_day_result' }, ({ payload }) => {
        const { eliminatedId, winner: w } =
          payload as { eliminatedId: string | null; winner: 'mafia' | 'citizens' | null }

        setDayVoteTied(eliminatedId === null && w === null)
        setEliminated(eliminatedId)

        setAliveIds(prev => {
          const next = eliminatedId ? prev.filter(id => id !== eliminatedId) : [...prev]
          aliveIdsRef.current = next
          return next
        })

        if (w) {
          setWinner(w)
          setPhase('game_over')
          setTimeout(() => {
            const myCurrentRole = assignmentsRef.current[userId]
            const isMafia = myCurrentRole === '마피아'
            const won = (w === 'mafia' && isMafia) || (w === 'citizens' && !isMafia)
            if (won) { roundWinsRef.current += 1; setRoundWins(roundWinsRef.current) }
            if (currentRoundRef.current >= roundsRef.current) {
              setCanFinish(true)
            }
          }, 2000)
        } else {
          // next night
          setTimeout(() => {
            if (isHost) {
              nightActionsRef.current = {}
              channelRef.current?.send({
                type: 'broadcast',
                event: 'night_start',
                payload: { dayNum: dayNum + 1 },
              })
            }
          }, 3000)
        }
      })

      // ── start vote ──
      .on('broadcast', { event: 'mafia_start_vote' }, () => {
        setPhase('day_vote')
      })

      // ── next round ──
      .on('broadcast', { event: 'mafia_next_round' }, () => {
        const next = currentRoundRef.current + 1
        currentRoundRef.current = next
        setCurrentRound(next)
        // reset all game state
        setPhase(isHost ? 'setup' : 'waiting')
        setMyRole(null)
        setAssignments({})
        assignmentsRef.current = {}
        const freshAlive = gamePlayers.map(p => p.userId)
        aliveIdsRef.current = freshAlive
        setAliveIds(freshAlive)
        setDayNum(1)
        setNightActed(false)
        setNightDeath(null)
        setPoliceResult(null)
        setDayVotedFor(null)
        setDayVoteMap({})
        dayVoteMapRef.current = {}
        setEliminated(null)
        setWinner(null)
        setDayVoteTied(false)
        nightActionsRef.current = {}
      })

      .subscribe()

    return () => { channel.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── action senders ──
  function sendNightAction(targetId: string) {
    if (nightActed || !myRole) return
    setNightActed(true)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'mafia_night_action',
      payload: { role: myRole, targetId, actorId: userId },
    })
  }

  function sendDayVote(targetId: string) {
    if (dayVotedFor) return
    setDayVotedFor(targetId)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'mafia_day_vote',
      payload: { voterId: userId, targetId },
    })
  }

  const amAlive = aliveIds.includes(userId)

  // ══════════════════════════════════════════════
  //  PHASE UIs
  // ══════════════════════════════════════════════

  // ── setup ──
  if (phase === 'setup') {
    const specialRoles: { role: '마피아' | '경찰' | '의사'; min: number }[] = [
      { role: '마피아', min: 1 },
      { role: '경찰',   min: 0 },
      { role: '의사',   min: 0 },
    ]
    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <div>
          <div style={{ fontSize: 44, marginBottom: 4, lineHeight: 1 }}>🕵️</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>역할 구성</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {playerCount}명 참여 중
          </div>
        </div>

        <div className="glass p-4 w-full flex flex-col gap-3">
          {specialRoles.map(({ role, min }) => {
            const s = ROLE_STYLE[role]
            const count = roleCounts[role]
            const canDec = count > min
            const canInc = citizenCount > 1
            return (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 12px', borderRadius: 12, background: s.bg, border: `1px solid ${s.border}40` }}>
                  <span style={{ fontSize: 18 }}>{s.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{role}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <button onClick={() => adjustRole(role, -1)} disabled={!canDec} style={{ width: 36, height: 36, borderRadius: '10px 0 0 10px', border: '1px solid var(--border)', borderRight: 'none', background: canDec ? 'var(--surface)' : 'var(--surface2)', color: canDec ? 'var(--text)' : 'var(--text-dim)', fontSize: 18, fontWeight: 700, cursor: canDec ? 'pointer' : 'default' }}>−</button>
                  <div style={{ width: 44, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none', background: 'var(--surface)', fontFamily: "'Bebas Neue'", fontSize: 22, color: s.color }}>{count}</div>
                  <button onClick={() => adjustRole(role, +1)} disabled={!canInc} style={{ width: 36, height: 36, borderRadius: '0 10px 10px 0', border: '1px solid var(--border)', borderLeft: 'none', background: canInc ? 'var(--surface)' : 'var(--surface2)', color: canInc ? 'var(--text)' : 'var(--text-dim)', fontSize: 18, fontWeight: 700, cursor: canInc ? 'pointer' : 'default' }}>+</button>
                </div>
              </div>
            )
          })}

          {/* 시민 자동 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 12px', borderRadius: 12, background: ROLE_STYLE['시민'].bg, border: `1px solid ${ROLE_STYLE['시민'].border}40` }}>
              <span style={{ fontSize: 18 }}>{ROLE_STYLE['시민'].emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: ROLE_STYLE['시민'].color }}>시민</span>
            </div>
            <div style={{ width: 116, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isValid ? ROLE_STYLE['시민'].border + '60' : '#ef444460'}`, borderRadius: 10, background: isValid ? ROLE_STYLE['시민'].bg : 'rgba(239,68,68,0.08)', fontFamily: "'Bebas Neue'", fontSize: 22, color: isValid ? ROLE_STYLE['시민'].color : '#ef4444', gap: 4 }}>
              {citizenCount}
              <span style={{ fontSize: 11, fontFamily: 'Pretendard', fontWeight: 600, opacity: 0.7 }}>자동</span>
            </div>
          </div>

          {!isValid && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>시민이 최소 1명 이상이어야 합니다</div>}
        </div>

        <button className="btn-primary" onClick={deal} disabled={!isValid} style={{ opacity: isValid ? 1 : 0.4, cursor: isValid ? 'pointer' : 'default' }}>
          게임 시작하기
        </button>
      </div>
    )
  }

  // ── waiting ──
  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 36 }}>🕵️</div>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>방장이 역할을 배분하는 중...</div>
      </div>
    )
  }

  // ── starting ──
  if (phase === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 96, lineHeight: 1, color: 'var(--amber)', textShadow: '0 0 40px rgba(245,158,11,0.5)' }}>
          {startCountdown > 0 ? startCountdown : '🕵️'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>게임 시작!</div>
      </div>
    )
  }

  // ── revealed ──
  if (phase === 'revealed' && myRole) {
    const s = ROLE_STYLE[myRole]
    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <style>{`@keyframes flipIn { from { transform: perspective(600px) rotateY(-90deg); opacity: 0 } to { transform: perspective(600px) rotateY(0deg); opacity: 1 } }`}</style>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>나의 역할</div>
        <div style={{ width: 200, height: 280, borderRadius: 24, background: s.bg, border: `2px solid ${s.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 0 32px ${s.border}40, 0 8px 32px rgba(0,0,0,0.2)`, animation: 'flipIn 0.35s ease' }}>
          <span style={{ fontSize: 56, lineHeight: 1 }}>{s.emoji}</span>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 40, letterSpacing: '0.05em', color: s.color, textShadow: `0 0 20px ${s.border}80` }}>{myRole}</span>
          <span style={{ fontSize: 12, color: s.color, opacity: 0.8, padding: '0 20px', lineHeight: 1.5, textAlign: 'center' }}>{s.desc}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          다른 플레이어가 보지 못하도록<br />혼자 확인하세요
        </div>
        {isHost && (
          <button
            className="btn-primary"
            onClick={() => {
              channelRef.current?.send({ type: 'broadcast', event: 'mafia_start_countdown', payload: {} })
            }}
          >
            게임 시작 →
          </button>
        )}
        {!isHost && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>방장이 게임을 시작할 때까지 기다리세요</div>
        )}
      </div>
    )
  }

  // ── night ──
  if (phase === 'night' && myRole) {
    const s = ROLE_STYLE[myRole]

    const roleConfig: Record<'마피아' | '경찰' | '의사', { prompt: string; subPrompt: string; filter: (id: string) => boolean }> = {
      '마피아': { prompt: '제거할 대상을 선택하세요', subPrompt: '선택한 플레이어는 내일 아침 사라집니다', filter: (id) => id !== userId && assignments[id] !== '마피아' },
      '경찰':   { prompt: '수사할 대상을 선택하세요', subPrompt: '마피아 여부를 확인할 수 있습니다',        filter: (id) => id !== userId },
      '의사':   { prompt: '보호할 대상을 선택하세요', subPrompt: '마피아 공격으로부터 지킵니다',          filter: (_)  => true },
    }

    const isMafiaRole = myRole === '마피아'
    const accentColor = isMafiaRole ? '#ef4444' : myRole === '경찰' ? '#60a5fa' : '#4ade80'

    const stars = [
      { x: 5,  y: 3,  sz: 2, dur: 2.1, dl: 0.0 }, { x: 12, y: 8,  sz: 1, dur: 3.2, dl: 0.5 },
      { x: 22, y: 2,  sz: 2, dur: 2.7, dl: 1.1 }, { x: 35, y: 6,  sz: 1, dur: 4.0, dl: 0.3 },
      { x: 48, y: 1,  sz: 3, dur: 3.5, dl: 1.8 }, { x: 58, y: 5,  sz: 1, dur: 2.3, dl: 0.7 },
      { x: 67, y: 3,  sz: 2, dur: 3.8, dl: 1.4 }, { x: 75, y: 8,  sz: 1, dur: 2.9, dl: 0.2 },
      { x: 83, y: 2,  sz: 2, dur: 4.2, dl: 1.0 }, { x: 92, y: 6,  sz: 1, dur: 3.1, dl: 1.6 },
      { x: 96, y: 12, sz: 2, dur: 2.5, dl: 0.8 }, { x: 8,  y: 15, sz: 1, dur: 3.7, dl: 1.3 },
      { x: 18, y: 18, sz: 2, dur: 2.2, dl: 0.4 }, { x: 30, y: 12, sz: 1, dur: 4.5, dl: 1.9 },
      { x: 42, y: 16, sz: 2, dur: 3.0, dl: 0.6 }, { x: 55, y: 11, sz: 1, dur: 2.8, dl: 1.2 },
      { x: 63, y: 17, sz: 2, dur: 3.6, dl: 0.1 }, { x: 72, y: 13, sz: 1, dur: 4.1, dl: 1.7 },
      { x: 80, y: 18, sz: 2, dur: 2.4, dl: 0.9 }, { x: 88, y: 14, sz: 1, dur: 3.3, dl: 1.5 },
      { x: 3,  y: 22, sz: 2, dur: 2.6, dl: 0.3 }, { x: 25, y: 25, sz: 1, dur: 3.9, dl: 1.1 },
      { x: 50, y: 22, sz: 2, dur: 4.3, dl: 0.7 }, { x: 77, y: 24, sz: 1, dur: 2.0, dl: 1.4 },
      { x: 94, y: 20, sz: 2, dur: 3.4, dl: 0.5 },
    ]

    return (
      <div style={{ position: 'relative', margin: '-8px -16px -16px', width: 'calc(100% + 32px)', flex: 1, alignSelf: 'stretch', overflowY: 'auto', overflowX: 'hidden', background: `radial-gradient(ellipse at 50% -5%, ${accentColor}38 0%, #0d1b3e 35%, #071020 100%)` }}>
        <style>{`
          @keyframes ns-twinkle  { 0%,100% { opacity: 0.9 } 50% { opacity: 0.08 } }
          @keyframes ns-twinkle2 { 0%,100% { opacity: 0.3 } 50% { opacity: 1.0 } }
          @keyframes ns-float    { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-10px) } }
          @keyframes ns-moon     { 0%,100% { opacity: 0.65; filter: blur(55px) } 50% { opacity: 1; filter: blur(38px) } }
          @keyframes ns-fadeUp   { from { transform: translateY(18px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes ns-pulse    { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
          @keyframes ns-shimmer  { 0% { background-position: -200% center } 100% { background-position: 200% center } }
        `}</style>

        {/* 별 */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          {stars.map((st, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${st.x}%`, top: `${st.y}%`,
              width: st.sz, height: st.sz, borderRadius: '50%', background: 'white',
              animation: `${i % 2 === 0 ? 'ns-twinkle' : 'ns-twinkle2'} ${st.dur}s ease-in-out infinite`,
              animationDelay: `${st.dl}s`,
            }} />
          ))}
        </div>

        {/* 달빛 글로우 */}
        <div style={{ position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)', width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}40 0%, transparent 65%)`, animation: 'ns-moon 5s ease-in-out infinite', zIndex: 1, pointerEvents: 'none' }} />

        {/* 하단 안개 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, background: `linear-gradient(to top, ${accentColor}08 0%, transparent 100%)`, zIndex: 1, pointerEvents: 'none' }} />

        {/* 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 64px', gap: 22 }}>

          {/* 달 + 타이틀 */}
          <div style={{ textAlign: 'center', animation: 'ns-fadeUp 0.5s ease' }}>
            <div style={{ fontSize: 54, display: 'inline-block', animation: 'ns-float 5s ease-in-out infinite' }}>
              🌕
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.28em', textTransform: 'uppercase', marginTop: 10 }}>NIGHT {dayNum}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginTop: 6, letterSpacing: '0.02em', textShadow: `0 0 30px ${accentColor}60` }}>
              밤이 찾아왔습니다
            </div>
          </div>

          {/* 역할 뱃지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 99, background: s.bg, border: `1.5px solid ${s.border}`, boxShadow: `0 0 28px ${accentColor}50`, animation: 'ns-fadeUp 0.5s ease 0.1s both' }}>
            <span style={{ fontSize: 16 }}>{s.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.color, letterSpacing: '0.08em' }}>{myRole}</span>
          </div>

          {/* 사망 */}
          {!amAlive && (
            <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, padding: '28px 20px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', textAlign: 'center', animation: 'ns-fadeUp 0.4s ease 0.2s both' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>💀</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>사망했습니다</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>밤이 끝날 때까지 기다리세요</div>
            </div>
          )}

          {/* 시민 / 행동 완료 */}
          {amAlive && (myRole === '시민' || nightActed) && (
            <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, padding: '32px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', textAlign: 'center', animation: 'ns-fadeUp 0.4s ease 0.2s both' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', marginBottom: 14 }}>
                {nightActed && myRole !== '시민' ? '행동 완료' : '시민'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)', animation: 'ns-pulse 3s ease infinite' }}>
                {nightActed && myRole !== '시민' ? '다른 플레이어를 기다리는 중...' : '마피아가 활동 중입니다...'}
              </div>
            </div>
          )}

          {/* 타겟 선택 */}
          {amAlive && myRole !== '시민' && !nightActed && (() => {
            const cfg = roleConfig[myRole as '마피아' | '경찰' | '의사']
            const targets = aliveIds.filter(cfg.filter)
            const actionIcon = isMafiaRole ? '🎯' : myRole === '경찰' ? '🔍' : '💊'
            const actionLabel = isMafiaRole ? '제거' : myRole === '경찰' ? '조사' : '보호'
            return (
              <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16, animation: 'ns-fadeUp 0.4s ease 0.2s both' }}>

                {/* 프롬프트 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.color, marginBottom: 6, textShadow: `0 0 24px ${accentColor}90` }}>{cfg.prompt}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>{cfg.subPrompt}</div>
                </div>

                {/* 구분선 */}
                <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)` }} />

                {/* 타겟 버튼 목록 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {targets.map(tid => (
                    <button
                      key={tid}
                      onClick={() => sendNightAction(tid)}
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: 14,
                        border: `2px solid ${accentColor}99`,
                        background: 'rgba(255,255,255,0.15)',
                        cursor: 'pointer', transition: 'all 0.18s ease',
                        display: 'flex', alignItems: 'center', gap: 12,
                        WebkitTapHighlightColor: 'transparent',
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12)`,
                      }}
                      onMouseEnter={e => {
                        const btn = e.currentTarget as HTMLButtonElement
                        btn.style.background = `rgba(255,255,255,0.22)`
                        btn.style.borderColor = `${accentColor}ff`
                        btn.style.boxShadow = `0 0 24px ${accentColor}55, inset 0 1px 0 rgba(255,255,255,0.2)`
                        btn.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={e => {
                        const btn = e.currentTarget as HTMLButtonElement
                        btn.style.background = 'rgba(255,255,255,0.15)'
                        btn.style.borderColor = `${accentColor}99`
                        btn.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.12)`
                        btn.style.boxShadow = 'none'
                        btn.style.transform = 'translateY(0)'
                      }}
                    >
                      <span style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `${accentColor}30`,
                        border: `1.5px solid ${accentColor}90`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0,
                      }}>
                        {actionIcon}
                      </span>
                      <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#ffffff', textAlign: 'left' }}>
                        {getPlayerName(gamePlayers,tid)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, flexShrink: 0, letterSpacing: '0.04em' }}>
                        {actionLabel} →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // ── day_announce ──
  if (phase === 'day_announce') {
    const deadName = nightDeath ? getPlayerName(gamePlayers,nightDeath) : null
    return (
      <div style={{ position: 'relative', margin: '-8px -16px -16px', width: 'calc(100% + 32px)', flex: 1, alignSelf: 'stretch', overflowY: 'auto', overflowX: 'hidden', background: 'linear-gradient(180deg, #1a0e00 0%, #2d1a00 30%, #1a1200 100%)' }}>
        <style>{`
          @keyframes da-fadeDown { from { transform: translateY(-14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes da-fadeUp   { from { transform: translateY(14px);  opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes da-sun      { 0%,100% { opacity: 0.7; filter: blur(60px) } 50% { opacity: 1; filter: blur(40px) } }
          @keyframes da-ray      { 0%,100% { opacity: 0.04 } 50% { opacity: 0.10 } }
          @keyframes da-float    { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-8px) } }
          @keyframes da-pulse    { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
        `}</style>

        {/* 햇빛 글로우 */}
        <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 65%)', animation: 'da-sun 5s ease-in-out infinite', zIndex: 1, pointerEvents: 'none' }} />

        {/* 햇살 줄기 */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: '60%', transformOrigin: 'top center', transform: `rotate(${deg}deg)`, background: 'linear-gradient(to bottom, rgba(251,191,36,0.12), transparent)', animation: `da-ray ${2 + (i % 3) * 0.7}s ease-in-out infinite`, animationDelay: `${i * 0.15}s`, zIndex: 0, pointerEvents: 'none' }} />
        ))}

        {/* 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 20px 60px', gap: 18 }}>

          {/* 태양 + 타이틀 */}
          <div style={{ textAlign: 'center', animation: 'da-fadeDown 0.5s ease' }}>
            <div style={{ fontSize: 52, display: 'inline-block', animation: 'da-float 5s ease-in-out infinite' }}>☀️</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(251,191,36,0.55)', letterSpacing: '0.28em', textTransform: 'uppercase', marginTop: 10 }}>DAY {dayNum}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fef3c7', marginTop: 6, letterSpacing: '0.02em', textShadow: '0 0 30px rgba(251,191,36,0.6)' }}>
              {dayNum}일차 아침
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ width: '100%', maxWidth: 380, height: 1, background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)', animation: 'da-fadeDown 0.4s ease 0.1s both' }} />

          {/* 사망 공개 */}
          {deadName ? (
            <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, padding: '24px 20px', background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', textAlign: 'center', animation: 'da-fadeUp 0.5s ease 0.15s both' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(239,68,68,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>밤사이 사라진 플레이어</div>
              <div style={{ fontSize: 38, marginBottom: 8 }}>💀</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fca5a5' }}>{deadName}</div>
              {nightDeath === userId && (
                <div style={{ fontSize: 12, color: 'rgba(239,68,68,0.7)', marginTop: 8, fontWeight: 600 }}>당신이 제거되었습니다</div>
              )}
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, padding: '24px 20px', background: 'rgba(74,222,128,0.08)', border: '1.5px solid rgba(74,222,128,0.25)', textAlign: 'center', animation: 'da-fadeUp 0.5s ease 0.15s both' }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>🛡️</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#86efac' }}>아무도 죽지 않았습니다!</div>
              <div style={{ fontSize: 12, color: 'rgba(74,222,128,0.6)', marginTop: 6 }}>의사가 성공적으로 보호했습니다</div>
            </div>
          )}

          {/* 경찰 수사 결과 */}
          {policeResult && (
            <div style={{ width: '100%', maxWidth: 380, borderRadius: 16, padding: '14px 18px', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', animation: 'da-fadeUp 0.5s ease 0.25s both' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fde68a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>🔦 수사 결과 (나만 보임)</div>
              <div style={{ fontSize: 14, color: '#fef9c3' }}>
                <span style={{ fontWeight: 700 }}>{getPlayerName(gamePlayers,policeResult.targetId)}</span>
                {' → '}
                <span style={{ fontWeight: 800, color: policeResult.isMafia ? '#fca5a5' : '#93c5fd' }}>
                  {policeResult.isMafia ? '마피아!' : '시민'}
                </span>
              </div>
            </div>
          )}

          {/* 생존자 */}
          <div style={{ width: '100%', maxWidth: 380, borderRadius: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', animation: 'da-fadeUp 0.5s ease 0.3s both' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(254,243,199,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>생존자 {aliveIds.length}명</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {gamePlayers.map(p => {
                const alive = aliveIds.includes(p.userId)
                return (
                  <span key={p.userId} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: alive ? 'rgba(254,243,199,0.1)' : 'transparent', border: alive ? '1px solid rgba(254,243,199,0.2)' : 'none', color: alive ? (p.userId === userId ? '#fbbf24' : '#fef3c7') : 'rgba(255,255,255,0.25)', textDecoration: alive ? 'none' : 'line-through', opacity: alive ? 1 : 0.4 }}>
                    {alive ? '' : '💀 '}{p.name}
                  </span>
                )
              })}
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(254,243,199,0.4)', animation: 'da-pulse 2.5s ease infinite', letterSpacing: '0.04em' }}>
            잠시 후 토론이 시작됩니다...
          </div>
        </div>
      </div>
    )
  }

  // ── day_discuss ──
  if (phase === 'day_discuss') {
    const mins = Math.floor(discussTimeLeft / 60)
    const secs = discussTimeLeft % 60
    const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`
    const isUrgent = discussTimeLeft <= 10 && discussTimeLeft > 0
    const isWarning = discussTimeLeft <= 20 && discussTimeLeft > 10
    const timerColor = isUrgent ? '#ef4444' : isWarning ? '#f97316' : '#fbbf24'
    const bgGlow = isUrgent ? 'rgba(239,68,68,0.30)' : isWarning ? 'rgba(249,115,22,0.22)' : 'rgba(251,191,36,0.22)'

    return (
      <div style={{ position: 'relative', margin: '-8px -16px -16px', width: 'calc(100% + 32px)', flex: 1, alignSelf: 'stretch', overflowY: 'auto', overflowX: 'hidden', background: 'linear-gradient(180deg, #2c1a08 0%, #3d2510 45%, #251508 100%)' }}>
        <style>{`
          @keyframes dd-fadeUp   { from { transform: translateY(14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes dd-flicker  { 0%,100% { opacity: 1 } 30% { opacity: 0.75 } 60% { opacity: 0.9 } 80% { opacity: 0.7 } }
          @keyframes dd-shake    { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-4px) } 40% { transform: translateX(4px) } 60% { transform: translateX(-2px) } 80% { transform: translateX(2px) } }
          @keyframes dd-pulse    { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
          @keyframes dd-fire     { 0%,100% { opacity: 0.55; filter: blur(50px) } 50% { opacity: 0.9; filter: blur(35px) } }
        `}</style>

        {/* 횃불 글로우 */}
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${isUrgent ? 'rgba(239,68,68,0.45)' : 'rgba(251,146,60,0.45)'} 0%, transparent 65%)`, animation: 'dd-fire 3s ease-in-out infinite', zIndex: 0, pointerEvents: 'none', transition: 'background 1.5s ease' }} />
        {/* 하단 그라데이션 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to top, rgba(20,8,0,0.6), transparent)', zIndex: 0, pointerEvents: 'none' }} />

        {/* 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 56px', gap: 16 }}>

          {/* 헤더 */}
          <div style={{ textAlign: 'center', animation: 'dd-fadeUp 0.4s ease' }}>
            <div style={{ fontSize: 36, display: 'inline-block', animation: 'dd-flicker 2.5s ease-in-out infinite' }}>🔥</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(251,146,60,0.7)', letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 8 }}>DAY {dayNum} · 토론</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fde8c8', marginTop: 4, textShadow: '0 0 20px rgba(251,146,60,0.6)' }}>
              마피아를 찾아내세요
            </div>
          </div>

          {/* 타이머 카드 */}
          <div style={{
            width: '100%', maxWidth: 380,
            borderRadius: 20, padding: '20px',
            background: isUrgent ? 'rgba(239,68,68,0.18)' : 'rgba(251,146,60,0.12)',
            border: `2px solid ${isUrgent ? 'rgba(239,68,68,0.55)' : 'rgba(251,146,60,0.40)'}`,
            textAlign: 'center',
            boxShadow: isUrgent ? '0 0 30px rgba(239,68,68,0.25)' : '0 0 20px rgba(251,146,60,0.15)',
            transition: 'all 0.8s ease',
            animation: 'dd-fadeUp 0.4s ease 0.05s both',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: isUrgent ? 'rgba(252,165,165,0.8)' : 'rgba(253,186,116,0.8)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
              {isUrgent ? '⚠️ 시간 종료 임박' : isWarning ? '서두르세요' : '남은 시간'}
            </div>
            <div style={{
              fontFamily: "'Bebas Neue'", fontSize: 72, lineHeight: 1,
              color: isUrgent ? '#fca5a5' : isWarning ? '#fdba74' : '#fde8c8',
              textShadow: `0 0 32px ${isUrgent ? 'rgba(239,68,68,0.8)' : 'rgba(251,146,60,0.7)'}`,
              transition: 'all 0.5s ease',
              animation: isUrgent ? 'dd-shake 0.6s ease infinite' : 'none',
            }}>
              {timeStr}
            </div>
          </div>

          {/* 경찰 수사 결과 */}
          {policeResult && (
            <div style={{ width: '100%', maxWidth: 380, borderRadius: 14, padding: '12px 16px', background: 'rgba(250,204,21,0.12)', border: '1.5px solid rgba(250,204,21,0.35)', animation: 'dd-fadeUp 0.4s ease 0.1s both' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fde68a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>🔦 수사 결과 (나만 보임)</div>
              <div style={{ fontSize: 14, color: '#fef9c3', fontWeight: 600 }}>
                <span style={{ fontWeight: 700 }}>{getPlayerName(gamePlayers,policeResult.targetId)}</span>{' → '}
                <span style={{ fontWeight: 800, color: policeResult.isMafia ? '#fca5a5' : '#93c5fd' }}>
                  {policeResult.isMafia ? '마피아!' : '시민'}
                </span>
              </div>
            </div>
          )}

          {/* 플레이어 목록 */}
          <div style={{ width: '100%', maxWidth: 380, borderRadius: 16, overflow: 'hidden', border: '1.5px solid rgba(251,146,60,0.25)', animation: 'dd-fadeUp 0.4s ease 0.15s both' }}>
            <div style={{ padding: '11px 16px', background: 'rgba(251,146,60,0.30)', borderBottom: '1.5px solid rgba(251,146,60,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#fde8c8', letterSpacing: '0.08em' }}>
                생존자
              </span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#fbbf24', letterSpacing: '0.04em', textShadow: '0 0 12px rgba(251,191,36,0.6)' }}>
                {aliveIds.length} <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(253,186,116,0.7)' }}>/ {gamePlayers.length}명</span>
              </span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
              {gamePlayers.map((p, idx) => {
                const alive = aliveIds.includes(p.userId)
                const isMe = p.userId === userId
                return (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: isMe ? 'rgba(251,191,36,0.12)' : 'transparent', borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)', opacity: alive ? 1 : 0.4 }}>
                    <span style={{ fontSize: 16 }}>{alive ? (isMe ? '🙋' : '👤') : '💀'}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: alive ? (isMe ? '#fde68a' : '#fde8c8') : 'rgba(255,255,255,0.35)', textDecoration: alive ? 'none' : 'line-through' }}>
                      {p.name}{isMe ? ' (나)' : ''}
                    </span>
                    {!alive && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.08em' }}>사망</span>}
                    {alive && isMe && <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.06em' }}>나</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 버튼 / 안내 */}
          {isHost ? (
            <button
              onClick={() => channelRef.current?.send({ type: 'broadcast', event: 'mafia_start_vote', payload: {} })}
              style={{ width: '100%', maxWidth: 380, padding: '15px', borderRadius: 14, background: 'rgba(251,191,36,0.20)', border: '2px solid rgba(251,191,36,0.60)', color: '#fef3c7', fontSize: 15, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.04em', boxShadow: '0 0 20px rgba(251,191,36,0.2)', animation: 'dd-fadeUp 0.4s ease 0.2s both' }}
            >
              ⚖️ 투표 시작
            </button>
          ) : (
            <div style={{ fontSize: 12, color: isUrgent ? '#fca5a5' : 'rgba(253,186,116,0.6)', textAlign: 'center', fontWeight: isUrgent ? 700 : 400, animation: isUrgent ? 'dd-pulse 0.8s ease infinite' : 'none', letterSpacing: '0.04em' }}>
              {isUrgent ? '⚠️ 곧 투표가 시작됩니다!' : '방장이 투표를 시작할 때까지 기다리세요'}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── day_vote ──
  if (phase === 'day_vote') {
    const votable = aliveIds.filter(id => id !== userId)
    const totalAlive = aliveIds.length
    const votesCast = Object.keys(dayVoteMap).filter(vid => aliveIds.includes(vid)).length
    const tally: Record<string, number> = {}
    Object.values(dayVoteMap).forEach(tid => {
      if (aliveIds.includes(tid)) tally[tid] = (tally[tid] ?? 0) + 1
    })
    const maxVotes = Math.max(...Object.values(tally), 0)

    return (
      <div style={{ position: 'relative', margin: '-8px -16px -16px', width: 'calc(100% + 32px)', flex: 1, alignSelf: 'stretch', overflowY: 'auto', overflowX: 'hidden', background: 'linear-gradient(180deg, #1a0a0a 0%, #1f0f00 40%, #120800 100%)' }}>
        <style>{`
          @keyframes dv-fadeUp  { from { transform: translateY(14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes dv-pulse   { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
          @keyframes dv-glow    { 0%,100% { opacity: 0.5; filter: blur(60px) } 50% { opacity: 0.85; filter: blur(40px) } }
          @keyframes dv-flicker { 0%,100% { opacity: 0.7 } 25% { opacity: 1 } 75% { opacity: 0.5 } }
        `}</style>

        {/* 배경 글로우 */}
        <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 65%)', animation: 'dv-glow 4s ease-in-out infinite', zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, background: 'linear-gradient(to top, rgba(239,68,68,0.06), transparent)', zIndex: 0, pointerEvents: 'none' }} />

        {/* 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '44px 20px 60px', gap: 20 }}>

          {/* 타이틀 */}
          <div style={{ textAlign: 'center', animation: 'dv-fadeUp 0.4s ease' }}>
            <div style={{ fontSize: 46, display: 'inline-block', animation: 'dv-flicker 3s ease-in-out infinite' }}>⚖️</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(239,68,68,0.55)', letterSpacing: '0.28em', textTransform: 'uppercase', marginTop: 10 }}>DAY {dayNum} · VOTE</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff1f1', marginTop: 6, textShadow: '0 0 30px rgba(239,68,68,0.5)' }}>
              {!amAlive ? '관전 중' : dayVotedFor ? `${getPlayerName(gamePlayers,dayVotedFor)}에게 투표` : myRole === '마피아' ? '시민을 제거하세요' : '마피아를 제거하세요'}
            </div>
          </div>

          {/* 투표 진행도 */}
          <div style={{ width: '100%', maxWidth: 380, animation: 'dv-fadeUp 0.4s ease 0.05s both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>투표 현황</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {dayVoteTimeLeft !== null && (
                  <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, lineHeight: 1, color: dayVoteTimeLeft <= 10 ? '#ef4444' : 'rgba(255,255,255,0.35)', transition: 'color 0.3s' }}>
                    {dayVoteTimeLeft}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: votesCast === totalAlive ? '#4ade80' : '#fbbf24' }}>{votesCast} / {totalAlive}명</span>
              </div>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalAlive > 0 ? (votesCast / totalAlive) * 100 : 0}%`, background: votesCast === totalAlive ? '#4ade80' : 'linear-gradient(90deg, #ef4444, #f97316)', borderRadius: 99, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ width: '100%', maxWidth: 380, height: 1, background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)' }} />

          {/* 투표 전 — 후보 버튼 */}
          {amAlive && !dayVotedFor && (
            <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, animation: 'dv-fadeUp 0.4s ease 0.1s both' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textAlign: 'center' }}>제거할 플레이어를 선택하세요</div>
              {votable.map(tid => {
                const votes = tally[tid] ?? 0
                return (
                  <button
                    key={tid}
                    onClick={() => sendDayVote(tid)}
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 14,
                      border: '2px solid rgba(239,68,68,0.55)',
                      background: 'rgba(255,255,255,0.12)',
                      cursor: 'pointer', transition: 'all 0.18s ease',
                      display: 'flex', alignItems: 'center', gap: 12,
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
                    }}
                    onMouseEnter={e => {
                      const b = e.currentTarget as HTMLButtonElement
                      b.style.background = 'rgba(255,255,255,0.20)'
                      b.style.borderColor = 'rgba(239,68,68,0.90)'
                      b.style.boxShadow = '0 0 22px rgba(239,68,68,0.40), inset 0 1px 0 rgba(255,255,255,0.15)'
                      b.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      const b = e.currentTarget as HTMLButtonElement
                      b.style.background = 'rgba(255,255,255,0.12)'
                      b.style.borderColor = 'rgba(239,68,68,0.55)'
                      b.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.10)'
                      b.style.transform = 'translateY(0)'
                    }}
                  >
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(239,68,68,0.25)', border: '1.5px solid rgba(239,68,68,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>👤</span>
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#ffffff', textAlign: 'left' }}>{getPlayerName(gamePlayers,tid)}</span>
                    {votes > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.25)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(239,68,68,0.4)' }}>{votes}표</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* 투표 후 / 관전 — 득표 현황 */}
          {(dayVotedFor || !amAlive) && (
            <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, animation: 'dv-fadeUp 0.4s ease 0.1s both' }}>
              {aliveIds.map(tid => {
                const votes = tally[tid] ?? 0
                const pct = totalAlive > 0 ? (votes / totalAlive) * 100 : 0
                const isLeading = votes > 0 && votes === maxVotes
                const myVoteTarget = dayVoteMap[userId] === tid
                return (
                  <div key={tid} style={{ width: '100%', padding: '12px 16px', borderRadius: 16, background: isLeading ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${isLeading ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.09)'}`, transition: 'all 0.3s ease', boxShadow: isLeading ? '0 0 18px rgba(239,68,68,0.2)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15 }}>{isLeading ? '🎯' : '👤'}</span>
                        <span style={{ fontSize: 15, fontWeight: myVoteTarget ? 700 : 500, color: myVoteTarget ? '#fbbf24' : '#f1f5f9' }}>
                          {getPlayerName(gamePlayers,tid)}{myVoteTarget ? ' ✓' : ''}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isLeading ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}>{votes}표</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: isLeading ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'rgba(239,68,68,0.35)', borderRadius: 99, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
              {dayVoteTied && (
                <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(251,191,36,0.35)', textAlign: 'center', animation: 'dv-fadeUp 0.4s ease' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>🤝 동점 — 아무도 처형되지 않습니다</div>
                  <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.6)', marginTop: 4 }}>밤이 다시 찾아옵니다</div>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 4, animation: 'dv-pulse 2.5s ease infinite' }}>
                모두 투표하면 자동으로 결과가 나옵니다
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── game_over ──
  if (phase === 'game_over' && myRole) {
    const isMafia = myRole === '마피아'
    const won = (winner === 'mafia' && isMafia) || (winner === 'citizens' && !isMafia)
    const citizensWin = winner === 'citizens'
    const bgFrom = citizensWin ? '#001a3a' : '#1a0000'
    const bgMid  = citizensWin ? '#002a5c' : '#2a0000'
    const bgTo   = citizensWin ? '#001020' : '#120000'
    const glowColor = citizensWin ? 'rgba(96,165,250,0.45)' : 'rgba(239,68,68,0.45)'

    return (
      <div style={{ position: 'relative', margin: '-8px -16px -16px', width: 'calc(100% + 32px)', flex: 1, alignSelf: 'stretch', overflowY: 'auto', overflowX: 'hidden', background: `linear-gradient(180deg, ${bgFrom} 0%, ${bgMid} 35%, ${bgTo} 100%)` }}>
        <style>{`
          @keyframes go-popIn  { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          @keyframes go-fadeUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          @keyframes go-glow   { 0%,100% { opacity: 0.6; filter: blur(55px) } 50% { opacity: 1; filter: blur(38px) } }
          @keyframes go-float  { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-10px) } }
          @keyframes go-shine  { 0%,100% { opacity: 0.03 } 50% { opacity: 0.09 } }
        `}</style>

        {/* 배경 글로우 */}
        <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${glowColor} 0%, transparent 65%)`, animation: 'go-glow 5s ease-in-out infinite', zIndex: 0, pointerEvents: 'none' }} />
        {/* 햇살/빛줄기 */}
        {citizensWin && [0,40,80,120,160,200,240,280,320].map((deg, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: '55%', transformOrigin: 'top center', transform: `rotate(${deg}deg)`, background: 'linear-gradient(to bottom, rgba(96,165,250,0.1), transparent)', animation: `go-shine ${2.2 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s`, zIndex: 0, pointerEvents: 'none' }} />
        ))}

        {/* 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 64px', gap: 20 }}>

          {/* 라운드 표시 */}
          {rounds > 1 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', animation: 'go-fadeUp 0.3s ease' }}>
              ROUND {currentRound} / {rounds}  ·  {roundWins}승
            </div>
          )}

          {/* 메인 결과 */}
          <div style={{ textAlign: 'center', animation: 'go-popIn 0.55s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ fontSize: 64, display: 'inline-block', animation: 'go-float 4s ease-in-out infinite' }}>
              {citizensWin ? '🏆' : '🔪'}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: citizensWin ? 'rgba(96,165,250,0.6)' : 'rgba(239,68,68,0.6)', letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 12 }}>
              {citizensWin ? 'CITIZENS WIN' : 'MAFIA WIN'}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', marginTop: 6, letterSpacing: '0.02em', textShadow: `0 0 30px ${citizensWin ? 'rgba(96,165,250,0.7)' : 'rgba(239,68,68,0.7)'}` }}>
              {citizensWin ? '시민팀 승리' : '마피아 승리'}
            </div>
          </div>

          {/* 나의 결과 뱃지 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'go-fadeUp 0.4s ease 0.15s both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 99, background: won ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.12)', border: `1.5px solid ${won ? 'rgba(74,222,128,0.35)' : 'rgba(239,68,68,0.35)'}`, boxShadow: `0 0 20px ${won ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <span style={{ fontSize: 16 }}>{won ? '🎉' : '💀'}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: won ? '#86efac' : '#fca5a5' }}>
                {won ? '승리했습니다!' : '패배했습니다'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
              내 역할: <span style={{ fontWeight: 700, color: ROLE_STYLE[myRole].color }}>{myRole}</span>
            </div>
          </div>

          {/* 최후 제거 */}
          {eliminated && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', animation: 'go-fadeUp 0.4s ease 0.2s both' }}>
              최후 투표 제거 — <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{getPlayerName(gamePlayers,eliminated)}</span>
            </div>
          )}

          {/* 구분선 */}
          <div style={{ width: '100%', maxWidth: 380, height: 1, background: `linear-gradient(90deg, transparent, ${citizensWin ? 'rgba(96,165,250,0.35)' : 'rgba(239,68,68,0.35)'}, transparent)`, animation: 'go-fadeUp 0.4s ease 0.25s both' }} />

          {/* 전체 역할 공개 */}
          <div style={{ width: '100%', maxWidth: 380, borderRadius: 18, padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', animation: 'go-fadeUp 0.4s ease 0.3s both' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>전체 역할 공개</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gamePlayers.map(p => {
                const role = assignments[p.userId]
                if (!role) return null
                const rs = ROLE_STYLE[role]
                const isMe = p.userId === userId
                const survived = aliveIds.includes(p.userId)
                const isMafiaRole = role === '마피아'
                const rowBg     = isMafiaRole ? 'rgba(239,68,68,0.14)'       : 'rgba(96,165,250,0.10)'
                const rowBorder = isMafiaRole ? 'rgba(239,68,68,0.40)'       : 'rgba(96,165,250,0.30)'
                const badgeBg   = isMafiaRole ? 'rgba(239,68,68,0.22)'       : 'rgba(96,165,250,0.18)'
                const badgeColor= isMafiaRole ? '#fca5a5'                    : '#93c5fd'
                const meRing    = isMe ? (isMafiaRole ? '1.5px solid rgba(239,68,68,0.75)' : '1.5px solid rgba(96,165,250,0.65)') : `1px solid ${rowBorder}`
                return (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 12, background: rowBg, border: meRing, opacity: survived ? 1 : 0.45 }}>
                    <span style={{ fontSize: 18 }}>{survived ? rs.emoji : '💀'}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: survived ? '#f1f5f9' : 'rgba(255,255,255,0.35)', textDecoration: survived ? 'none' : 'line-through' }}>
                      {p.name}{isMe ? ' (나)' : ''}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: badgeColor, background: badgeBg, padding: '3px 10px', borderRadius: 8 }}>{role}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 다음 라운드 / 종료 */}
          <div style={{ width: '100%', maxWidth: 380, animation: 'go-fadeUp 0.4s ease 0.4s both' }}>
            {currentRound < rounds ? (
              isHost ? (
                <button
                  onClick={() => channelRef.current?.send({ type: 'broadcast', event: 'mafia_next_round', payload: {} })}
                  style={{ width: '100%', padding: '15px', borderRadius: 16, border: `1.5px solid ${citizensWin ? 'rgba(96,165,250,0.5)' : 'rgba(239,68,68,0.5)'}`, background: citizensWin ? 'rgba(96,165,250,0.12)' : 'rgba(239,68,68,0.12)', color: '#ffffff', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em' }}
                >
                  다음 라운드 시작 ({currentRound + 1} / {rounds}) →
                </button>
              ) : (
                <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>방장이 다음 라운드를 시작할 때까지 기다리세요</div>
              )
            ) : (
              <button
                onClick={() => { if (canFinish) onCompleteRef.current(roundWinsRef.current * 100) }}
                disabled={!canFinish}
                style={{
                  width: '100%', padding: '15px', borderRadius: 16,
                  border: `1.5px solid ${canFinish ? (citizensWin ? 'rgba(96,165,250,0.6)' : 'rgba(239,68,68,0.6)') : 'rgba(255,255,255,0.1)'}`,
                  background: canFinish ? (citizensWin ? 'rgba(96,165,250,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.04)',
                  color: canFinish ? '#ffffff' : 'rgba(255,255,255,0.3)',
                  fontSize: 15, fontWeight: 700,
                  cursor: canFinish ? 'pointer' : 'default',
                  letterSpacing: '0.03em',
                  transition: 'all 0.3s ease',
                }}
              >
                {canFinish ? '최종 결과 확인 →' : '결과 집계 중...'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── fallback ──
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center w-full" style={{ minHeight: 200 }}>
      <div style={{ fontSize: 36 }}>⏳</div>
      <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>잠시만 기다려주세요...</div>
    </div>
  )
}

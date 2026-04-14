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
}

type Role = '마피아' | '시민' | '경찰' | '의사'
type Phase =
  | 'setup'
  | 'waiting'
  | 'revealed'
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

export default function MafiaGameBattle({ onComplete, roomCode, userId, myName, players, isHost }: Props) {
  const playerCount = players.length
  const defaultCount = DEFAULT_COUNTS[Math.min(Math.max(playerCount, 3), 10)] ?? DEFAULT_COUNTS[3]

  // ── core state ──
  const [phase, setPhase] = useState<Phase>(isHost ? 'setup' : 'waiting')
  const [roleCounts, setRoleCounts] = useState(defaultCount)
  const [myRole, setMyRole] = useState<Role | null>(null)
  const [assignments, setAssignments] = useState<Record<string, Role>>({})
  const [aliveIds, setAliveIds] = useState<string[]>(players.map(p => p.userId))
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

  // ── refs ──
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  // host collects night actions
  const nightActionsRef = useRef<{ mafia?: string; police?: string; doctor?: string }>({})
  // stable refs for state used in callbacks
  const aliveIdsRef = useRef<string[]>(aliveIds)
  aliveIdsRef.current = aliveIds
  const assignmentsRef = useRef<Record<string, Role>>(assignments)
  assignmentsRef.current = assignments
  const dayVoteMapRef = useRef<Record<string, string>>(dayVoteMap)
  dayVoteMapRef.current = dayVoteMap
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
    players.forEach((p, i) => { newAssignments[p.userId] = shuffledRoles[i] })

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

    const needPolice = !!alivePolice
    const needDoctor = !!aliveDoctor
    const hasAll =
      actions.mafia !== undefined &&
      (!needPolice || actions.police !== undefined) &&
      (!needDoctor || actions.doctor !== undefined)

    if (!hasAll) return

    let killedId: string | null = actions.mafia ?? null
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
  const resolveDayVote = useCallback((voteMap: Record<string, string>, alive: string[], assign: Record<string, Role>) => {
    // check if all alive players voted
    const totalVoters = alive.length
    const votesReceived = Object.keys(voteMap).filter(vid => alive.includes(vid)).length
    if (votesReceived < totalVoters) return

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
    const DISCUSS_TIME = Math.max(60, Math.min(180, players.length * 30))
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

  // ── broadcast channel ──
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`mafia-${roomCode}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = channel

    channel
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
        const { role, targetId } = payload as { role: Role; targetId: string; actorId: string }
        const actions = nightActionsRef.current
        if (role === '마피아') actions.mafia = targetId
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

        setEliminated(eliminatedId)

        setAliveIds(prev => {
          const next = eliminatedId ? prev.filter(id => id !== eliminatedId) : [...prev]
          aliveIdsRef.current = next
          return next
        })

        if (w) {
          setWinner(w)
          setPhase('game_over')
          // score after short delay so state settles
          setTimeout(() => {
            const myCurrentRole = assignmentsRef.current[userId]
            const isMafia = myCurrentRole === '마피아'
            const won = (w === 'mafia' && isMafia) || (w === 'citizens' && !isMafia)
            onCompleteRef.current(won ? 100 : 0)
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
          역할 배분하기
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
              nightActionsRef.current = {}
              channelRef.current?.send({ type: 'broadcast', event: 'night_start', payload: { dayNum: 1 } })
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
    const nightBg: React.CSSProperties = {
      background: 'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(10,10,30,0.96) 100%)',
      borderRadius: 20,
      padding: '24px 16px',
      width: '100%',
    }

    // dead players see a waiting screen
    if (!amAlive) {
      return (
        <div className="flex flex-col items-center gap-4 text-center w-full" style={nightBg}>
          <div style={{ fontSize: 40 }}>💀</div>
          <div style={{ fontSize: 16, color: '#aaa', fontWeight: 700 }}>당신은 사망했습니다</div>
          <div style={{ fontSize: 13, color: '#666' }}>밤이 끝날 때까지 기다리세요...</div>
        </div>
      )
    }

    if (nightActed) {
      return (
        <div className="flex flex-col items-center gap-4 text-center w-full" style={nightBg}>
          <div style={{ fontSize: 40 }}>🌙</div>
          <div style={{ fontSize: 15, color: '#aaa' }}>행동 완료</div>
          <div style={{ fontSize: 13, color: '#666' }}>밤이 끝날 때까지 기다려요...</div>
        </div>
      )
    }

    // 시민: no action
    if (myRole === '시민') {
      return (
        <div className="flex flex-col items-center gap-4 text-center w-full" style={nightBg}>
          <div style={{ fontSize: 48 }}>🌙</div>
          <div style={{ fontSize: 18, color: '#ccc', fontWeight: 700 }}>눈을 감으세요</div>
          <div style={{ fontSize: 13, color: '#666' }}>마피아가 활동 중입니다...</div>
        </div>
      )
    }

    // special roles — pick target
    const roleConfig: Record<'마피아' | '경찰' | '의사', { title: string; prompt: string; color: string; filter: (id: string) => boolean }> = {
      '마피아': {
        title: '마피아',
        prompt: '누구를 제거할까요?',
        color: '#ef4444',
        filter: (id) => id !== userId && assignments[id] !== '마피아',
      },
      '경찰': {
        title: '경찰',
        prompt: '누구의 정체를 확인할까요?',
        color: '#facc15',
        filter: (id) => id !== userId,
      },
      '의사': {
        title: '의사',
        prompt: '누구를 보호할까요?',
        color: '#4ade80',
        filter: (id) => true,
      },
    }

    const cfg = roleConfig[myRole as '마피아' | '경찰' | '의사']
    const targets = aliveIds.filter(cfg.filter)
    const s = ROLE_STYLE[myRole]

    return (
      <div className="flex flex-col items-center gap-5 text-center w-full" style={nightBg}>
        <div style={{ fontSize: 32 }}>{s.emoji}</div>
        <div>
          <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{cfg.title}</div>
          <div style={{ fontSize: 16, color: '#ddd', fontWeight: 700 }}>{cfg.prompt}</div>
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {targets.map(tid => (
            <button
              key={tid}
              onClick={() => sendNightAction(tid)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${cfg.color}40`,
                background: `${cfg.color}15`,
                color: '#eee',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${cfg.color}30` }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${cfg.color}15` }}
            >
              {getPlayerName(players, tid)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── day_announce ──
  if (phase === 'day_announce') {
    const deadName = nightDeath ? getPlayerName(players, nightDeath) : null
    return (
      <div className="flex flex-col items-center gap-5 text-center w-full">
        <style>{`@keyframes fadeDown { from { transform: translateY(-16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
        <div style={{ fontSize: 48, animation: 'fadeDown 0.5s ease' }}>☀️</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', animation: 'fadeDown 0.5s ease 0.1s both' }}>
          {dayNum}일차 아침
        </div>
        {deadName ? (
          <div className="glass p-4 w-full" style={{ animation: 'fadeDown 0.5s ease 0.2s both' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>밤사이 사라진 플레이어</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>💀 {deadName}</div>
            {nightDeath === userId && (
              <div style={{ fontSize: 12, color: '#ef444480', marginTop: 4 }}>당신이 제거되었습니다</div>
            )}
          </div>
        ) : (
          <div className="glass p-4 w-full" style={{ animation: 'fadeDown 0.5s ease 0.2s both' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>🛡 아무도 죽지 않았습니다!</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>의사가 성공적으로 보호했습니다</div>
          </div>
        )}
        {policeResult && (
          <div className="glass p-3 w-full" style={{ border: '1px solid #facc1540', animation: 'fadeDown 0.5s ease 0.3s both' }}>
            <div style={{ fontSize: 11, color: '#facc15', fontWeight: 700, marginBottom: 4 }}>🔦 수사 결과</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              <span style={{ fontWeight: 700 }}>{getPlayerName(players, policeResult.targetId)}</span>은(는){' '}
              <span style={{ fontWeight: 700, color: policeResult.isMafia ? '#ef4444' : '#60a5fa' }}>
                {policeResult.isMafia ? '마피아입니다!' : '시민입니다'}
              </span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>잠시 후 토론이 시작됩니다...</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: -8 }}>
          생존자 {aliveIds.length}명
        </div>
      </div>
    )
  }

  // ── day_discuss ──
  if (phase === 'day_discuss') {
    const mins = Math.floor(discussTimeLeft / 60)
    const secs = discussTimeLeft % 60
    const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`
    const timerColor = discussTimeLeft <= 10 ? '#ef4444' : discussTimeLeft <= 20 ? '#f97316' : 'var(--text)'
    return (
      <div className="flex flex-col items-center gap-5 text-center w-full">
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>☀️ {dayNum}일차 토론</div>

        {/* timer */}
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 56, color: timerColor, lineHeight: 1, transition: 'color 0.3s' }}>
          {timeStr}
        </div>

        {policeResult && (
          <div className="glass p-3 w-full" style={{ border: '1px solid #facc1540' }}>
            <div style={{ fontSize: 11, color: '#facc15', fontWeight: 700, marginBottom: 4 }}>🔦 내 수사 결과</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              <span style={{ fontWeight: 700 }}>{getPlayerName(players, policeResult.targetId)}</span>
              {' '}→ {' '}
              <span style={{ fontWeight: 700, color: policeResult.isMafia ? '#ef4444' : '#60a5fa' }}>
                {policeResult.isMafia ? '마피아' : '시민'}
              </span>
            </div>
          </div>
        )}

        {/* alive players */}
        <div className="glass p-3 w-full" style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
            생존자 ({aliveIds.length}명)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {aliveIds.map(id => (
              <div key={id} style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, color: id === userId ? 'var(--amber)' : 'var(--text)', fontWeight: id === userId ? 700 : 400 }}>
                {getPlayerName(players, id)}{id === userId ? ' (나)' : ''}
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <button className="btn-primary" style={{ width: '100%' }} onClick={() => setPhase('day_vote')}>
            투표 시작
          </button>
        )}
        {!isHost && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>타이머가 끝나면 투표가 시작됩니다</div>
        )}
      </div>
    )
  }

  // ── day_vote ──
  if (phase === 'day_vote') {
    const votable = aliveIds.filter(id => id !== userId)
    const totalAlive = aliveIds.length
    const votesCast = Object.keys(dayVoteMap).filter(vid => aliveIds.includes(vid)).length
    // tally for display
    const tally: Record<string, number> = {}
    Object.values(dayVoteMap).forEach(tid => {
      if (aliveIds.includes(tid)) tally[tid] = (tally[tid] ?? 0) + 1
    })

    return (
      <div className="flex flex-col items-center gap-5 text-center w-full">
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🗳 투표</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {votesCast}/{totalAlive}명 투표 완료
        </div>

        {!amAlive && (
          <div className="glass p-4 w-full" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            💀 사망 — 투표를 관전 중입니다
          </div>
        )}

        {amAlive && !dayVotedFor && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>제거할 플레이어를 선택하세요</div>
            {votable.map(tid => (
              <button
                key={tid}
                onClick={() => sendDayVote(tid)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{getPlayerName(players, tid)}</span>
                {tally[tid] ? <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{tally[tid]}표</span> : null}
              </button>
            ))}
          </div>
        )}

        {(dayVotedFor || !amAlive) && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayVotedFor && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                {getPlayerName(players, dayVotedFor)}에게 투표했습니다
              </div>
            )}
            {/* vote tallies */}
            {aliveIds.map(tid => {
              const votes = tally[tid] ?? 0
              const pct = totalAlive > 0 ? (votes / totalAlive) * 100 : 0
              return (
                <div key={tid} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text)', fontWeight: dayVoteMap[userId] === tid ? 700 : 400 }}>
                      {getPlayerName(players, tid)}{dayVoteMap[userId] === tid ? ' ✓' : ''}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{votes}표</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#ef4444', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              모든 플레이어가 투표하면 자동으로 결과가 나옵니다
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── game_over ──
  if (phase === 'game_over' && myRole) {
    const isMafia = myRole === '마피아'
    const won = (winner === 'mafia' && isMafia) || (winner === 'citizens' && !isMafia)

    return (
      <div className="flex flex-col items-center gap-5 text-center w-full">
        <style>{`
          @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        `}</style>

        <div style={{ animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)', fontSize: 64 }}>
          {winner === 'citizens' ? '🏆' : '🔪'}
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: '0.05em', animation: 'fadeUp 0.4s ease 0.2s both', color: winner === 'citizens' ? '#60a5fa' : '#ef4444' }}>
          {winner === 'citizens' ? '시민팀 승리!' : '마피아 승리!'}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, animation: 'fadeUp 0.4s ease 0.3s both', color: won ? '#4ade80' : '#ef4444' }}>
          {won ? '승리했습니다! 🎉' : '패배했습니다 💀'}
        </div>

        {eliminated && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', animation: 'fadeUp 0.4s ease 0.35s both' }}>
            최후 투표 제거: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{getPlayerName(players, eliminated)}</span>
          </div>
        )}

        {/* all role reveals */}
        <div className="glass p-4 w-full" style={{ animation: 'fadeUp 0.4s ease 0.4s both', textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>전체 역할 공개</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map(p => {
              const role = assignments[p.userId]
              if (!role) return null
              const s = ROLE_STYLE[role]
              const isMe = p.userId === userId
              const survived = aliveIds.includes(p.userId)
              return (
                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 10, background: isMe ? `${s.border}20` : 'transparent', border: isMe ? `1px solid ${s.border}40` : '1px solid transparent' }}>
                  <span style={{ fontSize: 16 }}>{survived ? s.emoji : '💀'}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 400, color: survived ? 'var(--text)' : 'var(--text-dim)', textDecoration: survived ? 'none' : 'line-through' }}>
                    {p.name}{isMe ? ' (나)' : ''}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 6 }}>{role}</span>
                </div>
              )
            })}
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

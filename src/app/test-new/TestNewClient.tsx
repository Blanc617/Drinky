'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SpotDifferenceTest from '@/components/SpotDifferenceTest'
import CapitalQuizTest from '@/components/CapitalQuizTest'
import GeneralQuizTest from '@/components/GeneralQuizTest'
import FallingCatchTest from '@/components/FallingCatchTest'
import BeatTimingTest from '@/components/BeatTimingTest'
import RhythmTapTest from '@/components/RhythmTapTest'
import RhythmCopyTest from '@/components/RhythmCopyTest'
import ReactionTest from '@/components/ReactionTest'
import CognitionTest from '@/components/CognitionTest'
import StroopTest from '@/components/StroopTest'
import RpsLoserTest from '@/components/RpsLoserTest'
import BalanceTest from '@/components/BalanceTest'
import RunnerTest from '@/components/RunnerTest'
import NunchiGame from '@/components/NunchiGame'
import ThreeSixNineGame from '@/components/ThreeSixNineGame'
import ChoSeongGame from '@/components/ChoSeongGame'
import MafiaGame from '@/components/MafiaGame'
import LiarGame from '@/components/LiarGame'
import TimingChallenge from '@/components/TimingChallenge'
import BalanceGame from '@/components/BalanceGame'
import MindMeldGame from '@/components/MindMeldGame'

type GameKey = 'reaction' | 'cognition' | 'stroop' | 'rps' | 'balance' | 'spot' | 'capital' | 'general' | 'falling' | 'beat' | 'rhythmtap' | 'rhythmcopy' | 'runner' | 'nunchi' | 'threesixnine' | 'choseong' | 'mafia' | 'liar' | 'timing' | 'balancegame' | 'mindmeld'

const GAMES: { key: GameKey; emoji: string; label: string; tag: '기존' | '신규' | '리듬' | '술게임'; minPlayers?: number; players?: string }[] = [
  { key: 'reaction',   emoji: '🐹', label: '두더지 잡기',     tag: '기존' },
  { key: 'cognition',  emoji: '🎨', label: '색 순서 기억',    tag: '기존' },
  { key: 'stroop',     emoji: '🌈', label: '스트룹 테스트',   tag: '기존' },
  { key: 'rps',        emoji: '✊', label: '지는 가위바위보', tag: '기존' },
  { key: 'balance',    emoji: '🧘', label: '균형 감각',        tag: '기존' },
  { key: 'spot',       emoji: '🔍', label: '틀린 그림 찾기',  tag: '신규' },
  { key: 'capital',    emoji: '🌍', label: '수도 맞추기',      tag: '신규' },
  { key: 'general',    emoji: '🧠', label: '상식 퀴즈',        tag: '신규' },
  { key: 'falling',    emoji: '🍺', label: '술이 내린다',      tag: '신규' },
  { key: 'beat',       emoji: '🎯', label: '박자 맞추기',      tag: '리듬' },
  { key: 'rhythmtap',  emoji: '👈', label: '연타 리듬',        tag: '리듬' },
  { key: 'rhythmcopy', emoji: '🥁', label: '리듬 따라치기',    tag: '리듬' },
  { key: 'runner',     emoji: '🏃', label: '달리기 장애물',    tag: '리듬' },
  { key: 'mindmeld',     emoji: '🧠', label: '이심전심',       tag: '술게임', minPlayers: 2, players: '2명' },
  { key: 'timing',       emoji: '⚡', label: '타이밍 챌린지',  tag: '술게임', minPlayers: 2, players: '2명+' },
  { key: 'choseong',     emoji: '🔤', label: '초성게임',       tag: '술게임', minPlayers: 2, players: '2명+' },
  { key: 'nunchi',       emoji: '👀', label: '눈치게임',       tag: '술게임', minPlayers: 3, players: '3명+' },
  { key: 'threesixnine', emoji: '3️⃣', label: '369 게임',       tag: '술게임', minPlayers: 3, players: '3명+' },
  { key: 'liar',         emoji: '🤥', label: '라이어게임',     tag: '술게임', minPlayers: 3, players: '3명+' },
  { key: 'balancegame',  emoji: '⚖️', label: '밸런스게임',     tag: '술게임', minPlayers: 3, players: '3명+' },
  { key: 'mafia',        emoji: '🕵️', label: '마피아게임',     tag: '술게임', minPlayers: 5, players: '5명+' },
]

export default function TestNewClient() {
  const searchParams = useSearchParams()
  const drinkingOnly = searchParams.get('mode') === 'drinking'
  const router = useRouter()

  const [playing, setPlaying] = useState<GameKey | null>(null)
  const [lastScore, setLastScore] = useState<{ key: GameKey; score: number } | null>(null)

  function handleComplete(key: GameKey, score: number) {
    setLastScore({ key, score })
    setPlaying(null)
  }

  if (playing) {
    const game = GAMES.find(g => g.key === playing)
    return (
      <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ←
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{game?.label}</span>
        </div>
        <div className="flex flex-col flex-1 items-center justify-start pt-4">
          {playing === 'reaction' && <ReactionTest      onComplete={(s) => handleComplete('reaction', s)} />}
          {playing === 'cognition' && <CognitionTest    onComplete={(s) => handleComplete('cognition', s)} />}
          {playing === 'stroop'   && <StroopTest        onComplete={(s) => handleComplete('stroop', s)} />}
          {playing === 'rps'      && <RpsLoserTest      onComplete={(s) => handleComplete('rps', s)} />}
          {playing === 'balance'  && <BalanceTest       onComplete={(s) => handleComplete('balance', s)} />}
          {playing === 'spot'     && <SpotDifferenceTest onComplete={(s) => handleComplete('spot', s)} />}
          {playing === 'capital'  && <CapitalQuizTest   onComplete={(s) => handleComplete('capital', s)} />}
          {playing === 'general'  && <GeneralQuizTest   onComplete={(s) => handleComplete('general', s)} />}
          {playing === 'falling'    && <FallingCatchTest  onComplete={(s) => handleComplete('falling', s)} />}
          {playing === 'beat'       && <BeatTimingTest    onComplete={(s) => handleComplete('beat', s)} />}
          {playing === 'rhythmtap'  && <RhythmTapTest     onComplete={(s) => handleComplete('rhythmtap', s)} />}
          {playing === 'rhythmcopy' && <RhythmCopyTest    onComplete={(s) => handleComplete('rhythmcopy', s)} />}
          {playing === 'runner'       && <RunnerTest         onComplete={(s) => handleComplete('runner', s)} />}
          {playing === 'nunchi'       && <NunchiGame        onComplete={(s) => handleComplete('nunchi', s)} />}
          {playing === 'threesixnine' && <ThreeSixNineGame  onComplete={(s) => handleComplete('threesixnine', s)} />}
          {playing === 'choseong'     && <ChoSeongGame      onComplete={(s) => handleComplete('choseong', s)} />}
          {playing === 'mafia'        && <MafiaGame         onComplete={(s) => handleComplete('mafia', s)} />}
          {playing === 'liar'         && <LiarGame          onComplete={(s) => handleComplete('liar', s)} />}
          {playing === 'timing'       && <TimingChallenge   onComplete={(s) => handleComplete('timing', s)} />}
          {playing === 'balancegame'  && <BalanceGame       onComplete={(s) => handleComplete('balancegame', s)} />}
          {playing === 'mindmeld'     && <MindMeldGame      onComplete={(s) => handleComplete('mindmeld', s)} />}
        </div>
      </main>
    )
  }

  const existing = GAMES.filter(g => g.tag === '기존')
  const newer = GAMES.filter(g => g.tag === '신규')
  const rhythm = GAMES.filter(g => g.tag === '리듬')
  const drinking = GAMES.filter(g => g.tag === '술게임').sort((a, b) => (a.minPlayers ?? 0) - (b.minPlayers ?? 0))

  const sections = drinkingOnly
    ? [{ label: '술게임', list: drinking }]
    : [{ label: '기존 게임', list: existing }, { label: '신규 게임', list: newer }, { label: '리듬 게임', list: rhythm }, { label: '술게임', list: drinking }]

  return (
    <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-6" style={{ overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            cursor: 'pointer', color: 'var(--text)', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            {drinkingOnly ? '🍺 술자리 게임' : '게임 테스트'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {drinkingOnly ? `${drinking.length}개 게임` : `전체 ${GAMES.length}개 게임`}
          </div>
        </div>
      </div>

      {lastScore && (
        <div className="glass p-4" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{GAMES.find(g => g.key === lastScore.key)?.emoji}</span>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{GAMES.find(g => g.key === lastScore.key)?.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>점수: {lastScore.score}</div>
          </div>
        </div>
      )}

      {sections.map(({ label, list }) => (
        <div key={label} className="flex flex-col gap-3">
          {!drinkingOnly && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>}
          {list.map(({ key, emoji, label: name, players }) => (
            <button
              key={key}
              onClick={() => setPlaying(key)}
              className="glass"
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '18px 20px', borderRadius: 20,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: 'var(--surface)', textAlign: 'left', width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 32 }}>{emoji}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
              {players && (
                <span style={{
                  marginLeft: 'auto', fontSize: 12, fontWeight: 600,
                  color: 'var(--amber)', background: 'var(--amber-light)',
                  padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                }}>👥 {players}</span>
              )}
              <span style={{ color: 'var(--text-dim)', fontSize: 18, ...(players ? {} : { marginLeft: 'auto' }) }}>→</span>
            </button>
          ))}
        </div>
      ))}
    </main>
  )
}

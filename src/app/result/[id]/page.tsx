'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INTOXICATION_LEVELS } from '@/types'

const LEVEL_CONFIG: Record<number, { color: string; glow: string; emoji: string }> = {
  1: { color: '#4ade80', glow: 'rgba(74,222,128,0.3)', emoji: '😎' },
  2: { color: '#a3e635', glow: 'rgba(163,230,53,0.3)', emoji: '😄' },
  3: { color: '#facc15', glow: 'rgba(250,204,21,0.3)', emoji: '😊' },
  4: { color: '#f59e0b', glow: 'rgba(245,158,11,0.3)', emoji: '🥴' },
  5: { color: '#f97316', glow: 'rgba(249,115,22,0.3)', emoji: '😵' },
  6: { color: '#ef4444', glow: 'rgba(239,68,68,0.3)', emoji: '🚨' },
  7: { color: '#dc2626', glow: 'rgba(220,38,38,0.3)', emoji: '💀' },
}

export default function ResultPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<{
    intoxication_level: number
    intoxication_percentage: number
    reaction_score: number
    cognition_score: number
    pronunciation_score: number
    balance_score: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      supabase.from('measurements').select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            setError('결과를 불러오지 못했습니다.')
          } else {
            setData(data)
          }
        })
    })
  }, [params.id])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{error}</div>
        <button className="btn-secondary" onClick={() => router.push('/')}>홈으로</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>결과 불러오는 중...</div>
      </div>
    )
  }

  const level = INTOXICATION_LEVELS.find((l) => l.level === data.intoxication_level)
  const config = LEVEL_CONFIG[data.intoxication_level] ?? LEVEL_CONFIG[4]

  return (
    <main className="flex flex-col flex-1 px-6 py-12 gap-8">
      {/* 뒤로가기 */}
      <div>
        <button
          onClick={() => router.back()}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
      </div>

      {/* 결과 메인 */}
      <div className="flex flex-col items-center gap-3 text-center pt-4">
        <div style={{ fontSize: 56, animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          {config.emoji}
        </div>
        <div style={{
          fontFamily: "'Bebas Neue'", fontSize: 96, lineHeight: 1,
          color: config.color,
          textShadow: `0 0 40px ${config.glow}, 0 0 80px ${config.glow}`,
          animation: 'fadeUp 0.6s ease 0.2s both',
        }}>
          {data.intoxication_percentage}
          <span style={{ fontSize: 40 }}>%</span>
        </div>
        <div style={{
          fontSize: 24, fontWeight: 700, color: config.color,
          animation: 'fadeUp 0.6s ease 0.3s both',
        }}>
          {level?.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', animation: 'fadeUp 0.6s ease 0.4s both' }}>
          기준선 대비 수행 능력
        </div>
      </div>

      {/* 세부 점수 */}
      <div className="glass p-5 flex flex-col gap-4" style={{ animation: 'fadeUp 0.6s ease 0.5s both' }}>
        {[
          { label: '반응속도', value: `${Math.round(data.reaction_score)}ms`, note: '낮을수록 좋음', icon: '⚡' },
          { label: '인지', value: `${Math.round(data.cognition_score)}%`, icon: '🧠' },
          { label: '스트룹', value: `${Math.round(data.pronunciation_score)}%`, icon: '🎨' },
          { label: '가위바위보', value: `${Math.round(data.balance_score)}점`, icon: '✌️' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', flex: 1 }}>{item.label}</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{item.value}</div>
              {item.note && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-3 mt-auto" style={{ animation: 'fadeUp 0.6s ease 0.6s both' }}>
        <button className="btn-primary" onClick={() => router.push('/test')}>
          다시 측정
        </button>
        <button className="btn-secondary" onClick={() => router.push('/')}>
          홈으로
        </button>
      </div>

      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes fadeUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </main>
  )
}

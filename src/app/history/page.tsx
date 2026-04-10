'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INTOXICATION_LEVELS } from '@/types'

interface MeasurementRow {
  id: string
  type: string
  intoxication_level: number | null
  intoxication_percentage: number | null
  created_at: string
}

const LEVEL_COLORS: { [key: number]: string } = {
  1: '#4ade80', 2: '#a3e635', 3: '#facc15',
  4: '#f59e0b', 5: '#f97316', 6: '#ef4444', 7: '#dc2626',
}

const LEVEL_EMOJIS: { [key: number]: string } = {
  1: '😎', 2: '😄', 3: '😊', 4: '🥴', 5: '😵', 6: '🚨', 7: '💀',
}

export default function HistoryPage() {
  const [records, setRecords] = useState<MeasurementRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('measurements')
        .select('id, type, intoxication_level, intoxication_percentage, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setRecords(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function formatDate(iso: string) {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          ←
        </button>
        <span style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: '0.05em', color: 'var(--text)' }}>
          측정 기록
        </span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>불러오는 중...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div style={{ fontSize: 48 }}>📭</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>아직 기록이 없어요</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3" style={{ overflowY: 'auto' }}>
          {records.map((r, i) => {
            const level = r.intoxication_level
              ? INTOXICATION_LEVELS.find((l) => l.level === r.intoxication_level)
              : null
            const color = r.intoxication_level ? LEVEL_COLORS[r.intoxication_level] : 'var(--text-dim)'
            const emoji = r.intoxication_level ? LEVEL_EMOJIS[r.intoxication_level] : '📊'

            return (
              <div
                key={r.id}
                onClick={() => r.type === 'retest' && router.push(`/result/${r.id}`)}
                className="glass"
                style={{
                  padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
                  cursor: r.type === 'retest' ? 'pointer' : 'default',
                  animation: `fadeUp 0.4s ease ${i * 0.05}s both`,
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ fontSize: 28, flexShrink: 0 }}>{emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>
                    {formatDate(r.created_at)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {r.type === 'baseline' ? '기준선 측정' : '음주 측정'}
                  </div>
                </div>
                {r.type === 'retest' && level && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color, lineHeight: 1 }}>
                      {r.intoxication_percentage}%
                    </div>
                    <div style={{ fontSize: 11, color, fontWeight: 600 }}>{level.label}</div>
                  </div>
                )}
                {r.type === 'retest' && (
                  <div style={{ color: 'var(--text-dim)', fontSize: 16, flexShrink: 0 }}>›</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </main>
  )
}

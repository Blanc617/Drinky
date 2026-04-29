'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INTOXICATION_LEVELS } from '@/types'
import { LEVEL_COLORS, LEVEL_EMOJIS } from '@/lib/constants'
import type { User } from '@supabase/supabase-js'

interface Baseline {
  reaction_score: number
  cognition_score: number
  pronunciation_score: number
  balance_score: number
  created_at: string
}

interface BaselineRecord {
  id: string
  created_at: string
}

interface DetailedRecord {
  id: string
  intoxication_level: number
  intoxication_percentage: number
  reaction_score: number
  cognition_score: number
  pronunciation_score: number
  balance_score: number
  created_at: string
}

interface Stats {
  totalTests: number
  avgLevel: number
  worstLevel: number
  worstPct: number
}


const GAME_ITEMS = [
  { key: 'reaction_score',      label: '반응속도',   icon: '⚡' },
  { key: 'cognition_score',     label: '인지',      icon: '🧠' },
  { key: 'pronunciation_score', label: '스트룹',    icon: '🎨' },
  { key: 'balance_score',       label: '가위바위보', icon: '✌️' },
]

function formatDatetime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${m}월 ${d}일 (${days[date.getDay()]})`
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [latestBaseline, setLatestBaseline] = useState<Baseline | null>(null)
  const [baselineRecords, setBaselineRecords] = useState<BaselineRecord[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [allRecords, setAllRecords] = useState<DetailedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      setAvatarUrl(user.user_metadata?.avatar_url ?? null)

      const [baselineRes, allBaselinesRes, retestRes] = await Promise.all([
        supabase.from('measurements').select('*')
          .eq('user_id', user.id).eq('type', 'baseline')
          .order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('measurements').select('id, created_at')
          .eq('user_id', user.id).eq('type', 'baseline')
          .order('created_at', { ascending: false }),
        supabase.from('measurements')
          .select('id, intoxication_level, intoxication_percentage, reaction_score, cognition_score, pronunciation_score, balance_score, created_at')
          .eq('user_id', user.id).eq('type', 'retest')
          .order('created_at', { ascending: false }),
      ])

      if (baselineRes.data) setLatestBaseline(baselineRes.data)
      setBaselineRecords(allBaselinesRes.data ?? [])

      const retests: DetailedRecord[] = retestRes.data ?? []
      if (retests.length > 0) {
        const avgLevel = retests.reduce((a, b) => a + b.intoxication_level, 0) / retests.length
        const worst = retests.reduce((a, b) => b.intoxication_level > a.intoxication_level ? b : a)
        setStats({
          totalTests: retests.length,
          avgLevel: Math.round(avgLevel),
          worstLevel: worst.intoxication_level,
          worstPct: worst.intoxication_percentage,
        })
        setAllRecords(retests)
        setExpandedDate(toDateKey(retests[0].created_at))
      }

      setLoading(false)
    }
    load()
  }, [])

  async function uploadAvatar(file: File) {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { console.error('업로드 실패:', uploadError); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.auth.updateUser({ data: { avatar_url: `${publicUrl}?t=${Date.now()}` } })
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
    setUploading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div style={{ width: 24, height: 24, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const grouped: Record<string, DetailedRecord[]> = {}
  for (const r of allRecords) {
    const key = toDateKey(r.created_at)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }
  const retestDateKeys = Object.keys(grouped)
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0]

  return (
    <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-5" style={{ overflowY: 'auto' }}>
      <style>{`
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ←
        </button>
        <span style={{ fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: '0.05em', color: 'var(--text)' }}>마이페이지</span>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp 0.4s ease both' }}>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--amber)', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface2)', border: '2px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
          )}
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: 'var(--amber)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>
            {uploading ? '…' : '+'}
          </div>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
        </div>
        <button onClick={signOut}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
          로그아웃
        </button>
      </div>

      {stats ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em' }}>음주 통계</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--amber)', lineHeight: 1 }}>{stats.totalTests}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>총 측정</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{LEVEL_EMOJIS[stats.avgLevel] ?? '🥴'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>평균 단계</div>
              <div style={{ fontSize: 10, color: LEVEL_COLORS[stats.avgLevel], marginTop: 2 }}>
                {INTOXICATION_LEVELS.find(l => l.level === stats.avgLevel)?.label}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{LEVEL_EMOJIS[stats.worstLevel] ?? '💀'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>최악의 날</div>
              <div style={{ fontSize: 10, color: LEVEL_COLORS[stats.worstLevel], marginTop: 2 }}>{stats.worstPct}%</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          <div style={{ fontSize: 32 }}>📊</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>아직 측정 기록이 없어요</div>
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => router.push('/test')}>지금 측정하기</button>
        </div>
      )}

      {/* 음주 전 측정 기록 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', animation: 'fadeUp 0.4s ease 0.2s both' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🧪</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>음주 전 측정 기록</span>
          </div>
          <button onClick={() => router.push('/baseline')}
            style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--amber)', cursor: 'pointer' }}>
            + 재측정
          </button>
        </div>
        {baselineRecords.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>기준선 기록이 없어요</div>
        ) : latestBaseline && (
          <>
            <div style={{ padding: '14px 20px', borderBottom: baselineRecords.length > 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
                최근 측정 — {formatDatetime(latestBaseline.created_at)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: '반응속도', icon: '⚡', value: `${Math.round(latestBaseline.reaction_score)}ms` },
                  { label: '인지', icon: '🧠', value: `${Math.round(latestBaseline.cognition_score)}점` },
                  { label: '스트룹', icon: '🎨', value: `${Math.round(latestBaseline.pronunciation_score)}점` },
                  { label: '가위바위보', icon: '✌️', value: `${Math.round(latestBaseline.balance_score)}점` },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{item.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {baselineRecords.length > 1 && (
              <div style={{ padding: '10px 20px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>이전 측정</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {baselineRecords.slice(1).map((b) => (
                    <div key={b.id} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDatetime(b.created_at)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 음주 후 측정 기록 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', animation: 'fadeUp 0.4s ease 0.3s both' }}>
        <div style={{ padding: '16px 20px', borderBottom: retestDateKeys.length > 0 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🍻</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>음주 후 측정 기록</span>
        </div>
        {retestDateKeys.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>측정 기록이 없어요</div>
        ) : (
          retestDateKeys.map((dateKey, di) => {
            const records = grouped[dateKey]
            const isOpen = expandedDate === dateKey
            const isLast = di === retestDateKeys.length - 1
            return (
              <div key={dateKey}>
                <button
                  onClick={() => setExpandedDate(isOpen ? null : dateKey)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: (isOpen || !isLast) ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{formatDateLabel(dateKey)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 99 }}>
                      {records.length}회
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14, display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                </button>
                {isOpen && (
                  <div style={{ animation: 'slideDown 0.2s ease', borderBottom: !isLast ? '1px solid var(--border)' : 'none' }}>
                    {records.map((r, i) => {
                      const levelColor = LEVEL_COLORS[r.intoxication_level] ?? 'var(--amber)'
                      const levelLabel = INTOXICATION_LEVELS.find(l => l.level === r.intoxication_level)?.label
                      const emoji = LEVEL_EMOJIS[r.intoxication_level] ?? '🥴'
                      const isRecordOpen = expandedRecord === r.id
                      return (
                        <div key={r.id} style={{ borderBottom: i < records.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          {/* 기록 요약 행 - 탭해서 상세 토글 */}
                          <button
                            onClick={() => setExpandedRecord(isRecordOpen ? null : r.id)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18 }}>{emoji}</span>
                              <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{formatTime(r.created_at)}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: levelColor }}>{levelLabel}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: levelColor, lineHeight: 1 }}>{r.intoxication_percentage}%</div>
                              <span style={{ color: 'var(--text-dim)', fontSize: 14, display: 'inline-block', transition: 'transform 0.2s', transform: isRecordOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                            </div>
                          </button>
                          {/* 상세 게임 점수 */}
                          {isRecordOpen && (
                            <div style={{ padding: '4px 20px 14px', animation: 'slideDown 0.2s ease' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {GAME_ITEMS.map((g) => {
                                  const score = Math.round(Math.max(0, Math.min(100, r[g.key as keyof DetailedRecord] as number)))
                                  const barColor = score >= 80 ? '#4ade80' : score >= 50 ? '#f59e0b' : '#ef4444'
                                  return (
                                    <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{g.icon}</span>
                                      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>{g.label}</span>
                                      <div style={{ flex: 1, height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${score}%`, background: barColor, borderRadius: 99 }} />
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 52, textAlign: 'right' }}>
                                        {score}<span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>/100</span>
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}

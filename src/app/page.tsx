'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

function BottleLogo() {
  return (
    <svg width="80" height="110" viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#166534"/>
          <stop offset="100%" stopColor="#14532d"/>
        </linearGradient>
        <linearGradient id="bottleGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86efac"/>
          <stop offset="60%" stopColor="#22c55e"/>
          <stop offset="100%" stopColor="#16a34a"/>
        </linearGradient>
        <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#14532d" stopOpacity="0.95"/>
        </linearGradient>
        <linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <clipPath id="bodyClip">
          <path d="M32 32 C32 32 16 40 15 50 L15 96 Q15 101 20 101 L60 101 Q65 101 65 96 L65 50 C64 40 48 32 48 32 Z"/>
        </clipPath>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Cork/Cap */}
      <rect x="29" y="3" width="22" height="12" rx="4" fill="url(#capGrad)"/>
      <rect x="31" y="5" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.15)"/>

      {/* Neck */}
      <rect x="30" y="14" width="20" height="20" rx="3" fill="url(#bottleGrad)"/>
      <rect x="32" y="15" width="6" height="14" rx="3" fill="url(#shineGrad)"/>

      {/* Bottle body */}
      <path d="M32 32 C32 32 16 40 15 50 L15 96 Q15 101 20 101 L60 101 Q65 101 65 96 L65 50 C64 40 48 32 48 32 Z"
        fill="url(#bottleGrad)"/>

      {/* Liquid fill */}
      <rect x="15" y="64" width="50" height="37" clipPath="url(#bodyClip)" fill="url(#liquidGrad)"/>

      {/* Liquid surface wave */}
      <path d="M15 64 Q28 60 40 64 Q52 68 65 64" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="none" clipPath="url(#bodyClip)"/>

      {/* Label */}
      <rect x="20" y="62" width="40" height="28" rx="5" fill="rgba(0,0,0,0.18)"/>
      <rect x="20" y="62" width="40" height="28" rx="5" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>

      {/* Face — eyes */}
      <circle cx="31" cy="73" r="3" fill="white"/>
      <circle cx="49" cy="73" r="3" fill="white"/>
      <circle cx="32" cy="73.8" r="1.5" fill="#1a0800"/>
      <circle cx="50" cy="73.8" r="1.5" fill="#1a0800"/>
      {/* Eye shine */}
      <circle cx="32.8" cy="72.5" r="0.6" fill="white"/>
      <circle cx="50.8" cy="72.5" r="0.6" fill="white"/>

      {/* Smile */}
      <path d="M30 80 Q40 87 50 80" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>

      {/* Rosy cheeks */}
      <ellipse cx="25" cy="78" rx="4" ry="2.5" fill="rgba(255,100,80,0.3)"/>
      <ellipse cx="55" cy="78" rx="4" ry="2.5" fill="rgba(255,100,80,0.3)"/>

      {/* Bottle shine highlight */}
      <path d="M33 36 C32 42 31 52 33 62" stroke="rgba(255,255,255,0.4)" strokeWidth="3.5" strokeLinecap="round"/>

      {/* Floating bubbles — right */}
      <circle cx="70" cy="78" r="3.5" fill="rgba(34,197,94,0.35)" filter="url(#softGlow)"/>
      <circle cx="74" cy="65" r="2.5" fill="rgba(34,197,94,0.25)"/>
      <circle cx="71" cy="53" r="1.8" fill="rgba(34,197,94,0.18)"/>

      {/* Floating bubbles — left */}
      <circle cx="9"  cy="72" r="2.5" fill="rgba(34,197,94,0.28)"/>
      <circle cx="7"  cy="59" r="3.5" fill="rgba(34,197,94,0.2)" filter="url(#softGlow)"/>
      <circle cx="10" cy="48" r="1.5" fill="rgba(34,197,94,0.15)"/>
    </svg>
  )
}

const STAGES = [
  { step: '1단계', label: '완전 멀쩡', color: '#4ade80', bar: 10  },
  { step: '2단계', label: '알딸딸',   color: '#a3e635', bar: 25  },
  { step: '3단계', label: '기분 좋음', color: '#bef264', bar: 40  },
  { step: '4단계', label: '슬슬 취함', color: '#f59e0b', bar: 55  },
  { step: '5단계', label: '많이 취함', color: '#f97316', bar: 70  },
  { step: '6단계', label: '필름 위험', color: '#fb923c', bar: 85  },
  { step: '7단계', label: '완전 만취', color: '#ef4444', bar: 100 },
]

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [hasBaseline, setHasBaseline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFirstTimer, setShowFirstTimer] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      if (data.user) {
        const { data: baseline } = await supabase
          .from('measurements').select('id').eq('user_id', data.user.id)
          .eq('type', 'baseline').limit(1).single()
        setHasBaseline(!!baseline)
      }
      setLoading(false)
    }
    init()
  }, [])

  async function handleMeasure() {
    if (!hasBaseline) {
      setShowFirstTimer(true)
      setTimeout(() => {
        setShowFirstTimer(false)
        router.push('/baseline')
      }, 2000)
    } else {
      router.push('/test')
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div style={{ width: 24, height: 24, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-10deg); }
          50%       { transform: translateY(-10px) rotate(-10deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.6;  transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes bubbleUp {
          0%   { opacity: 0; transform: translateY(4px); }
          40%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-16px); }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        .bottle-float  { animation: float 3.2s ease-in-out infinite; }
        .glow-behind   { animation: glowPulse 3.2s ease-in-out infinite; }
      `}</style>

      <main style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 24px 24px' }}>

        {/* ── 상단 유저 메뉴 ── */}
        {user && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
            <button
              onClick={() => router.push('/profile')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '6px 12px',
                fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              마이페이지
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                {(user.user_metadata?.full_name ?? user.email?.split('@')[0])}님
              </span>
              <button
                onClick={signOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '6px 12px',
                  fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                로그아웃
              </button>
            </div>
          </div>
        )}

        {/* ── Hero ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 24, paddingTop: user ? 16 : 40, paddingBottom: 16 }}>

          {/* Logo block */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 44 }}>

            {/* Bottle with ambient glow */}
            <div style={{ position: 'relative', width: 80, height: 110 }}>
              <div className="glow-behind" style={{
                position: 'absolute',
                width: 150, height: 150,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 68%)',
                top: '50%', left: '50%',
                pointerEvents: 'none',
              }}/>
              <div className="bottle-float" style={{ filter: 'drop-shadow(0 10px 28px rgba(34,197,94,0.45))' }}>
                <BottleLogo />
              </div>
            </div>

            {/* Wordmark */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 68,
                lineHeight: 1,
                letterSpacing: '0.06em',
                color: '#f59e0b',
                textShadow: '0 0 48px rgba(245,158,11,0.5), 0 2px 0 rgba(0,0,0,0.4)',
              }}>
                DRINKY
              </div>
              <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
                "나 안 취했어"를<br />데이터로 반박하세요
              </p>
            </div>
          </div>

          {/* Stage preview card */}
          <div className="glass" style={{
            padding: '18px 20px',
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.25)',
            marginTop: 12,
            marginBottom: 0,
          }}>
            <div style={{
              fontSize: 13, color: 'rgba(0,0,0,0.8)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: 700, textAlign: 'center',
              marginBottom: 14,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="12" width="4" height="9" rx="1"/>
                  <rect x="10" y="7" width="4" height="14" rx="1"/>
                  <rect x="17" y="3" width="4" height="18" rx="1"/>
                </svg>
                취함 단계 측정
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {STAGES.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Step */}
                  <span style={{ fontSize: 13, color: '#000', fontWeight: 600, minWidth: 40, flexShrink: 0 }}>
                    {s.step}
                  </span>
                  {/* Label */}
                  <span style={{ fontSize: 12, color: '#111', minWidth: 54, flexShrink: 0 }}>
                    {s.label}
                  </span>
                  {/* Bar */}
                  <div style={{ flex: 1, height: 5, background: 'rgba(148,180,220,0.18)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${s.bar}%`,
                      background: s.color,
                      borderRadius: 99,
                      boxShadow: `0 0 6px ${s.color}60`,
                    }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom actions ── */}
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {showFirstTimer && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 50,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.45)',
                }}>
                  <div style={{
                    background: 'var(--surface)', borderRadius: 20, padding: '28px 32px',
                    textAlign: 'center', maxWidth: 280,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    animation: 'fadeUp 0.3s ease',
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>
                      처음이시군요!
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      기준선을 먼저 측정해야해요.<br/>지금 바로 시작할게요!
                    </div>
                  </div>
                </div>
              )}
              <button onClick={handleMeasure} className="btn-primary">
                지금 바로 측정하기
              </button>
              <button onClick={() => router.push('/history')} className="btn-secondary">
                나의 음주 역사 📋
              </button>
            </div>
          ) : (
            <div style={{ paddingBottom: 8 }}>
              <button
                onClick={signInWithGoogle}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: '#fff', color: '#111', fontWeight: 700, fontSize: 15,
                  padding: '16px 24px', borderRadius: 16, border: 'none', cursor: 'pointer',
                  transition: 'opacity 0.15s ease', width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google로 시작하기
              </button>
            </div>
          )}

        </div>
      </main>
    </>
  )
}

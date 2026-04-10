'use client'

import { useRouter } from 'next/navigation'

interface Props {
  title: string
  step: number
  totalSteps: number
  stepLabels: string[]
  currentStepKey: string
  completedSteps: string[]
  children: React.ReactNode
}

export default function TestShell({
  title, step, totalSteps, stepLabels, currentStepKey, completedSteps, children
}: Props) {
  const router = useRouter()
  const progress = (step / totalSteps) * 100

  return (
    <main className="flex flex-col flex-1 px-6 pt-12 pb-8 gap-8">
      {/* 상단 헤더 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ←
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>
            {step} / {totalSteps}
          </span>
        </div>

        {/* 진행 바 */}
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* 스텝 칩 */}
        <div className="flex">
          {stepLabels.map((label, i) => {
            const key = ['reaction', 'cognition', 'pronunciation', 'balance'][i]
            const isDone = completedSteps.includes(key)
            const isCurrent = key === currentStepKey
            return (
              <div key={label} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
                    background: isCurrent ? 'var(--amber)' : isDone ? 'var(--surface2)' : 'transparent',
                    color: isCurrent ? '#fff' : isDone ? 'var(--text-muted)' : 'var(--text-dim)',
                    border: isCurrent ? 'none' : '1px solid var(--border)',
                    transition: 'all 0.3s ease',
                    boxShadow: isCurrent ? '0 0 10px var(--amber-glow)' : 'none',
                  }}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 테스트 컨텐츠 */}
      <div className="flex flex-col flex-1 items-center justify-start pt-4">
        {children}
      </div>
    </main>
  )
}

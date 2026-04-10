'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReactionTest from '@/components/ReactionTest'
import CognitionTest from '@/components/CognitionTest'
import StroopTest from '@/components/StroopTest'
import RpsLoserTest from '@/components/RpsLoserTest'
import TestShell from '@/components/TestShell'
import { calculateIntoxication } from '@/lib/intoxication'
import type { BaselineScore } from '@/types'

type Step = 'reaction' | 'cognition' | 'pronunciation' | 'balance' | 'saving'
const STEPS: Step[] = ['reaction', 'cognition', 'pronunciation', 'balance']
const STEP_LABELS = ['반응속도', '인지', '스트룹', '가위바위보']

export default function TestPage() {
  const [baseline, setBaseline] = useState<BaselineScore | null>(null)
  const [loadingBaseline, setLoadingBaseline] = useState(true)
  const [step, setStep] = useState<Step>('reaction')
  const [scores, setScores] = useState<Record<string, number>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function fetchBaseline() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('measurements').select('*')
        .eq('user_id', user.id).eq('type', 'baseline')
        .order('created_at', { ascending: false }).limit(1).single()
      if (!data) { router.push('/baseline'); return }
      setBaseline({
        reaction: data.reaction_score, cognition: data.cognition_score,
        pronunciation: data.pronunciation_score, balance: data.balance_score,
      })
      setLoadingBaseline(false)
    }
    fetchBaseline()
  }, [])

  function handleScore(testStep: Step, score: number) {
    const updated = { ...scores, [testStep]: score }
    setScores(updated)
    const currentIndex = STEPS.indexOf(testStep)
    if (currentIndex + 1 < STEPS.length) {
      setStep(STEPS[currentIndex + 1])
    } else {
      saveResult(updated)
    }
  }

  async function saveResult(finalScores: Record<string, number>) {
    setStep('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !baseline) return
    const current: BaselineScore = {
      reaction: finalScores.reaction, cognition: finalScores.cognition,
      pronunciation: finalScores.pronunciation, balance: finalScores.balance,
    }
    const result = calculateIntoxication(baseline, current)
    const { data, error } = await supabase.from('measurements').insert({
      user_id: user.id, type: 'retest',
      reaction_score: current.reaction, cognition_score: current.cognition,
      pronunciation_score: current.pronunciation, balance_score: current.balance,
      intoxication_level: result.level, intoxication_percentage: result.percentage,
    }).select().single()
    if (error) {
      console.error('저장 실패:', error)
      alert('결과 저장에 실패했습니다. 다시 시도해주세요.')
      setStep('balance')
      return
    }
    if (data) router.push(`/result/${data.id}`)
  }

  if (loadingBaseline) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>기준선 불러오는 중...</div>
      </div>
    )
  }

  if (step === 'saving') {
    return (
      <div className="flex items-center justify-center flex-1">
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>결과 저장 중...</div>
      </div>
    )
  }

  const currentIndex = STEPS.indexOf(step as Step)
  const completedSteps = STEPS.slice(0, currentIndex).map(String)

  return (
    <TestShell
      title="음주 측정"
      step={currentIndex + 1}
      totalSteps={STEPS.length}
      stepLabels={STEP_LABELS}
      currentStepKey={step}
      completedSteps={completedSteps}
    >
      {step === 'reaction' && <ReactionTest onComplete={(s) => handleScore('reaction', s)} />}
      {step === 'cognition' && <CognitionTest onComplete={(s) => handleScore('cognition', s)} />}
      {step === 'pronunciation' && <StroopTest onComplete={(s) => handleScore('pronunciation', s)} />}
      {step === 'balance' && <RpsLoserTest onComplete={(s) => handleScore('balance', s)} />}
    </TestShell>
  )
}

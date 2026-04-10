'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReactionTest from '@/components/ReactionTest'
import CognitionTest from '@/components/CognitionTest'
import StroopTest from '@/components/StroopTest'
import RpsLoserTest from '@/components/RpsLoserTest'
import TestShell from '@/components/TestShell'

type Step = 'reaction' | 'cognition' | 'pronunciation' | 'balance' | 'saving'
const STEPS: Step[] = ['reaction', 'cognition', 'pronunciation', 'balance']
const STEP_LABELS = ['반응속도', '인지', '스트룹', '가위바위보']

export default function BaselinePage() {
  const [step, setStep] = useState<Step>('reaction')
  const [scores, setScores] = useState<Record<string, number>>({})
  const router = useRouter()
  const supabase = createClient()

  function handleScore(testStep: Step, score: number) {
    const updated = { ...scores, [testStep]: score }
    setScores(updated)
    const currentIndex = STEPS.indexOf(testStep)
    if (currentIndex + 1 < STEPS.length) {
      setStep(STEPS[currentIndex + 1])
    } else {
      saveBaseline(updated)
    }
  }

  async function saveBaseline(finalScores: Record<string, number>) {
    setStep('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    await supabase.from('measurements').insert({
      user_id: user.id, type: 'baseline',
      reaction_score: finalScores.reaction,
      cognition_score: finalScores.cognition,
      pronunciation_score: finalScores.pronunciation,
      balance_score: finalScores.balance,
      intoxication_level: null, intoxication_percentage: null,
    })
    router.push('/')
  }

  const currentIndex = STEPS.indexOf(step as Step)
  const completedSteps = STEPS.slice(0, currentIndex).map(String)

  if (step === 'saving') {
    return (
      <div className="flex items-center justify-center flex-1">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>기준선 저장 중...</div>
      </div>
    )
  }

  return (
    <TestShell
      title="기준선 측정"
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

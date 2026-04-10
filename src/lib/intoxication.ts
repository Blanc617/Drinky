import { BaselineScore, IntoxicationResult, INTOXICATION_LEVELS } from '@/types'

const WEIGHTS = {
  reaction: 0.25,
  cognition: 0.25,
  pronunciation: 0.25,
  balance: 0.25,
}

// 반응속도는 낮을수록 좋으므로 기준선 대비 역수로 점수화
function reactionScore(baseline: number, current: number): number {
  if (current === 0) return 0
  return Math.min((baseline / current) * 100, 100)
}

function directScore(baseline: number, current: number): number {
  if (baseline === 0) return 0
  return Math.min((current / baseline) * 100, 100)
}

export function calculateIntoxication(
  baseline: BaselineScore,
  current: BaselineScore
): IntoxicationResult {
  const scores = {
    reaction: reactionScore(baseline.reaction, current.reaction),
    cognition: directScore(baseline.cognition, current.cognition),
    pronunciation: directScore(baseline.pronunciation, current.pronunciation),
    balance: directScore(baseline.balance, current.balance),
  }

  const percentage =
    scores.reaction * WEIGHTS.reaction +
    scores.cognition * WEIGHTS.cognition +
    scores.pronunciation * WEIGHTS.pronunciation +
    scores.balance * WEIGHTS.balance

  const found = INTOXICATION_LEVELS.find(
    (l) => percentage >= l.min && percentage <= l.max
  )
  const level = found ?? INTOXICATION_LEVELS[INTOXICATION_LEVELS.length - 1]

  return {
    level: level.level,
    label: level.label,
    percentage: Math.round(percentage),
    scores: current,
  }
}

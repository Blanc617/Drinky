export type TestType = 'reaction' | 'cognition' | 'pronunciation' | 'balance'

export interface BaselineScore {
  reaction: number   // 평균 반응시간 (ms), 낮을수록 좋음
  cognition: number  // 정답률 (0~100)
  pronunciation: number // 정확도 (0~100)
  balance: number    // 안정도 점수 (0~100)
}

export interface MeasurementRecord {
  id: string
  user_id: string
  type: 'baseline' | 'retest'
  scores: BaselineScore
  intoxication_level: number | null // 1~7단계, baseline이면 null
  created_at: string
}

export interface IntoxicationResult {
  level: number       // 1~7
  label: string
  percentage: number  // 기준선 대비 %
  scores: BaselineScore
}

export const INTOXICATION_LEVELS = [
  { level: 1, label: '완전 멀쩡', min: 80, max: 100 }, // 자연 변동성(±15~20%) 감안
  { level: 2, label: '알딸딸',   min: 65, max: 79 },
  { level: 3, label: '기분 좋음', min: 52, max: 64 },
  { level: 4, label: '슬슬 취함', min: 40, max: 51 },
  { level: 5, label: '많이 취함', min: 28, max: 39 },
  { level: 6, label: '필름 위험', min: 16, max: 27 },
  { level: 7, label: '완전 만취', min: 0,  max: 15 },
]

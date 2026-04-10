// 발음 테스트 문장 목록
export const PRONUNCIATION_SENTENCES = [
  '간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다',
  '경찰청 철창살은 외철창살이고 검찰청 철창살은 쌍철창살이다',
  '내가 그린 기린 그림은 잘 그린 기린 그림이고 네가 그린 기린 그림은 못 그린 기린 그림이다',
  '저기 계신 저 분이 박 법학박사이시고 여기 계신 이 분이 백 법학박사이시다',
  '앞뜰에 있는 말뚝이 말 맬 말뚝이냐 말 못 맬 말뚝이냐',
  '중앙청 창살은 쌍창살이고 경찰청 창살은 외창살이다',
  '한양 양장점 양장사는 한양 양장점 양장사다',
]

// 인지 테스트 숫자 풀 (3~5자리)
export function generateDigitSequence(length: number): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 10))
}

export function getRandomPronunciationSentence(): string {
  return PRONUNCIATION_SENTENCES[
    Math.floor(Math.random() * PRONUNCIATION_SENTENCES.length)
  ]
}

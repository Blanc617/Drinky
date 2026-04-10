'use client'

import { useState, useRef } from 'react'
import { getRandomPronunciationSentence } from '@/lib/test-data'

interface Props {
  onComplete: (score: number) => void
}

export default function PronunciationTest({ onComplete }: Props) {
  const [phase, setPhase] = useState<'intro' | 'ready' | 'recording' | 'result'>('intro')
  const [sentence] = useState(() => getRandomPronunciationSentence())
  const [recognized, setRecognized] = useState('')
  const [score, setScore] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  function calcSimilarity(a: string, b: string): number {
    const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase()
    const na = normalize(a)
    const nb = normalize(b)
    if (na.length === 0) return 0
    let matches = 0
    for (let i = 0; i < Math.min(na.length, nb.length); i++) {
      if (na[i] === nb[i]) matches++
    }
    return Math.round((matches / na.length) * 100)
  }

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Chrome 브라우저를 사용해주세요.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript
      setRecognized(result)
      const s = calcSimilarity(sentence, result)
      setScore(s)
      setPhase('result')
      setTimeout(() => onComplete(s), 1500)
    }

    recognition.onerror = () => setPhase('ready')
    recognition.onend = () => { if (phase === 'recording') setPhase('ready') }

    recognition.start()
    setPhase('recording')
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-8 text-center w-full">
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 48, color: 'var(--amber)', letterSpacing: '0.05em' }}>
            발음 테스트
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
            문장을 또렷하게 읽으세요<br />
            마이크 버튼을 누르고 시작
          </p>
        </div>
        <button className="btn-primary" onClick={() => setPhase('ready')}>시작하기</button>
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-6 text-center w-full">
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          발음 테스트 완료
        </div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, color: 'var(--amber)', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
          {score}<span style={{ fontSize: 32 }}>%</span>
        </div>
        {recognized && (
          <div className="glass p-3 w-full">
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>인식된 내용</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{recognized}</div>
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>다음 테스트로 이동 중...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="glass p-5 w-full">
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>읽을 문장</div>
        <div style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text)', fontWeight: 500 }}>
          {sentence}
        </div>
      </div>

      <button
        onClick={startRecording}
        disabled={phase === 'recording'}
        style={{
          width: 96, height: 96, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: phase === 'recording' ? '#ef4444' : 'var(--amber)',
          color: '#000', fontSize: 32, fontWeight: 700,
          boxShadow: phase === 'recording'
            ? '0 0 0 8px rgba(239,68,68,0.15), 0 0 30px rgba(239,68,68,0.4)'
            : '0 0 20px var(--amber-glow)',
          animation: phase === 'recording' ? 'ripple 1.2s ease infinite' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        🎤
      </button>

      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {phase === 'recording' ? '녹음 중... 문장을 읽으세요' : '버튼을 누르고 읽으세요'}
      </div>

      <style>{`
        @keyframes ripple {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4), 0 0 30px rgba(239,68,68,0.4) }
          70% { box-shadow: 0 0 0 20px rgba(239,68,68,0), 0 0 30px rgba(239,68,68,0.4) }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0), 0 0 30px rgba(239,68,68,0.4) }
        }
      `}</style>
    </div>
  )
}

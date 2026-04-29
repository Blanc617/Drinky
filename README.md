# 🍺 Drinky

> **"나 안 취했어"를 데이터로 반박하세요.**

음주 후 인지·반응 능력을 측정해 취함 정도를 수치로 보여주는 웹 앱입니다.  
베이스라인(맨 정신) 대비 현재 퍼포먼스를 비교해 취함 퍼센트와 단계를 판정하며, 친구들과 함께하는 멀티플레이 배틀 모드도 지원합니다.

---

## 📌 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | Drinky |
| 목적 | 음주 상태에서의 인지·반응 능력 저하를 객관적 수치로 측정 |
| 대상 | 음주 자리에서 자신의 취함 정도를 재미있게 확인하고 싶은 사람 |
| 언어 | 한국어 |
| 플랫폼 | 모바일 우선 웹 앱 (반응형, 최대 390px) |

---

## 🛠 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.2.3 | App Router 기반 풀스택 프레임워크 |
| React | 19.2.4 | UI 라이브러리 |
| TypeScript | 5 | 정적 타입 시스템 |
| Tailwind CSS | 4 | 유틸리티 기반 스타일링 |

### Backend / Infra
| 기술 | 버전 | 용도 |
|------|------|------|
| Supabase | 2.103.0 | 인증, DB, 실시간 채널, 스토리지 |
| @supabase/ssr | 0.10.2 | SSR 환경 세션 쿠키 관리 |
| PostgreSQL | (Supabase 내장) | 측정 데이터 저장 |

### 주요 설계 결정
- **별도 REST API 서버 없음** — Supabase RLS 정책으로 데이터 접근 제어
- **전역 상태 관리 라이브러리 없음** — React 훅 + Supabase Realtime 구독
- **UI 컴포넌트 라이브러리 없음** — 완전 커스텀 디자인 시스템 (글래스모피즘)
- **폰트** — Pretendard (본문) + Bebas Neue (디스플레이)

---

## 🏗 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                    │
│                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Solo Test  │   │ Battle Mode  │   │   Profile   │  │
│  │  Flow       │   │ (Realtime)   │   │  / History  │  │
│  └──────┬──────┘   └──────┬───────┘   └──────┬──────┘  │
│         │                 │                   │         │
│         └─────────────────┴───────────────────┘         │
│                           │                             │
│              Supabase JS Client SDK                     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS / WebSocket
┌───────────────────────────▼─────────────────────────────┐
│                        Supabase                         │
│                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  Auth        │  │  PostgreSQL   │  │  Realtime   │  │
│  │  (Google     │  │  (measurements│  │  Channels   │  │
│  │   OAuth)     │  │   table + RLS)│  │  (Battle)   │  │
│  └──────────────┘  └───────────────┘  └─────────────┘  │
│                                                         │
│  ┌──────────────┐                                       │
│  │  Storage     │                                       │
│  │  (avatars)   │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

### 디렉토리 구조

```
src/
├── app/                   # Next.js App Router
│   ├── page.tsx           # 홈 (메인 메뉴)
│   ├── layout.tsx         # 루트 레이아웃
│   ├── auth/callback/     # Google OAuth 콜백 처리
│   ├── baseline/          # 베이스라인 측정
│   ├── test/              # 솔로 음주 테스트
│   ├── battle/[code]/     # 멀티플레이 배틀 룸
│   ├── profile/           # 유저 프로필 & 통계
│   ├── history/           # 측정 기록 목록
│   └── result/[id]/       # 개별 결과 상세
├── components/            # React 컴포넌트 (29개)
│   ├── *Test.tsx          # 솔로 테스트 컴포넌트
│   └── *Battle.tsx        # 배틀 모드 게임 컴포넌트
├── lib/
│   ├── supabase/          # Supabase 클라이언트 (브라우저/서버)
│   ├── intoxication.ts    # 취함 계산 알고리즘
│   ├── constants.ts       # 취함 레벨 색상·이모지 매핑
│   └── test-data.ts       # 테스트 문항 데이터
└── types/
    └── index.ts           # TypeScript 인터페이스
```

---

## ✨ 핵심 기능

### 1. 베이스라인 측정 (`/baseline`)
맨 정신일 때 4가지 테스트를 진행해 기준 퍼포먼스를 저장합니다.

| 테스트 | 측정 항목 | 방식 |
|--------|-----------|------|
| 반응 속도 테스트 | 반응 시간 (ms) | 9칸 격자에서 랜덤 출현하는 두더지 클릭 (5라운드) |
| 인지 테스트 | 정답률 (%) | 색상-단어 매칭 4지선다 |
| 스트룹 테스트 | 정답률 (%) | 단어 색상 구별 시간 제한 문제 |
| 가위바위보 | 반응/판단력 (%) | 패턴 감지 및 반응 |

### 2. 솔로 음주 테스트 (`/test`)
동일한 4가지 테스트를 음주 후 진행해 베이스라인 대비 취함 수준을 판정합니다.

**취함 판정 알고리즘 (`src/lib/intoxication.ts`)**

| 항목 | 가중치 | 이유 |
|------|--------|------|
| 반응 속도 | 20% | — |
| 인지력 | 25% | — |
| 발음 | 30% | 음주 영향이 가장 민감하게 나타남 |
| 균형감 | 25% | — |

**취함 단계 분류**

| 단계 | 레이블 | 퍼센트 범위 | 이모지 |
|------|--------|------------|--------|
| 1 | 완전 멀쩡 | 80 ~ 100% | 😎 |
| 2 | 알딸딸 | 65 ~ 79% | 😄 |
| 3 | 기분 좋음 | 52 ~ 64% | 😊 |
| 4 | 슬슬 취함 | 40 ~ 51% | 🥴 |
| 5 | 많이 취함 | 28 ~ 39% | 😵 |
| 6 | 필름 위험 | 16 ~ 27% | 🚨 |
| 7 | 완전 만취 | 0 ~ 15% | 💀 |

### 3. 멀티플레이 배틀 모드 (`/battle/[code]`)
4자리 코드로 방을 만들어 친구들과 함께 파티 게임을 즐깁니다.  
Supabase Realtime 채널로 실시간 동기화됩니다.

| 게임 | 설명 |
|------|------|
| 눈치 게임 | 먼저 말하는 사람 탈락 |
| 369 게임 | 3, 6, 9 배수에서 박수 |
| 초성 게임 | 초성 보고 단어 맞추기 |
| 라이어 게임 | 스파이를 찾아라 |
| 밸런스 게임 | 양자택일 선택 |
| 마피아 게임 | 사회적 추리 게임 |

### 4. 프로필 & 통계 (`/profile`)
- 아바타 이미지 업로드 (Supabase Storage)
- 누적 통계: 총 테스트 횟수, 평균 취함 레벨, 최고 취함 기록
- 베이스라인·재테스트 타임라인 (항목별 점수 접기/펼치기)

### 5. 측정 기록 (`/history`)
- 전체 측정 이력 시간순 목록
- 각 기록에서 상세 결과 페이지로 이동

---

## 🔌 주요 API

Drinky는 별도 REST API 서버 없이 **Supabase를 직접** 사용합니다.

### Auth — Google OAuth

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/auth/callback` | GET | Google OAuth 인증 후 코드 교환 → 세션 쿠키 발급 |

```typescript
// src/app/auth/callback/route.ts
const { error } = await supabase.auth.exchangeCodeForSession(code)
```

### Database — Supabase (PostgreSQL + RLS)

#### `measurements` 테이블 스키마

```sql
CREATE TABLE measurements (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type                    text        NOT NULL CHECK (type IN ('baseline', 'retest')),
  reaction_score          numeric     NOT NULL,   -- 반응 시간 (ms, 낮을수록 좋음)
  cognition_score         numeric     NOT NULL,   -- 인지 정답률 (0~100%)
  pronunciation_score     numeric     NOT NULL,   -- 발음/스트룹 정확도 (0~100%)
  balance_score           numeric     NOT NULL,   -- 균형/판단 점수 (0~100%)
  intoxication_level      integer,               -- 취함 단계 1~7 (베이스라인은 null)
  intoxication_percentage numeric,               -- 취함 퍼센트 0~100% (베이스라인은 null)
  created_at              timestamptz DEFAULT now() NOT NULL
);
```

**RLS 정책** — 사용자는 자신의 레코드만 조회·삽입 가능

#### 주요 Supabase 호출 패턴

```typescript
// 베이스라인 저장
await supabase.from('measurements').insert({ type: 'baseline', user_id, ...scores })

// 재테스트 저장 (취함 레벨 포함)
await supabase.from('measurements').insert({ type: 'retest', intoxication_level, intoxication_percentage, ...scores })

// 히스토리 조회
await supabase
  .from('measurements')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })

// 아바타 업로드
await supabase.storage.from('avatars').upload(`${userId}.jpg`, file)
```

### Realtime — 배틀 모드 채널

```typescript
// 배틀 룸 실시간 구독
const channel = supabase.channel(`battle:${code}`)
  .on('broadcast', { event: 'game_state' }, handler)
  .subscribe()

// 상태 브로드캐스트
channel.send({ type: 'broadcast', event: 'game_state', payload: { ... } })
```

---

## ⚙️ 환경 변수

`.env.local` 파일을 루트에 생성하고 아래 값을 설정하세요.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 🚀 로컬 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. `supabase/schema.sql` 실행해 테이블 및 RLS 정책 적용
3. Authentication → Providers에서 Google OAuth 활성화
4. Storage에서 `avatars` 버킷 생성
5. `.env.local`에 프로젝트 URL과 anon key 입력

---

## 📄 라이선스

MIT

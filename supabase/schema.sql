-- 측정 기록 테이블
create table measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('baseline', 'retest')),
  reaction_score numeric not null,      -- 반응속도 (ms)
  cognition_score numeric not null,     -- 인지 정답률 (0~100)
  pronunciation_score numeric not null, -- 발음 정확도 (0~100)
  balance_score numeric not null,       -- 균형 안정도 (0~100)
  intoxication_level integer,           -- 취함 단계 1~7 (baseline이면 null)
  intoxication_percentage numeric,      -- 기준선 대비 % (baseline이면 null)
  created_at timestamptz default now() not null
);

-- 본인 데이터만 접근 가능
alter table measurements enable row level security;

create policy "본인 데이터만 조회" on measurements
  for select using (auth.uid() = user_id);

create policy "본인 데이터만 삽입" on measurements
  for insert with check (auth.uid() = user_id);

-- 프로필 이미지 스토리지
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict do nothing;

create policy "본인 아바타만 업로드" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "본인 아바타만 수정" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "아바타 공개 조회" on storage.objects
  for select using (bucket_id = 'avatars');

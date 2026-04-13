'use client'

import { useState, useMemo } from 'react'

interface Props { onComplete: (score: number) => void }

interface Question { a: string; b: string; emoji: string }

export const ALL_QUESTIONS: Question[] = [
  // ── 공감 & 현실 ──
  { emoji: '📱', a: '술 마시고 새벽에 전 연인한테 보낸 카톡을 다음 날 아무도 언급 안 함', b: '모두가 캡처해서 단톡방에 공유함' },
  { emoji: '😬', a: '중요한 발표 직전 바지 지퍼 열린 걸 발표 끝나고 혼자 알게 됨', b: '발표 도중 슬라이드 전체가 날아가서 처음부터 다시 함' },
  { emoji: '💬', a: '상사한테 보낼 "저 오늘 진짜 너무 힘들어요" 메시지를 팀 전체 단톡방에 보냄', b: '부모님 단톡방에 보낼 메시지를 회사 임원 단톡방에 보냄' },
  { emoji: '🎤', a: '혼자인 줄 알고 노래 부르며 길 걷다가 뒤에 사람이 바짝 붙어 걷고 있었음', b: '조용한 카페에서 혼잣말이 마이크에 잡혀 매장 전체에 울려 퍼짐' },
  { emoji: '👀', a: '짝사랑 상대가 내 마음을 알고 정중하게 거절함', b: '짝사랑 상대가 영원히 내 마음을 모른 채 각자 다른 삶을 삶' },
  { emoji: '💌', a: '카톡 읽씹을 3일째 당하는 중인데 상대방 인스타 스토리는 올라옴', b: '모든 답장이 "ㅇㅇ" 또는 "ㅎㅎ" 두 글자로만 계속 옴' },
  { emoji: '🍽️', a: '먹고 싶은 음식 말할 때마다 "다른 거 어때?" 소리를 들음', b: '음식 선택을 항상 내가 해야 하고 한 명이라도 불만 있으면 내 탓이 됨' },

  // ── 직장 & 돈 ──
  { emoji: '💼', a: '월급 550만원인데 상사가 매일 퇴근 직전 일을 던지고 "금방 끝나죠?" 라고 함', b: '월급 270만원인데 칼퇴 보장되고 팀원들이 진짜 좋음' },
  { emoji: '📊', a: '내 아이디어를 훔쳐간 동료가 그걸로 승진함', b: '내가 실수해서 무고한 팀원 전체가 주말 야근을 함' },
  { emoji: '🔍', a: '지금 내 유튜브 시청 기록 전부 공개', b: '10년 전 내 SNS 게시물 전부 공개' },
  { emoji: '⏰', a: '중요한 날마다 알람이 안 울림 (면접, 소개팅, 약속 등)', b: '알람은 울리는데 항상 실제보다 2시간 일찍 울려서 매일 새벽에 깸' },

  // ── 관계 & 감정 ──
  { emoji: '💔', a: '전 연인이 나보다 훨씬 잘 됐다는 걸 공통 친구에게 계속 업데이트받음', b: '전 연인과 매달 한 번씩 예상치 못한 장소에서 마주침' },
  { emoji: '🤝', a: '좋아하는 사람이 나를 친한 친구로만 생각하고 연애 고민을 털어놓음', b: '좋아하는 사람도 나를 좋아하는데 둘 다 성격이 너무 달라서 만날 때마다 싸움' },
  { emoji: '🫂', a: '친한 친구 5명이 내 연인을 싫어하는데 이유를 말 안 해줌', b: '친한 친구 5명이 내 연인을 너무 좋아해서 내 연인이 친구들이랑 더 친해짐' },
  { emoji: '🎂', a: '생일에 아무도 먼저 연락 안 했는데 자정 지나서 다 같이 축하해줌', b: '생일 일주일 전부터 다들 알고 있었는데 당일에 아무도 연락 안 함' },

  // ── 음식 & 일상 ──
  { emoji: '🍜', a: '라면을 끓일 때마다 면이 항상 불어있음 (냄비째로 먹어도 불어있음)', b: '라면을 끓일 때마다 국물이 1/3도 안 남아서 항상 비벼 먹어야 함' },
  { emoji: '🛵', a: '치킨을 시켰는데 50분 늦게 도착했지만 먹어보니 지금껏 먹은 치킨 중 최고', b: '치킨이 정확히 제시간에 왔는데 먹어보니 기대보다 훨씬 별로' },
  { emoji: '☕', a: '카페에서 주문할 때마다 직원이 내 이름을 전혀 다른 이름으로 적음', b: '진동벨이 울려서 음료 받으러 갈 때마다 조금씩 쏟아져 있음' },
  { emoji: '👟', a: '걸을 때마다 신발에 작은 돌이 들어옴', b: '걸을 때마다 신발 끈이 풀림' },

  // ── 취향 & 자의식 ──
  { emoji: '🎵', a: '내가 흥얼거리는 노래가 항상 주변 사람들 귀에 꽂혀서 하루 종일 머릿속에 맴돔', b: '내가 추천하는 노래를 아무도 끝까지 듣지 않음' },
  { emoji: '📸', a: '사진 찍을 때마다 항상 내가 제일 잘 나오지 않음 (눈 감음, 표정 이상 등)', b: '사진 찍을 때마다 내가 제일 잘 나와서 친구들이 항상 내 사진만 올리자고 함' },
  { emoji: '🤐', a: '내 비밀을 가장 친한 친구 단 한 명이 앎', b: '나와 전혀 모르는 타인 100명이 앎' },
  { emoji: '🔋', a: '폰 배터리가 항상 15%를 유지하지만 충전이 안 됨', b: '폰 배터리가 항상 완충이지만 언제 갑자기 꺼질지 모름' },

  // ── 초현실 & 능력 ──
  { emoji: '👁️', a: '귀신이 보이는데 먼저 말 걸거나 해코지는 안 함', b: '귀신은 안 보이는데 혼자 있을 때마다 이상한 소리가 들림' },
  { emoji: '🧠', a: '자는 동안 전 세계 모든 언어를 완벽하게 습득하지만 일어나면 기억이 없음', b: '깨어있는 동안 어떤 정보든 한 번 보면 완벽히 기억하지만 잠들면 전부 리셋됨' },
  { emoji: '⚡', a: '하루에 딱 한 번 5분 동안 어디든 순간이동 가능 (돌아오는 것도 포함)', b: '항상 내 몸 주변 1m 안에 있는 사람의 생각이 들림 (끄는 방법 없음)' },
  { emoji: '🎰', a: '살면서 딱 한 번 로또 1등 당첨되지만 수령 직전에 잃어버림', b: '살면서 로또를 1000번 사지만 전부 꽝' },

  // ── 자존심 & 체면 ──
  { emoji: '🏃', a: '달리기 시합에서 1등으로 들어왔는데 코스를 한 바퀴 덜 돈 거라 실격', b: '실력이 충분한데 긴장해서 시합 당일에 실력 발휘를 아예 못 함' },
  { emoji: '😤', a: '내가 한 모든 노력이 "재능이 있어서 쉽게 한 거잖아"로 여겨짐', b: '내가 이룬 모든 성과가 "운이 좋았던 거잖아"로 여겨짐' },
  { emoji: '🙋', a: '회의에서 좋은 아이디어를 냈는데 아무도 반응 안 했다가 나중에 다른 사람이 같은 말 하니까 다들 좋다고 함', b: '회의에서 용기 내어 발표했는데 끝나고 팀장이 "아까 무슨 말 하려던 거예요?" 라고 물어봄' },

  // ── 수면 & 건강 ──
  { emoji: '😴', a: '침대에 눕자마자 3초 안에 잠드는데 자는 동안 뒤척임이 너무 심해서 일어나면 더 피곤함', b: '잠드는 데 1시간이 걸리지만 한 번 자면 8시간 꿈도 안 꾸고 완벽히 잠' },
  { emoji: '🤧', a: '감기에 걸리면 코가 너무 막혀서 냄새를 전혀 못 맡음', b: '감기에 걸리면 목이 너무 아파서 아무것도 삼키기 힘듦' },

  // ── 술자리 & 모임 ──
  { emoji: '🍺', a: '술자리에서 내가 먼저 취해서 친구들한테 업혀서 집에 감', b: '멀쩡한데 술 못 마신다고 평생 음료수만 마심' },
  { emoji: '🎲', a: '게임에서 지면 항상 내가 폭탄주를 마셔야 하는 자리에서 게임 5판 내내 짐', b: '절대 지지 않는데 아무도 게임 안 하려고 해서 혼자 멀뚱히 앉아있음' },
  { emoji: '🚕', a: '술자리 끝나고 대리 불렀더니 기사님이 취한 나한테 인생 상담을 40분 동안 함', b: '택시 탔는데 기사님이 한마디도 안 하고 목적지 지나쳐서 10분 더 달림' },
  { emoji: '🍻', a: '첫 만남 술자리에서 혼자만 빠르게 취해서 솔직한 말을 전부 다 해버림', b: '술을 전혀 못 마셔서 취한 친구들 옆에서 물만 마시며 6시간을 버팀' },
  { emoji: '🥂', a: '소개팅 자리에서 실수로 상대방 음료를 쏟아서 옷을 적심', b: '소개팅 내내 긴장해서 아무 말도 못 하고 집에 옴' },

  // ── SNS & 온라인 ──
  { emoji: '💻', a: '실수로 남친/남친 사진을 인스타 스토리에 올렸는데 24시간 안에 아무도 못 봄', b: '올린 지 3초 만에 30명이 봤고 한 명이 스크린샷 찍어서 공유함' },
  { emoji: '🤳', a: '공들여 찍은 셀카를 올렸더니 좋아요가 3개 (그중 1개는 내 부모님)', b: '아무 생각 없이 올린 사진이 바이럴 돼서 수천 명이 봄' },
  { emoji: '📲', a: '단톡방에서 나만 읽지 않은 메시지가 230개 쌓여있음', b: '모든 단톡방 알림이 항상 켜져 있어서 하루에 300번 알림이 울림' },
  { emoji: '🗑️', a: '보내지 말았어야 할 메시지를 보내고 1초 안에 삭제했지만 상대가 이미 봄', b: '중요한 메시지를 보내야 하는데 폰이 먹통이 돼서 못 보냄' },
  { emoji: '👁‍🗨', a: '내 계정을 오랫동안 스토킹하던 사람이 갑자기 팔로우 요청을 보냄', b: '내가 오랫동안 스토킹하던 계정 주인이 갑자기 나한테 DM을 보냄' },

  // ── 연애 & 이별 ──
  { emoji: '💑', a: '연인이 내 모든 행동을 칭찬하지만 솔직한 의견을 절대 말하지 않음', b: '연인이 내 모든 행동에 솔직한 피드백을 주지만 매번 상처를 줌' },
  { emoji: '💘', a: '고백 직전에 상대방이 다른 사람과 사귀기 시작함', b: '고백했더니 "우리 친구로 지내자"는 말을 들음' },
  { emoji: '🔐', a: '연인의 폰 잠금화면 배경이 내 사진인데 비밀번호를 절대 안 알려줌', b: '연인이 비밀번호를 알려줬는데 배경화면이 전 연인 사진임' },
  { emoji: '🛏️', a: '연인과 잘 때마다 이불을 다 빼앗김', b: '연인이 코를 너무 심하게 골아서 매일 밤 다른 방에서 잠' },
  { emoji: '🪞', a: '연인이 내 거울 앞에서 1시간씩 꾸미는 바람에 항상 약속에 늦음', b: '연인이 준비를 5분 안에 끝내서 내가 항상 느리다는 소리를 들음' },

  // ── 돈 & 소비 ──
  { emoji: '💸', a: '배달비 아끼려고 직접 픽업 갔더니 음식이 다 팔리고 없음', b: '배달 시켰더니 엉뚱한 음식이 왔고 환불 받으려면 30분 대기해야 함' },
  { emoji: '🏧', a: 'ATM 앞에서 카드를 넣었는데 기계가 카드를 삼켜버림', b: '현금을 찾았는데 지폐 한 장이 반쪽짜리가 섞여 있음' },
  { emoji: '🛒', a: '마트에서 계산 다 하고 나왔는데 제일 중요한 거 빠뜨림', b: '계산대에 줄 서 있는데 내 앞 사람 장바구니에 20개 넘는 물건이 있었음' },
  { emoji: '🎁', a: '받고 싶은 선물을 정확히 말했는데 상대방이 전혀 다른 걸 사줌', b: '아무 말 안 했는데 상대방이 내가 원하는 걸 정확히 골라줬는데 이미 갖고 있는 것임' },
  { emoji: '💳', a: '결제 직전에 카드가 한도 초과로 막힘', b: '결제 됐는데 나중에 보니 두 번 결제돼서 환불 요청해야 함' },

  // ── 교통 & 이동 ──
  { emoji: '🚇', a: '지하철을 탔는데 문이 닫히기 직전 내려야 할 역인 걸 깨달음', b: '지하철에서 잠들어서 종점까지 가버림' },
  { emoji: '🚌', a: '버스에서 하차벨을 눌렀는데 기사님이 그냥 지나쳐버림', b: '잘못 눌렀다는 걸 알면서도 그냥 거기서 내려야 했음' },
  { emoji: '🚗', a: '주차하려고 자리 기다렸는데 내 옆에서 기다리던 차가 새치기함', b: '주차 잘 해놓고 돌아왔더니 내 차만 주차위반 딱지가 붙어있음' },
  { emoji: '✈️', a: '공항에서 탑승구를 잘못 찾아 15분 뛰었는데 비행기를 놓침', b: '제시간에 탔는데 옆 자리 사람이 6시간 내내 말을 걸어옴' },
  { emoji: '🛺', a: '내비 믿고 갔더니 공사 중으로 막혀있어서 우회해야 함', b: '내비 없이 갔다가 완전히 다른 곳에 도착함' },

  // ── 음식 취향 갈등 ──
  { emoji: '🌶️', a: '음식점에서 항상 내가 제일 덜 맵게 시키는 사람이 되어 메뉴 선택권이 없음', b: '음식점에서 항상 제일 맵게 시켜서 다음날 아침이 지옥임' },
  { emoji: '🍣', a: '모두가 먹고 싶어하는 음식이 내가 제일 싫어하는 음식임', b: '내가 먹고 싶은 음식을 아무도 먹고 싶어하지 않음' },
  { emoji: '🥗', a: '다이어트 중인데 친구들이 매일 야식 먹으러 가자고 함', b: '다이어트 안 하는데 친구들이 다들 다이어트 중이라 매번 샐러드만 먹어야 함' },
  { emoji: '🍕', a: '피자 시켰는데 치즈가 전부 한쪽으로 몰려있음', b: '피자 시켰는데 토핑이 모두 중앙에만 있고 가장자리는 그냥 빵임' },
  { emoji: '🧋', a: '버블티에서 타피오카가 하나도 안 나옴', b: '버블티에서 타피오카만 가득 나와서 마시기가 너무 힘듦' },

  // ── 친구 & 우정 ──
  { emoji: '👫', a: '절친이 나한테 아무 말도 없이 갑자기 이사를 가버림', b: '절친이 내 연인이랑 나보다 더 친해짐' },
  { emoji: '🤫', a: '친구가 술 취해서 말한 비밀을 다음 날 기억 못 하는데 나는 다 기억함', b: '내가 술 취해서 말한 비밀을 친구가 다 기억하는데 나는 기억이 없음' },
  { emoji: '📞', a: '항상 내가 먼저 연락하고 상대방이 연락하면 나는 바로 답하는데 상대는 항상 늦게 답함', b: '연락이 너무 자주 와서 폰을 잠깐도 내려놓을 수가 없음' },
  { emoji: '🏠', a: '친구 집에서 자고 일어났더니 친구가 이미 나가서 혼자 집에 있음', b: '내 집에서 친구가 자고 갔는데 다음 날 점심까지 안 가고 있음' },
  { emoji: '🗣️', a: '모임에서 내가 하는 말마다 누군가가 끊어버림', b: '내가 말하는 중에 모두가 조용히 핸드폰만 봄' },

  // ── 직장 심화 ──
  { emoji: '😵', a: '업무 메일을 잘못된 수신인에게 보내고 나서 1시간 뒤에 알게 됨', b: '중요한 메일에 첨부 파일을 빼먹고 보내서 답장으로 지적받음' },
  { emoji: '🖥️', a: '3시간 동안 작업한 파일이 저장 안 된 채로 날아감', b: '저장은 됐는데 나중에 열어보니 엉뚱한 파일로 덮어쓰기 돼있음' },
  { emoji: '📋', a: '회의 자료를 열심히 준비했는데 회의가 갑자기 취소됨', b: '회의 자료를 전혀 안 준비했는데 갑자기 발표 순서가 내 차례가 됨' },
  { emoji: '🕐', a: '야근을 밥 먹듯이 하는 팀인데 칼퇴하면 눈치가 보임', b: '칼퇴 문화인 팀인데 나만 일이 많아서 혼자 남아야 함' },
  { emoji: '👔', a: '중요한 미팅에 옷을 너무 캐주얼하게 입고 감', b: '친구 만나는 자리에 옷을 너무 정장으로 빼입고 감' },

  // ── 기술 & 디지털 ──
  { emoji: '🔌', a: '충전기를 챙겨왔는데 어댑터를 안 챙겨서 못 씀', b: '어댑터는 챙겼는데 충전기를 두고 와서 못 씀' },
  { emoji: '🖨️', a: '중요한 서류를 출력해야 하는데 프린터 잉크가 다 떨어짐', b: '출력은 됐는데 용지가 2장 붙어서 나와서 내용이 뭉개짐' },
  { emoji: '📡', a: '중요한 영상통화 중에 와이파이가 끊어짐', b: '와이파이는 됐는데 카메라 화면에 얼굴이 이상하게 나옴' },
  { emoji: '🔑', a: '집 앞에서 지갑을 잃어버린 걸 알게 됨', b: '집 열쇠를 집 안에 두고 문을 잠가버림' },
  { emoji: '🎧', a: '이어폰 한쪽이 갑자기 소리가 안 남', b: '이어폰 줄이 항상 엉켜서 사용하기 전 5분 풀어야 함' },

  // ── 시험 & 학교 ──
  { emoji: '📝', a: '시험 전날 밤새웠는데 시험장 들어가자마자 잠이 쏟아짐', b: '시험 전날 너무 자서 기억했던 내용이 전부 날아간 것 같음' },
  { emoji: '📚', a: '공부를 완벽하게 준비했는데 시험 범위가 바뀌어있음', b: '시험 범위를 잘못 알고 전혀 다른 걸 공부해서 감' },
  { emoji: '🏫', a: '과제 제출 마감 시간이 오늘 밤 11시 59분인 걸 오늘 저녁 11시에 앎', b: '과제를 제출했는데 나중에 보니 빈 파일을 올렸음' },
  { emoji: '🎓', a: '졸업 직전에 필수 학점이 하나 빠진 걸 알게 됨', b: '졸업은 했는데 졸업장 이름이 틀려있음' },
  { emoji: '✏️', a: 'OMR 카드를 한 줄 밀려서 마킹한 걸 다 쓰고 나서 알게 됨', b: '시험지를 넘기다 모르는 문제를 건너뛰었는데 실수로 그 면이 통째로 빠짐' },

  // ── 여행 & 숙박 ──
  { emoji: '🏨', a: '호텔 예약을 했는데 당일에 오버부킹으로 방이 없다고 함', b: '방은 있는데 예약한 층이 공사 중이라 시끄러움' },
  { emoji: '🧳', a: '여행지에서 캐리어가 벨트 컨베이어에서 안 나옴', b: '캐리어는 나왔는데 다른 사람이 같은 캐리어를 가져가버림' },
  { emoji: '🗺️', a: '구글맵이 없어지는 곳에서 길을 잃음', b: '구글맵을 켜고 다니는데 계속 U턴을 시켜서 같은 곳을 3바퀴 돔' },
  { emoji: '⛺', a: '캠핑 갔는데 텐트 설치 방법을 몰라서 1시간 동안 씨름함', b: '텐트는 설치했는데 비가 와서 안으로 다 새어들어옴' },
  { emoji: '🏖️', a: '해변에서 파도에 신발이 쓸려 내려감', b: '선크림을 잘 발랐는데 하나만 빠뜨려서 그 부분만 새빨갛게 탐' },

  // ── 몸 & 체력 ──
  { emoji: '🏋️', a: '헬스장에서 운동 중에 방귀가 나와서 주변 사람들이 다 들음', b: '운동하다 거울 보며 자세 잡는데 옆 사람이랑 눈이 마주쳐서 5초간 눈싸움이 됨' },
  { emoji: '🤸', a: '스트레칭 중에 근육이 당겨서 이상한 자세로 굳어버림', b: '운동복을 입고 갔는데 운동기구가 전부 사용 중이라 30분을 기다림' },
  { emoji: '😪', a: '출근 지하철에서 졸다가 옆 사람 어깨에 기댐', b: '지하철에서 졸다가 내 어깨에 모르는 사람이 기대고 있음' },
  { emoji: '🤒', a: '중요한 약속 날에만 골라서 아픔', b: '멀쩡한 날 병원 갔더니 검사 결과가 안 좋게 나옴' },
  { emoji: '💊', a: '약을 먹어야 하는데 알약이 너무 커서 삼키기 너무 힘듦', b: '약을 먹었는데 나중에 보니 다른 사람 약을 먹었음' },

  // ── 집 & 생활 ──
  { emoji: '🚿', a: '샤워하다가 갑자기 뜨거운 물이 찬물로 바뀜', b: '샤워하고 나왔는데 수건을 욕실 밖에 두고 온 것을 알게 됨' },
  { emoji: '🍳', a: '요리 다 했는데 간을 너무 짜게 해서 못 먹을 수준', b: '요리를 잘 했는데 먹으려고 앉자마자 배달이 도착함' },
  { emoji: '🧹', a: '청소 끝낸 직후에 친구가 와서 바닥에 과자 부스러기를 전부 흘림', b: '청소를 안 했는데 갑자기 손님이 온다고 연락이 옴' },
  { emoji: '💡', a: '자려고 누웠는데 거실 불을 끄지 않은 게 기억남', b: '자다가 깨서 화장실 다녀왔는데 다시 잠들기까지 2시간 걸림' },
  { emoji: '🐜', a: '집 안에 개미 한 마리가 나타남', b: '모기 한 마리 때문에 밤새 잠을 못 잠' },

  // ── 명절 & 가족 ──
  { emoji: '🏠', a: '명절에 친척들이 내 취직/결혼/연애 상황을 계속 물어봄', b: '명절에 아무도 안 물어봐서 오히려 무시당하는 느낌이 듦' },
  { emoji: '🍖', a: '명절 음식 준비를 내가 제일 많이 했는데 인정을 못 받음', b: '명절 음식을 가장 적게 했는데 가장 많이 먹음' },
  { emoji: '👴', a: '부모님이 내 친구들 앞에서 내 어릴 때 흑역사 사진을 보여줌', b: '부모님이 친구들이랑 나보다 더 친해져서 나 없이 연락함' },
  { emoji: '🎎', a: '부모님이 내 연인을 너무 마음에 들어해서 나보다 더 걱정함', b: '부모님이 내 연인을 딱히 안 좋아하는데 내 앞에서는 말을 안 함' },
  { emoji: '🎋', a: '어릴 때 비교당했던 친척 형/언니가 지금은 나보다 훨씬 잘 됨', b: '어릴 때 비교당했던 친척 형/언니가 지금은 나보다 훨씬 못 됨' },

  // ── 성격 & 습관 ──
  { emoji: '⌚', a: '약속 장소에 항상 30분 일찍 도착해서 혼자 기다림', b: '항상 10분씩 늦어서 매번 미안하다는 말을 해야 함' },
  { emoji: '🗂️', a: '계획을 완벽하게 세웠는데 예상치 못한 변수로 전부 무너짐', b: '아무 계획 없이 즉흥적으로 갔는데 모든 게 잘 안 풀림' },
  { emoji: '🤷', a: '결정을 못 해서 항상 남이 정해주는 걸 기다림', b: '결정을 너무 빨리 해서 나중에 후회함' },
  { emoji: '🗣️', a: '하고 싶은 말을 못 해서 항상 나중에 혼자 상상 속에서 말함', b: '생각나는 대로 말해서 나중에 상대방이 상처받았다고 함' },
  { emoji: '📖', a: '책을 항상 반쯤 읽다가 새 책을 시작함 (읽다 만 책이 10권 쌓임)', b: '책을 끝까지 다 읽는데 내용이 하나도 기억이 안 남' },

  // ── 계절 & 날씨 ──
  { emoji: '☔', a: '우산 챙겼는데 안 비가 오고 안 챙겼을 때만 비가 옴', b: '비 올 때 우산을 폈는데 강풍에 우산이 뒤집어짐' },
  { emoji: '🌞', a: '더위를 너무 타서 여름에 외출을 못 함', b: '추위를 너무 타서 겨울에 두꺼운 패딩을 세 겹 입어야 함' },
  { emoji: '❄️', a: '눈이 온 날 나가다가 미끄러져서 넘어짐', b: '눈이 오는데 기다리던 버스가 15분 늦게 옴' },
  { emoji: '🌧️', a: '빨래를 널어놨는데 갑자기 비가 와서 다시 빨아야 함', b: '비 오는 날 세탁소에서 세탁물을 찾아오다가 비에 젖음' },
  { emoji: '🌊', a: '해수욕장에서 파도에 수영복 끈이 풀림', b: '물놀이 하다가 콘택트렌즈가 빠져버림' },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const ROUNDS_PER_GAME = 10
type Phase = 'setup' | 'voting' | 'reveal'

export default function BalanceGame({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [playerCount, setPlayerCount] = useState(4)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [votes, setVotes] = useState<('A' | 'B')[]>([])
  const [currentVoter, setCurrentVoter] = useState(0)

  function startGame() {
    setQuestions(shuffle(ALL_QUESTIONS).slice(0, ROUNDS_PER_GAME))
    setQuestionIdx(0)
    setVotes([])
    setCurrentVoter(0)
    setPhase('voting')
  }

  function castVote(choice: 'A' | 'B') {
    const newVotes = [...votes, choice]
    setVotes(newVotes)
    if (currentVoter + 1 >= playerCount) {
      setCurrentVoter(0)
      setPhase('reveal')
    } else {
      setCurrentVoter(v => v + 1)
    }
  }

  function nextQuestion() {
    const next = questionIdx + 1
    if (next >= ROUNDS_PER_GAME) {
      onComplete(100)
      return
    }
    setQuestionIdx(next)
    setVotes([])
    setCurrentVoter(0)
    setPhase('voting')
  }

  // ── setup ──
  if (phase === 'setup') return (
    <div className="flex flex-col items-center gap-8 text-center w-full">
      <div>
        <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>⚖️</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.01em', background: 'linear-gradient(135deg, var(--amber), #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          밸런스게임
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
          둘 중 하나를 골라야 한다면?<br />
          <strong style={{ color: 'var(--text)' }}>소수 의견</strong>이 벌칙!
        </p>
      </div>
      <div className="glass p-4 w-full flex flex-col gap-3">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>인원 수</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[2, 3, 4, 5, 6, 7, 8].map(n => (
            <button key={n} onClick={() => setPlayerCount(n)} style={{
              width: 44, height: 44, borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer',
              border: playerCount === n ? '2px solid var(--amber)' : '1px solid var(--border)',
              background: playerCount === n ? 'var(--amber-light)' : 'var(--surface)',
              color: playerCount === n ? '#92400e' : 'var(--text-muted)',
              boxShadow: playerCount === n ? '0 0 10px var(--amber-glow)' : 'none',
              transition: 'all 0.15s ease',
            }}>{n}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROUNDS_PER_GAME}문제</div>
      <button className="btn-primary" onClick={startGame}>게임 시작</button>
    </div>
  )

  const q = questions[questionIdx]
  if (!q) return null

  // ── voting ──
  if (phase === 'voting') return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{`@keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>

      {/* 진행 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{questionIdx + 1} / {ROUNDS_PER_GAME}</span>
        <span>플레이어 {currentVoter + 1}번 선택 중</span>
      </div>
      <div style={{ height: 4, width: '100%', background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--amber)', borderRadius: 99, width: `${(questionIdx / ROUNDS_PER_GAME) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* 질문 */}
      <div style={{ animation: 'fadeUp 0.3s ease', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', fontSize: 13, fontWeight: 700, color: 'var(--amber)',
          background: 'rgba(232,137,12,0.1)', border: '1px solid rgba(232,137,12,0.3)',
          borderRadius: 99, padding: '5px 14px', letterSpacing: '0.02em', marginBottom: 12,
        }}>
          둘 다 싫지만 하나를 고른다면?
        </div>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{q.emoji}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 16 }}>
          플레이어 {currentVoter + 1}번 — 하나를 선택하세요
        </div>
      </div>

      {/* 투표 버튼 */}
      <button onClick={() => castVote('A')} style={{
        width: '100%', padding: '20px 16px', borderRadius: 20,
        border: '2px solid rgba(96,165,250,0.5)', background: 'rgba(96,165,250,0.08)',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.08em', marginBottom: 6 }}>A</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{q.a}</div>
      </button>

      <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700 }}>VS</div>

      <button onClick={() => castVote('B')} style={{
        width: '100%', padding: '20px 16px', borderRadius: 20,
        border: '2px solid rgba(251,146,60,0.5)', background: 'rgba(251,146,60,0.08)',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', letterSpacing: '0.08em', marginBottom: 6 }}>B</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{q.b}</div>
      </button>

      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        {votes.length}명 완료 · {playerCount - votes.length}명 남음
      </div>
    </div>
  )

  // ── reveal ──
  const aCount = votes.filter(v => v === 'A').length
  const bCount = votes.filter(v => v === 'B').length
  const minority: 'A' | 'B' | 'tie' = aCount < bCount ? 'A' : bCount < aCount ? 'B' : 'tie'
  const isDone = questionIdx + 1 >= ROUNDS_PER_GAME

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{`
        @keyframes popIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: 'var(--text-dim)' }}>
        <span>{questionIdx + 1} / {ROUNDS_PER_GAME}</span>
        <span style={{ color: '#4ade80' }}>결과 공개</span>
      </div>

      <div style={{ fontSize: 36, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>{q.emoji}</div>

      {/* A 결과 */}
      {(['A', 'B'] as const).map(side => {
        const count = side === 'A' ? aCount : bCount
        const text = side === 'A' ? q.a : q.b
        const color = side === 'A' ? '#60a5fa' : '#fb923c'
        const isMinority = minority === side
        const isMajority = minority !== 'tie' && minority !== side

        return (
          <div key={side} style={{
            width: '100%', padding: '16px 20px', borderRadius: 20,
            border: isMinority ? '2px solid rgba(255,255,255,0.15)' : isMajority ? `2px solid ${color}` : `1px solid ${color}40`,
            background: isMinority ? 'rgba(255,255,255,0.04)' : isMajority ? `${color}18` : 'var(--surface)',
            boxShadow: isMajority ? `0 0 24px ${color}30` : 'none',
            animation: 'fadeUp 0.35s ease',
            position: 'relative',
            opacity: isMinority ? 0.75 : 1,
            transition: 'opacity 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isMajority ? color : 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>{side}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: isMajority ? 'var(--text)' : 'var(--text-muted)', lineHeight: 1.4 }}>{text}</div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0,
                color: isMajority ? color : 'var(--text-dim)',
              }}>
                <span style={{
                  fontFamily: "'Bebas Neue'", fontSize: 44, lineHeight: 1,
                  textShadow: isMajority ? `0 0 15px ${color}60` : 'none',
                }}>{count}</span>
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>명</span>
              </div>
            </div>
            {isMinority && (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
                🍺 소수 의견 → 벌칙!
              </div>
            )}
            {isMajority && (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color }}>
                ✓ 다수 의견
              </div>
            )}
          </div>
        )
      })}

      {minority === 'tie' && (
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', textAlign: 'center' }}>
          🤝 동점! 모두 벌칙
        </div>
      )}

      <button className="btn-primary" onClick={nextQuestion} style={{ marginTop: 4 }}>
        {isDone ? '게임 완료' : '다음 질문 →'}
      </button>
    </div>
  )
}

import type { TypeTestDef } from './types';

const o = (label: string, main: string, sub: string) => ({ label, scores: { [main]: 2, [sub]: 1 } });

export const LOVE_TYPE_TEST: TypeTestDef = {
  slug: 'love-type-test',
  title: '연애 유형 테스트',
  kicker: 'LOVE TYPE',
  intro: '12개의 상황 질문으로 나의 연애 스타일을 알아봐요.',
  bestLabel: '찰떡 연애 상대',
  gradient: ['#f472b6', '#7c3aed'],
  results: [
    { id: 'bulldozer', name: '직진 불도저', emoji: '🚀', color: '#F43F5E', summary: '좋으면 좋다고 바로 말하는 솔직파예요. 망설임 없는 추진력이 상대를 설레게 해요.', traits: ['솔직함', '추진력', '확신'], tip: '가끔은 상대의 속도에 맞춰 한 템포 쉬어 가면 더 단단해져요.', best: 'tsundere' },
    { id: 'tsundere', name: '츤데레 고양이', emoji: '🐈', color: '#64748B', summary: '겉으론 무심한 척해도 뒤에서 다 챙기는 반전 매력의 소유자예요.', traits: ['은근한 배려', '쿨함', '반전 매력'], tip: '마음을 한 번씩 말로도 표현해 주면 상대가 훨씬 안심해요.', best: 'bulldozer' },
    { id: 'puppy', name: '다정 강아지', emoji: '🐶', color: '#F59E0B', summary: '연락도 애정 표현도 아낌없이! 함께 있으면 기분이 좋아지는 사랑꾼이에요.', traits: ['애정 표현', '다정함', '긍정'], tip: '나만의 시간도 챙겨야 오래 다정할 수 있어요.', best: 'healer' },
    { id: 'strategist', name: '밀당 전략가', emoji: '♟️', color: '#6366F1', summary: '타이밍과 분위기를 읽는 데 능숙해요. 쉽게 속을 보여 주지 않는 신비로운 타입이에요.', traits: ['센스', '여유', '관찰력'], tip: '밀당보다 진심이 통하는 순간이 더 오래 기억에 남아요.', best: 'poet' },
    { id: 'poet', name: '로맨틱 시인', emoji: '🌹', color: '#E11D48', summary: '손편지, 깜짝 이벤트, 노을 데이트까지. 사랑을 작품처럼 만드는 로맨티스트예요.', traits: ['감성', '정성', '상상력'], tip: '특별한 날만큼 평범한 하루의 작은 말도 소중히 해 보세요.', best: 'strategist' },
    { id: 'partner', name: '현실 파트너', emoji: '🏠', color: '#0EA5E9', summary: '약속은 지키고 문제는 함께 푸는 믿음직한 연인이에요. 같이 미래를 그리기 좋아요.', traits: ['신뢰', '책임감', '계획성'], tip: '계획 밖의 즉흥 데이트도 가끔 넣어 주면 설렘이 살아나요.', best: 'free' },
    { id: 'free', name: '자유로운 바람', emoji: '🍃', color: '#10B981', summary: '서로의 세계를 존중하는 쿨한 연애를 해요. 함께여도 각자 빛나는 관계를 원해요.', traits: ['독립성', '즉흥성', '존중'], tip: '자유만큼 "보고 싶어" 한마디도 자주 건네 주세요.', best: 'partner' },
    { id: 'healer', name: '집콕 힐링러', emoji: '🛋️', color: '#A855F7', summary: '화려한 데이트보다 편안한 시간이 좋아요. 곁에 있으면 마음이 쉬어 가는 안식처 같은 타입이에요.', traits: ['편안함', '포용력', '안정감'], tip: '가끔은 밖으로 나가 새로운 추억을 같이 만들어 보세요.', best: 'puppy' }
  ],
  questions: [
    { text: '썸 타는 사람에게 연락할 때 나는?', options: [o('궁금하면 바로 전화부터 건다', 'bulldozer', 'puppy'), o('답장 텀을 일부러 맞춘다', 'strategist', 'tsundere'), o('하고 싶은 말을 길고 정성스럽게 쓴다', 'poet', 'puppy'), o('용건이 있을 때만 짧게 보낸다', 'tsundere', 'free')] },
    { text: '첫 데이트 장소로 끌리는 곳은?', options: [o('미리 예약해 둔 맛집', 'partner', 'bulldozer'), o('야경이 보이는 루프탑', 'poet', 'strategist'), o('발길 닿는 대로 걷다 들어간 곳', 'free', 'bulldozer'), o('조용하고 편한 동네 카페', 'healer', 'tsundere')] },
    { text: '연인이 아프다고 연락이 왔다!', options: [o('약 사 들고 바로 달려간다', 'puppy', 'bulldozer'), o('근처 병원과 챙길 것들을 정리해 보낸다', 'partner', 'strategist'), o('"괜찮아?" 한마디 하고 몰래 죽을 시켜 준다', 'tsundere', 'healer'), o('같이 누워서 영화 보며 쉬자고 한다', 'healer', 'puppy')] },
    { text: '좋아하는 마음을 표현하는 방식은?', options: [o('대놓고 좋아한다고 말한다', 'bulldozer', 'puppy'), o('편지나 플레이리스트에 담는다', 'poet', 'healer'), o('말보다 행동으로 조용히 챙긴다', 'tsundere', 'partner'), o('상대 반응을 보며 조금씩 드러낸다', 'strategist', 'free')] },
    { text: '연인과 다퉜을 때 나는?', options: [o('그 자리에서 대화로 끝장을 본다', 'bulldozer', 'partner'), o('혼자 시간을 갖고 생각을 정리한다', 'free', 'tsundere'), o('먼저 사과하고 꼭 안아 준다', 'puppy', 'poet'), o('상대가 먼저 다가오길 기다린다', 'strategist', 'tsundere')] },
    { text: '연인과 보내는 이상적인 주말은?', options: [o('집에서 배달 음식과 넷플릭스', 'healer', 'partner'), o('즉흥 당일치기 여행', 'free', 'bulldozer'), o('기념일급 깜짝 이벤트 준비', 'poet', 'puppy'), o('각자 할 일 하다가 저녁에 만나기', 'partner', 'free')] },
    { text: '연인이 SNS에 사진을 올렸다.', options: [o('바로 좋아요와 하트 댓글', 'puppy', 'poet'), o('몰래 다 보지만 반응은 안 한다', 'tsundere', 'strategist'), o('원래 SNS를 잘 안 본다', 'free', 'healer'), o('너무 빠르지 않게 반응을 조절한다', 'strategist', 'partner')] },
    { text: '100일 기념일, 나의 선택은?', options: [o('손편지와 깜짝 이벤트', 'poet', 'puppy'), o('필요했던 실용적인 선물', 'partner', 'healer'), o('무심한 척 선물을 툭 건넨다', 'tsundere', 'poet'), o('기념일보다 매일이 더 중요하다', 'free', 'healer')] },
    { text: '연애에서 가장 중요한 건?', options: [o('두근거리는 설렘', 'poet', 'strategist'), o('믿음과 안정감', 'partner', 'healer'), o('서로의 자유와 존중', 'free', 'tsundere'), o('넘치는 표현과 애정', 'puppy', 'bulldozer')] },
    { text: '친구가 연애 고민을 털어놓으면?', options: [o('"좋으면 고백해!" 등을 떠민다', 'bulldozer', 'poet'), o('타이밍과 작전을 같이 짜 준다', 'strategist', 'partner'), o('맛있는 거 먹으며 끝까지 들어 준다', 'healer', 'puppy'), o('조용히 듣다가 현실 조언 한마디', 'tsundere', 'partner')] },
    { text: '연인과의 연락은 이 정도가 좋다.', options: [o('하루 종일 실시간 중계', 'puppy', 'bulldozer'), o('자기 전 통화 한 번이면 충분', 'healer', 'partner'), o('보고 싶을 때 바로바로', 'bulldozer', 'free'), o('일부러 조금 늦게 답한다', 'strategist', 'tsundere')] },
    { text: '연인에게 가장 듣고 싶은 말은?', options: [o('"세상에서 네가 제일 좋아"', 'puppy', 'poet'), o('"너랑 있으면 편해"', 'healer', 'free'), o('"넌 정말 믿음직해"', 'partner', 'bulldozer'), o('"너 진짜 알다가도 모르겠어"', 'tsundere', 'strategist')] }
  ]
};

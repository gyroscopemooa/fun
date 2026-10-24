import type { TypeTestDef } from './types';

const o = (label: string, main: string, sub: string) => ({ label, scores: { [main]: 2, [sub]: 1 } });

export const OFFICE_TYPE_TEST: TypeTestDef = {
  slug: 'office-type-test',
  title: '직장인 유형 테스트',
  kicker: 'OFFICE TYPE',
  intro: '12개의 회사 생활 질문으로 나의 일하는 스타일을 알아봐요.',
  bestLabel: '찰떡 동료',
  gradient: ['#38bdf8', '#1e3a8a'],
  results: [
    { id: 'clockout', name: '칼퇴 요정', emoji: '🕕', color: '#22C55E', summary: '정해진 시간 안에 할 일을 끝내는 효율의 달인이에요. 6시 땡 하면 사라지는 게 특기예요.', traits: ['효율', '집중력', '선 긋기'], tip: '내 업무 노하우를 팀에 공유하면 모두가 칼퇴할 수 있어요.', best: 'excel' },
    { id: 'excel', name: '엑셀 장인', emoji: '📊', color: '#16A34A', summary: '정리와 계획이 곧 실력! 표와 체크리스트로 일을 깔끔하게 굴러가게 만들어요.', traits: ['꼼꼼함', '계획력', '정리 정돈'], tip: '완벽하지 않아도 먼저 공유하면 일이 더 빨라져요.', best: 'idea' },
    { id: 'mc', name: '회의 MC', emoji: '🎤', color: '#F97316', summary: '흩어진 의견을 모으고 결론을 내는 진행의 신이에요. 회의가 길어지지 않게 만드는 사람이에요.', traits: ['진행력', '소통', '리더십'], tip: '조용한 동료의 의견을 먼저 물어보면 회의가 더 풍성해져요.', best: 'fixer' },
    { id: 'idea', name: '아이디어 폭주기관차', emoji: '💡', color: '#EAB308', summary: '새로운 기획과 아이디어가 끝없이 솟아나요. 팀에 신선한 바람을 불어넣는 타입이에요.', traits: ['창의력', '도전정신', '에너지'], tip: '아이디어를 실행 순서까지 적어 두면 통과율이 확 올라가요.', best: 'excel' },
    { id: 'fixer', name: '조용한 해결사', emoji: '🛠️', color: '#475569', summary: '말없이 문제의 원인을 찾아 해결해 내는 숨은 실력자예요. "그거 누가 고쳤어?"의 주인공이에요.', traits: ['문제 해결', '침착함', '전문성'], tip: '내가 해결한 일을 가끔은 드러내야 실력이 제대로 평가받아요.', best: 'mc' },
    { id: 'insider', name: '사내 인싸', emoji: '🤝', color: '#EC4899', summary: '모든 부서에 아는 사람이 있는 연결 고리예요. 덕분에 팀 분위기가 늘 화기애애해요.', traits: ['친화력', '네트워크', '분위기 메이커'], tip: '바쁠 땐 거절도 괜찮아요. 내 업무 시간도 지켜 주세요.', best: 'balance' },
    { id: 'deadline', name: '마감 히어로', emoji: '⏰', color: '#EF4444', summary: '마감이 다가올수록 능력이 폭발해요. 위기의 순간 기적을 만드는 팀의 비밀 병기예요.', traits: ['순발력', '위기 대처', '몰입'], tip: '마감 하루 전을 나만의 마감으로 잡으면 여유가 생겨요.', best: 'clockout' },
    { id: 'balance', name: '워라밸 철학자', emoji: '🧘', color: '#8B5CF6', summary: '일도 삶도 놓치지 않는 균형 감각의 소유자예요. 오래, 즐겁게 일하는 법을 알아요.', traits: ['균형감', '자기관리', '여유'], tip: '내 루틴을 팀과 나누면 모두의 번아웃을 막을 수 있어요.', best: 'insider' }
  ],
  questions: [
    { text: '출근하면 제일 먼저 하는 일은?', options: [o('오늘 할 일 리스트 작성', 'excel', 'clockout'), o('커피 타며 동료와 수다', 'insider', 'mc'), o('밀린 메일과 메신저 정리', 'fixer', 'excel'), o('일단 멍 때리며 시동 걸기', 'deadline', 'balance')] },
    { text: '회의 시간의 나는?', options: [o('진행하고 결론을 정리한다', 'mc', 'excel'), o('아이디어를 계속 던진다', 'idea', 'mc'), o('조용히 듣다 핵심 한마디', 'fixer', 'balance'), o('언제 끝나나 시계를 본다', 'clockout', 'balance')] },
    { text: '퇴근 1시간 전, 급한 일이 떨어졌다!', options: [o('오히려 집중력이 최고조', 'deadline', 'fixer'), o('우선순위부터 다시 정리', 'excel', 'mc'), o('동료들과 나눠서 같이 해치운다', 'insider', 'mc'), o('오늘 할 수 있는 만큼만 한다', 'balance', 'clockout')] },
    { text: '점심시간에 나는?', options: [o('팀원들과 맛집 탐방', 'insider', 'mc'), o('혼밥하며 조용히 충전', 'balance', 'fixer'), o('빨리 먹고 남은 일 처리', 'clockout', 'deadline'), o('안 가 본 새 메뉴 개척', 'idea', 'insider')] },
    { text: '나의 업무 스타일은?', options: [o('무조건 미리미리', 'excel', 'clockout'), o('몰아서 한 번에', 'deadline', 'idea'), o('효율적으로 끝내고 퇴근', 'clockout', 'excel'), o('남들이 못 푸는 문제 담당', 'fixer', 'deadline')] },
    { text: '새 프로젝트가 시작됐다.', options: [o('기획은 내가 해 보고 싶다', 'idea', 'mc'), o('일정과 리스크를 표로 정리', 'excel', 'fixer'), o('사람들을 모아 팀을 꾸린다', 'mc', 'insider'), o('야근 없는 일정부터 확인', 'balance', 'clockout')] },
    { text: '퇴근 후 나의 모습은?', options: [o('운동이나 취미 생활', 'balance', 'idea'), o('동료들과 가볍게 한잔', 'insider', 'mc'), o('못다 한 일이 머릿속에 맴돈다', 'deadline', 'excel'), o('정시 퇴근 자체가 행복', 'clockout', 'balance')] },
    { text: '가장 듣기 좋은 칭찬은?', options: [o('"덕분에 살았어요"', 'fixer', 'deadline'), o('"아이디어 진짜 좋다"', 'idea', 'mc'), o('"자료가 정말 깔끔해요"', 'excel', 'fixer'), o('"같이 일하면 재밌어요"', 'insider', 'idea')] },
    { text: '메신저 알림이 울리면?', options: [o('바로 답장한다', 'insider', 'mc'), o('모아 두었다가 한 번에 확인', 'deadline', 'clockout'), o('퇴근 후엔 무음 모드', 'balance', 'clockout'), o('이모지로 분위기부터 띄운다', 'mc', 'insider')] },
    { text: '회사 워크숍에서 나는?', options: [o('레크리에이션 진행 담당', 'mc', 'insider'), o('일정표와 준비물 공유', 'excel', 'mc'), o('기발한 팀 게임 제안', 'idea', 'mc'), o('조용히 귀가 루트 확인', 'clockout', 'balance')] },
    { text: '업무에 문제가 생겼다!', options: [o('원인을 끝까지 파고든다', 'fixer', 'excel'), o('관련자들과 바로 회의를 잡는다', 'mc', 'fixer'), o('마감 직전 기적을 만든다', 'deadline', 'fixer'), o('완전히 새로운 방법을 시도한다', 'idea', 'fixer')] },
    { text: '꿈꾸는 회사 생활은?', options: [o('주 4일제와 정시 퇴근', 'clockout', 'balance'), o('실력으로 조용히 인정받기', 'fixer', 'excel'), o('좋은 사람들과 즐겁게 일하기', 'insider', 'mc'), o('일과 삶이 딱 50:50', 'balance', 'idea')] }
  ]
};

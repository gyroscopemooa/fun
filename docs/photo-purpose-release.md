# 사진 도구의 용도 분리

## 여권사진

- `/ai-passport-photo`, `/online-passport-photo`, `/free-passport-photo`는 같은 무료 원본 규격 도구를 사용한다. 기존 URL과 보조 페이지의 noindex를 유지한다.
- 브라우저 Canvas에서 원본 자르기와 크기 변환만 수행한다. 사진 업로드, 생성 요청, 결제가 없다. AI 배경 제거·귀/머리 합성·피부 보정을 제공하지 않는다.
- 413×531px JPG, 500KB 이하, JFIF 300dpi로 저장한다. 가이드는 CSS 오버레이여서 저장 파일에 포함하지 않는다. 원본 해상도가 부족하면 저장을 막는다.
- 정수리와 턱 끝 선은 수동 측정 가이드다. 기본 선이나 체크리스트는 자동 검증 결과가 아니다. 공식 적합/통과 판정을 표시하지 않는다.
- 두 귀 노출을 필수로 요구하지 않는다. 눈썹과 얼굴 윤곽을 가리지 않는 원본 촬영을 안내한다.
- 서버의 기존 `passport_photo` 생성 요청은 결제 실행 전에 거부한다. 이전 주문 기록은 삭제하지 않는다.
- 근거: [외교부 여권사진 규정](https://www.passport.go.kr/home/kor/contents.do?menuPos=32), [공식 사진 검증](https://www.passport.go.kr/home/kor/onlinePhotoVerify/index.do?menuPos=33). 확인일 2026-11-15.

## 프로필 스튜디오

- `/ai-headshot`, `/ai-photoshop`은 별도 프로필 UI를 사용한다. 증명사진 페이지의 제목만 바꾸지 않는다.
- `toolType=headshot`, `profileOptions={purpose,background,expression,framing,ratio,retouch}`, `outfitType`을 서버에 전달한다. 모든 값은 서버의 고정 선택지로 검증한다.
- 용도: business/resume/social. 배경: gray/ivory/blue/white. 표정: neutral/smile. 구도: shoulders/upper. 비율: portrait/square. 보정: off/light. 의상: current/suit/smart.
- 프로필 전용 프롬프트를 사용하고 세로는 800×1000px, 정사각은 1000×1000px로 출력한다. 생성 전 화면은 원본/선택값 참고이며 생성 결과라고 표시하지 않는다.
- `/config.headshotOptionsVersion=2026-11-15-v1`과 `readiness.headshotReady`를 모두 확인한 뒤 실행을 연다. 키·플래그가 없거나 생성이 실패하면 증명사진/로컬 필터로 대체하지 않는다.
- 기존 base 상품/가격·결제 흐름을 유지한다. 새 결제 상품이나 NICE 설정을 추가하지 않는다. 원본 이미지는 sessionStorage에 저장하지 않고 업로드 ID·옵션·주문·작업 ID만 보관한다. 복귀·새로고침은 기존 주문/작업을 확인한다.
- headshot도 기존 증명사진과 같은 비동기 작업·중복 실행 차단·크레딧 실패 반환을 적용한다. 신분증·여권 제출용으로 안내하지 않는다.

## 검증

- `node --test node-api/src/providers/idPhoto.test.js node-api/src/providers/idPhotoHttp.test.js node-api/src/providers/headshotOptions.test.js node-api/src/providers/headshotHttp.test.js`
- `node scripts/test-photo-purpose.mjs`: 임시 프로필의 headless Whale에서 규격·밀도·실제 픽셀 유지, 무업로드·무결제, 선택값 요청, 다운로드, 복귀, 실패/반환, 반응형, 별도 UI와 링크를 확인한다. 유료 생성과 결제 응답은 모의한다.
- `node scripts/test-photo-studios-ui.mjs`: 기존 증명사진 및 홈/사이드바 회귀 검사.
- `npm run build` 후 production preview에서도 UI 검증한다.

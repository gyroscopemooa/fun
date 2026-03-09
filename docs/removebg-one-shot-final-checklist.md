# remove.bg One-Shot Final Checklist

## 목적
- 무료/제한 크레딧을 아끼기 위해 실제 호출 테스트를 마지막에 1회만 수행한다.
- 지금은 준비만 하고, 실행은 하지 않는다.

## 0) 지금 상태
- 테스트 실행: 보류
- 목표: 최종 점검 완료 후 1회 실행

## 1) 사전 준비(실행 전)
1. `node-api/.env` 확인
2. 아래 값 확인

```env
PORT=8787
PAYMENT_MODE=mock
IMAGE_PROVIDER=remove_bg
REMOVE_BG_API_KEY=실제키
REMOVE_BG_URL=https://api.remove.bg/v1.0/removebg
```

3. `PUBLIC_` prefix로 API 키를 저장하지 않았는지 확인
4. 프론트 코드에 키 하드코딩이 없는지 확인

## 2) 실행 직전 체크
1. `8787` 포트에 기존 node 프로세스가 없는지 확인
2. `funhub/node-api` 의존성 설치 상태 확인 (`npm install`)
3. 로컬 서버 실행 명령 준비

```bash
cd C:\Users\jeonm\Documents\2.funny\funhub\node-api
npm run dev
```
4. 별도 터미널에서 사전 점검 스크립트 실행

```bash
cd C:\Users\jeonm\Documents\2.funny\funhub
powershell -ExecutionPolicy Bypass -File .\scripts\removebg-one-shot-check.ps1
```

## 3) 최종 1회 실행 시나리오
1. 브라우저에서 `http://127.0.0.1:8787/config` 확인
2. 기대값
   - `configuredImageProvider = remove_bg`
   - `imageProvider = remove_bg` (실패 시 fallback이면 local_sharp 가능)
3. `ai-id-photo` 페이지에서 사진 1장 업로드
4. 생성 버튼 1회 클릭
5. 후보 3장 생성 여부 확인

## 4) 성공 기준
1. 생성 완료 메시지 확인
2. 후보 이미지 3장 노출
3. 다운로드 버튼 동작 가능

## 5) 실패 시 처리(즉시)
1. 실패 메시지 기록
2. `node-api` 로그 확인
3. 원인별 조치
   - 키 오류: `REMOVE_BG_API_KEY` 재확인
   - 호출 제한: 플랜/크레딧 확인
   - 네트워크 오류: 재시도 없이 보류
4. 즉시 `IMAGE_PROVIDER=auto` 또는 `local_sharp`로 임시 복귀

## 6) 실행 후 정리
1. 성공/실패 결과를 md에 기록
2. 다음 단계 결정
   - 성공: Polar 실결제 샌드박스 1회
   - 실패: 외부 API 교체(remove.bg -> photoroom/cutout) 검토

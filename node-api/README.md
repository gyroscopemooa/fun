# ManyTool Node API (MVP)

AI 증명사진 MVP를 위한 로컬 Node API입니다.

## Endpoints
- `GET /health`
- `GET /config` (현재 provider/payment 모드 확인)
- `POST /upload` (multipart field: `image`)
- `POST /generate` (`photoId` 필요)
- `GET /job/:id`
- `POST /checkout` (`mock` 또는 `polar` 모드)
- `POST /payment/webhook` (결제 상태 업데이트)
- `GET /order/:id`
- `GET /download/:candidateId`

## Quick Start
```bash
cd funhub/node-api
npm install
npm run dev
```

기본 포트: `8787` (`PORT` 환경변수로 변경 가능)

주요 환경변수:
- `EXTERNAL_AI_ENABLED=false` (기본)
  - `false`: 외부 API 미호출, `local_sharp`만 사용 (개발/과금 방지)
  - `true`: `IMAGE_PROVIDER` 규칙에 따라 외부 API 사용 가능
- `IMAGE_PROVIDER=auto` (기본)
  - `auto`면 우선순위: `remove_bg` -> `photoroom` -> `local_sharp`
  - API 키가 없거나 외부 API 실패 시 자동으로 `local_sharp` fallback
- `PAYMENT_MODE=mock` (기본, `polar` 지원)
- `REMOVE_BG_API_KEY=...` (선택)
- `REMOVE_BG_URL=https://api.remove.bg/v1.0/removebg` (선택)
- `PHOTOROOM_API_KEY=...` (선택)
- `PHOTOROOM_REMOVE_BG_URL=...` (선택)
- `PHOTOROOM_IMAGE_FIELD=image_file` (선택)
- `POLAR_ACCESS_TOKEN=...` (`PAYMENT_MODE=polar`일 때 필요)
- `POLAR_PRODUCT_BASE=...` (productType별 Polar product ID 필요)
- `POLAR_PRODUCT_ADD2=...`
- `POLAR_PRODUCT_ADD3=...`
- `POLAR_PRODUCT_ADD7=...`
- `POLAR_SUCCESS_URL=...`
- `POLAR_RETURN_URL=...`
- `POLAR_WEBHOOK_INSECURE_TOKEN=...` (임시 토큰 검증, 운영 시 정식 서명검증으로 교체)

## Example Flow
1. `POST /upload` -> `photoId` 획득
2. `POST /generate` -> 후보 3장 생성
3. `POST /checkout` -> 결제 시작 (mock=즉시 paid / polar=checkoutUrl 반환)
4. `GET /download/:candidateId` -> 다운로드

## Notes
- 현재 버전은 in-memory + 로컬 파일 저장 기반입니다.
- 운영 전에는 Supabase/Postgres/Storage 연결로 교체하세요.
- `PAYMENT_MODE=polar`에서는 `checkoutUrl`을 프론트에서 열고, webhook으로 주문 상태를 `paid`로 갱신합니다.
- 현재 webhook 보안은 `POLAR_WEBHOOK_INSECURE_TOKEN` 기반 임시 방식입니다. 운영 전 정식 서명 검증을 붙여야 합니다.
- `IMAGE_PROVIDER`를 기준으로 이미지 처리 provider를 교체할 수 있습니다.
- 운영 권장: `EXTERNAL_AI_ENABLED=true` + `IMAGE_PROVIDER=auto` + 최소 1개 외부 API 키 등록.

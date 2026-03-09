# ManyTool Node API (MVP)

AI 증명사진 MVP를 위한 로컬 Node API입니다.

## Endpoints
- `GET /health`
- `GET /config` (현재 provider/payment 모드 확인)
- `POST /upload` (multipart field: `image`)
- `POST /generate` (`photoId` 필요)
- `GET /job/:id`
- `POST /checkout` (mock 결제, 기본 `paid` 처리)
- `POST /payment/webhook`
- `GET /download/:candidateId`

## Quick Start
```bash
cd funhub/node-api
npm install
npm run dev
```

기본 포트: `8787` (`PORT` 환경변수로 변경 가능)

`.env.example` 기준 주요 변수:
- `IMAGE_PROVIDER=local_sharp` (현재 기본)
- `PAYMENT_MODE=mock` (현재 기본)

## Example Flow
1. `POST /upload` -> `photoId` 획득
2. `POST /generate` -> 후보 3장 생성
3. `POST /checkout` -> 추가 생성 결제(mock)
4. `GET /download/:candidateId` -> 다운로드

## Notes
- 현재 버전은 in-memory + 로컬 파일 저장 기반입니다.
- 운영 전에는 Supabase/Postgres/Storage 연결로 교체하세요.
- `PAYMENT_MODE=mock` 기본값이며, 실결제(POLAR) 연동 시 checkout/webhook 로직을 교체하면 됩니다.
- `IMAGE_PROVIDER`를 기준으로 이미지 처리 provider를 교체할 수 있습니다.

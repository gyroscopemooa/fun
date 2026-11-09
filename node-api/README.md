# ManyTool Node API (MVP)

AI 증명사진 MVP를 위한 로컬 Node API입니다.

## AI 증명사진 운영

- `OPENAI_API_KEY`가 있으면 증명사진(`toolType=id_photo`)은 `gpt-image-2` 이미지 편집 API를 사용합니다. `OPENAI_IMAGE_MODEL`로 모델을 지정할 수 있습니다.
- `ID_PHOTO_ENABLED=false`로 증명사진만 중지할 수 있습니다. 이 전용 플래그는 다른 실험 기능의 `EXTERNAL_AI_ENABLED`와 별개입니다.
- `/config`의 `readiness.idPhotoReady`로 활성화 여부를 확인합니다. 키 유무만 확인하므로 실제 모델 접근은 생성 테스트로 검증해야 합니다.
- `outfitType=current`는 원래 옷 유지, `suit`는 정장 변경입니다. 실패 시 로컬 필터로 대체하지 않습니다.
- 증명사진 `/generate`는 결제 검증 뒤 `202 {jobId,status:processing}`를 반환합니다. `/job/:id`를 조회해 `done`과 후보 3장을 받습니다. 실패는 `failed`로 반환됩니다.
- 동일 주문의 중복 실행을 차단합니다. 크레딧은 작업 완료 시 사용 완료 처리하며 생성 실패 시 반환합니다.
- 검증: `node --test src/providers/idPhoto.test.js src/providers/idPhotoHttp.test.js src/credits/credits.test.js`.

## Endpoints
- `GET /health`
- `GET /config` (현재 provider/payment 모드 확인)
- `POST /upload` (multipart field: `image`)
- `POST /generate` (`photoId` 필요)
- `GET /job/:id`
- `POST /checkout` (`mock` 또는 `polar` 모드)
- `POST /payment/webhook` (결제 상태 업데이트)
- `POST /refund` (로컬 orderId 기준 Polar 환불 요청)
- `GET /order/:id`
- `GET /download/:candidateId`
- `POST /video/mkv-mp4/convert` (multipart field: `video`, paid order 필요)
- `GET /video/mkv-mp4/job/:id`

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
- `POLAR_PRODUCT_BASE=...` 또는 `POLAR_PRODUCT_ID=...` (기본 상품 Polar product ID)
- `POLAR_PRODUCT_VIDEO_MKV_MP4=...` (MKV -> MP4 변환 상품 ID)
- `POLAR_PRODUCT_ADD2=...`
- `POLAR_PRODUCT_ADD3=...`
- `POLAR_PRODUCT_ADD7=...`
- `POLAR_SUCCESS_URL=...`
- `POLAR_RETURN_URL=...`
- `POLAR_WEBHOOK_SECRET=...` (권장, Standard Webhooks 서명 검증)
- `POLAR_WEBHOOK_INSECURE_TOKEN=...` (임시 토큰 검증 fallback)
- `FFMPEG_PATH=ffmpeg` (PATH에 없으면 절대경로 지정)
- `OPENAI_IMAGE_MODEL=gpt-image-2` (AI 이미지 생성기 OpenAI 모델. `gpt-image-1`은 API에서 더 이상 지원되지 않음)
- `XAI_API_KEY=...` (xAI 이미지 엔진. 사이트 기본 엔진이므로 유효한 키 필요)

## Example Flow
1. `POST /upload` -> `photoId` 획득
2. `POST /generate` -> 후보 3장 생성
3. `POST /checkout` -> 결제 시작 (mock=즉시 paid / polar=checkoutUrl 반환)
4. `GET /download/:candidateId` -> 다운로드

## MKV to MP4 Flow
1. `POST /checkout` with `productType=video_mkv_mp4`
2. 결제 완료 후 `POST /video/mkv-mp4/convert`
3. `GET /video/mkv-mp4/job/:id` polling
4. 완료 시 `job.outputUrl` 다운로드

## Notes
- 현재 버전은 in-memory + 로컬 파일 저장 기반입니다.
- 운영 전에는 Supabase/Postgres/Storage 연결로 교체하세요.
- `PAYMENT_MODE=polar`에서는 `checkoutUrl`을 프론트에서 열고, webhook으로 주문 상태를 `paid`로 갱신합니다.
- `POLAR_WEBHOOK_SECRET`가 있으면 Polar 표준 서명을 검증합니다.
- 기본 상품만 연결하려면 `POLAR_PRODUCT_ID` 하나만 넣어도 됩니다. 다만 `+2 / +3 / +7` 추가 생성은 각각 별도 상품 ID가 있어야 실제 결제가 됩니다.
- `IMAGE_PROVIDER`를 기준으로 이미지 처리 provider를 교체할 수 있습니다.
- 운영 권장: `EXTERNAL_AI_ENABLED=true` + `IMAGE_PROVIDER=auto` + 최소 1개 외부 API 키 등록.
- 비디오 변환은 서버에 `ffmpeg`가 설치되어 있어야 활성화됩니다.
- MKV 변환 업로드 한도는 현재 `1.5GiB`입니다.
- 비디오 주문은 현재 `1회 결제당 1개 파일` 기준입니다.

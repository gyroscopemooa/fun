# funhub (manytool)

Astro 기반 SEO 허브 + AI 툴 MVP 프로젝트입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

- 기본 웹 주소: `http://127.0.0.1:4321`

## 빌드

```bash
npm run build
npm run preview
```

## AI 증명사진(Node API 연동)

`/ai-id-photo`는 OpenAI 이미지 편집 API로 정면·흰 배경·잔머리를 정리하고 정장 ON/OFF를 지원합니다.
서버의 `readiness.idPhotoReady` 확인 후 결제·생성을 시작하며, 실패 시 로컬 필터 사진으로 대체하지 않습니다.

### 1) Node API 실행

```bash
cd node-api
npm install
npm run dev
```

- 기본 API 주소: `http://127.0.0.1:8787`

### 2) Astro에서 API 주소 지정(선택)

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```env
PUBLIC_NODE_API_BASE=http://127.0.0.1:8787
```

## 주요 페이지

- `/ai-id-photo`
- `/ai-photoshop`
- `/online-id-photo`
- `/online-passport-photo`

## 기술 스택

- Astro
- React islands (필요 구간 확장 예정)
- Node.js API (`node-api`)
- Supabase (확장 예정)
- Polar (결제 연동 예정)

## 커뮤니티

- 게시판: /community/
- 수동 게시글 폴더: src/content/community/
- 작성 요청: 지금 커뮤 글 작성해줘
- 작성·발행 지침: [docs/community-writing.md](docs/community-writing.md)
- 파일 추가 후 빌드·배포해야 운영 사이트에 반영됩니다.

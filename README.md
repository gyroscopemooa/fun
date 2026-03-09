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

`/ai-id-photo` 페이지는 Node API가 켜져 있으면 서버 파이프라인을 사용하고,
연결 실패 시 브라우저 로컬 생성 모드로 자동 fallback 됩니다.

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

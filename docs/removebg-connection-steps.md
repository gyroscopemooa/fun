# remove.bg Connection Steps (Step 1)

## Purpose
- Connect one external AI API first (`remove.bg`) without exposing API key in frontend.

## Rule
- Never put API key in `PUBLIC_*` variables or frontend code.
- Store key only in `node-api/.env`.

## 1) Create local env file
- Path: `funhub/node-api/.env`
- Base template: copy `funhub/node-api/.env.example`

Required values:
```env
PORT=8787
PAYMENT_MODE=mock
IMAGE_PROVIDER=remove_bg
REMOVE_BG_API_KEY=YOUR_REMOVE_BG_KEY
REMOVE_BG_URL=https://api.remove.bg/v1.0/removebg
```

## 2) Install / run Node API
```bash
cd funhub/node-api
npm install
npm run dev
```

## 3) Verify provider selection
- Check:
  - `GET http://127.0.0.1:8787/config`
- Expected:
  - `configuredImageProvider = remove_bg`
  - `imageProvider = remove_bg` (or `local_sharp` only if key missing/failure fallback)

## 4) Web test flow
1. Open `ai-id-photo` page.
2. Upload one photo.
3. Click generate.
4. Confirm status message says Node API generation completed.

## 5) Failure behavior (expected)
- If `remove.bg` fails, server automatically falls back to `local_sharp`.
- Service should still return candidates instead of hard-failing.

## 6) Security checks
- `node-api/.env` must not be committed.
- No API key logs in console.
- No API key string in frontend source.

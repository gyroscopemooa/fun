# Kakao + No-Login Download Plan

## Goal
- Keep service fully usable without signup/login.
- Support both PC and mobile users.
- Deliver completed result links through Kakao.
- Allow re-download for 7 days after payment, then expire.

## Scope
- Web: desktop + mobile browser.
- Identity model: no account, order-based access.
- Delivery: Kakao message with secure result link.

## UX Flow
1. User uploads photo and generates candidates.
2. User completes payment.
3. Server creates `order_id`, `access_token`, and `expires_at` (payment time + 7 days).
4. Server sends Kakao message with result URL.
5. User opens Kakao link on any device (PC/mobile).
6. Server validates token + expiry and shows result/download page.
7. After 7 days, link is expired and download is blocked.

## Data Model (Draft)
- `orders`
  - `id` (uuid)
  - `status` (`paid`, `pending`, `expired`, `refunded`)
  - `amount`
  - `provider` (`polar`)
  - `created_at`
  - `paid_at`
- `deliveries`
  - `id` (uuid)
  - `order_id` (fk)
  - `channel` (`kakao`)
  - `recipient` (phone hash or kakao target key)
  - `sent_at`
  - `status`
- `access_links`
  - `id` (uuid)
  - `order_id` (fk)
  - `token_hash`
  - `expires_at`
  - `last_access_at`
  - `revoked_at`

## API Draft
- `POST /checkout` -> create order (existing).
- `POST /payment/webhook` -> mark order paid (existing, expand).
- `POST /notify/kakao` -> send result link after payment.
- `GET /result/:token` -> validate token and show result metadata.
- `GET /download/:candidateId?token=...` -> validate token + expiry + order ownership.

## Security Rules
- Do not expose raw `order_id` as auth.
- Use signed/random token and store only `token_hash`.
- Token must be single-order scoped.
- Expired token returns clear error page with renewal contact CTA.
- Optional: max download count per candidate (e.g., 5).

## Expiry / Retention
- Access validity: 7 days after payment.
- Expired orders:
  - block download immediately
  - optional delayed file cleanup batch job (e.g., +1~3 days buffer)

## Device Compatibility
- Works without login on:
  - PC browser
  - Mobile browser
- Kakao link can open on both environments.

## Implementation Phases
### Phase 1 (MVP)
- Token-based result link.
- 7-day expiry enforcement.
- Manual/placeholder Kakao send hook.

### Phase 2
- Real Kakao AlimTalk integration.
- Retry queue for failed message delivery.
- Delivery status tracking page for admin.

### Phase 3
- Reissue link API (still no login, with phone/order verification).
- Auto cleanup worker for expired assets.

## Notes
- This plan keeps the current no-login product strategy.
- Can be implemented later without breaking current flow.

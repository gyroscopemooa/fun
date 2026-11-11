# NICEPAY PostgreSQL migration status

## Wallet and main-server implementation (2026-11-11, third checkpoint)

The native wallet now supports existing Polar and Play receipt handling,
sessions, allocated purchases, execution claims, refunds and recovery. Existing
prices and the default SQLite backend are preserved. Main-server callers await
durable writes before publishing successful responses or completed jobs.
PostgreSQL selection requires both `CREDITS_STORAGE=postgres` and
`CREDITS_MIGRATION_CONFIRMED=true`, an initialized schema and no SQLite path.
There is no automatic schema creation or fallback. Production settings have not
been changed; production NICEPAY routes remain disabled.

Independent review found four async-port defects: stale saves could erase name
input locks, cached Polar name/photo claims could race, and a rejected background
settlement could become unhandled. All four were fixed and independently
rechecked. Regression tests cover immutable locks, refunded-state preservation,
atomic cached claims and settlement failures. Generated artifacts remain available
for reconciliation when settlement fails; completion is published after settlement.

Final local regression: 96 tests passed, zero failures. Real PostgreSQL tests
also passed wallet migration/reconciliation, import rollback after inserts and
identity resets, existing credit HTTP routes, and the actual main-server purchase
and failed-execution recovery path. Test data uses random private schemas and
fake payment/AI providers. No actual payment, email or paid AI call is performed.

Additional commands (from `node-api`):

```powershell
node scripts/test-postgres-wallet-migration.mjs
node scripts/test-postgres-credit-routes.mjs
node scripts/test-postgres-server.mjs
node scripts/inspect-payment-snapshot.mjs <backup-path>
node scripts/migrate-payment-database.mjs --source <backup-path>
```

Migration defaults to read-only dry-run. Applying requires a consistent source
backup, frozen source writers, `--apply --source-writes-frozen --digest <digest>`
and an absent destination schema. Unknown tables/columns, unbalanced ledgers,
unsafe numbers and nonempty destinations are rejected. Import and exact row
reconciliation occur in one transaction, including identity sequence resets.
The apply command restricts schema grants and enables table RLS. An uncertain
commit must be inspected, never blindly retried.

**Production cutover remains incomplete.** No consistent production SQLite
backup has been obtained, so an empty source must not be assumed from disabled
credit configuration. No production payment schema/import/deployment has been
performed. Direct NICEPAY tool execution/private media persistence and real
merchant checkout/cancellation verification remain outstanding. Staging credit
tests are not evidence that those remaining flows are ready for activation.

## Credit staging implementation (2026-11-11, second checkpoint)

`PostgresPaymentLedger` now implements native awaited SQL for checkout keys,
approval claims/receipts, wallet fulfillment, allocated debits, refund holds,
withdrawal, dispatch claims and cancellation application. Existing intent,
authentication-signature and cancellation-signature verification functions are
reused. Existing SQLite stores and production Polar routes remain in place.

The existing credit customer, callback and refund routers support either backend.
The explicit staging factory accepts the PostgreSQL store only for credit-topup
catalogs. Photo/image/video/bundles/tool configuration is rejected before routing;
the old synchronous tool stores cannot accidentally be used with PostgreSQL.
At this checkpoint the production server did not select this backend; the third
checkpoint above adds an explicitly gated selector, without enabling it.

The native dispatch UPDATE requires order ID, cancellation ID, expected amount
and `reserved` state together inside the writer transaction. Commit completes
before the fake/real transport is called. Unknown outcomes stay held for signed
reconciliation; duplicate dispatch never calls the transport again.

Additional verification commands (from `node-api`):

```powershell
node scripts/test-postgres-ledger.mjs
node scripts/test-postgres-http.mjs
```

These explicitly create a random private `manytool_payment_test_<uuid>` schema
containing only fictional data, then drop that exact schema in cleanup. They do
not initialize the production `manytool_payments` schema or import real balances.
The actual PostgreSQL tests cover competing checkout/approval/fulfillment,
allocated debit replay, insufficient funds, spent-lot rejection, owner mismatch,
withdraw/re-reserve from another connection, stale dispatch ID/amount, duplicate
dispatch, uncertain cancellation and competing debit/refund. The HTTP test uses
the actual shared routers and cryptographic verification with fake merchant keys;
the fake approval/cancel clients never send an external request.

From the repository root, the same real-browser regression runs on either
backend (Edge is used on this Windows host):

```powershell
$env:NICEPAY_TEST_BROWSER_CHANNEL='msedge'
$env:NICEPAY_TEST_DATABASE='postgres'
node scripts/test-nicepay-credit-browser.mjs
Remove-Item Env:NICEPAY_TEST_DATABASE
node scripts/test-nicepay-credit-browser.mjs
```

Both PostgreSQL and SQLite browser runs passed balance, prepare/reload/retry,
refund hold/withdrawal, mobile controls, unauthenticated access and default-off
checks. Browser/provider external traffic is blocked; database traffic is the
explicit authenticated test connection. Route handlers are drained before
closing the browser so cleanup completes without in-flight request exceptions.

Independent read-only review found no actionable defect in this staging credit
scope. A broader SQLite staging test still hits the previously observed Windows
private-photo-root POSIX permission guard; the guard was not weakened. This is
not a claim that the full suite or real NICEPAY checkout has passed.

At this checkpoint, missing before production were full Polar/Play and tool-spend/refund/restore
callers, production login/session migration, a consistent existing wallet/order
backup and reconciled import, private media storage, production schema ownership
and grants, real merchant/payment/cancel verification. None of these may be
inferred from passing isolated native credit tests.

## Verified on 2026-11-11

The existing Manytool Supabase project (`pzqlzomrvondxikyafvy`, Singapore) accepts
the locally configured session-pooler connection with certificate and hostname
verification enabled. The database password is only in the ignored
`node-api/.env.nicepay-migration` file, never in Git. Use a percent-encoded password
inside `MANYTOOL_DATABASE_URL`; remove the example placeholder's square brackets.
An actual bracket in a password must instead be encoded, not removed.

Run from `node-api`:

```powershell
node scripts/check-payment-database.mjs
node --test src/payments/postgres.test.js
node scripts/test-payment-database.mjs
```

The first command is read-only. The last command explicitly uses two database
sessions, transaction advisory locks and a temporary table. It rolls back every
test mutation and disconnects both sessions; it makes no payment-provider calls.
It checks PostgreSQL primitives, **not the application's migrated refund flow**.
The production NICEPAY/credit store selection still uses SQLite.

Results: 8/8 local unit tests; live verified TLS/read-only query, cross-session
writer serialization/release, conditional claim with stale ID/amount rejection,
duplicate claim rejection and temporary-table rollback all passed. Existing
public fishbread/local_eats tables were only listed, never changed. No payment
schema, permanent test rows or migrated data were created.

`pg_stat_ssl` on a pooler describes the pooler-to-database connection. The initial
probe incorrectly used it to judge the app-to-pooler TLS connection. The probe
now checks the actual authenticated TLS socket without disabling certificate
validation. This does not claim that the pooler's internal hop uses TLS.

## Prepared code, not production activation

`database-config.js` pins the intended project, rejects URL overrides and requires
verified TLS. `postgres.js` provides a small pool and an awaited transaction
boundary with a transaction-scoped writer lock, bounded waits, rollback, and
connection disposal after an uncertain commit. It never automatically retries a
transaction. Bigint results outside JavaScript's exact integer range fail.

These modules are **not imported by the production server**. Adding the URL to
Render alone cannot migrate the app and must not be used as a cutover procedure.
The existing Polar implementation, product amounts, SQLite persistence and
default-off NICEPAY gates are unchanged.

## Remaining prerequisites for cutover

1. Port the shared wallet/order storage and every caller from synchronous SQLite
   to awaited PostgreSQL operations. The current callbacks, SQL `?` parameters,
   SQLite `rowid`, `INSERT OR IGNORE`, scalar `MIN`, integer/boolean results and
   filesystem-based shared-database checks are not PostgreSQL-compatible.
2. Create a separately owned private `manytool_payments` schema, with no browser
   or public API role access. Preserve existing `public` tables. All payment
   mutations must use the same transaction lock; do not hold it over PG/AI HTTP
   calls. Recheck refund attempt ID and amount inside the dispatch transaction.
3. Obtain a consistent backup of any existing production SQLite wallet/order
   data before deployment or restart, then import it with counts, balances,
   allocations, ledger totals and idempotency keys reconciled. An empty Supabase
   payment schema is not evidence that the existing wallet has no data. Prevent
   concurrent SQLite writes during final export/cutover; do not dual-write money.
4. Run application-level regression and browser tests against PostgreSQL, including
   duplicate approval, debit/refund contention, stale refund dispatch, process
   restart, uncertain outcomes and provider reconciliation. The older Windows
   full-suite photo permission failures still need Linux validation.
5. Configure the deployed API only after these checks. Render can remain the API
   host; PostgreSQL stores ledger data, not the private media artifacts. Photo,
   audio and video persistence needs a separate verified storage plan.
6. Complete merchant/test configuration and real browser NICEPAY approval/cancel
   checks. State the amount before any actual charge. Do not enable unverified
   payment routes or call a refund request a completed cancellation.

No production deployment, paid plan change, real charge or real cancellation was
performed during this preparation. This is a foundation checkpoint, not a
completed database migration or completed NICEPAY integration.

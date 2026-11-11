# NICEPAY PostgreSQL migration status

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
The actual NICEPAY/credit store classes still use SQLite.

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

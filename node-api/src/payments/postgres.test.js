import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentDatabaseConfig, assertPaymentTls } from './database-config.js';
import { withPaymentTransaction, createPaymentPool, PAYMENT_LOCK } from './postgres.js';

const valid = 'postgresql://postgres.pzqlzomrvondxikyafvy:example@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

test('database configuration pins project and verified TLS, decoding password once', async () => {
  const config = paymentDatabaseConfig(valid.replace(':example@', ':a%40b%23%25%5B%5D@'));
  assert.equal(config.password, 'a@b#%[]');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.match(config.ssl.ca, /BEGIN CERTIFICATE/);
  const pool = createPaymentPool(valid);
  try {
    assert.equal(pool.options.types.getTypeParser(20)('1234'), 1234);
    assert.throws(() => pool.options.types.getTypeParser(20)('9007199254740993'), /safe range/);
  } finally { await pool.end(); }
});

test('reject other project, transaction pooler, URL SSL options and incomplete credentials', () => {
  for (const value of [undefined, '', 'broken', valid.replace('postgres.pzqlzomrvondxikyafvy', 'postgres.other'),
    valid.replace(':5432/', ':6543/'), valid.replace('/postgres', '/other'),
    valid + '?sslmode=disable', valid + '#fragment', valid.replace(':example@', ':@'),
    valid.replace(':example@', ':[YOUR-PASSWORD]@'), valid.replace(':example@', ':%XX@')]) {
    assert.throws(() => paymentDatabaseConfig(value));
  }
});

test('client TLS authorization is required independently of backend TLS', () => {
  assertPaymentTls({ connection: { stream: { encrypted: true, authorized: true } } });
  for (const stream of [{}, {encrypted:true,authorized:false}, {encrypted:false,authorized:true}]) {
    assert.throws(() => assertPaymentTls({connection:{stream}}), /Verified/);
  }
});

function fakePool(failSql) {
  const calls = [];
  const releases = [];
  const client = {
    connection: { stream: { encrypted: true, authorized: true } },
    async query(sql, values) {
      calls.push([sql, values]);
      if (failSql?.(sql)) throw new Error('injected failure');
      return {rows:[]};
    },
    release(discard) { releases.push(discard); },
  };
  return {pool:{connect:async()=>client},calls,releases};
}

test('writer obtains transaction lock before callback and commits before release', async () => {
  const fixture = fakePool();
  const value = await withPaymentTransaction(fixture.pool, async client => {
    assert.deepEqual(fixture.calls.at(-1), ['SELECT pg_advisory_xact_lock($1, $2)', PAYMENT_LOCK]);
    await client.query('SELECT 1');
    return 42;
  });
  assert.equal(value,42);
  assert.equal(fixture.calls.at(-1)[0], 'COMMIT');
  assert.deepEqual(fixture.releases,[false]);
});

test('callback rejection rolls back and never commits', async () => {
  const fixture = fakePool();
  await assert.rejects(withPaymentTransaction(fixture.pool, async () => { throw Error('stale refund'); }), /stale refund/);
  assert.equal(fixture.calls.at(-1)[0],'ROLLBACK');
  assert.ok(!fixture.calls.some(([sql])=>sql==='COMMIT'));
  assert.deepEqual(fixture.releases,[false]);
});

test('uncertain commit destroys connection and never retries callback', async () => {
  const fixture = fakePool(sql=>sql==='COMMIT');
  let attempts=0;
  await assert.rejects(withPaymentTransaction(fixture.pool,async()=>{attempts++;}),/injected/);
  assert.equal(attempts,1);
  assert.deepEqual(fixture.releases,[true]);
});

test('read-only transaction does not acquire a payment writer lock', async () => {
  const fixture=fakePool();
  await withPaymentTransaction(fixture.pool,async()=>{}, {readOnly:true});
  assert.equal(fixture.calls[0][0],'BEGIN READ ONLY');
  assert.ok(!fixture.calls.some(([sql])=>sql.includes('advisory')));
});

test('failed rollback discards connection without replacing original error', async () => {
  const fixture=fakePool(sql=>sql==='ROLLBACK');
  await assert.rejects(withPaymentTransaction(fixture.pool,async()=>{throw Error('original');}),/original/);
  assert.deepEqual(fixture.releases,[true]);
});

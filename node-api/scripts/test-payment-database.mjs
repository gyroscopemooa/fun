// Explicit live database probe. No provider calls or permanent application writes.
// Temporary tables vanish with the session; all test mutations are rolled back.
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {createPaymentPool,withPaymentTransaction,PAYMENT_LOCK} from '../src/payments/postgres.js';
import {assertPaymentTls} from '../src/payments/database-config.js';
dotenv.config({path:new URL('../.env.nicepay-migration',import.meta.url)});
let pool,first,second;
const passed=[];
try {
  pool=createPaymentPool(process.env.MANYTOOL_DATABASE_URL);
  await withPaymentTransaction(pool,async client=>{
    assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
    assert.equal((await client.query('SELECT 1::bigint AS n')).rows[0].n,1);
  },{readOnly:true});
  passed.push('verified TLS and read-only transaction');
  first=await pool.connect(); second=await pool.connect();
  assertPaymentTls(first); assertPaymentTls(second);
  await first.query('BEGIN'); await second.query('BEGIN');
  await first.query('SELECT pg_advisory_xact_lock($1,$2)',PAYMENT_LOCK);
  assert.equal((await second.query('SELECT pg_try_advisory_xact_lock($1,$2) AS acquired',PAYMENT_LOCK)).rows[0].acquired,false);
  await first.query('ROLLBACK');
  assert.equal((await second.query('SELECT pg_try_advisory_xact_lock($1,$2) AS acquired',PAYMENT_LOCK)).rows[0].acquired,true);
  await second.query('ROLLBACK');
  passed.push('two sessions serialize writers and release lock on rollback');
  await first.query('BEGIN');
  await first.query('CREATE TEMP TABLE payment_probe (id text PRIMARY KEY, amount bigint NOT NULL, state text NOT NULL) ON COMMIT DROP');
  await first.query("INSERT INTO payment_probe VALUES ('new-attempt',1000,'reserved')");
  const stale=await first.query("UPDATE payment_probe SET state='sending' WHERE id=$1 AND amount=$2 AND state='reserved' RETURNING id",['old-attempt',1000]);
  assert.equal(stale.rowCount,0);
  const changedAmount=await first.query("UPDATE payment_probe SET state='sending' WHERE id=$1 AND amount=$2 AND state='reserved' RETURNING id",['new-attempt',2000]);
  assert.equal(changedAmount.rowCount,0);
  const claimed=await first.query("UPDATE payment_probe SET state='sending' WHERE id=$1 AND amount=$2 AND state='reserved' RETURNING id",['new-attempt',1000]);
  assert.equal(claimed.rowCount,1);
  const duplicate=await first.query("UPDATE payment_probe SET state='sending' WHERE id=$1 AND amount=$2 AND state='reserved' RETURNING id",['new-attempt',1000]);
  assert.equal(duplicate.rowCount,0);
  await first.query('ROLLBACK');
  assert.equal((await first.query("SELECT to_regclass('pg_temp.payment_probe') AS name")).rows[0].name,null);
  passed.push('conditional refund claim rejects stale ID, changed amount and duplicate claim; temporary data rolled back');
  console.log(JSON.stringify({ok:true,passed,permanentApplicationWrites:false,providerCalls:0}));
} catch(error) {
  console.error(JSON.stringify({ok:false,passed,code:/^[A-Z0-9_]{2,40}$/.test(error.code??'')?error.code:'DATABASE_PROBE_FAILED'}));
  process.exitCode=1;
} finally {
  for(const client of [first,second])if(client){await client.query('ROLLBACK').catch(()=>{});client.release(true);}
  await pool?.end();
}

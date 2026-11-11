import pg from 'pg';
import { paymentDatabaseConfig, assertPaymentTls } from './database-config.js';

// Preserve SQLite BEGIN IMMEDIATE's single-writer semantics during the port.
// All payment mutations must use this transaction boundary on the same database.
// Do not call payment providers inside the callback or automatically retry it:
// a lost COMMIT acknowledgement can mean the transaction already committed.
export const PAYMENT_LOCK = [1297371212, 1];

export async function withPaymentTransaction(pool, callback, { readOnly = false } = {}) {
  const client = await pool.connect();
  let began = false;
  let discard = false;
  try {
    assertPaymentTls(client);
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
    began = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    const schema=pool.paymentSchema??'manytool_payments';
    if(schema!=='manytool_payments'&&!/^manytool_payment_test_[a-f0-9]{32}$/.test(schema))throw Error('Invalid payment schema');
    await client.query(`SET LOCAL search_path = ${schema}, pg_catalog`);
    if (!readOnly) await client.query('SELECT pg_advisory_xact_lock($1, $2)', PAYMENT_LOCK);
    const result = await callback(client);
    try { await client.query('COMMIT'); } catch (error) { discard = true; error.paymentCommitUncertain=true; throw error; }
    began = false;
    return result;
  } catch (error) {
    if (began) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
    } else {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

export function createPaymentPool(raw,{schema='manytool_payments',allowTestSchema=false}={}) {
  if(schema!=='manytool_payments'&&!(allowTestSchema&&/^manytool_payment_test_[a-f0-9]{32}$/.test(schema)))throw Error('Unexpected payment schema');
  const config = paymentDatabaseConfig(raw);
  // Database timestamps and money use bigint. Reject values outside JS's exact range.
  const types = new pg.TypeOverrides();
  types.setTypeParser(20, value => {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error('Database integer outside safe range');
    return number;
  });
  const pool=new pg.Pool({ ...config, types, max: 3, idleTimeoutMillis: 10000 });
  pool.paymentSchema=schema;
  // pg discards failed idle clients; do not let an idle socket error become an
  // uncaught EventEmitter exception or log credentials from provider errors.
  pool.on('error',()=>console.error('[payment-db] Idle database connection closed; subsequent requests reconnect.'));
  return pool;
}

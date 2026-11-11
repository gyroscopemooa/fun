import {randomUUID} from 'node:crypto';
import dotenv from 'dotenv';
import {createPaymentPool} from '../src/payments/postgres.js';
import {PostgresPaymentLedger,PAYMENT_TABLES} from '../src/payments/postgres-ledger.js';

export async function createPostgresTestFixture(){
  dotenv.config({path:new URL('../.env.nicepay-migration',import.meta.url)});
  const schema='manytool_payment_test_'+randomUUID().replaceAll('-','');
  if(!/^manytool_payment_test_[a-f0-9]{32}$/.test(schema))throw Error('Invalid test schema');
  const pool=createPaymentPool(process.env.MANYTOOL_DATABASE_URL);
  let created=false;
  try{
    const c=await pool.connect();
    try{await c.query('BEGIN');await c.query(`CREATE SCHEMA ${schema}`);await c.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);await c.query(`SET LOCAL search_path = ${schema}, pg_catalog`);await c.query(PAYMENT_TABLES);await c.query('COMMIT');created=true;}
    catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
  }catch(error){await pool.end();throw error;}
  const scoped={async connect(){const c=await pool.connect();return {connection:c.connection,release:discard=>c.release(discard),query:(sql,args)=>c.query(sql==='SET LOCAL search_path = manytool_payments, pg_catalog'?`SET LOCAL search_path = ${schema}, pg_catalog`:sql,args)};}};
  return {
    store:new PostgresPaymentLedger(scoped),pool:scoped,schema,
    async close(){
      try{if(created){await pool.query(`DROP SCHEMA ${schema} CASCADE`);const result=await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema]);if(result.rowCount)throw Error('Test schema cleanup incomplete');created=false;}}
      catch(error){console.error(JSON.stringify({cleanupFailed:true,testSchema:schema}));throw error;}
      finally{await pool.end();}
    },
  };
}

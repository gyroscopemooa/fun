// Dry-run by default. Production cutover must first freeze source writers and
// retain a consistent SQLite backup. No automatic merge or overwrite is allowed.
import dotenv from 'dotenv';
import {readPaymentSnapshot,paymentSnapshotDigest,importPaymentSnapshot,SNAPSHOT_COLUMNS} from '../src/payments/payment-snapshot.js';
import {PAYMENT_TABLES} from '../src/payments/postgres-ledger.js';
import {createPaymentPool,withPaymentTransaction} from '../src/payments/postgres.js';
dotenv.config({path:new URL('../.env.nicepay-migration',import.meta.url)});
let pool;
try{
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){
    const arg=args[i];if(['--apply','--source-writes-frozen'].includes(arg)){if(options[arg])throw Error('Duplicate option');options[arg]=true;}
    else if(['--source','--digest'].includes(arg)){if(options[arg]||!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing option');options[arg]=args[++i];}
    else throw Error('Unknown option');
  }
  if(!options['--source'])throw Error('Explicit consistent SQLite backup required');
  const snapshot=readPaymentSnapshot(options['--source']),digest=paymentSnapshotDigest(snapshot);
  const counts=Object.fromEntries(Object.entries(snapshot.tables).map(([table,rows])=>[table,rows.length]));
  if(!options['--apply'])console.log(JSON.stringify({dryRun:true,digest,counts,databaseChanged:false}));
  else{
    if(!options['--source-writes-frozen']||options['--digest']!==digest)throw Error('Frozen source and matching digest required');
    pool=createPaymentPool(process.env.MANYTOOL_DATABASE_URL);
    const target={tx:fn=>withPaymentTransaction(pool,async c=>{
      // No IF NOT EXISTS: an existing target needs investigation, never overwrite.
      await c.query('CREATE SCHEMA manytool_payments');
      await c.query('REVOKE ALL ON SCHEMA manytool_payments FROM PUBLIC');
      await c.query(PAYMENT_TABLES);
      for(const role of ['PUBLIC','anon','authenticated','service_role']){
        if(role!=='PUBLIC'&&!(await c.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)continue;
        await c.query(`REVOKE ALL ON SCHEMA manytool_payments FROM ${role}`);
        await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA manytool_payments FROM ${role}`);
        await c.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA manytool_payments FROM ${role}`);
      }
      for(const table of Object.keys(SNAPSHOT_COLUMNS))await c.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      return fn(c);
    })};
    const result=await importPaymentSnapshot(target,snapshot,digest);
    console.log(JSON.stringify({applied:true,...result,sourceChanged:false,productionActivation:false}));
  }
}catch(error){process.exitCode=1;console.error(JSON.stringify({applied:error.paymentCommitUncertain?null:false,commitOutcomeUncertain:error.paymentCommitUncertain===true,code:/^[A-Z0-9_]{2,40}$/.test(error.code??'')?error.code:'MIGRATION_REFUSED',hint:'Check source backup, supported tables, balanced ledger, frozen writers, confirmed digest and an absent target schema. Never retry an uncertain commit without inspecting the target.'}));}
finally{await pool?.end();}

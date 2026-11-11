import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

// Static identifiers only. Unknown tables/columns must be ported explicitly;
// silently omitting tool entitlements or recovery jobs would lose purchased rights.
export const SNAPSHOT_COLUMNS={
  wallets:['email','balance'],
  ledger:['id','email','delta','kind','created','position'],
  tokens:['hash','email','kind','expires'],
  limits:['key','count','expires'],
  topups:['id','email','credits','amount','currency','product','checkout','provider_order','status','refunded','url','position'],
  topup_terms:['topup_id','unit_krw','policy'],
  purchases:['id','email','request_key','fingerprint','credits','state','data'],
  allocations:['purchase_id','topup_id','credits'],
  refund_requests:['id','topup_id','email','credits','amount','quote','status','created'],
  refund_receipts:['topup_id','amount','payload'],
  play_jobs:['token_hash','sealed_token','attempts','next_attempt'],
  play_voids:['token_hash','package','created'],
  play_sync:['package','completed'],
  play_receipts:['token_hash','email','product','package','credits','order_id','consumed','created'],
  nice_orders:['id','owner','intent','state','tid','created','expires','updated'],
  nice_receipts:['order_id','tid','amount','created'],
  nice_checkout_keys:['owner','request_key','order_id','fingerprint'],
  nice_events:['id','order_id','state','created'],
  nice_fulfillments:['order_id','category','created'],
  nice_entitlements:['order_id','owner','product','state'],
  nice_refunds:['order_id','cancel_id','owner','category','credits','amount','state','updated'],
  nice_refund_history:['cancel_id','order_id','snapshot'],
};
const canonical=rows=>rows.map(row=>JSON.stringify(row)).sort();
const fail=()=>{throw Error('Payment snapshot validation failed; no migration applied');};

export function validatePaymentSnapshot(snapshot){
  if(snapshot?.version!==1||!snapshot.tables||Object.keys(snapshot.tables).length!==Object.keys(SNAPSHOT_COLUMNS).length)fail();
  for(const [table,columns]of Object.entries(SNAPSHOT_COLUMNS)){
    const rows=snapshot.tables[table];if(!Array.isArray(rows))fail();
    for(const row of rows){if(!Array.isArray(row)||row.length!==columns.length)fail();for(const value of row)if(value!==null&&typeof value!=='string'&&!(typeof value==='number'&&Number.isSafeInteger(value)))fail();}
  }
  const sums=new Map();
  for(const [,email,delta]of snapshot.tables.ledger){if(typeof email!=='string'||!Number.isSafeInteger(delta))fail();const sum=(sums.get(email)??0)+delta;if(!Number.isSafeInteger(sum))fail();sums.set(email,sum);}
  const wallets=new Map();
  for(const [email,balance]of snapshot.tables.wallets){if(typeof email!=='string'||!Number.isSafeInteger(balance)||wallets.has(email)||balance!==(sums.get(email)??0))fail();wallets.set(email,balance);}
  for(const email of sums.keys())if(!wallets.has(email))fail();
  return snapshot;
}

export function paymentSnapshotDigest(snapshot){
  validatePaymentSnapshot(snapshot);
  return createHash('sha256').update(JSON.stringify(Object.keys(SNAPSHOT_COLUMNS).map(table=>[table,canonical(snapshot.tables[table])]))).digest('hex');
}

export function readPaymentSnapshot(filename){
  const db=new DatabaseSync(filename,{readOnly:true});
  try{
    db.exec('PRAGMA query_only=ON; BEGIN');
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*'").all().map(row=>row.name);
    if(tables.some(table=>!Object.hasOwn(SNAPSHOT_COLUMNS,table)))throw Error('Unsupported payment tables require an explicit migration');
    const snapshot={version:1,tables:{}};
    for(const [table,columns]of Object.entries(SNAPSHOT_COLUMNS)){
      if(!tables.includes(table)){snapshot.tables[table]=[];continue;}
      const sourceColumns=db.prepare(`PRAGMA table_info("${table}")`).all().map(row=>row.name);
      const expected=columns.filter(column=>!(column==='position'&&['ledger','topups'].includes(table)));
      if(sourceColumns.length!==expected.length||sourceColumns.some(column=>!expected.includes(column)))throw Error('Unsupported payment columns require an explicit migration');
      const selected=columns.map(column=>column==='position'?'rowid AS position':`"${column}"`).join(',');
      snapshot.tables[table]=db.prepare(`SELECT ${selected} FROM "${table}"`).all().map(row=>columns.map(column=>row[column]));
    }
    validatePaymentSnapshot(snapshot);
    db.exec('ROLLBACK');return snapshot;
  }finally{db.close();}
}

// Caller supplies an explicitly initialized isolated payment schema and freezes
// source writers before the final snapshot. Existing target data is never merged.
export async function importPaymentSnapshot(target,snapshot,expectedDigest){
  snapshot=structuredClone(snapshot);
  const digest=paymentSnapshotDigest(snapshot);
  if(typeof expectedDigest!=='string'||digest!==expectedDigest)throw Error('Snapshot digest confirmation required');
  return target.tx(async c=>{
    for(const table of Object.keys(SNAPSHOT_COLUMNS)){
      if((await c.query(`SELECT 1 FROM "${table}" LIMIT 1`)).rowCount)throw Error('Payment migration requires an empty target');
    }
    for(const [table,columns]of Object.entries(SNAPSHOT_COLUMNS)){
      const identity=['ledger','topups','nice_events'].includes(table)?' OVERRIDING SYSTEM VALUE':'';
      const sql=`INSERT INTO "${table}" (${columns.map(column=>`"${column}"`).join(',')})${identity} VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')})`;
      for(const row of snapshot.tables[table])await c.query(sql,row);
    }
    for(const [table,columns]of Object.entries(SNAPSHOT_COLUMNS)){
      const rows=(await c.query(`SELECT ${columns.map(column=>`"${column}"`).join(',')} FROM "${table}"`)).rows.map(row=>columns.map(column=>row[column]));
      if(JSON.stringify(canonical(rows))!==JSON.stringify(canonical(snapshot.tables[table])))throw Error('Imported payment rows do not match snapshot');
    }
    for(const [table,column]of [['ledger','position'],['topups','position'],['nice_events','id']]){
      // Identity sequence changes are transaction-safe with ALTER ... RESTART.
      // setval is deliberately avoided: sequence side effects survive rollback.
      const maximum=(await c.query(`SELECT MAX("${column}") AS maximum FROM "${table}"`)).rows[0].maximum??0;
      if(!Number.isSafeInteger(maximum)||maximum<0||!Number.isSafeInteger(maximum+1))fail();
      await c.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" RESTART WITH ${maximum+1}`);
    }
    return {digest,counts:Object.fromEntries(Object.keys(SNAPSHOT_COLUMNS).map(table=>[table,snapshot.tables[table].length]))};
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CreditStore} from '../credits/store.js';
import {readPaymentSnapshot,paymentSnapshotDigest,validatePaymentSnapshot,importPaymentSnapshot} from './payment-snapshot.js';

function fixture(t){const dir=mkdtempSync(join(tmpdir(),'payment-snapshot-')),file=join(dir,'source.sqlite'),store=new CreditStore(file);t.after(()=>{store.close();rmSync(dir,{recursive:true});});return {file,store};}
test('read-only snapshot is deterministic and never changes source rows',t=>{
  const {file,store}=fixture(t);store.change('fixture','fake@example.invalid',10,'fixture');
  const before=readPaymentSnapshot(file);assert.equal(before.tables.wallets[0][1],10);
  assert.equal(paymentSnapshotDigest(before),paymentSnapshotDigest(readPaymentSnapshot(file)));
  assert.equal(store.balance('fake@example.invalid'),10);
});
test('unknown tables and columns are refused, not silently discarded',t=>{
  const {file,store}=fixture(t);store.db.exec('CREATE TABLE sqliteCustom(data TEXT)');
  assert.throws(()=>readPaymentSnapshot(file),/Unsupported payment tables/);
  store.db.exec('DROP TABLE sqliteCustom; ALTER TABLE wallets ADD COLUMN extra TEXT');
  assert.throws(()=>readPaymentSnapshot(file),/Unsupported payment columns/);
});
test('ledger mismatch and unsafe values block import before connecting',async t=>{
  const {file,store}=fixture(t);store.change('fixture','fake@example.invalid',10,'fixture');
  const snapshot=readPaymentSnapshot(file);snapshot.tables.wallets[0][1]=9;
  assert.throws(()=>validatePaymentSnapshot(snapshot));
  let connected=false;const target={tx(){connected=true;throw Error('must not connect');}};
  await assert.rejects(importPaymentSnapshot(target,snapshot,'wrong'));assert.equal(connected,false);
  snapshot.tables.wallets[0][1]=10;const digest=paymentSnapshotDigest(snapshot);
  await assert.rejects(importPaymentSnapshot(target,snapshot,digest+'x'),/digest/);assert.equal(connected,false);
  snapshot.tables.wallets[0][1]=Number.MAX_SAFE_INTEGER+1;assert.throws(()=>validatePaymentSnapshot(snapshot));
});
test('migration CLI defaults to dry-run and refuses unconfirmed apply without connecting',t=>{
  const {file}=fixture(t),script=fileURLToPath(new URL('../../scripts/migrate-payment-database.mjs',import.meta.url));
  const run=args=>spawnSync(process.execPath,[script,'--source',file,...args],{windowsHide:true,encoding:'utf8',env:{...process.env,MANYTOOL_DATABASE_URL:''}});
  const dry=run([]);assert.equal(dry.status,0);assert.equal(JSON.parse(dry.stdout).databaseChanged,false);
  const apply=run(['--apply']);assert.equal(apply.status,1);assert.equal(JSON.parse(apply.stderr).applied,false);
});

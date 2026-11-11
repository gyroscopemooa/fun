// Read-only inventory; never prints balances, emails, tokens or row contents.
import {readPaymentSnapshot,paymentSnapshotDigest} from '../src/payments/payment-snapshot.js';
try{
  if(process.argv.length!==3)throw Error('One explicit SQLite filename required');
  const snapshot=readPaymentSnapshot(process.argv[2]);
  console.log(JSON.stringify({readOnly:true,digest:paymentSnapshotDigest(snapshot),counts:Object.fromEntries(Object.entries(snapshot.tables).map(([table,rows])=>[table,rows.length]))}));
}catch{console.error('Snapshot inspection failed. Verify the explicit source path, supported schema and ledger consistency. No data was changed.');process.exitCode=1;}

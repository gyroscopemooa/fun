import {PostgresPaymentLedger} from './postgres-ledger.js';

export const isPostgresPaymentStore=store=>store instanceof PostgresPaymentLedger;

export function assertSharedPaymentStorage(store,wallet){
  if(isPostgresPaymentStore(store)||isPostgresPaymentStore(wallet)){
    if(!isPostgresPaymentStore(store)||!isPostgresPaymentStore(wallet)||store.pool!==wallet.pool)throw Error('Shared PostgreSQL payment pool required');
    return;
  }
  const file=db=>db?.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file;
  if(!file(store?.db)||file(store.db)!==file(wallet?.db))throw Error('Shared persistent payment wallet required');
}

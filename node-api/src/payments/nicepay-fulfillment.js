// NICE orders and CreditStore MUST use the same private SQLite file.
// Receipt verification is durable first; this transaction is safely replayable after a crash.
export function fulfillNicepayOrder(creditStore, orderId) {
  if(typeof creditStore.fulfill==='function')return creditStore.fulfill(orderId);
  const db=creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_fulfillments(order_id TEXT PRIMARY KEY, category TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS nice_entitlements(order_id TEXT PRIMARY KEY, owner TEXT NOT NULL, product TEXT NOT NULL, state TEXT NOT NULL);`);
  return creditStore.tx(()=>{
    const row=db.prepare("SELECT o.*,r.amount AS receipt_amount,r.tid AS receipt_tid FROM nice_orders o JOIN nice_receipts r ON r.order_id=o.id WHERE o.id=? AND o.state='verified'").get(orderId);
    if(!row)throw new Error('Verified NICEPAY receipt required in wallet database');
    const intent=JSON.parse(row.intent);
    if(row.owner!==intent.ownerId||row.tid!==row.receipt_tid||intent.amount!==row.receipt_amount)throw new Error('NICEPAY fulfillment mismatch');
    if(db.prepare('SELECT 1 FROM nice_fulfillments WHERE order_id=?').get(orderId))return false;
    if(intent.category==='credit_topup'){
      if(!Number.isSafeInteger(intent.credits)||intent.credits<=0||intent.amount!==intent.credits*1000||intent.unitKrw!==1000||typeof intent.refundPolicyVersion!=='string'||!intent.refundPolicyVersion)throw new Error('NICEPAY credit pack mismatch');
      const id=`nicepay:${orderId}`;
      db.prepare("INSERT INTO topups(id,email,credits,amount,currency,product,provider_order,status) VALUES(?,?,?,?,'krw',?,?,'paid')").run(id,row.owner,intent.credits,intent.amount,intent.productId,`nicepay:${row.tid}`);
      db.prepare('INSERT INTO topup_terms VALUES(?,?,?)').run(id,intent.unitKrw,intent.refundPolicyVersion);
      creditStore.change(`topup:${id}`,row.owner,intent.credits,'NICEPAY 충전');
    }else if(intent.category==='direct'){
      db.prepare("INSERT INTO nice_entitlements VALUES(?,?,?,'ready')").run(orderId,row.owner,intent.productId);
    }else if(intent.category!=='donation')throw new Error('Unknown NICEPAY fulfillment category');
    db.prepare('INSERT INTO nice_fulfillments VALUES(?,?,?)').run(orderId,intent.category,Date.now());return true;
  });
}
export function pendingNicepayFulfillments(creditStore){
  // Tables are initialized independently without applying any receipt.
  creditStore.db.exec('CREATE TABLE IF NOT EXISTS nice_fulfillments(order_id TEXT PRIMARY KEY, category TEXT NOT NULL, created INTEGER NOT NULL)');
  return creditStore.db.prepare("SELECT o.id FROM nice_orders o LEFT JOIN nice_fulfillments f ON f.order_id=o.id WHERE o.state='verified' AND f.order_id IS NULL").all().map(row=>row.id);
}
export function claimNicepayEntitlement(creditStore,orderId,owner,product){
  return creditStore.tx(()=>{
    const changed=creditStore.db.prepare("UPDATE nice_entitlements SET state='claimed' WHERE order_id=? AND owner=? AND product=? AND state='ready'").run(orderId,owner,product);
    if(changed.changes!==1)throw new Error('NICEPAY entitlement unavailable');
  });
}
// Explicit local recovery job: performs no PG request, and isolates failures per order.
export function recoverNicepayFulfillments(creditStore){
  return pendingNicepayFulfillments(creditStore).map(orderId=>{
    try{return {orderId,fulfilled:fulfillNicepayOrder(creditStore,orderId)};}
    catch{return {orderId,fulfilled:false,requiresReview:true};}
  });
}

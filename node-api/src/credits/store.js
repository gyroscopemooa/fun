import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { calculateRefund, REFUND_POLICY_VERSION } from './refunds.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

export class CreditStore {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS wallets(email TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY, email TEXT NOT NULL, delta INTEGER NOT NULL, kind TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS topups(id TEXT PRIMARY KEY, email TEXT NOT NULL, credits INTEGER NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL, product TEXT NOT NULL, checkout TEXT, provider_order TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', refunded INTEGER NOT NULL DEFAULT 0, url TEXT);
      CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY, email TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, credits INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'ready', data TEXT NOT NULL, UNIQUE(email, request_key));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS topup_terms(topup_id TEXT PRIMARY KEY, unit_krw INTEGER NOT NULL, policy TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS allocations(purchase_id TEXT NOT NULL, topup_id TEXT NOT NULL, credits INTEGER NOT NULL, PRIMARY KEY(purchase_id,topup_id));
      CREATE TABLE IF NOT EXISTS refund_requests(id TEXT PRIMARY KEY, topup_id TEXT UNIQUE NOT NULL, email TEXT NOT NULL, credits INTEGER NOT NULL, amount INTEGER NOT NULL, quote TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS refund_receipts(topup_id TEXT NOT NULL, amount INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(topup_id,amount));`);
  }
  close() { this.db.close(); }
  initPlayStore() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS play_jobs(token_hash TEXT PRIMARY KEY, sealed_token TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS play_voids(token_hash TEXT PRIMARY KEY, package TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS play_sync(package TEXT PRIMARY KEY, completed INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS play_receipts(token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, product TEXT NOT NULL, package TEXT NOT NULL, credits INTEGER NOT NULL, order_id TEXT UNIQUE, consumed INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);`);
  }
  playReceipt(tokenHash) { this.initPlayStore(); return this.db.prepare('SELECT * FROM play_receipts WHERE token_hash=?').get(tokenHash); }
  applyPlayPurchase({ tokenHash, email, productId, packageName, credits, orderId, sealedToken }) {
    this.initPlayStore();
    return this.tx(() => {
      if (this.isPlayVoided(tokenHash, packageName)) fail('Play purchase was voided');
      const prior = this.playReceipt(tokenHash);
      if (prior) {
        if (prior.email !== email || prior.product !== productId || prior.package !== packageName) fail('Play purchase binding mismatch');
        return;
      }
      if (!sealedToken) fail('Durable Play recovery unavailable', 503);
      this.queuePlayConsume(tokenHash, sealedToken);
      if (!Number.isSafeInteger(credits) || credits <= 0) fail('Invalid Play credits', 400);
      const id = `play:${tokenHash}`;
      this.db.prepare('INSERT INTO play_receipts(token_hash,email,product,package,credits,order_id,created) VALUES(?,?,?,?,?,?,?)').run(tokenHash, email, productId, packageName, credits, orderId, Date.now());
      // Play prices/refunds belong to Google. Do not invent a KRW amount or apply Polar refund terms.
      this.db.prepare("INSERT INTO topups(id,email,credits,amount,currency,product,provider_order,status) VALUES(?,?,?,0,'play',?,?,'paid')").run(id, email, credits, productId, orderId ? `google-play:${orderId}` : null);
      this.change(`topup:${id}`, email, credits, 'Google Play 충전');
    });
  }
  markPlayConsumed(tokenHash) {
    this.tx(() => { this.db.prepare('UPDATE play_receipts SET consumed=1 WHERE token_hash=?').run(tokenHash);
      this.db.prepare('DELETE FROM play_jobs WHERE token_hash=?').run(tokenHash); });
  }
  queuePlayConsume(tokenHash, sealedToken) {
    this.initPlayStore();
    this.db.prepare('INSERT INTO play_jobs(token_hash,sealed_token) VALUES(?,?) ON CONFLICT(token_hash) DO UPDATE SET sealed_token=excluded.sealed_token').run(tokenHash,sealedToken);
  }
  pendingPlayConsumes(now, limit=100) {
    this.initPlayStore();
    return this.db.prepare('SELECT j.*,r.email,r.product,r.package FROM play_jobs j JOIN play_receipts r USING(token_hash) WHERE j.next_attempt<=? ORDER BY j.next_attempt LIMIT ?').all(now,limit);
  }
  retryPlayConsume(tokenHash, now) {
    this.db.prepare('UPDATE play_jobs SET attempts=attempts+1,next_attempt=? + MIN(3600000,60000 * (1 << MIN(attempts,6))) WHERE token_hash=?').run(now,tokenHash);
  }
  isPlayVoided(tokenHash, packageName) {
    this.initPlayStore();
    const row=this.db.prepare('SELECT package FROM play_voids WHERE token_hash=?').get(tokenHash);
    if (row && row.package!==packageName) fail('Play package mismatch');
    return Boolean(row);
  }
  voidPlayPurchase(tokenHash, packageName, now=Date.now()) {
    this.initPlayStore();
    return this.tx(() => {
      const receipt=this.playReceipt(tokenHash);
      if(receipt && receipt.package!==packageName) fail('Play package mismatch');
      this.db.prepare('INSERT OR IGNORE INTO play_voids VALUES(?,?,?)').run(tokenHash,packageName,now);
      if(receipt) {
        // Full reversal also creates debt if credits have already been spent.
        this.change(`play-void:${tokenHash}`,receipt.email,-receipt.credits,'Google Play 환불 회수');
        this.db.prepare("UPDATE topups SET status='refunded',refunded=credits WHERE id=?").run(`play:${tokenHash}`);
      }
      this.db.prepare('DELETE FROM play_jobs WHERE token_hash=?').run(tokenHash);
    });
  }
  oldestPlayReceipt(packageName) { this.initPlayStore(); return this.db.prepare('SELECT MIN(created) AS created FROM play_receipts WHERE package=?').get(packageName)?.created ?? 0; }
  playSyncTime(packageName) { this.initPlayStore(); return this.db.prepare('SELECT completed FROM play_sync WHERE package=?').get(packageName)?.completed ?? 0; }
  markPlaySynced(packageName, now) { this.initPlayStore(); this.db.prepare('INSERT INTO play_sync VALUES(?,?) ON CONFLICT(package) DO UPDATE SET completed=excluded.completed').run(packageName,now); }


  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  balance(email) { return this.db.prepare('SELECT balance FROM wallets WHERE email=?').get(email)?.balance ?? 0; }
  history(email) { return this.db.prepare('SELECT delta, kind, created FROM ledger WHERE email=? ORDER BY created DESC, rowid DESC LIMIT 50').all(email); }
  change(id, email, delta, kind) {
    if (this.db.prepare('SELECT id FROM ledger WHERE id=?').get(id)) return false;
    this.db.prepare('INSERT OR IGNORE INTO wallets(email) VALUES (?)').run(email);
    this.db.prepare('UPDATE wallets SET balance=balance+? WHERE email=?').run(delta, email);
    this.db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?)').run(id, email, delta, kind, Date.now());
    return true;
  }
  rateLimit(key, maximum, duration) {
    return this.tx(() => {
      const now = Date.now();
      this.db.prepare('DELETE FROM limits WHERE expires<?').run(now);
      const row = this.db.prepare('SELECT * FROM limits WHERE key=?').get(key);
      if (row?.count >= maximum) fail('잠시 후 다시 시도해주세요.', 429);
      this.db.prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + duration);
    });
  }
  token(email, kind, ttl) {
    const raw = randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM tokens WHERE expires<?').run(Date.now());
    this.db.prepare('INSERT INTO tokens VALUES(?,?,?,?)').run(hash(raw), email, kind, Date.now() + ttl);
    return raw;
  }
  authenticate(raw, kind = 'session', consume = false) {
    return this.tx(() => {
      const row = this.db.prepare('SELECT * FROM tokens WHERE hash=? AND kind=? AND expires>?').get(hash(String(raw)), kind, Date.now());
      if (!row) fail('이메일 로그인이 필요합니다.', 401);
      if (consume) this.db.prepare('DELETE FROM tokens WHERE hash=?').run(row.hash);
      return row.email;
    });
  }
  logout(raw) { this.db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(String(raw))); }
  createTopup(email, pack, product) {
    const id = randomUUID();
    return this.tx(() => {
    this.db.prepare('INSERT INTO topups(id,email,credits,amount,currency,product) VALUES(?,?,?,?,?,?)')
      .run(id, email, pack.credits, pack.amount, pack.currency.toLowerCase(), product);
    this.db.prepare('INSERT INTO topup_terms VALUES(?,?,?)').run(id, 1000, REFUND_POLICY_VERSION);
    return this.topup(id);
    });
  }
  topup(id) { return this.db.prepare('SELECT * FROM topups WHERE id=?').get(id); }
  checkout(id, checkout, url) { this.db.prepare('UPDATE topups SET checkout=?,url=? WHERE id=?').run(checkout, url, id); }
  applyPayment(event) {
    const data = event.data;
    const id = data?.metadata?.credit_topup_id;
    return this.tx(() => {
      const row = this.topup(id ?? '');
      if (!row) fail('Unknown credit top-up', 404);
      if (!['order.paid', 'order.refunded'].includes(event.type)) return;
      // Verify the paid, tax-exclusive amount, product, currency and immutable checkout binding.
      if (!data.id || data.product_id !== row.product || data.currency !== row.currency ||
          data.net_amount !== row.amount || (data.discount_amount ?? 0) !== 0 ||
          (row.checkout && data.checkout_id !== row.checkout) || !data.checkout_id ||
          (row.provider_order && row.provider_order !== data.id)) fail('Credit payment mismatch', 400);
      if (event.type === 'order.paid' && data.paid !== true) fail('Payment not settled', 400);
      this.db.prepare('UPDATE topups SET provider_order=?,checkout=? WHERE id=?').run(data.id, data.checkout_id, row.id);
      if (event.type === 'order.paid') {
        if (row.status === 'refunded') return;
        this.change(`topup:${id}`, row.email, row.credits, '충전');
        this.db.prepare("UPDATE topups SET status='paid' WHERE id=?").run(id);
      } else {
        // Refund events carry cumulative refunded_amount. Reverse proportionately,
        // even after spending; a negative wallet is blocked from further purchases.
        if (!Number.isSafeInteger(data.refunded_amount) || data.refunded_amount < 0) fail('Invalid refund', 400);
        const request = this.db.prepare('SELECT * FROM refund_requests WHERE topup_id=?').get(id);
        if (request) {
          this.db.prepare('INSERT OR IGNORE INTO refund_receipts VALUES(?,?,?)').run(id, data.refunded_amount, JSON.stringify(data));
          if (request.status === 'completed' && data.refunded_amount <= request.amount) return;
          // A requested refund already removed all remaining credits. Do not
          // proportionally reverse them a second time or leave discount residue.
          if (data.refunded_amount !== request.amount) {
            this.db.prepare("UPDATE refund_requests SET status='review' WHERE id=?").run(request.id);
            return;
          }
          if (request.status === 'review') return;
          this.db.prepare("UPDATE refund_requests SET status='completed' WHERE id=?").run(request.id);
          this.db.prepare("UPDATE topups SET status='refunded',refunded=? WHERE id=?").run(request.credits, id);
          return;
        }
        const reversed = Math.min(row.credits, Math.ceil(row.credits * data.refunded_amount / row.amount));
        const delta = reversed - row.refunded;
        if (delta <= 0) return;
        // Handle a refund arriving before order.paid without ever granting free credit.
        this.change(`topup:${id}`, row.email, row.credits, '충전');
        this.change(`refund:${id}:${reversed}`, row.email, -delta, '충전 환불 회수');
        this.db.prepare("UPDATE topups SET status='refunded',refunded=? WHERE id=?").run(reversed, id);
      }
    });
  }
  purchase(email, key, fingerprint, credits, order) {
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) fail('요청 식별자가 필요합니다.', 400);
    if (!Number.isSafeInteger(credits) || credits <= 0) fail('Invalid debit', 400);
    return this.tx(() => {
      const previous = this.db.prepare('SELECT * FROM purchases WHERE email=? AND request_key=?').get(email, key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) fail('같은 요청의 상품 정보를 변경할 수 없습니다.');
        return JSON.parse(previous.data);
      }
      if (this.db.prepare("SELECT id FROM refund_requests WHERE email=? AND status='review'").get(email)) fail('환불 내역 확인 중입니다. 고객센터에 문의해주세요.');
      if (this.balance(email) < credits) fail('크레딧 잔액이 부족합니다.', 402);
      let unallocated = credits;
      for (const lot of this.lots(email)) {
        const count = Math.min(unallocated, lot.available);
        if (count > 0) {
          this.db.prepare('INSERT INTO allocations VALUES(?,?,?)').run(order.id, lot.id, count);
          unallocated -= count;
        }
        if (!unallocated) break;
      }
      if (unallocated) fail('충전별 잔액 확인이 필요합니다. 고객센터에 문의해주세요.');
      this.change(`spend:${order.id}`, email, -credits, '도구 사용');
      this.db.prepare('INSERT INTO purchases(id,email,request_key,fingerprint,credits,data) VALUES(?,?,?,?,?,?)')
        .run(order.id, email, key, fingerprint, credits, JSON.stringify(order));
      if (order.productType === 'ai_pet_translator') this.db.prepare("UPDATE purchases SET state='done' WHERE id=?").run(order.id);
      return order;
    });
  }
  order(id) { const row = this.db.prepare('SELECT data FROM purchases WHERE id=?').get(id); return row ? JSON.parse(row.data) : null; }
  allOrders() { return this.db.prepare('SELECT data FROM purchases').all().map(row => JSON.parse(row.data)); }
  state(id) { return this.db.prepare('SELECT state FROM purchases WHERE id=?').get(id)?.state; }
  saveOrder(order) { this.db.prepare('UPDATE purchases SET data=? WHERE id=?').run(JSON.stringify(order), order.id); }
  claim(id) {
    const result = this.db.prepare("UPDATE purchases SET state='processing' WHERE id=? AND state='ready'").run(id);
    if (!result.changes) fail('이미 사용했거나 처리 중인 크레딧 주문입니다.');
  }
  finish(id, success) {
    return this.tx(() => {
      const row = this.db.prepare('SELECT * FROM purchases WHERE id=?').get(id);
      if (!row || row.state !== 'processing') return;
      if (success) this.db.prepare("UPDATE purchases SET state='done' WHERE id=?").run(id);
      else this.restoreRow(row);
    });
  }
  restoreRow(row) {
    this.change(`restore:${row.id}`, row.email, row.credits, '실패 복구');
    const order = { ...JSON.parse(row.data), status: 'refunded', refundStatus: 'succeeded', refundedAt: new Date().toISOString() };
    this.db.prepare("UPDATE purchases SET state='refunded',data=? WHERE id=?").run(JSON.stringify(order), row.id);
  }
  restore(id) {
    return this.tx(() => {
      const row = this.db.prepare('SELECT * FROM purchases WHERE id=?').get(id);
      if (!row || row.state === 'done' || row.state === 'refunded') return;
      this.restoreRow(row);
    });
  }
  cancel(email, id) {
    return this.tx(() => {
      const row = this.db.prepare('SELECT * FROM purchases WHERE id=? AND email=?').get(id, email);
      if (!row || row.state !== 'ready') fail('아직 사용하지 않은 주문만 취소할 수 있습니다.');
      this.restoreRow(row);
    });
  }
  pending(email) { return this.db.prepare("SELECT id,credits,data FROM purchases WHERE email=? AND state='ready'").all(email).map(r => ({ id: r.id, credits: r.credits, productType: JSON.parse(r.data).productType })); }
  lots(email) {
    return this.db.prepare(`SELECT t.*, COALESCE((SELECT SUM(a.credits) FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=t.id AND p.state!='refunded'),0) allocated,
      EXISTS(SELECT 1 FROM refund_requests r WHERE r.topup_id=t.id) locked
      FROM topups t WHERE t.email=? ORDER BY t.rowid`).all(email).map(row => ({ ...row,
        available: ['paid', 'refunded'].includes(row.status) && !row.locked ? Math.max(0, row.credits - row.refunded - row.allocated) : 0 }));
  }
  refundQuote(email, id) {
    const row = this.topup(id);
    if (!row || row.email !== email) fail('충전 주문을 찾을 수 없습니다.', 404);
    if (row.currency === 'play') fail('Google Play 구매 환불은 Google Play 절차를 이용해주세요.');
    if (row.status !== 'paid' || row.refunded) fail('이미 환불되었거나 결제 확인 전인 주문입니다.');
    if (this.db.prepare('SELECT id FROM refund_requests WHERE topup_id=?').get(id)) fail('이미 환불을 접수한 주문입니다.');
    const terms = this.db.prepare('SELECT * FROM topup_terms WHERE topup_id=?').get(id);
    if (terms?.policy !== REFUND_POLICY_VERSION) fail('구매 당시 환불 조건을 고객센터에서 확인해야 합니다.');
    const legacy = this.db.prepare("SELECT id FROM purchases p WHERE email=? AND state!='refunded' AND NOT EXISTS(SELECT 1 FROM allocations a WHERE a.purchase_id=p.id)").get(email);
    if (legacy) fail('이전 사용 내역을 고객센터에서 확인해야 합니다.');
    const pending = this.db.prepare("SELECT p.id FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=? AND p.state IN ('ready','processing')").get(id);
    if (pending) fail('미사용 주문을 취소하거나 진행 중인 작업이 끝난 후 환불을 신청해주세요.');
    const used = this.db.prepare("SELECT COALESCE(SUM(a.credits),0) amount FROM allocations a JOIN purchases p ON p.id=a.purchase_id WHERE a.topup_id=? AND p.state='done'").get(id).amount;
    return { topupId: id, ...calculateRefund({ paidAmount: row.amount, totalCredits: row.credits, usedCredits: used, unitKrw: terms.unit_krw }) };
  }
  requestRefund(email, id, expected) {
    return this.tx(() => {
      const previous = this.db.prepare('SELECT * FROM refund_requests WHERE topup_id=? AND email=?').get(id, email);
      if (previous) return { id: previous.id, status: previous.status, ...JSON.parse(previous.quote) };
      const quote = this.refundQuote(email, id);
      if (quote.refundAmount !== expected.refundAmount || quote.usedCredits !== expected.usedCredits || expected.policyVersion !== quote.policyVersion) fail('사용 내역이 변경되었습니다. 환불 예상액을 다시 확인해주세요.');
      if (!quote.remainingCredits || !quote.refundAmount) fail('자동 접수 가능한 환불 잔액이 없습니다. 예외 사유는 고객센터에 문의해주세요.');
      if (this.balance(email) < quote.remainingCredits) fail('잔액 확인이 필요합니다. 고객센터에 문의해주세요.');
      const requestId = randomUUID();
      this.change(`refund-hold:${id}`, email, -quote.remainingCredits, '충전 환불 대기');
      this.db.prepare('INSERT INTO refund_requests VALUES(?,?,?,?,?,?,?,?)').run(requestId, id, email, quote.remainingCredits, quote.refundAmount, JSON.stringify(quote), 'requested', Date.now());
      return { id: requestId, status: 'requested', ...quote };
    });
  }
  topupHistory(email) {
    return this.db.prepare(`SELECT t.id,t.credits,t.amount,t.currency,t.status,r.status refundStatus,r.amount refundAmount
      FROM topups t LEFT JOIN refund_requests r ON r.topup_id=t.id WHERE t.email=? AND t.status!='pending' ORDER BY t.rowid DESC LIMIT 50`).all(email).map(row => ({ ...row, provider: row.currency === 'play' ? 'google_play' : 'polar', amount: row.currency === 'play' ? null : row.amount }));
  }
}

import { createHash, createHmac, createSign, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const playTokenHash = token => createHash('sha256').update(token).digest('hex');
export const playAccountBinding = (email, secret) => createHmac('sha256', secret).update(`manytool-play:${email}`).digest('hex');
export function readPlayConfig(env) {
  let products;
  try { products = JSON.parse(env.PLAY_CREDIT_PRODUCTS_JSON || '{}'); } catch { fail('Invalid Play credit product configuration', 503); }
  if (!products || Array.isArray(products) || typeof products !== 'object' || Object.keys(products).length > 20) fail('Invalid Play products', 503);
  for (const [id, credits] of Object.entries(products)) if (!/^[a-z0-9][a-z0-9_.]{0,99}$/.test(id) || !Number.isSafeInteger(credits) || credits < 1 || credits > 100000) fail('Invalid Play product', 503);
  const packageName = env.PLAY_PACKAGE_NAME || '';
  const bindingSecret = env.PLAY_ACCOUNT_BINDING_SECRET || '';
  const recoveryAvailable = Boolean(env.PLAY_SERVICE_ACCOUNT_FILE) && bindingSecret.length >= 32
    && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName);
  const tokenKey = env.PLAY_TOKEN_ENCRYPTION_KEY || '';
  const workerEnabled = env.PLAY_WORKER_ENABLED === 'true';
  const enabled = /^[a-f0-9]{64}$/.test(tokenKey) && workerEnabled && env.PLAY_CREDITS_ENABLED === 'true' && env.CREDITS_ENABLED === 'true' && env.CREDITS_TOOLS_READY === 'true'
    && env.PLAY_REFUND_RECONCILIATION_READY === 'true' && recoveryAvailable && Object.keys(products).length > 0;
  return { enabled, recoveryAvailable, products, packageName, bindingSecret, tokenKey, workerEnabled };
}

// Credential files are deployed separately outside public storage. Never return/log their content.
export function createPlayPublisher({ credentialFile, fetcher = fetch, now = () => Date.now() }) {
  let cached = null;
  async function accessToken() {
    if (cached && cached.expires > now() + 60000) return cached.token;
    const credential = JSON.parse(await readFile(credentialFile, 'utf8'));
    if (credential.type !== 'service_account' || !credential.client_email || !credential.private_key) fail('Play credentials unavailable', 503);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const issued = Math.floor(now() / 1000);
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credential.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600 })}`;
    const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(credential.private_key, 'base64url')}`;
    const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail('Play authentication unavailable', 503);
    const body = await response.json();
    if (!body.access_token || !Number.isFinite(body.expires_in)) fail('Play authentication unavailable', 503);
    cached = { token: body.access_token, expires: now() + Math.min(body.expires_in, 3600) * 1000 };
    return cached.token;
  }
  async function call(packageName, productId, purchaseToken, consume = false) {
    const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
    const url = `${base}/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}${consume ? ':consume' : ''}`;
    const response = await fetcher(url, { method: consume ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail('Play purchase verification unavailable', response.status === 404 ? 400 : 503);
    return consume ? null : response.json();
  }
  async function listVoided(packageName, { startTime, endTime, pageToken }) {
    const url=new URL(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/voidedpurchases`);
    url.searchParams.set('startTime',String(startTime)); url.searchParams.set('endTime',String(endTime));
    url.searchParams.set('type','0'); url.searchParams.set('includeQuantityBasedPartialRefund','true');
    if(pageToken) url.searchParams.set('token',pageToken);
    const response=await fetcher(url,{headers:{Authorization:`Bearer ${await accessToken()}`},signal:AbortSignal.timeout(15000)});
    if(!response.ok) fail('Play refund synchronization unavailable',503);
    return response.json();
  }
  return { get: (pkg, id, token) => call(pkg, id, token), consume: (pkg, id, token) => call(pkg, id, token, true), listVoided };

}

export async function verifyPlayCredit({ store, config, publisher, email, productId, purchaseToken }) {
  if (typeof productId !== 'string' || !/^[a-z0-9][a-z0-9_.]{0,99}$/.test(productId) || typeof purchaseToken !== 'string' || purchaseToken.length < 8 || purchaseToken.length > 4096 || /[\x00-\x20]/.test(purchaseToken)) fail('Invalid Play purchase');
  const tokenHash = playTokenHash(purchaseToken);
  if (store.isPlayVoided(tokenHash, config.packageName)) fail('Play purchase was voided',409);
  const previous = store.playReceipt(tokenHash);
  if (previous && (previous.email !== email || previous.product !== productId || previous.package !== config.packageName)) fail('Purchase belongs to another account', 409);
  if (previous) {
    if (!config.recoveryAvailable) fail('Play 구매 복구를 사용할 수 없습니다.', 503);
  } else {
    if (Date.now()-store.playSyncTime(config.packageName)>900000) fail('Play refund synchronization is stale',503);
    if (!config.enabled) fail('Play 크레딧 충전은 준비 중입니다.', 503);
    if (!Object.hasOwn(config.products, productId)) fail('Invalid Play purchase');
  }
  // Even retries recheck Google: cancelled/revoked purchases must never be newly granted.
  const purchase = await publisher.get(config.packageName, productId, purchaseToken);
  if (previous && purchase.purchaseState === 1) store.voidPlayPurchase(tokenHash,config.packageName);
  if (purchase.purchaseState !== 0 || purchase.obfuscatedExternalAccountId !== playAccountBinding(email, config.bindingSecret)
      || (purchase.productId && purchase.productId !== productId) || (purchase.quantity ?? 1) !== 1) fail('Play purchase is not eligible');
  if (![0, 1].includes(purchase.consumptionState)) fail('Invalid Play consumption state');
  if (purchase.consumptionState === 1 && !previous) fail('Purchase was already consumed', 409);
  if (!previous && Date.now()-store.playSyncTime(config.packageName)>900000) fail('Play refund synchronization is stale',503);
  if (!previous) store.applyPlayPurchase({ tokenHash, email, productId, packageName: config.packageName, credits: config.products[productId], orderId: purchase.orderId || null, sealedToken: sealPlayToken(purchaseToken,tokenHash,config.tokenKey) });
  else if (purchase.consumptionState === 0) store.queuePlayConsume(tokenHash,sealPlayToken(purchaseToken,tokenHash,config.tokenKey));
  if(store.isPlayVoided(tokenHash,config.packageName)) fail('Play purchase was voided',409);
  let consumptionPending = false;
  if (purchase.consumptionState === 0) {
    try { await publisher.consume(config.packageName, productId, purchaseToken); store.markPlayConsumed(tokenHash); }
    catch { consumptionPending = true; } // Durable grant exists; retry verification, never grant twice.
  } else store.markPlayConsumed(tokenHash);
  return { credited: true, consumptionPending, balance: store.balance(email) };
}

export function installPlayCreditRoutes(app, { store, env = process.env, publisher }) {
  const config = readPlayConfig(env);
  publisher ||= createPlayPublisher({ credentialFile: env.PLAY_SERVICE_ACCOUNT_FILE });
  const stopWorker=config.workerEnabled && config.recoveryAvailable && /^[a-f0-9]{64}$/.test(config.tokenKey) ? startPlayRecoveryWorker({store,config,publisher}) : ()=>{};
  const origin = new URL(env.PUBLIC_WEB_BASE_URL || 'https://manytool.net').origin;
  const auth = req => store.authenticate(/(?:^|;\s*)manytool_credit_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1] || '');
  const wrap = fn => async (req, res) => { res.setHeader('Cache-Control', 'no-store'); try { await fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Play 요청을 처리하지 못했습니다.' }); } };
  app.get('/credits/play/catalog', wrap((req, res) => {
    const email = auth(req);
    const enabled=config.enabled && Date.now()-store.playSyncTime(config.packageName)<=900000;
    res.json({ enabled, recoveryAvailable: config.recoveryAvailable, accountBinding: config.recoveryAvailable ? playAccountBinding(email, config.bindingSecret) : null,
      products: enabled ? Object.entries(config.products).map(([productId, credits]) => ({ productId, credits })) : [] });
  }));
  app.post('/credits/play/verify', wrap(async (req, res) => {
    if (req.headers.origin !== origin) fail('허용되지 않은 요청입니다.', 403);
    const email = auth(req); store.rateLimit(`play:${email}`, 30, 600000);
    res.json(await verifyPlayCredit({ store, config, publisher, email, productId: req.body?.productId, purchaseToken: req.body?.purchaseToken }));
  }));
  return stopWorker;
}

// AES-GCM ciphertext only, key supplied separately by the deployment secret manager.
export function sealPlayToken(token, hash, key) {
  if(!/^[a-f0-9]{64}$/.test(key || '')) fail('Play recovery key unavailable',503);
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
  cipher.setAAD(Buffer.from(hash));
  return Buffer.concat([iv,cipher.update(token,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function openPlayToken(sealed, hash, key) {
  const bytes=Buffer.from(sealed,'base64'), decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(0,12));
  decipher.setAAD(Buffer.from(hash)); decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8');
}
export async function reconcilePlayVoids({store,config,publisher,now=Date.now()}) {
  const day=86400000, previous=store.playSyncTime(config.packageName);
  // A missed history window must be investigated, not silently called synchronized.
  const oldest=store.oldestPlayReceipt(config.packageName);
  if((previous && now-previous>29*day) || (!previous && oldest && now-oldest>29*day)) fail('Play refund history gap requires reconciliation',503);
  const startTime=previous ? Math.max(now-29*day,previous-day) : now-29*day;
  let pageToken; const seen=new Set(); let pages=0;
  do {
    if(++pages>1000 || (pageToken && seen.has(pageToken))) fail('Invalid Play refund pagination',503);
    if(pageToken) seen.add(pageToken);
    const page=await publisher.listVoided(config.packageName,{startTime,endTime:now,pageToken});
    if(!page || (page.voidedPurchases!==undefined && !Array.isArray(page.voidedPurchases))) fail('Invalid Play refund response',503);
    for(const purchase of page.voidedPurchases || []) {
      if(typeof purchase.purchaseToken!=='string' || purchase.purchaseToken.length<8 || purchase.purchaseToken.length>4096) fail('Invalid Play void token',503);
      // Only quantity-one purchases are granted, so a refunded quantity of one is full reversal.
      if(purchase.voidedQuantity!==undefined && Number(purchase.voidedQuantity)!==1) fail('Unsupported Play refund quantity requires review',503);
      store.voidPlayPurchase(playTokenHash(purchase.purchaseToken),config.packageName,now);
    }
    pageToken=page.tokenPagination?.nextPageToken;
    if(pageToken!==undefined && typeof pageToken!=='string') fail('Invalid Play refund pagination',503);
  } while(pageToken);
  store.markPlaySynced(config.packageName,now);
}
export async function retryPlayConsumes({store,config,publisher,now=Date.now()}) {
  let completed=0, pending=0;
  for(const job of store.pendingPlayConsumes(now)) {
    if(job.package!==config.packageName) continue;
    try {
      const token=openPlayToken(job.sealed_token,job.token_hash,config.tokenKey);
      if(playTokenHash(token)!==job.token_hash) throw Error('token mismatch');
      if(store.isPlayVoided(job.token_hash,job.package)) continue;
      const purchase=await publisher.get(job.package,job.product,token);
      if(purchase.purchaseState===1) {store.voidPlayPurchase(job.token_hash,job.package,now);continue;}
      if(purchase.purchaseState!==0 || purchase.obfuscatedExternalAccountId!==playAccountBinding(job.email,config.bindingSecret)
        || (purchase.productId && purchase.productId!==job.product) || (purchase.quantity??1)!==1 || ![0,1].includes(purchase.consumptionState)) throw Error('ineligible');
      if(store.isPlayVoided(job.token_hash,job.package)) continue;
      if(purchase.consumptionState===0) await publisher.consume(job.package,job.product,token);
      store.markPlayConsumed(job.token_hash); completed++;
    } catch {store.retryPlayConsume(job.token_hash,now);pending++;}
  }
  return {completed,pending};
}
export function startPlayRecoveryWorker(args) {
  let busy=false;
  const tick=async()=>{
    if(busy) return; busy=true;
    try {await reconcilePlayVoids(args);} catch {console.error('[play-recovery] Refund synchronization failed; new grants stop after freshness window.');}
    try {const result=await retryPlayConsumes(args);if(result.pending) console.error(`[play-recovery] ${result.pending} consume jobs pending retry.`);} catch {console.error('[play-recovery] Consume retry failed.');}
    finally {busy=false;}
  };
  const timer=setInterval(tick,60000); timer.unref(); void tick();
  return ()=>clearInterval(timer);
}

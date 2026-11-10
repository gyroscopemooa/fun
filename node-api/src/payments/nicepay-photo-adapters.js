import { createHash } from 'node:crypto';

const COUNTS = Object.freeze({ base: 3, add2: 2, add3: 3, add7: 7 });
const PRODUCTS = [...Object.keys(COUNTS), 'passport_addon', 'headshot_addon'];
const id = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw Error('Invalid private photo reference');
  return value;
};
const fail = message => { throw Error(message); };

/** Unmounted staging interface. All injected functions are trusted server dependencies.
 * resolvePurchase MUST read an immutable checkout snapshot, not request body fields.
 * resolveArtifact MUST verify owner and return a private artifact handle, never a public URL.
 * generate MUST durably save files and return owned private artifact IDs. It receives
 * orderId as its idempotency key, and MUST NOT infer retries from network timeouts.
 * Call execute through executeNicepayTool, which owns claiming/reconciliation.
 * This deliberately does not import server.js (which starts a production listener).
 */
export function createNicepayPhotoAdapters({ enabled = false, creditStore, resolvePurchase,
  resolveArtifact, generate, addonPolicies = {} } = {}) {
  if (!enabled) return {};
  if (!creditStore || ![resolvePurchase, resolveArtifact, generate].every(fn => typeof fn === 'function')) {
    throw Error('Private photo storage and immutable purchase binding required');
  }
  const db = creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_photo_jobs (
    order_id TEXT PRIMARY KEY, owner TEXT NOT NULL, product TEXT NOT NULL,
    parent_id TEXT, binding TEXT NOT NULL, state TEXT NOT NULL, result TEXT);
    CREATE TABLE IF NOT EXISTS nice_photo_selection (
    order_id TEXT PRIMARY KEY, owner TEXT NOT NULL, candidate_id TEXT NOT NULL);`);

  async function purchase(orderId, owner, product) {
    if (typeof owner !== 'string' || !owner) fail('Photo owner required');
    const spec = await resolvePurchase({ orderId, owner, product });
    if (!spec || spec.owner !== owner || spec.product !== product) fail('Photo purchase ownership mismatch');
    const allowedTools = ['id_photo', 'passport_photo', 'headshot'];
    if (!allowedTools.includes(spec.toolType)) fail('Photo tool rights mismatch');
    const photoId = id(spec.photoId);
    let count = COUNTS[product];
    if (count === undefined) {
      // These legacy product names do not define a usable allowance in server.js.
      const policy = addonPolicies[product];
      if (!policy || policy.toolType !== spec.toolType || !Number.isSafeInteger(policy.count)
        || policy.count < 1 || policy.count > 7) fail('Photo addon policy is not approved');
      count = policy.count;
    }
    const parentId = product === 'base' ? null : id(spec.parentOrderId);
    if (parentId) {
      const parent = db.prepare(`SELECT j.* FROM nice_photo_jobs j JOIN nice_entitlements e ON e.order_id=j.order_id
        WHERE j.order_id=? AND j.owner=? AND j.product='base' AND j.state='done'
        AND e.owner=j.owner AND e.product=j.product AND e.state='claimed'`).get(parentId, owner);
      if (!parent) fail('Completed owned base photo job required');
      const original = JSON.parse(parent.binding);
      if (original.photoId !== photoId || original.toolType !== spec.toolType) fail('Photo addon parent mismatch');
      if (JSON.stringify(original.options) !== JSON.stringify(spec.options ?? {})) fail('Photo addon options mismatch');
    }
    // Options (provider, outfit, full package etc.) come exclusively from checkout.
    const options = spec.options ?? {};
    if (!options || typeof options !== 'object' || Array.isArray(options)
      || Buffer.byteLength(JSON.stringify(options)) > 8192) fail('Invalid photo options');
    return { photoId, toolType: spec.toolType, options, count, parentId };
  }

  return Object.fromEntries(PRODUCTS.map(product => [product, {
    async validate(input, { orderId, owner } = {}) {
      // Prevent callers choosing a different tool/provider/input after payment.
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some(key => key !== 'photoId')) fail('Only a bound photo reference is accepted');
      id(orderId);
      const spec = await purchase(orderId, owner, product);
      if (spec.photoId !== id(input.photoId)) fail('Paid photo input changed');
      const source = await resolveArtifact({ artifactId: spec.photoId, owner, kind: 'source' });
      if (!source || source.owner !== owner || source.id !== spec.photoId) fail('Owned private photo required');
      return { photoId: spec.photoId };
    },
    async execute(input, { orderId, owner } = {}) {
      id(orderId);
      if (typeof owner !== 'string' || !owner) fail('Photo owner required');
      const entitlement = db.prepare('SELECT state FROM nice_entitlements WHERE order_id=? AND owner=? AND product=?').get(orderId, owner, product);
      if (!entitlement || entitlement.state !== 'claimed') fail('Claimed photo entitlement required');
      const spec = await purchase(orderId, owner, product);
      if (spec.photoId !== input.photoId) fail('Paid photo input changed');
      const binding = JSON.stringify(spec);
      const prior = db.prepare('SELECT * FROM nice_photo_jobs WHERE order_id=?').get(orderId);
      if (prior) {
        if (prior.owner !== owner || prior.product !== product || prior.binding !== binding) fail('Photo execution binding mismatch');
        if (prior.state === 'done') return JSON.parse(prior.result);
        fail('Photo generation requires reconciliation');
      }
      const source = await resolveArtifact({ artifactId: spec.photoId, owner, kind: 'source' });
      if (!source || source.owner !== owner || source.id !== spec.photoId) fail('Owned private photo required');
      db.prepare("INSERT INTO nice_photo_jobs VALUES(?,?,?,?,?,'running',NULL)").run(orderId, owner, product, spec.parentId, binding);
      try {
        const generated = await generate({ ...spec, source, owner, orderId, idempotencyKey: orderId });
        if (!Array.isArray(generated) || generated.length !== spec.count) fail('Photo candidate allowance mismatch');
        const candidates = [];
        for (const [index, item] of generated.entries()) {
          const artifactId = id(item.artifactId);
          const artifact = await resolveArtifact({ artifactId, owner, kind: 'generated', orderId });
          if (!artifact || artifact.id !== artifactId || artifact.owner !== owner || artifact.orderId !== orderId) fail('Photo output ownership mismatch');
          candidates.push({ id: createHash('sha256').update(`${orderId}:${index}`).digest('hex'), artifactId });
        }
        if (new Set(candidates.map(item => item.artifactId)).size !== spec.count) fail('Duplicate photo candidates');
        const result = { jobId: orderId, parentJobId: spec.parentId, status: 'done', candidates };
        db.prepare("UPDATE nice_photo_jobs SET state='done',result=? WHERE order_id=? AND state='running'").run(JSON.stringify(result), orderId);
        return result;
      } catch (error) {
        db.prepare("UPDATE nice_photo_jobs SET state='uncertain' WHERE order_id=? AND state='running'").run(orderId);
        // Do not propagate untrusted provider retry hints to the payment wrapper.
        throw Error('Photo generation requires reconciliation', { cause: error });
      }
    }
  }]));
}

/** Authenticated private delivery boundary; never returns a raw filesystem path. */
export function selectNicepayPhotoCandidate({ creditStore, orderId, owner, candidateId }) {
  id(orderId); id(candidateId);
  return creditStore.tx(() => {
    const row = creditStore.db.prepare(`SELECT j.result FROM nice_photo_jobs j JOIN nice_entitlements e ON e.order_id=j.order_id
      WHERE j.order_id=? AND j.owner=? AND j.state='done' AND e.owner=? AND e.state='claimed'`).get(orderId, owner, owner);
    if (!row) fail('Owned completed photo job required');
    const candidate = JSON.parse(row.result).candidates.find(item => item.id === candidateId);
    if (!candidate) fail('Photo candidate does not belong to this job');
    creditStore.db.prepare(`INSERT INTO nice_photo_selection VALUES(?,?,?)
      ON CONFLICT(order_id) DO UPDATE SET candidate_id=excluded.candidate_id`).run(orderId, owner, candidateId);
    return { artifactId: candidate.artifactId, owner, orderId };
  });
}

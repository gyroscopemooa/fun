import {createHash} from 'node:crypto';

export class BundleInputError extends Error {}

const PET_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
// Separate from the single-use adapter registry: these products grant ongoing rights.
// Not mounted by server.js; enabling this internal helper never enables checkout.
export function createNicepayBundleAccess({enabled = false, creditStore, clock = Date.now} = {}) {
  if (!enabled) return {};
  if (!creditStore?.db) throw Error('Private credit store required');
  const db = creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_bundle_locks(order_id TEXT PRIMARY KEY, input TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS nice_bundle_runs(order_id TEXT NOT NULL, request_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL, state TEXT NOT NULL, result TEXT, updated INTEGER NOT NULL,
      PRIMARY KEY(order_id, request_id));`);

  function entitlement(orderId, owner, product) {
    const row = db.prepare(`SELECT e.state, r.created AS paid_at FROM nice_entitlements e
      JOIN nice_orders o ON o.id=e.order_id JOIN nice_receipts r ON r.order_id=o.id
      WHERE e.order_id=? AND e.owner=? AND e.product=? AND o.owner=e.owner
      AND o.state='verified' AND o.tid=r.tid`).get(orderId, owner, product);
    if (!row || !['ready', 'claimed'].includes(row.state)) throw Error('NICEPAY bundle unavailable');
    if (product === 'ai_pet_translator' && (clock() < row.paid_at || clock() >= row.paid_at + PET_PERIOD_MS)) {
      throw new BundleInputError('Pet pass expired');
    }
    return row;
  }

  async function execute({orderId, owner, requestId, product, operation, input, lock, runner, beforeStart}) {
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) throw Error('Stable request id required');
    if (typeof runner !== 'function') throw Error('Trusted bundle runner required');
    const fingerprint = createHash('sha256').update(JSON.stringify({operation, input, lock})).digest('hex');
    const prior = creditStore.tx(() => {
      entitlement(orderId, owner, product);
      if (lock) {
        const encoded = JSON.stringify(lock);
        const old = db.prepare('SELECT input FROM nice_bundle_locks WHERE order_id=?').get(orderId);
        if (old && old.input !== encoded) throw new BundleInputError('Name premium input changed');
        if (!old) db.prepare('INSERT INTO nice_bundle_locks VALUES(?,?)').run(orderId, encoded);
      }
      const run = db.prepare('SELECT * FROM nice_bundle_runs WHERE order_id=? AND request_id=?').get(orderId, requestId);
      if (run) {
        if (run.fingerprint !== fingerprint) throw Error('Request id input mismatch');
        if (run.state !== 'done') throw Error('Bundle execution needs reconciliation');
        return {cached: true, result: JSON.parse(run.result)};
      }
      // A crashed/unknown operation must be resolved before another request can duplicate it.
      if (db.prepare("SELECT 1 FROM nice_bundle_runs WHERE order_id=? AND state!='done'").get(orderId)) {
        throw Error('Bundle execution needs reconciliation');
      }
      beforeStart?.();
      db.prepare("UPDATE nice_entitlements SET state='claimed' WHERE order_id=?").run(orderId);
      db.prepare("INSERT INTO nice_bundle_runs VALUES(?,?,?,'running',NULL,?)").run(orderId, requestId, fingerprint, clock());
      return {cached: false};
    });
    if (prior.cached) return prior.result;
    try {
      const result = await runner(input);
      const encoded = JSON.stringify(result);
      if (!encoded || Buffer.byteLength(encoded) > 65536) throw Error('Private artifact reference required');
      const saved=db.prepare("UPDATE nice_bundle_runs SET state='done',result=?,updated=? WHERE order_id=? AND request_id=? AND state='running'")
        .run(encoded, clock(), orderId, requestId);
      if (saved.changes!==1) throw Error('Bundle result needs reconciliation');
      return result;
    } catch (error) {
      // No automatic re-execution or refund after an uncertain paid operation.
      db.prepare("UPDATE nice_bundle_runs SET state='uncertain',updated=? WHERE order_id=? AND request_id=?")
        .run(clock(), orderId, requestId);
      throw error;
    }
  }

  return {
    petStatus({orderId, owner}) {
      const row = entitlement(orderId, owner, 'ai_pet_translator');
      return {startsAt: row.paid_at, expiresAt: row.paid_at + PET_PERIOD_MS, autoRenew: false,
        analyze: true, command: true, text: true, audio: true};
    },
    async executePet({orderId, owner, requestId, input, runner, beforeStart}) {
      const normalized = validatePetInput(input);
      return execute({orderId, owner, requestId, product: 'ai_pet_translator', operation: normalized.mode, input: normalized, runner, beforeStart});
    },
    async executeName({orderId, owner, requestId, operation, input, options = {}, runner}) {
      if (!['analyze', 'recommend'].includes(operation)) throw new BundleInputError('Invalid name bundle operation');
      const lock = normalizeNameInput(input);
      // Options vary within the bundle; identity remains locked across both operations.
      if(!options||typeof options!=='object'||Array.isArray(options))throw new BundleInputError('Invalid name recommendation options');
      const topK = options.topK ?? 5, givenLength = options.givenLength ?? 2;
      if (!Number.isInteger(topK) || topK < 1 || topK > 20 || ![1,2].includes(givenLength)) throw new BundleInputError('Invalid name recommendation options');
      const payload = operation === 'recommend' ? {...lock, topK, givenLength} : lock;
      return execute({orderId, owner, requestId, product: 'ai_name_premium', operation, input: payload, lock, runner});
    }
  };
}

function normalizeNameInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BundleInputError('Name input required');
  const text = (value, max = 80) => {
    if (typeof value !== 'string' || value.length > max) throw new BundleInputError('Invalid name input');
    return value.trim();
  };
  const displayName = text(input.displayName ?? '');
  const hanjaName = text(input.hanjaName ?? '').replace(/\s+/g, '');
  const birthDate = text(input.birthDate ?? '', 10);
  const surname = text(input.surname ?? hanjaName.slice(0, 1));
  const given = (input.given ?? hanjaName.slice(1).split(''));
  if (!Array.isArray(given) || given.length < 1 || given.length > 2 || surname.length !== 1) throw new BundleInputError('Invalid name characters');
  const normalizedGiven = given.map(value => text(value));
  if (normalizedGiven.some(value => value.length !== 1)) throw new BundleInputError('Invalid name characters');
  if (hanjaName && hanjaName !== surname + normalizedGiven.join('')) throw new BundleInputError('Name identity mismatch');
  if (input.gender !== undefined && !['male', 'female'].includes(input.gender)) throw new BundleInputError('Invalid gender');
  if (input.calendarType !== undefined && !['solar', 'lunar'].includes(input.calendarType)) throw new BundleInputError('Invalid calendar');
  return {displayName, hanjaName, birthDate, gender: input.gender === 'male' ? 'male' : 'female',
    calendarType: input.calendarType === 'lunar' ? 'lunar' : 'solar', surname, given: normalizedGiven};
}

function validatePetInput(input = {}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BundleInputError('Invalid pet input');
  const {animal = 'dog', mode = 'analyze', textInput = '', audioInput = null, locale = 'en'} = input;
  if (!['dog', 'cat'].includes(animal) || !['analyze', 'command'].includes(mode)) throw new BundleInputError('Invalid pet mode');
  if (typeof textInput !== 'string' || !['ko','en','ja','zh','es','de','fr','pt','vi','id'].includes(locale)) throw new BundleInputError('Invalid pet input');
  if (audioInput && (!Buffer.isBuffer(audioInput.buffer) || !audioInput.buffer.length || audioInput.buffer.length > 10 * 1024 * 1024)) throw new BundleInputError('Invalid pet audio');
  if (!textInput.trim() && !audioInput) throw new BundleInputError('Pet text or audio required');
  // Only trusted upload handling supplies audioInput. Voice output must use private artifact storage.
  return {animal, mode, textInput: textInput.trim(), audioInput, locale};
}

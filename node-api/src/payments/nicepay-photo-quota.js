// Storage safeguards, not billing/entitlement policy. No timers or network calls.
export function createPhotoQuota({ creditStore, policy = {}, now = Date.now }) {
  const limits = { fileBytes: 20_000_000, ownerBytes: 200_000_000, globalBytes: 2_000_000_000,
    ownerFiles: 100, globalFiles: 10000, hourlyUploads: 30, unusedSourceMs: 86400000, writingLeaseMs: 900000, ...policy };
  for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid photo storage quota');
  if (limits.fileBytes > 20_000_000 || limits.ownerBytes < limits.fileBytes || limits.globalBytes < limits.fileBytes) throw Error('Invalid photo byte quota');
  const db = creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_photo_storage_quota(id TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,
    bytes INTEGER NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS nice_photo_quota_owner ON nice_photo_storage_quota(owner,state);`);
  // Existing durable artifacts remain accounted for and never silently expire at migration.
  db.prepare(`INSERT OR IGNORE INTO nice_photo_storage_quota SELECT id,owner,kind,bytes,'active',? FROM nice_photo_artifacts`).run(now());
  function referenced(id) {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='nice_photo_purchases'").get()) return false;
    return Boolean(db.prepare("SELECT 1 FROM nice_photo_purchases WHERE json_extract(spec,'$.photoId')=? LIMIT 1").get(id));
  }
  function reserveOne({ id, owner, kind }) {
        const own = db.prepare("SELECT count(*) files,coalesce(sum(bytes),0) bytes FROM nice_photo_storage_quota WHERE owner=? AND state!='removed'").get(owner);
        const all = db.prepare("SELECT count(*) files,coalesce(sum(bytes),0) bytes FROM nice_photo_storage_quota WHERE state!='removed'").get();
        const rate = db.prepare("SELECT count(*) n FROM nice_photo_storage_quota WHERE owner=? AND kind='source' AND created>?").get(owner, now() - 3600000);
        if (own.files >= limits.ownerFiles || all.files >= limits.globalFiles || own.bytes + limits.fileBytes > limits.ownerBytes
          || all.bytes + limits.fileBytes > limits.globalBytes || (kind === 'source' && rate.n >= limits.hourlyUploads)) {
          throw Object.assign(Error('Photo storage quota reached'), { status: 429 });
        }
        db.prepare("INSERT INTO nice_photo_storage_quota VALUES(?,?,?,?,'writing',?)").run(id, owner, kind, limits.fileBytes, now());
  }
  return {
    limits,
    reserve(item) { return creditStore.tx(() => reserveOne(item)); },
    reserveBatch(items) { return creditStore.tx(() => { for (const item of items) reserveOne(item); }); },
    assertWriting(id, owner, kind) { if (!db.prepare("SELECT 1 FROM nice_photo_storage_quota WHERE id=? AND owner=? AND kind=? AND state='writing'").get(id, owner, kind)) throw Error('Photo reservation unavailable'); },
    complete(id, bytes, insertArtifact) {
      creditStore.tx(() => {
        if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > limits.fileBytes) throw Error('Photo quota size mismatch');
        const updated = db.prepare("UPDATE nice_photo_storage_quota SET state='active',bytes=? WHERE id=? AND state='writing'").run(bytes, id);
        if (updated.changes !== 1) throw Error('Photo write reservation expired');
        insertArtifact();
      });
    },
    assertActive(id) { if (!db.prepare("SELECT 1 FROM nice_photo_storage_quota WHERE id=? AND state='active'").get(id)) throw Error('Photo storage unavailable'); },
    claimRemoval(id, owner, { failedWrite = false, expiredOnly = false } = {}) {
      return creditStore.tx(() => {
        const row = db.prepare('SELECT * FROM nice_photo_storage_quota WHERE id=? AND owner=?').get(id, owner);
        if (!row) throw Error('Owned photo reservation required');
        if (row.state === 'removed') return null;
        if (row.state === 'deleting') return row;
        if (row.state === 'writing') {
          if (!failedWrite && row.created > now() - limits.writingLeaseMs) throw Error('Photo write still active');
        } else if (row.kind !== 'source' || referenced(id) || (expiredOnly && row.created > now() - limits.unusedSourceMs)) {
          throw Error('Photo is retained for an existing purchase');
        }
        db.prepare("UPDATE nice_photo_storage_quota SET state='deleting' WHERE id=?").run(id);
        return row;
      });
    },
    finishRemoval(id) {
      creditStore.tx(() => {
        if (!db.prepare("SELECT 1 FROM nice_photo_storage_quota WHERE id=? AND state='deleting'").get(id)) throw Error('Photo deletion claim required');
        db.prepare('DELETE FROM nice_photo_artifacts WHERE id=?').run(id);
        db.prepare("UPDATE nice_photo_storage_quota SET state='removed',bytes=0 WHERE id=?").run(id);
      });
    },
    candidates() { return db.prepare(`SELECT id,owner FROM nice_photo_storage_quota WHERE state='deleting'
      OR (state='writing' AND created<=?) OR (state='active' AND kind='source' AND created<=?)`).all(now()-limits.writingLeaseMs, now()-limits.unusedSourceMs); }
  };
}

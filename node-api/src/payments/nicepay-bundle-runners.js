import {randomUUID, createHash} from 'node:crypto';
import {createNicepayBundleAccess,BundleInputError} from './nicepay-bundle-access.js';
import {getNamingDataset} from '../naming/repository.js';
import {calculateFiveGrid} from '../naming/fiveGrid.js';
import {scoreFiveGrid} from '../naming/score.js';
import {buildNameExplanation} from '../naming/description.js';
import {recommendNames} from '../naming/recommend.js';

// Private SQLite blobs avoid public /files paths and survive a service restart.
// No HTTP route is mounted here. The caller must derive owner from server authentication.
export function createNicepayBundleRunners({enabled=false, creditStore, clock=Date.now,
  analyzePetAudio, namingDataset=getNamingDataset, ownerQuotaBytes=200*1024*1024, totalQuotaBytes=1024*1024*1024}={}) {
  if (!enabled) return {};
  if (![ownerQuotaBytes,totalQuotaBytes].every(n=>Number.isSafeInteger(n)&&n>=20*1024*1024)) throw Error('Invalid artifact quota');
  const access=createNicepayBundleAccess({enabled,creditStore,clock});
  const db=creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_bundle_artifacts(id TEXT PRIMARY KEY, order_id TEXT NOT NULL,
    owner TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, digest TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS nice_bundle_reservations(order_id TEXT NOT NULL, request_id TEXT NOT NULL, owner TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(order_id,request_id));`);
  return {
    petStatus: access.petStatus,
    async pet(args) {
      return access.executePet({...args, beforeStart:()=>{
        if (args.input?.mode!=='command') return;
        const usage=owner=>db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS n FROM nice_bundle_artifacts'+(owner?' WHERE owner=?':'')).get(...(owner?[owner]:[])).n;
        const reserved=owner=>db.prepare('SELECT count(*) AS n FROM nice_bundle_reservations'+(owner?' WHERE owner=?':'')).get(...(owner?[owner]:[])).n*20*1024*1024;
        if (usage(args.owner)+reserved(args.owner)+20*1024*1024>ownerQuotaBytes || usage()+reserved()+20*1024*1024>totalQuotaBytes) throw Error('Private artifact storage quota reached');
        db.prepare('INSERT INTO nice_bundle_reservations VALUES(?,?,?,?)').run(args.orderId,args.requestId,args.owner,clock());
      }, runner:async input=>{
        try {
        const run=analyzePetAudio ?? (await import('../commerce/petTranslator.js')).analyzePetAudio;
        const result=await run(input);
        if (input.mode!=='command') return result;
        if (result?.mimeType!=='audio/mpeg' || typeof result.audio!=='string' || result.audio.length>28*1024*1024) throw Error('Invalid pet audio output');
        const bytes=Buffer.from(result.audio,'base64');
        if (!bytes.length || bytes.length>20*1024*1024 || bytes.toString('base64')!==result.audio) throw Error('Invalid pet audio encoding');
        const id=randomUUID(),digest=createHash('sha256').update(bytes).digest('hex');
        db.prepare('INSERT INTO nice_bundle_artifacts VALUES(?,?,?,?,?,?)').run(id,args.orderId,args.owner,'audio/mpeg',bytes,digest);
        const {audio,...metadata}=result;
        return {...metadata,artifact:{id,mimeType:'audio/mpeg',size:bytes.length}};
        } finally { db.prepare('DELETE FROM nice_bundle_reservations WHERE order_id=? AND request_id=?').run(args.orderId,args.requestId); }
      }});
    },
    async name(args) {
      // Dataset errors are preflight failures; do not consume the entitlement.
      const dataset=await namingDataset();
      const surname=typeof args.input?.surname==='string'?args.input.surname.trim():args.input?.hanjaName?.trim().slice(0,1);
      const given=args.input?.given??args.input?.hanjaName?.trim().slice(1).split('')??[];
      if (!dataset.strokeMap.has(surname) || (args.operation==='analyze' && (!Array.isArray(given) || given.some(c=>typeof c!=='string'||!dataset.strokeMap.has(c.trim()))))) throw new BundleInputError('Name stroke data unavailable');
      return access.executeName({...args,runner:async input=>{
        const {surname,given,topK,givenLength,...identity}=input;
        const orderLock={...identity,surname,given};
        if (args.operation==='recommend') {
          const recommendations=recommendNames({surname,surnameStroke:dataset.strokeMap.get(surname),
            givenLength:input.givenLength,topK:input.topK,pool:dataset.pool,luckMap:dataset.luckMap,metaMap:dataset.metaMap});
          if (!recommendations.length) throw Error('No recommendation candidates');
          return {ok:true,orderLock,input:{surname,topK:input.topK,givenLength:input.givenLength},recommendations,
            notices:['현재는 단성 기준 추천만 지원합니다.','luck81.csv의 31~81 구간은 seed 상태라 점수가 보수적으로 계산될 수 있습니다.']};
        }
        const grids=calculateFiveGrid({surnameStroke:dataset.strokeMap.get(surname),givenStrokes:given.map(c=>dataset.strokeMap.get(c))});
        const scoreResult=scoreFiveGrid(grids,dataset.luckMap);
        const report=buildNameExplanation({surname,given,grids,scoreResult,metaMap:dataset.metaMap});
        return {ok:true,orderLock,input:{surname,given},grids,score:scoreResult.score,grade:scoreResult.grade,details:scoreResult.details,
          explanation:report.summary,report,parts:[surname,...given].map(hanja=>({hanja,strokes:dataset.strokeMap.get(hanja),meta:dataset.metaMap.get(hanja)??dataset.surnameMap.get(hanja)??null}))};
      }});
    },
    removeArtifact({artifactId,owner}) {
      const removed=db.prepare('DELETE FROM nice_bundle_artifacts WHERE id=? AND owner=?').run(artifactId,owner);
      if (removed.changes!==1) throw Error('Owned artifact unavailable');
      return {removed:true};
    },
    // Read-only retention inventory: successful outputs never silently expire.
    retentionCandidates({olderThan=clock()-30*86400000}={}) {
      return db.prepare(`SELECT a.id,a.order_id,a.owner,length(a.bytes) AS size FROM nice_bundle_artifacts a
        WHERE NOT EXISTS(SELECT 1 FROM nice_bundle_runs r WHERE r.order_id=a.order_id AND (r.state='running' OR r.updated>=?))`).all(olderThan);
    },
    recover(now=clock()) {
      db.prepare("UPDATE nice_bundle_runs SET state='uncertain',updated=? WHERE state='running' AND updated<?").run(now,now-30*60000);
      // No automatic retries or releasing reservations: the provider may still finish.
      return db.prepare("SELECT order_id,request_id,state FROM nice_bundle_runs WHERE state='uncertain'").all();
    },
    readArtifact({artifactId,owner}) {
      const row=db.prepare(`SELECT a.* FROM nice_bundle_artifacts a JOIN nice_entitlements e ON e.order_id=a.order_id
        JOIN nice_orders o ON o.id=e.order_id WHERE a.id=? AND a.owner=? AND e.owner=a.owner
        AND e.product='ai_pet_translator' AND e.state='claimed' AND o.state='verified' AND o.owner=e.owner`).get(artifactId,owner);
      if (!row) throw Error('Owned pet artifact unavailable');
      // Do not release an orphan from a failed result-persistence operation.
      const results=db.prepare("SELECT result FROM nice_bundle_runs WHERE order_id=? AND state='done'").all(row.order_id);
      if (!results.some(r=>JSON.parse(r.result)?.artifact?.id===row.id)) throw Error('Pet artifact not ready');
      const bytes=Buffer.from(row.bytes);
      if (createHash('sha256').update(bytes).digest('hex')!==row.digest) throw Error('Pet artifact integrity failure');
      return {bytes,mimeType:row.mime};
    }
  };
}

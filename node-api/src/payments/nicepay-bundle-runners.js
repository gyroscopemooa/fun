import {randomUUID, createHash} from 'node:crypto';
import {createNicepayBundleAccess} from './nicepay-bundle-access.js';
import {getNamingDataset} from '../naming/repository.js';
import {calculateFiveGrid} from '../naming/fiveGrid.js';
import {scoreFiveGrid} from '../naming/score.js';
import {buildNameExplanation} from '../naming/description.js';
import {recommendNames} from '../naming/recommend.js';

// Private SQLite blobs avoid public /files paths and survive a service restart.
// No HTTP route is mounted here. The caller must derive owner from server authentication.
export function createNicepayBundleRunners({enabled=false, creditStore, clock=Date.now,
  analyzePetAudio, namingDataset=getNamingDataset}={}) {
  if (!enabled) return {};
  const access=createNicepayBundleAccess({enabled,creditStore,clock});
  const db=creditStore.db;
  db.exec(`CREATE TABLE IF NOT EXISTS nice_bundle_artifacts(id TEXT PRIMARY KEY, order_id TEXT NOT NULL,
    owner TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, digest TEXT NOT NULL);`);
  return {
    petStatus: access.petStatus,
    async pet(args) {
      return access.executePet({...args, runner:async input=>{
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
      }});
    },
    async name(args) {
      // Dataset errors are preflight failures; do not consume the entitlement.
      const dataset=await namingDataset();
      const surname=typeof args.input?.surname==='string'?args.input.surname.trim():args.input?.hanjaName?.trim().slice(0,1);
      const given=args.input?.given??args.input?.hanjaName?.trim().slice(1).split('')??[];
      if (!dataset.strokeMap.has(surname) || (args.operation==='analyze' && (!Array.isArray(given) || given.some(c=>typeof c!=='string'||!dataset.strokeMap.has(c.trim()))))) throw Error('Name stroke data unavailable');
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

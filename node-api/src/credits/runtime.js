// Keep the in-memory non-credit order API, but never publish a credit update
// before its durable write completes. All callers must await get/set.
export function createCreditOrderAccess(cache,store){
  return {
    async get(id){return (store?await store.order(id):null)??cache.get(id);},
    async set(id,value){if(store&&value.paymentMode==='credits'){await store.saveOrder(value);value=await store.order(id);if(!value)throw Error('Durable credit order missing');}cache.set(id,value);return cache;},
  };
}

// Direct Polar orders still use the process-local cache. Do not await between
// re-reading this authoritative object and publishing its immutable input lock.
export function lockCachedNameInput(cache,id,input){
  let order=cache.get(id);
  if(!order||order.productType!=='ai_name_premium'||order.status!=='paid')throw Error('Paid name order required');
  if(order.namePremiumLock&&!isDeepStrictEqual(order.namePremiumLock,input))throw Error('name premium input changed');
  if(!order.namePremiumLock){order={...order,namePremiumLock:input,namePremiumLockedAt:new Date().toISOString()};cache.set(id,order);}
  return order;
}

export function claimCachedPhotoJob(cache,jobs,id,jobId){
  const order=cache.get(id);
  if(!order||order.status!=='paid')throw Object.assign(Error('payment required'),{statusCode:402});
  const active=jobs.get(order.aiPhotoJobId);
  if(active&&active.status!=='failed')throw Object.assign(Error('this order has already been used'),{statusCode:409});
  const claimed={...order,aiPhotoJobId:jobId};cache.set(id,claimed);return claimed;
}

export function markCreditSettlementPending(job){
  if(job){job.creditSettlementPending=true;job.error='처리 결과를 확인 중입니다. 다시 실행하지 마세요.';}
  console.error('[credits] Background settlement requires reconciliation.');
}

export function observeCreditBackground(promise,getJob){
  return promise.catch(()=>markCreditSettlementPending(getJob()));
}

// Express 4 does not forward rejected async handlers to error middleware.
// This is required once order reads/writes perform asynchronous database I/O.
export function forwardAsyncRouteErrors(app){
  const wrap=handler=>Array.isArray(handler)?handler.map(wrap):typeof handler!=='function'||handler.length===4?handler:function(req,res,next){
    try{const result=handler(req,res,next);if(result&&typeof result.then==='function')result.catch(next);return result;}catch(error){next(error);}
  };
  for(const method of ['get','post','put','patch','delete','options','head']){
    const register=app[method].bind(app);
    app[method]=(...args)=>register(...args.map(wrap));
  }
}

export function creditResponseSettlement(store){
  return (req,res,next)=>{
    const json=res.json.bind(res);
    res.json=body=>{
      const id=req.body?.orderId||/^\/order\/([^/]+)\/detail-page$/.exec(req.path)?.[1];
      const generation=['/generate','/ai-calorie-calculator/analyze','/ai-personal-color/analyze','/ai-manseryeok/analyze','/name-premium/analyze','/name-premium/recommend'].includes(req.path)||/^\/order\/[^/]+\/detail-page$/.test(req.path);
      if(req.method!=='POST'||!generation||!id||req.creditClaimed!==id||req.creditAsync)return json(body);
      // Express handlers may not await res.json. Own this promise and fail closed
      // rather than emitting success while settlement is still in flight.
      void (async()=>{
        const order=await store.order(id);
        const success=Boolean(order?.detailPageResult)||(res.statusCode<400&&body?.analysis?.isFood!==false);
        await store.finish(id,success);
        if(!success&&body&&typeof body==='object')body.creditRestored=true;
        if(!res.headersSent)json(body);
      })().catch(()=>{if(!res.headersSent){res.status(503);json({error:'크레딧 처리 상태를 확인 중입니다. 다시 실행하지 말고 주문 상태를 확인해주세요.'});}});
      return res;
    };
    next();
  };
}
import {isDeepStrictEqual} from 'node:util';

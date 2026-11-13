import {executeNicepayTool} from './nicepay-execution.js';
import {nicepayStagingEntry} from '../../../src/lib/nicepay-staging-entry.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';import {Script,createContext} from 'node:vm';
import {CreditStore} from '../credits/store.js';import {NicepayOrderStore} from './nicepay-orders.js';
import {createNicepayServerStaging} from './nicepay-server-staging.js';import {createNicepayPgClient} from './nicepay-pg.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
test('customer form -> retry-safe order -> fake approval -> one paid-tool result with real cookie',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'nice-customer-')),file=join(dir,'db');
 const creditStore=new CreditStore(file),store=new NicepayOrderStore(file);
 const authenticate=creditStore.authenticate.bind(creditStore);
 creditStore.authenticate=async(...args)=>authenticate(...args);
 const config={variant:'legacy',id:'fake00000m',secret:'offline-test-only-secret',returnUrl:'https://manytool.net/nice/payment/return'};
 const policy={enabled:true,apiConfirmed:true,variant:'legacy',categories:{direct:{approved:true,methods:['card'],maxAmountKrw:10000}}};
 const catalog={ai_manseryeok:{category:'direct',amount:10000,currency:'KRW',recurring:false,goodsName:'Saju'}};
 let calls=0,approvals=0,orderId;const tid='c'.repeat(30);
 const client=createNicepayPgClient({config,enabled:true,fetcher:async()=>{approvals++;const p={ResultCode:'3001',MID:config.id,Moid:orderId,Amt:'000000010000',TID:tid,PayMethod:'CARD'};p.Signature=hash(tid+config.id+p.Amt+config.secret);return Response.json(p);}});
 const options={enabled:true,store,creditStore,origin:'https://manytool.net',payment:{config,policy,catalog,client},tools:{analyzeSaju:async input=>{calls++;return {title:input.name,report:'Fixture report'};}}};
 const app=express();app.use('/off',(await createNicepayServerStaging(options)).router);app.use('/nice',(await createNicepayServerStaging({...options,customerEnabled:true})).router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await new Promise(r=>server.close(r));store.close();creditStore.close();rmSync(dir,{recursive:true});});
 const base='http://127.0.0.1:'+server.address().port,token=creditStore.token('buyer@example.com','session',60000);
 const headers={Cookie:'manytool_credit_session='+token,Origin:'https://manytool.net','Content-Type':'application/json'};
 const post=(url,body,custom=headers)=>fetch(base+url,{method:'POST',headers:custom,body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/off/customer/',{headers})).status,503);
 assert.equal((await fetch(base+'/nice/customer/')).status,401);
 const entry=nicepayStagingEntry({enabled:'true',basePath:'/nice',pathname:'/ai-manseryeok'});
 const page=await fetch(base+entry.href,{headers});const html=await page.text();assert.match(html,/생년월일 정보/);assert.match(html,/<option value="ai_manseryeok" selected>/);
 const clientCode=await (await fetch(base+'/nice/customer/client.js',{headers})).text();new Script(clientCode);await checkClientRecovery(clientCode);
 const input={name:'홍길동',birthDate:'1995-01-02',birthTime:'12:00',calendarType:'solar',isLeapMonth:false,timeUnknown:false,locale:'ko'};
 const request={productId:'ai_manseryeok',input,requestKey:'customer-request-123456'};
 assert.equal((await post('/nice/customer/prepare',{...request,requestKey:undefined})).status,422);
 assert.equal(store.db.prepare('SELECT count(*) n FROM nice_orders').get().n,0);
 assert.equal((await post('/nice/customer/prepare',request,{...headers,Origin:'https://evil.invalid'})).status,403);
 const responses=await Promise.all([post('/nice/customer/prepare',request),post('/nice/customer/prepare',request)]);
 const [first,second]=await Promise.all(responses.map(r=>r.json()));assert.equal(first.orderId,second.orderId);orderId=first.orderId;
 assert.equal(store.db.prepare('SELECT count(*) n FROM nice_orders').get().n,1);
 assert.equal((await post('/nice/customer/prepare',{...request,input:{...input,name:'다른 사람'}})).status,400);
 assert.equal((await fetch(base+first.checkoutUrl,{headers:{Cookie:headers.Cookie}})).status,200);
 assert.equal((await post('/nice/customer/execute',{orderId,input})).status,409);assert.equal(calls,0);
 assert.equal((await post('/nice/customer/result',{orderId})).status,409);
 assert.deepEqual((await (await post('/nice/customer/history',{})).json()).orders,[]);
 const auth={AuthResultCode:'0000',MID:config.id,Moid:orderId,Amt:'10000',AuthToken:'fake-token',TxTid:tid,PayMethod:'CARD',NextAppURL:'https://dc1-api.nicepay.co.kr/webapi/pay_process.jsp'};auth.Signature=hash(auth.AuthToken+config.id+auth.Amt+config.secret);
 const callback=()=>fetch(base+'/nice/payment/return',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(auth)});
 assert.equal((await callback()).status,200);assert.equal((await callback()).status,200);assert.equal(approvals,1);
 assert.equal((await (await post('/nice/customer/status',{orderId})).json()).ready,true);
 assert.equal((await post('/nice/customer/execute',{orderId,input:{...input,name:'changed'}})).status,409);
 assert.equal((await post('/nice/payment/execute',{orderId,input:{...input,name:'CHANGED-VIA-GENERIC'}})).status,409);
 assert.equal(calls,0);
 await assert.rejects(executeNicepayTool({creditStore,orderId,owner:'buyer@example.com',product:'ai_manseryeok',runner:()=>{calls++;}}),/Purchased input mismatch/);
 const result=await (await post('/nice/customer/execute',{orderId,input})).json();assert.equal(result.result.title,input.name);
 assert.equal((await post('/nice/customer/execute',{orderId,input})).status,200);assert.equal(calls,1);
 const restored=await post('/nice/customer/result',{orderId});assert.equal(restored.status,200);
 assert.equal((await restored.json()).result.title,input.name);assert.equal(calls,1);
 assert.deepEqual((await (await post('/nice/customer/history',{})).json()).orders,[{orderId,productId:'ai_manseryeok'}]);
 assert.equal((await post('/nice/payment/execute',{orderId,input:{...input,name:'changed after completion'}})).status,409);
 assert.equal((await post('/nice/payment/execute',{orderId,input})).status,200);
 assert.equal(calls,1);
 assert.equal((await post('/nice/customer/prepare',request)).status,200);
 assert.equal((await (await post('/nice/customer/prepare',request)).json()).checkoutUrl,null);
 const other=creditStore.token('other@example.com','session',60000);
 assert.equal((await post('/nice/customer/status',{orderId},{...headers,Cookie:'manytool_credit_session='+other})).status,404);
 assert.equal((await post('/nice/customer/result',{orderId},{...headers,Cookie:'manytool_credit_session='+other})).status,404);
 assert.deepEqual((await (await post('/nice/customer/history',{},{...headers,Cookie:'manytool_credit_session='+other})).json()).orders,[]);
 assert.equal((await post('/nice/customer/result',{orderId},{...headers,Cookie:''})).status,401);
 assert.equal((await fetch(base+first.checkoutUrl,{headers})).status,404);
});


async function checkClientRecovery(code){
 for(const uncertain of [false,true]){
  const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{value:id==='product'?'ai_manseryeok':'',disabled:false,hidden:false});return elements.get(id);};
  const values={name:'Test',birthDate:'invalid',birthTime:'12:00',calendarType:'solar'},fields=[element('product'),{disabled:false}];
  element('purchase').querySelectorAll=()=>fields;
  const requests=[],storage=new Map();
  const context=createContext({document:{getElementById:element,querySelectorAll:()=>[]},location:{pathname:'/nice/customer/',reload(){}},
   crypto:{randomUUID:()=> 'client-request-123456'},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
   FormData:class{get(k){return values[k];}has(){return false;}},
   fetch:async(_url,options)=>{if(_url.endsWith('/history'))return {ok:true,json:async()=>({orders:[]})};requests.push(JSON.parse(options.body));if(requests.length===1){if(uncertain)throw Error('Network lost');return {ok:false,json:async()=>({editable:true,error:'Invalid birth date'})};}return {ok:true,json:async()=>({orderId:'order',checkoutUrl:'/nice/customer/pay/order',amount:10000,currency:'KRW'})};}
  });
  new Script(code).runInContext(context);
  await element('purchase').onsubmit({preventDefault(){}});
  assert.equal(fields[0].disabled,uncertain);
  values.birthDate='1995-01-02';
  await element('purchase').onsubmit({preventDefault(){}});
  assert.equal(requests[1].input.birthDate,uncertain?'invalid':'1995-01-02');
  assert.equal(requests[0].requestKey,requests[1].requestKey);
  assert.equal(element('prepare').disabled,true);
 }
}

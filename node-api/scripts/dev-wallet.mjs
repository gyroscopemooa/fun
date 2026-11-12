import express from 'express';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {CreditStore} from '../src/credits/store.js';
import {installCreditRoutes} from '../src/credits/routes.js';

// Standalone local launcher. Never load deployment .env files or mount payment clients.
const webOrigin='http://127.0.0.1:4321',apiOrigin='http://127.0.0.1:8788';
const store=new CreditStore(':memory:');
const mailbox=[];
const app=express();
app.use((req,res,next)=>{
 res.set('Cache-Control','no-store');
 if(req.headers.host!=='127.0.0.1:8788')return res.sendStatus(403);
 if(req.headers.origin && ![webOrigin,apiOrigin].includes(req.headers.origin))return res.sendStatus(403);
 if(req.headers.origin===webOrigin){res.set('Access-Control-Allow-Origin',webOrigin);res.set('Access-Control-Allow-Credentials','true');res.set('Access-Control-Allow-Headers','Content-Type');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
 if(req.method==='OPTIONS')return res.sendStatus(204);
 next();
});
app.use(express.json({limit:'16kb'}));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.get('/',(_req,res)=>res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>매니툴 로컬 메일함</title><body><h1>로컬 로그인 메일함</h1><p>이 PC에서만 사용하는 임시 계정입니다. 종료하면 계정과 메일이 사라집니다. 실제 이메일은 발송하지 않습니다.</p><p><a href="${webOrigin}/credits/">로그인·잔액 화면 열기</a> · <a href="/">메일함 새로고침</a></p><p>로그인 화면에서 이메일을 입력한 뒤 이 메일함을 새로고침하세요. 충전 및 실결제는 비활성 상태입니다.</p>${mailbox.map(m=>`<article><h2>${escape(m.email)}</h2><a href="${escape(m.url)}">이메일 인증하고 로그인</a></article>`).join('')||'<p>아직 메일이 없습니다.</p>'}</body></html>`));
installCreditRoutes(app,{store,orders:new Map(),verifyWebhook(){throw Error('Disabled locally');},
 env:{GOOGLE_CREDIT_CLIENT_ID:process.env.GOOGLE_CREDIT_CLIENT_ID || '',PUBLIC_WEB_BASE_URL:webOrigin,CREDITS_ENABLED:'false',CREDITS_TOOLS_READY:'false',RESEND_API_KEY:'local-mail-sink',RESEND_FROM_EMAIL:'local@example.invalid'},
 fetcher:async(url,options)=>{
  if(url!=='https://api.resend.com/emails')throw Error('External requests disabled');
  const mail=JSON.parse(options.body),link=mail.text.match(/http:\/\/127\.0\.0\.1:4321\/credits\/#login=[a-f0-9]{64}/)?.[0];
  if(!link)throw Error('Invalid local login email');
  mailbox.unshift({email:mail.to[0],url:link});mailbox.splice(20);
  return Response.json({id:'local-only'});
 }});

// Explicit loopback-only simulation. No PG transport, real money or production storage.
const reviewAccount='credit-review@example.invalid';let simulatedTopup;
app.get('/review/',(_req,res)=>{
 const session=store.token(reviewAccount,'session',3600000);
 res.setHeader('Set-Cookie',`manytool_credit_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`);
 res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>크레딧 충전·사용 모의 검수</title><style>body{font:20px sans-serif;max-width:900px;margin:40px auto;line-height:1.8}aside{background:#fff0c2;padding:20px}button{padding:15px;margin:12px;font-size:20px}strong{font-size:36px}</style><h1>크레딧 충전·사용 모의 검수</h1><aside>로컬 메모리 지갑만 사용합니다. NICE 결제·실제 금전 결제·유료 AI 실행이 아닙니다. 10개 충전·2개 차감은 검수용 예시이며 판매 가격이나 상품별 차감량을 확정하지 않습니다.</aside><p>임시 검수 계정: ${reviewAccount}</p><p>잔액 <strong id="balance">확인 중</strong> 크레딧</p><button id="topup">모의 충전 10개 (1회)</button><button id="use">모의 상품 사용 2개 (1회)</button><p id="result" role="status"></p><h2>실제 테스트 원장</h2><pre id="history"></pre><script>async function call(path){const r=await fetch('/review/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d=await r.json();if(!r.ok)throw Error(d.error);return d}function show(d){document.getElementById('balance').textContent=d.balance;document.getElementById('history').textContent=d.history.map(x=>x.kind+' '+(x.delta>0?'+':'')+x.delta).join('\\n')}async function refresh(){show(await call('state'))}for(const action of ['topup','use'])document.getElementById(action).onclick=async()=>{try{const d=await call(action);show(d);document.getElementById('result').textContent=d.message;}catch(e){document.getElementById('result').textContent=e.message;}};refresh();</script></html>`);
});
app.post('/review/:action',(req,res)=>{
 try{
 if(req.headers.origin!==apiOrigin)throw Error('로컬 검수 화면에서 요청해주세요.');
 const token=/(?:^|;\s*)manytool_credit_session=([a-f0-9]+)/.exec(req.headers.cookie||'')?.[1];
 const owner=store.authenticate(token);if(owner!==reviewAccount)throw Error('검수 계정이 필요합니다.');
 let message='잔액 조회';
 if(req.params.action==='topup'){
 if(!simulatedTopup){simulatedTopup=store.createTopup(owner,{credits:10,amount:0,currency:'KRW'},'local-review-only');store.checkout(simulatedTopup.id,'local-review-checkout','https://example.invalid/local-only');store.applyPayment({type:'order.paid',data:{id:'local-review-event',paid:true,product_id:'local-review-only',currency:'krw',net_amount:0,discount_amount:0,checkout_id:'local-review-checkout',metadata:{credit_topup_id:simulatedTopup.id}}});}
 message='모의 충전 반영: 10개. 실제 결제는 없으며 같은 충전 버튼을 눌러도 중복 지급하지 않습니다.';
 }else if(req.params.action==='use'){
 const order=store.purchase(owner,'local-review-use-0001','local-sample',2,{id:'local-review-use',productType:'review_sample',paymentMode:'credits',status:'paid'});
 if(store.state(order.id)==='ready'){store.claim(order.id);store.finish(order.id,true);}
 message='모의 상품 사용 완료: 2개 차감, 검수용 결과 표시. 실제 AI 결과가 아닙니다. 재시도해도 중복 차감하지 않습니다.';
 }else if(req.params.action!=='state')return res.sendStatus(404);
 res.json({balance:store.balance(owner),history:store.history(owner),message});
 }catch(e){res.status(400).json({error:e.message});}
});

const server=app.listen(8788,'127.0.0.1',()=>{
 console.log('Wallet: '+webOrigin+'/credits/');
 console.log('Local mailbox: '+apiOrigin+'/');
 console.log('Payments disabled. Local account data is discarded on exit.');
});
const require=createRequire(import.meta.url);
const astro=join(dirname(require.resolve('astro/package.json')),'astro.js');
const root=fileURLToPath(new URL('../../',import.meta.url));
const child=spawn(process.execPath,[astro,'dev','--host','127.0.0.1','--port','4321'],{cwd:root,stdio:'inherit',windowsHide:true,
 env:{...process.env,PUBLIC_NODE_API_BASE:apiOrigin,PUBLIC_NICEPAY_STAGING_ENABLED:'false'}});
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;child.kill();server.close();store.close();process.exitCode=code;}
server.on('error',error=>{console.error('Local wallet API could not start:',error.code);stop(1);});
child.on('error',error=>{console.error('Local frontend could not start:',error.message);stop(1);});
child.on('exit',code=>stop(code??1));
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());

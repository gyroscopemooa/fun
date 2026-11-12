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

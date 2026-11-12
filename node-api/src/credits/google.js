import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client();
const failure = (message, status=401) => Object.assign(new Error(message), {status});
export function installGoogleCreditRoutes(app, {store, env, origin, cookie, verify=async (credential,audience)=>(await client.verifyIdToken({idToken:credential,audience})).getPayload()}) {
 const audience=env.GOOGLE_CREDIT_CLIENT_ID || '';
 const secure=new URL(origin).protocol==='https:';
 const nonceCookie=(value,age)=>`manytool_google_nonce=${value}; Path=/credits; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
 const wrap=fn=>async(req,res)=>{res.set('Cache-Control','no-store');try{if(req.headers.origin!==origin)throw failure('허용되지 않은 요청입니다.',403);if(!audience)throw failure('구글 로그인 설정을 준비하고 있습니다.',503);await fn(req,res);}catch(e){res.status(e.status||401).json({error:e.status?e.message:'구글 인증을 확인하지 못했습니다. 다시 로그인해주세요.'});}};
 app.post('/credits/google/challenge',wrap(async(req,res)=>{
  await store.rateLimit(`google:${req.ip}`,30,600000);
  const nonce=await store.token('google-login','google-nonce',5*60000);
  res.setHeader('Set-Cookie',nonceCookie(nonce,300));res.json({nonce,clientId:audience});
 }));
 app.post('/credits/google/session',wrap(async(req,res)=>{
  const credential=req.body?.credential;
  if(typeof credential!=='string'||credential.length>12000)throw failure('구글 인증을 확인해주세요.');
  const payload=await verify(credential,audience);
  const nonce=/(?:^|;\s*)manytool_google_nonce=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
  if(!nonce||payload?.nonce!==nonce||payload.email_verified!==true||!payload.sub)throw failure('구글 인증을 다시 진행해주세요.');
  const email=String(payload.email||'').toLowerCase();
  // Automatic linking to an existing email wallet is allowed only for a Google-authoritative address.
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254||(!email.endsWith('@gmail.com')&&!payload.hd))throw failure('이 구글 계정은 이메일 인증 링크로 로그인해주세요.',403);
  await store.authenticate(nonce,'google-nonce',true);
  const session=await store.token(email,'session',30*86400000);
  res.setHeader('Set-Cookie',[cookie(session,30*86400),nonceCookie('',0)]);res.json({ok:true});
 }));
}

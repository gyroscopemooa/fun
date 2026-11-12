import {createRemoteJWKSet,jwtVerify,SignJWT} from 'jose';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_CLIENT='265717233884-lna24m7pac95087fc3rhv1ijdc2ga69h.apps.googleusercontent.com';
const COOKIE='__Host-manytool_credit_review',CHALLENGE='__Host-manytool_credit_challenge';
const encoder=new TextEncoder();
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const cookie=(name,value,seconds=3600)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
const readCookie=(request,name)=>request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const publicState=s=>({email:s.email,balance:s.used?8:s.topped?10:0,topped:!!s.topped,used:!!s.used,history:[...(s.used?[{label:'테스트 상품 사용',delta:-2}]:[]),...(s.topped?[{label:'모의 충전',delta:10}]:[])],result:s.used?'테스트 사용 완료: 2개 차감. 실제 AI를 실행하거나 구매 권한을 지급한 결과가 아닙니다.':null});
export function createCreditReviewHandler({verifyGoogle=async credential=>(await jwtVerify(credential,googleKeys,{audience:GOOGLE_CLIENT,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],maxTokenAge:'1h'})).payload}={}){
 return async({request,env})=>{
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 try{
 const url=new URL(request.url),origin='https://manytool.net',action=url.pathname.split('/').filter(Boolean).at(-1);
 if(url.origin!==origin||typeof env.CREDIT_REVIEW_SESSION_SECRET!=='string'||env.CREDIT_REVIEW_SESSION_SECRET.length<43)throw error('공개 테스트 설정을 준비하고 있습니다.',503);
 const key=encoder.encode(env.CREDIT_REVIEW_SESSION_SECRET);
 const sign=(state,kind,ttl='1h')=>new SignJWT({...state,kind}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(ttl).setIssuer('manytool-credit-review').setAudience(origin).sign(key);
 const verify=async(token,kind)=>{try{const {payload}=await jwtVerify(token||'',key,{issuer:'manytool-credit-review',audience:origin,algorithms:['HS256']});if(payload.kind!==kind)throw Error();return payload;}catch{throw error('테스트 계정으로 다시 로그인해주세요.',401);}};
 if(request.method==='GET'&&action==='config')return reply({clientId:GOOGLE_CLIENT,mode:'simulation',expiresIn:3600});
 if(request.method==='GET'&&action==='me')return reply(publicState(await verify(readCookie(request,COOKIE),'session')));
 if(request.method!=='POST')throw error('지원하지 않는 요청입니다.',405);
 if(request.headers.get('Origin')!==origin)throw error('허용되지 않은 요청입니다.',403);
 const raw=await request.text();if(raw.length>16384)throw error('요청이 너무 큽니다.',413);
 let body;try{body=JSON.parse(raw||'{}');}catch{throw error('요청을 확인해주세요.');}
 if(action==='challenge'){
 const nonce=crypto.randomUUID();headers.append('Set-Cookie',cookie(CHALLENGE,await sign({nonce},'challenge','5m'),300));return reply({nonce,clientId:GOOGLE_CLIENT});
 }
 if(action==='session'){
 const challenge=await verify(readCookie(request,CHALLENGE),'challenge');
 if(typeof body.credential!=='string'||body.credential.length>12000)throw error('구글 인증이 필요합니다.',401);
 let identity;try{identity=await verifyGoogle(body.credential);}catch{throw error('구글 인증을 확인하지 못했습니다.',401);}
 if(identity.nonce!==challenge.nonce||identity.email_verified!==true||typeof identity.sub!=='string'||typeof identity.email!=='string')throw error('구글 인증을 다시 진행해주세요.',401);
 const previous=readCookie(request,COOKIE);let state={sub:identity.sub,email:identity.email,topped:false,used:false};
 if(previous){try{const s=await verify(previous,'session');if(s.sub===identity.sub)state={...state,topped:!!s.topped,used:!!s.used};}catch{}}
 headers.append('Set-Cookie',cookie(COOKIE,await sign(state,'session')));headers.append('Set-Cookie',cookie(CHALLENGE,'',0));return reply(publicState(state));
 }
 if(action==='logout'){headers.append('Set-Cookie',cookie(COOKIE,'',0));headers.append('Set-Cookie',cookie(CHALLENGE,'',0));return reply({ok:true});}
 const s=await verify(readCookie(request,COOKIE),'session');
 if(action==='topup')s.topped=true;
 else if(action==='use'){if(!s.topped)throw error('테스트 크레딧을 먼저 충전해주세요.',402);s.used=true;}
 else throw error('지원하지 않는 요청입니다.',404);
 const state={sub:s.sub,email:s.email,topped:!!s.topped,used:!!s.used};headers.append('Set-Cookie',cookie(COOKIE,await sign(state,'session')));return reply(publicState(state));
 }catch(e){return reply({error:e.status?e.message:'테스트 요청을 처리하지 못했습니다.'},e.status||500);}
 };
}

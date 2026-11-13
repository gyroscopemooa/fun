import { createRemoteJWKSet, jwtVerify } from 'jose';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const GOOGLE_CLIENT = '265717233884-lna24m7pac95087fc3rhv1ijdc2ga69h.apps.googleusercontent.com';
const ORIGIN = 'https://manytool.net', SESSION = '__Host-manytool_account', NONCE = '__Host-manytool_login';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cookie = (name,value,age) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const read = (r,name) => r.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1) || '';
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const hash = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
export function createAccountHandler({ verifyGoogle = async credential => (await jwtVerify(credential,keys,{audience:GOOGLE_CLIENT,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],maxTokenAge:'1h'})).payload } = {}) {
  return async ({request,env}) => {
    const headers = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'});
    const reply = (body,status=200) => new Response(JSON.stringify(body),{status,headers});
    try {
      const url = new URL(request.url), action = url.pathname.split('/').filter(Boolean).at(-1), db = env.ACCOUNT_DB;
      if (url.origin !== ORIGIN || !db) throw fail('로그인 서비스를 준비하고 있습니다.',503);
      if (request.method==='GET' && action==='config') return reply({googleClientId:GOOGLE_CLIENT});
      const now = Math.floor(Date.now()/1000);
      const current = async () => {
        const value = read(request,SESSION);
        if (!/^[a-f0-9]{64}$/.test(value)) throw fail('로그인이 필요합니다.',401);
        const user = await db.prepare('SELECT u.sub,u.email FROM account_sessions s JOIN account_users u ON u.sub=s.sub WHERE s.hash=? AND s.expires>?').bind(await hash(value),now).first();
        if (!user) throw fail('다시 로그인해주세요.',401);
        return user;
      };
      if(request.method==='GET' && action==='me') { const user = await current(); return reply({email:user.email}); }
      if(request.method!=='POST') throw fail('지원하지 않는 요청입니다.',405);
      if(request.headers.get('Origin')!==ORIGIN) throw fail('허용되지 않은 요청입니다.',403);
      if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw fail('JSON 요청이 필요합니다.',415);
      const reader=request.body?.getReader();let size=0;const chunks=[];
      if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw fail('요청이 너무 큽니다.',413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const raw=new TextDecoder().decode(bytes);
      let body;try{body=JSON.parse(raw);}catch{throw fail('요청을 확인해주세요.');}
      if(!body || typeof body!=='object' || Array.isArray(body))throw fail('요청을 확인해주세요.');
      if(action==='logout') {
        await db.prepare('DELETE FROM account_sessions WHERE hash=?').bind(await hash(read(request,SESSION))).run();
        headers.append('Set-Cookie',cookie(SESSION,'',0));headers.append('Set-Cookie',cookie(NONCE,'',0));return reply({ok:true});
      }
      if(action==='delete') {
        const user=await current();
        await db.batch([db.prepare('DELETE FROM account_sessions WHERE sub=?').bind(user.sub),db.prepare('DELETE FROM account_users WHERE sub=?').bind(user.sub)]);
        headers.append('Set-Cookie',cookie(SESSION,'',0));headers.append('Set-Cookie',cookie(NONCE,'',0));return reply({ok:true});
      }
      if(!['challenge','session'].includes(action))throw fail('지원하지 않는 요청입니다.',404);
      const rateKey=await hash(`${request.headers.get('CF-Connecting-IP')||'unknown'}:${Math.floor(now/600)}`);
      const rate=await db.prepare('INSERT INTO account_limits(hash,count,expires) VALUES(?,1,?) ON CONFLICT(hash) DO UPDATE SET count=count+1 RETURNING count').bind(rateKey,now+600).first();
      if(rate.count>60)throw fail('잠시 후 다시 시도해주세요.',429);
      if(action==='challenge') {
        const nonce=token();
        await db.batch([db.prepare('DELETE FROM account_challenges WHERE expires<?').bind(now),db.prepare('DELETE FROM account_sessions WHERE expires<?').bind(now),db.prepare('DELETE FROM account_limits WHERE expires<?').bind(now),db.prepare('INSERT INTO account_challenges(hash,expires) VALUES(?,?)').bind(await hash(nonce),now+300)]);
        headers.append('Set-Cookie',cookie(NONCE,nonce,300));return reply({nonce,clientId:GOOGLE_CLIENT});
      }
      const nonce=read(request,NONCE);
      if(!/^[a-f0-9]{64}$/.test(nonce)||typeof body.credential!=='string'||body.credential.length>12000)throw fail('다시 로그인해주세요.',401);
      let identity;try{identity=await verifyGoogle(body.credential);}catch{throw fail('Google 인증을 확인하지 못했습니다.',401);}
      if(identity.nonce!==nonce||identity.email_verified!==true||typeof identity.sub!=='string'||!identity.sub||identity.sub.length>255||typeof identity.email!=='string'||identity.email.length>254)throw fail('Google 인증을 다시 진행해주세요.',401);
      const challenge=await db.prepare('DELETE FROM account_challenges WHERE hash=? AND expires>? RETURNING hash').bind(await hash(nonce),now).first();
      if(!challenge)throw fail('만료되었거나 이미 사용한 로그인입니다.',401);
      const session=token();
      await db.batch([db.prepare('INSERT INTO account_users(sub,email,created,updated) VALUES(?,?,?,?) ON CONFLICT(sub) DO UPDATE SET email=excluded.email,updated=excluded.updated').bind(identity.sub,identity.email,now,now),db.prepare('INSERT INTO account_sessions(hash,sub,expires) VALUES(?,?,?)').bind(await hash(session),identity.sub,now+2592000),db.prepare('DELETE FROM account_sessions WHERE hash=?').bind(await hash(read(request,SESSION)))]);
      headers.append('Set-Cookie',cookie(SESSION,session,2592000));headers.append('Set-Cookie',cookie(NONCE,'',0));return reply({email:identity.email});
    } catch(e) { return reply({error:e.status?e.message:'로그인 요청을 처리하지 못했습니다.'},e.status||500); }
  };
}

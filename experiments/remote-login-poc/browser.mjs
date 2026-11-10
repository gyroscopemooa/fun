import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { ApiError, secret, validateMediaUrl } from './core.mjs';

export const FIXTURE_ORIGIN = 'https://media.example.test';
export const VIEWPORT = { width: 390, height: 640 };
export const FIXTURE = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:18px sans-serif;padding:24px;background:#eef3ff;color:#172849}button{font:inherit;padding:20px;background:#245bd8;color:white;border:0;border-radius:12px}p{line-height:1.6}</style><h1>매니툴 테스트 사이트</h1><p>이 화면은 서버에서 실행되는 실제 브라우저입니다. 외부 서비스에 연결하지 않습니다.</p><button id="login">모의 계정으로 로그인</button><p id="state">로그인 전</p><p>영상·스토리는 테스트 자료만 제공합니다.</p><script>function render(){document.body.dataset.auth=sessionStorage.getItem('mock-auth')==='yes'?'yes':'no';document.getElementById('state').textContent=document.body.dataset.auth==='yes'?'모의 로그인 완료':'로그인 전';document.getElementById('login').disabled=document.body.dataset.auth==='yes'};document.getElementById('login').onclick=()=>{sessionStorage.setItem('mock-auth','yes');render()};render();</script></html>`;
const matches = (a,b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));

export class BrowserSetupFailure extends Error {
  constructor(browser){super('Browser setup and cleanup failed');this.pendingBrowser=browser;}
}

export class ChromiumFixture {
  static async open(chromium, executablePath) {
    const media = await readFile(new URL('./demo.webm',import.meta.url));
    const browser = await chromium.launch({headless:true, chromiumSandbox:true, ...(executablePath ? {executablePath} : {}), timeout:15_000});
    try {
      const context = await browser.newContext({viewport:VIEWPORT, serviceWorkers:'block', acceptDownloads:false, permissions:[]});
      // This adapter can ONLY render a built-in fixture. It is not a general web browser.
      await context.route('**/*', route => {
        const r=route.request();
        if(r.url()===`${FIXTURE_ORIGIN}/` && r.isNavigationRequest() && r.method()==='GET') return route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'none'"},body:FIXTURE});
        if(r.url()===`${FIXTURE_ORIGIN}/media/demo.webm` && r.method()==='GET' && !r.isNavigationRequest()) return route.fulfill({status:200,contentType:'video/webm',body:media});
        return route.abort('blockedbyclient');
      });
      const page=await context.newPage();
      context.on('page', popup=>{if(popup!==page) popup.close().catch(()=>{});});
      page.on('dialog', dialog=>dialog.dismiss().catch(()=>{}));
      page.setDefaultTimeout(5000);
      await page.goto(`${FIXTURE_ORIGIN}/`);
      return new ChromiumFixture(browser,context,page);
    } catch(error) { try {await browser.close();} catch {throw new BrowserSetupFailure({close:()=>browser.close()});} throw error; }
  }
  constructor(browser,context,page){this.browser=browser;this.context=context;this.page=page;}
  async authenticated(){return await this.page.locator('body').getAttribute('data-auth')==='yes';}
  async frame(){return { image:(await this.page.screenshot({type:'jpeg',quality:65,timeout:5000})).toString('base64'), ...VIEWPORT, authenticated:await this.authenticated() };}
  async media(){return this.page.evaluate(async()=>{const response=await fetch('/media/demo.webm');if(!response.ok)throw new Error('Fixture unavailable');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>131072)throw new Error('Fixture too large');return btoa(String.fromCharCode(...bytes));});}
  async click(x,y){await this.page.mouse.click(x,y);}
  async close(){try {await this.context.close();} finally {await this.browser.close();}}
}

// One browser PROCESS per session, never a shared logged-in browser or persistent profile.
// This is still not OS/container isolation and must remain loopback + fixture-only.
export class BrowserSessionManager {
  #sessions=new Map(); #queue=Promise.resolve(); #pending=0; #retired=new Set(); #stopped=false;
  constructor({factory,now=Date.now,ttl=300_000,max=2}={}){this.factory=factory;this.now=now;this.ttl=ttl;this.max=max;}
  #serial(operation,force=false){if(!force&&this.#pending>=32)return Promise.reject(new ApiError(429,'브라우저 요청 대기 한도입니다.'));this.#pending++;const result=this.#queue.then(operation).finally(()=>{this.#pending--;});this.#queue=result.catch(()=>{});return result;}
  async #dispose(browser){this.#retired.add(browser);await browser.close();this.#retired.delete(browser);}
  async #drop(id,s){this.#sessions.delete(id);s.owner='';s.token='';await this.#dispose(s.browser);}
  async #sweep(){await Promise.allSettled([...this.#retired].map(browser=>this.#dispose(browser)));await Promise.allSettled([...this.#sessions].filter(([,s])=>s.expiresAt<=this.now()).map(([id,s])=>this.#drop(id,s)));}
  sweep(){return this.#serial(()=>this.#sweep());}
  #get(owner,id,token){const s=this.#sessions.get(id);if(!s||!matches(owner,s.owner)||!matches(token,s.token))throw new ApiError(404,'세션이 없거나 만료되었습니다.');return s;}
  create(owner){return this.#serial(async()=>{
    if(this.#stopped)throw new ApiError(503,'브라우저 서비스가 종료 중입니다.');
    await this.#sweep();
    if(typeof owner!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(owner))throw new ApiError(401,'접속 인증이 필요합니다.');
    for(const [id,s]of this.#sessions)if(matches(owner,s.owner))await this.#drop(id,s);
    if(this.#sessions.size+this.#retired.size>=this.max)throw new ApiError(429,'브라우저 세션 한도입니다.');
    let browser;try {browser=await this.factory();}catch(error){if(error instanceof BrowserSetupFailure)this.#retired.add(error.pendingBrowser);throw new ApiError(503,'격리 브라우저를 시작할 수 없습니다. 실행 환경을 확인해 주세요.');}
    const id=secret(),token=secret(),expiresAt=this.now()+this.ttl;
    this.#sessions.set(id,{owner,token,expiresAt,browser,lastFrame:-Infinity,lastClick:-Infinity});
    return {id,token,expiresAt,mode:'chromium-fixture',authenticated:false};
  });}
  #use(owner,id,token,fn){return this.#serial(async()=>{await this.#sweep();const s=this.#get(owner,id,token);try{return await fn(s);}catch(error){if(error instanceof ApiError)throw error;await this.#drop(id,s).catch(()=>{});throw new ApiError(503,'브라우저가 중단되어 세션을 종료했습니다.');}});}
  status(owner,id,token){return this.#use(owner,id,token,async s=>({authenticated:await s.browser.authenticated(),expiresAt:s.expiresAt,mode:'chromium-fixture'}));}
  frame(owner,id,token){return this.#use(owner,id,token,async s=>{if(this.now()-s.lastFrame<500)throw new ApiError(429,'화면 요청이 너무 빠릅니다.');s.lastFrame=this.now();return s.browser.frame();});}
  click(owner,id,token,x,y){return this.#use(owner,id,token,async s=>{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=VIEWPORT.width||y>=VIEWPORT.height)throw new ApiError(400,'잘못된 클릭 위치입니다.');
    if(this.now()-s.lastClick<100)throw new ApiError(429,'클릭 요청이 너무 빠릅니다.');s.lastClick=this.now();await s.browser.click(x,y);return {authenticated:await s.browser.authenticated()};
  });}
  login(){throw new ApiError(400,'브라우저 화면 안의 모의 로그인 버튼을 직접 눌러 주세요.');}
  download(owner,id,token,url){return this.#use(owner,id,token,async s=>{const media=validateMediaUrl(url);if(!await s.browser.authenticated())throw new ApiError(409,'브라우저 화면에서 먼저 모의 로그인해 주세요.');return {filename:'manytool-test-video.webm',mime:'video/webm',contentBase64:await s.browser.media(),fixtureOnly:true};});}
  close(owner,id,token){return this.#serial(async()=>{await this.#sweep();const s=this.#get(owner,id,token);await this.#drop(id,s);return {closed:true};});}
  shutdown(){this.#stopped=true;return this.#serial(async()=>{await Promise.allSettled([...this.#sessions].map(([id,s])=>this.#drop(id,s)));await Promise.allSettled([...this.#retired].map(browser=>this.#dispose(browser)));if(this.#retired.size)throw new ApiError(503,'일부 브라우저 종료 확인에 실패했습니다.');},true);}
}

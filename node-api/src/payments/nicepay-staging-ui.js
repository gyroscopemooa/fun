import express from 'express';
import {renderNicepayPgForm} from './nicepay-pg.js';
const groups=['payment','photo','image'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const operator=async(authenticate,operators,req)=>{
 const owner=await authenticate(req);
 if(!Array.isArray(operators)||!operators.includes(owner))throw Error('Operator access required');
 return owner;
};
const now=()=>new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14);

// Operator staging UI only; no catalog defaults, payment auto-submit or live provider creation.
export function createNicepayStagingUi({store,authenticate,origin,payment,photo,image,operators=[]}){
 const options={payment,photo,image},router=express.Router();
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
  try{res.locals.owner=await operator(authenticate,operators,req);next();}catch{res.status(401).send('An explicitly allowed staging operator session is required.');}
 });
 router.get('/',(req,res)=>{
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Manytool 결제 staging</title><body>
  <h1>Manytool 결제 staging</h1><p>운영 서비스가 아닙니다. 승인된 테스트 계정·상품만 사용하세요. 결제 및 AI 실행은 자동으로 시작하지 않습니다.</p>
  <label>상품 <select id="product"></select></label><p id="price"></p>
  <label>구매 옵션 JSON <textarea id="purchase" rows="4">{}</textarea></label><button id="checkout">주문 준비</button>
  <a id="pay" target="_blank" rel="noopener" hidden>결제창 열기</a>
  <p><label>주문 ID <input id="order"></label><button id="status">결제 상태 확인</button></p>
  <label>도구 실행 JSON <textarea id="input" rows="6">{}</textarea></label>
  <label>실행 종류 <select id="action"><option value="execute">단일 도구·사진·이미지</option value="pet">펫 번역</option><option value="analyze">이름 분석</option><option value="recommend">이름 추천</option><option value="convert">영상 변환</option></select></label>
  <p><label>펫·이름 요청 ID <input id="request"></label><button id="newRequest">새 작업 ID</button></p><button id="execute">도구 실행</button>
  <p><label>이미지 또는 영상 <input id="file" type="file"></label><button id="upload">선택 경로에 업로드</button></p>
  <p>사진·이미지는 결제 전 업로드 ID를 구매 옵션에 넣으세요. 영상은 결제 후 업로드합니다. 실행 JSON은 해당 도구의 검증된 입력 구조를 사용합니다.</p>
  <p><label>결과 ID <input id="artifact"></label><button id="download">결과 다운로드</button></p>
  <pre id="result" role="status"></pre><script src="${escape(req.baseUrl)}/client.js"></script></body></html>`);
 });
 router.get('/client.js',(_req,res)=>res.type('js').send(clientScript));
 router.use((req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'Origin rejected'}));
 router.post('/catalog',(_req,res)=>{
  const products=groups.flatMap(group=>Object.entries(options[group]?.catalog??{}).map(([id,p])=>({group,id,label:p.goodsName,amount:p.amount,currency:p.currency,category:p.category})));
  res.json({products});
 });
 router.post('/status',express.json({limit:'2kb'}),async(req,res)=>{
  try{const order=await store.owned(req.body?.orderId,res.locals.owner);res.json({orderId:order.id,state:order.state,productId:order.productId,category:order.category});}
  catch{res.status(404).json({error:'Order unavailable'});}
 });
 // Navigation to the PG form does not send Origin; its own route remains owner authenticated.
 // Defined separately below to avoid treating navigation as a mutation.
 return router;
}

export function createNicepayCheckoutPreview({store,authenticate,payment,photo,image,operators=[]}){
 const router=express.Router(),options={payment,photo,image};
 router.get('/:group/:id',async(req,res)=>{
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer');
  res.set('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline' https://pg-web.nicepay.co.kr; connect-src https://*.nicepay.co.kr; frame-src https://*.nicepay.co.kr; img-src https://*.nicepay.co.kr data:; style-src 'unsafe-inline'; form-action https:; base-uri 'none'; frame-ancestors 'none'");
  try{
   if(!groups.includes(req.params.group))throw Error();
   const settings=options[req.params.group],order=await store.owned(req.params.id,await operator(authenticate,operators,req));
   if(!settings||!Object.hasOwn(settings.catalog,order.productId)||order.state!=='created'||order.expires<=Date.now()||order.merchantId!==settings.config.id)throw Error();
   // Photo/image orders are created only after immutable binding in their checkout route.
   if(req.params.group!=='payment'){
    const table=req.params.group==='photo'?'nice_photo_purchases':'nice_image_purchases';
    if(!store.db.prepare('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=?').get(table))throw Error();
    if(!store.db.prepare('SELECT 1 FROM '+table+' WHERE order_id=?').get(order.id))throw Error();
   }
   res.type('html').send(renderNicepayPgForm(order,settings.config,now()));
  }catch{res.status(404).send('Checkout unavailable. Check the order status; do not create another payment blindly.');}
 });
 return router;
}

const clientScript=String.raw`
const $=id=>document.getElementById(id),base=location.pathname.replace(/\/ui\/?$/,'');
let products=[];
$('request').value=crypto.randomUUID();$('newRequest').onclick=()=>{$('request').value=crypto.randomUUID();};
const selected=()=>products[Number($('product').value)];
const show=v=>$('result').textContent=typeof v==='string'?v:JSON.stringify(v,null,2);
async function request(path,body){
 const r=await fetch(base+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const text=await r.text();if(!r.ok)throw Error(text);return {text,response:r};
}
const json=id=>JSON.parse($(id).value);
const run=fn=>async()=>{try{await fn();}catch(e){show(e.message);}};
function price(){const p=selected();$('price').textContent=p?p.amount+' '+p.currency+' · '+p.group:'';$('pay').hidden=true;}
$('product').onchange=price;
$('checkout').onclick=run(async()=>{
 const p=selected();if(!p)throw Error('No approved configured products');
 const route=p.group==='payment'?'/payment':'/'+p.group+'/payment';
 const {text}=await request(route+'/checkout',{productId:p.id,input:json('purchase')});
 const doc=new DOMParser().parseFromString(text,'text/html'),id=doc.querySelector('input[name="Moid"]')?.value;
 if(!id)throw Error('No order returned; check server status before retrying');
 $('order').value=id;$('pay').href=base+'/checkout-preview/'+p.group+'/'+encodeURIComponent(id);$('pay').hidden=false;show('주문 준비 완료. 결제창 열기를 눌러 진행하세요.');
});
$('status').onclick=run(async()=>show(JSON.parse((await request('/ui/status',{orderId:$('order').value})).text)));
$('execute').onclick=run(async()=>{
 const p=selected(),action=$('action').value,input=json('input'),orderId=$('order').value;
 let route,body;
 if(action==='execute'){route=(p.group==='payment'?'/payment':'/'+p.group+'/payment')+'/execute';body={orderId,input};}
 else if(action==='convert'){route='/video/convert';body={...input,orderId};}
 else {route=action==='pet'?'/bundles/pet':'/bundles/name/'+action;body={orderId,requestId:$('request').value,input};}
 show(JSON.parse((await request(route,body)).text));
});
$('upload').onclick=run(async()=>{
 const p=selected(),file=$('file').files[0];if(!file)throw Error('Choose a file');
 let route,body,headers={};
 if(p.group==='photo'||p.group==='image'){route='/'+p.group+'/files/upload';body=file;headers['Content-Type']=file.type;}
 else if(p.id==='video_mkv_mp4'){route='/video/upload';body=new FormData();body.append('video',file);headers['X-Manytool-Order']=$('order').value;}
 else throw Error('This tool uses its validated JSON image input');
 const r=await fetch(base+route,{method:'POST',credentials:'same-origin',headers,body});const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));show(data);
});
$('download').onclick=run(async()=>{
 const p=selected(),id=$('artifact').value;let route,options,name;
 if(['photo','image'].includes(p.group)){
  route='/'+p.group+'/files/download';name='manytool.png';options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:$('order').value,candidateId:id})};
 }else if(p.id==='video_mkv_mp4'){route='/video/download/'+encodeURIComponent(id);name='manytool.mp4';options={method:'GET'};}
 else if(p.id==='ai_pet_translator'){route='/bundles/artifact/'+encodeURIComponent(id);name='manytool.mp3';options={method:'POST'};}
 else throw Error('This tool returns its report as JSON');
 const r=await fetch(base+route,{...options,credentials:'same-origin'});
 if(!r.ok)throw Error('Download unavailable');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
run(async()=>{products=JSON.parse((await request('/ui/catalog',{})).text).products;products.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.group+' / '+p.label+' ('+p.id+')';$('product').append(o);});price();})();
`;

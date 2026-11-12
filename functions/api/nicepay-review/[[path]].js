import {NICE_REVIEW_PRODUCTS} from '../../../src/data/nicepay-review-products.js';
// Review-only module: deliberately has no approval transport, database, or fulfillment binding.
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const html=(body,status=200)=>new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>매니툴 결제 연동 심사</title><body>'+body+'</body></html>',{status,headers});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function onRequest({request,env}){
 const url=new URL(request.url);
 // Even a forged successful authentication callback must never trigger approval or credit delivery.
 if(url.pathname!=='/api/nicepay-review/window')return html('<h1>심사 전용 · 결제 처리 안 함</h1><p>인증 결과를 승인하거나 크레딧을 지급하지 않습니다.</p><a href="/payment-review/">돌아가기</a>',409);
 if(request.method!=='POST')return html('<p>상품 검토 화면에서 결제창을 열어주세요.</p>',405);
 if(env.NICEPAY_REVIEW_ENABLED!=='true'||!env.NICEPAY_REVIEW_ORIGIN||url.origin!==env.NICEPAY_REVIEW_ORIGIN)return html('<h1>심사 연결 설정 대기</h1><p>결제는 처리되지 않습니다.</p>',503);
 if(request.headers.get('Origin')!==url.origin)return html('<p>허용되지 않은 요청입니다.</p>',403);
 if(Number(request.headers.get('Content-Length')||0)>2048)return html('<p>요청이 너무 큽니다.</p>',413);
 const body=await request.text();if(body.length>2048)return html('<p>요청이 너무 큽니다.</p>',413);
 const id=new URLSearchParams(body).get('product');
 const product=id===null?null:Object.hasOwn(NICE_REVIEW_PRODUCTS,id)?NICE_REVIEW_PRODUCTS[id]:undefined;
 if(product===undefined)return html('<p>상품을 다시 선택해주세요.</p>',400);
 const key=env.NICEPAY_REVIEW_MERCHANT_KEY;
 if(typeof key!=='string'||! /^[A-Za-z0-9+/]{80,100}={0,2}$/.test(key))return html('<h1>심사 연결 설정 대기</h1>',503);
 const timestamp=new Date(Date.now()+9*3600000).toISOString().replace(/\D/g,'').slice(0,14);
 // Fixed diagnostic amount is not a catalog price. Client input never controls MID, amount or return URL.
 const mid='000000002m',amount='1000';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(timestamp+mid+amount+key));
 const signature=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 const fields={MID:mid,Moid:'review_'+crypto.randomUUID().replaceAll('-',''),Amt:amount,GoodsName:product?product.name:'Manytool integration review',PayMethod:'CARD',EdiDate:timestamp,CharSet:'utf-8',ReturnURL:url.origin+'/api/nicepay-review/return',SignData:signature};
 return html(`<h1>상품 주문 확인 · 실제 구매 불가</h1>${product?`<h2>${escape(product.name)}</h2><p>서비스 제공기간: ${escape(product.period)}</p><p><a href="${escape(product.path)}">상품 화면으로 돌아가기</a></p>`:''}<p>판매 가격은 미정입니다. NICE 창의 1,000원은 연결 확인용 표시액입니다.</p><p>카드정보 입력이나 결제 완료를 진행하지 마세요. 서버 승인·크레딧 지급은 차단되어 있습니다.</p><form name="payForm" method="post" accept-charset="euc-kr" action="/api/nicepay-review/return">${Object.entries(fields).map(([k,v])=>`<input type="hidden" name="${k}" value="${escape(v)}">`).join('')}<button type="button" id="pay">NICE 결제창 연결 확인</button></form><p id="status" role="status"></p><a href="/payment-review/">상품 검토로 돌아가기</a><script src="https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js"></script><script>function nicepaySubmit(){document.getElementById('status').textContent='심사 전용이므로 승인 요청을 전송하지 않습니다.'}function nicepayClose(){document.getElementById('status').textContent='결제창을 닫았습니다. 결제 및 크레딧 지급은 처리하지 않았습니다.'}document.getElementById('pay').onclick=function(){if(typeof goPay==='function')goPay(document.payForm);else document.getElementById('status').textContent='결제창을 불러오지 못했습니다.'}</script>`);
}

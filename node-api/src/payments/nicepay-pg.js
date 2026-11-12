import { createHash, timingSafeEqual } from 'node:crypto';
import {buildPgInquiry,verifyPgInquiry,buildPgFullCancel,verifyPgFullCancel} from './nicepay-operations.js';
import { buildNicepayRequest, verifyNicepayAuthentication, verifyNicepayApproval } from './nicepay.js';
const sha = s => createHash('sha256').update(s).digest('hex');
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assertLegacy = config => { if (config.variant !== 'legacy') throw new Error('NICE PG MID contract required'); };
export function renderNicepayPgForm(order, config, timestamp) {
  assertLegacy(config);
  const fields = buildNicepayRequest(order,config,timestamp);
  // All submitted values are ASCII, a subset of EUC-KR. Non-ASCII labels remain blocked.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>NICEPAY test checkout</title></head><body><p>Test integration only. Not a live checkout.</p><form name="payForm" method="post" accept-charset="euc-kr" action="${escape(config.returnUrl)}">${Object.entries(fields).map(([k,v])=>`<input type="hidden" name="${escape(k)}" value="${escape(v)}">`).join('')}<button type="button" id="pay">Open card authentication</button></form><p id="status"></p><script src="https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js"></script><script>function nicepaySubmit(){document.payForm.submit()}function nicepayClose(){document.getElementById('status').textContent='Cancelled'}document.getElementById('pay').onclick=function(){goPay(document.payForm)}</script></body></html>`;
}
export function buildPgAuthorization(body,order,config,timestamp,{netCancel=false}={}) {
  assertLegacy(config);
  const auth=verifyNicepayAuthentication(body,order,config);
  if (!/^\d{14}$/.test(timestamp)) throw new Error('Invalid timestamp');
  const host=new URL(body.NextAppURL).origin;
  const cancelUrl=`${host}/webapi/cancel_process.jsp`;
  if(netCancel && body.NetCancelURL!==cancelUrl) throw new Error('Invalid network cancel destination');
  const fields={TID:auth.tid,AuthToken:body.AuthToken,MID:config.id,Amt:String(order.amount),EdiDate:timestamp,
    SignData:sha(body.AuthToken+config.id+order.amount+timestamp+config.secret),CharSet:'utf-8',EdiType:'JSON',...(netCancel?{NetCancel:'1'}:{})};
  return {url:netCancel?cancelUrl:body.NextAppURL,body:new URLSearchParams(fields).toString(),auth};
}
export class NicepayUncertainError extends Error {
  constructor(){super('NICEPAY outcome uncertain; reconcile or network-cancel before retry');this.code='NICEPAY_UNCERTAIN';}
}
export function createNicepayPgClient({config,enabled=false,fetcher=fetch,timeoutMs=15000}) {
  assertLegacy(config);
  const post=async request=>{
    if(!enabled) throw new Error('NICEPAY transport disabled');
    try {
      const response=await fetcher(request.url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:request.body,signal:AbortSignal.timeout(timeoutMs)});
      if(!response.ok) throw new Error('HTTP error');
      const reader=response.body.getReader();let total=0;const chunks=[];
      try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>65536)throw new Error('Response too large');chunks.push(value);}}
      finally {await reader.cancel().catch(()=>{});}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }catch{throw new NicepayUncertainError();}
  };
  return {
    async inquire(order,timestamp){
      const result=await post(buildPgInquiry(order,config,timestamp));
      try{return verifyPgInquiry(result,order);}catch{throw new NicepayUncertainError();}
    },
    async fullCancel(order,timestamp,cancelOrderId){
      const result=await post(buildPgFullCancel(order,config,timestamp,cancelOrderId));
      try{return verifyPgFullCancel(result,order,config,cancelOrderId);}catch{throw new NicepayUncertainError();}
    },
    async approve(body,order,timestamp){
      const request=buildPgAuthorization(body,order,config,timestamp);
      const result=await post(request);
      try{return verifyNicepayApproval(result,order,request.auth,config);}catch{throw new NicepayUncertainError();}
    },
    async networkCancel(body,order,timestamp){
      const request=buildPgAuthorization(body,order,config,timestamp,{netCancel:true});
      const result=await post(request);
      try{
        if(result.ResultCode!=='2001'||result.MID!==config.id||result.TID!==request.auth.tid||result.PayMethod!=='CARD'
          ||typeof result.CancelAmt!=='string'||!/^\d{1,12}$/.test(result.CancelAmt)||Number(result.CancelAmt)!==order.amount
          ||typeof result.RemainAmt!=='string'||!/^0{1,12}$/.test(result.RemainAmt)
          ||typeof result.Signature!=='string'||!/^[a-fA-F0-9]{64}$/.test(result.Signature))throw new Error();
        const expected=sha(result.TID+config.id+result.CancelAmt+config.secret);
        if(!timingSafeEqual(Buffer.from(result.Signature,'hex'),Buffer.from(expected,'hex')))throw new Error();
        return {orderId:order.id,tid:request.auth.tid,cancelled:true};
      }catch{throw new NicepayUncertainError();}
    }
  };
}
// Public route is deliberately unavailable until durable fulfillment and merchant testing are complete.
export function installDisabledNicepayPgRoutes(app){
  app.get('/payments/nicepay/config',(_req,res)=>res.set('Cache-Control','no-store').json({enabled:false,provider:'nicepay',variant:'legacy',status:'integration_testing'}));
  app.post(['/payments/nicepay/checkout','/payments/nicepay/return'],(_req,res)=>res.status(503).json({error:'NICEPAY integration is not enabled'}));
}

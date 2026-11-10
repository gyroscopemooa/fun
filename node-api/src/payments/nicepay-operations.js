import {createHash,timingSafeEqual} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
function validate(order,config,time){
 if(config.variant!=='legacy'||order.merchantId!==config.id||!/^[a-zA-Z0-9]{10}$/.test(config.id)||typeof config.secret!=='string'||config.secret.length<16
 ||!/^[a-zA-Z0-9]{30}$/.test(order.tid)||!/^\d{14}$/.test(time)||!Number.isSafeInteger(order.amount)||order.amount<=0||order.currency!=='KRW')throw Error('Invalid NICEPAY operation');
}
export function buildPgInquiry(order,config,time){
 validate(order,config,time);
 return {url:'https://webapi.nicepay.co.kr/webapi/inquery/trans_status.jsp',body:new URLSearchParams({TID:order.tid,MID:config.id,EdiDate:time,SignData:hash(order.tid+config.id+time+config.secret),CharSet:'utf-8',EdiType:'JSON'}).toString()};
}
export function verifyPgInquiry(result,order){
 if(result.ResultCode!=='0000'||result.TID!==order.tid||!['0','1','9'].includes(result.Status))throw Error('Invalid NICEPAY inquiry');
 // This endpoint does NOT return amount/order/signature: never use it alone to credit a wallet.
 return {tid:order.tid,status:({'0':'approved','1':'cancelled','9':'not_found'})[result.Status],fulfillmentAllowed:false};
}
export function buildPgFullCancel(order,config,time,cancelOrderId){
 validate(order,config,time);
 if(order.state!=='verified'||typeof cancelOrderId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(cancelOrderId))throw Error('Verified full cancellation required');
 return {url:'https://pg-api.nicepay.co.kr/webapi/cancel_process.jsp',body:new URLSearchParams({TID:order.tid,MID:config.id,Moid:cancelOrderId,CancelAmt:String(order.amount),CancelMsg:'Customer request',PartialCancelCode:'0',EdiDate:time,SignData:hash(config.id+String(order.amount)+time+config.secret),CharSet:'utf-8',EdiType:'JSON'}).toString()};
}
export function verifyPgFullCancel(result,order,config,cancelOrderId){
 if(config.variant!=='legacy'||order.merchantId!==config.id||!['2001','2211'].includes(result.ResultCode)||result.MID!==config.id||result.TID!==order.tid||result.Moid!==cancelOrderId||result.PayMethod!=='CARD'
 ||typeof result.CancelAmt!=='string'||!/^\d{1,12}$/.test(result.CancelAmt)||Number(result.CancelAmt)!==order.amount
 ||typeof result.RemainAmt!=='string'||!/^0{1,12}$/.test(result.RemainAmt)||typeof result.Signature!=='string'||!/^[a-fA-F0-9]{64}$/.test(result.Signature))throw Error('Invalid NICEPAY full cancellation');
 if(!timingSafeEqual(Buffer.from(result.Signature,'hex'),Buffer.from(hash(result.TID+config.id+result.CancelAmt+config.secret),'hex')))throw Error('Invalid NICEPAY cancellation signature');
 return {orderId:order.id,tid:order.tid,cancelOrderId,amount:order.amount,cancelled:true};
}

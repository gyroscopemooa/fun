import {SITE, payloadPath, validatePayload} from './core.js';
function delay(ms,signal){
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
  });
}
// Content never enters a URL/history entry. A separate, payload-free probe pins the
// exact target document before delivering to that document with optional host access.
export async function sendToTool(raw,signal,destination='default') {
  const payload=validatePayload(raw), url=SITE+payloadPath(payload,destination);
  signal?.throwIfAborted();
  const tab=await chrome.tabs.create({url});
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    signal?.throwIfAborted();
    const current=await chrome.tabs.get(tab.id);
    if(current.status==='complete'){
      const actual=new URL(current.url), expectedPath=new URL(url).pathname.replace(/\/$/,'');
      if(actual.origin!==SITE || actual.pathname.replace(/\/$/,'')!==expectedPath)throw Error('다른 페이지로 이동되어 전달을 취소했습니다.');
      const [probe]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(origin,path,kind)=>{
        return location.origin===origin&&location.pathname.replace(/\/$/,'')===path&&document.documentElement.dataset.manytoolImportReady===kind;
      },args:[SITE,expectedPath,payload.kind]});
      signal?.throwIfAborted();
      if(probe?.result&&probe.documentId){
        const nonce=crypto.randomUUID();
        const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id,documentIds:[probe.documentId]},func:(data,id,origin,path)=>{
          if(location.origin!==origin||location.pathname.replace(/\/$/,'')!==path)return false;
          const root=document.documentElement;
          if(root.dataset.manytoolImportReady!==data.kind)return false;
          document.dispatchEvent(new CustomEvent('manytool:import-v1',{detail:JSON.stringify({nonce:id,payload:data})}));
          const accepted=root.dataset.manytoolImportAck===id;
          delete root.dataset.manytoolImportAck;
          return accepted;
        },args:[payload,nonce,SITE,expectedPath]});
        if(result?.result)return;
      }
    }
    await delay(400,signal);
  }
  throw Error('사이트에 확장 연결 기능이 아직 반영되지 않았거나 페이지 준비가 늦습니다. 아래 저장/복사 기능으로 직접 가져오실 수 있습니다.');
}

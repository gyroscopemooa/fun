/** One-time, user-initiated extension handoff. Never starts a job or payment. */
export type ExtensionPayload = {kind:'text';text:string}|{kind:'image';dataUrl:string}|{kind:'video';url:string};
export function parseExtensionImport(detail: unknown): {nonce:string;payload:ExtensionPayload}|null {
  if(typeof detail!=='string'||detail.length>4*1024*1024+200)return null;
  try {
    const {nonce,payload}=JSON.parse(detail);
    if(typeof nonce!=='string'||!/^[a-f0-9-]{36}$/.test(nonce)||!payload)return null;
    if(payload.kind==='text'&&typeof payload.text==='string'&&payload.text.trim()&&payload.text.length<=3000)return {nonce,payload:{kind:'text',text:payload.text}};
    if(payload.kind==='image'&&typeof payload.dataUrl==='string'&&payload.dataUrl.length<=4*1024*1024&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(payload.dataUrl))return {nonce,payload:{kind:'image',dataUrl:payload.dataUrl}};
    if(payload.kind==='video'&&typeof payload.url==='string'&&payload.url.length<=2048){
      const url=new URL(payload.url);
      if(url.protocol==='https:'&&!url.username&&!url.password)return {nonce,payload:{kind:'video',url:url.href}};
    }
  }catch{}
  return null;
}
export function listenForExtensionImport(kind:ExtensionPayload['kind'], accept:(payload:ExtensionPayload)=>boolean) {
  let received=false;
  const root=document.documentElement;
  root.dataset.manytoolImportReady=kind;
  const listener=(event:Event)=>{
    if(received)return;
    const value=parseExtensionImport((event as CustomEvent).detail);
    if(!value||value.payload.kind!==kind)return;
    if(accept(value.payload)){
      received=true;delete root.dataset.manytoolImportReady;root.dataset.manytoolImportAck=value.nonce;
    }
  };
  document.addEventListener('manytool:import-v1',listener);
  return ()=>{document.removeEventListener('manytool:import-v1',listener);if(root.dataset.manytoolImportReady===kind)delete root.dataset.manytoolImportReady;delete root.dataset.manytoolImportAck;};
}
export function captureFile(dataUrl:string):File {
  const encoded=dataUrl.slice('data:image/png;base64,'.length);
  const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
  if(bytes.length<8||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71||bytes[4]!==13||bytes[5]!==10||bytes[6]!==26||bytes[7]!==10)throw Error('PNG 형식이 아닙니다.');
  return new File([bytes],'매니툴-캡처.png',{type:'image/png'});
}

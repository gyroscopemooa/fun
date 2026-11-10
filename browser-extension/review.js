import {validatePayload,isFresh,selectionText,PERMISSION} from './core.js';
import {sendToTool} from './handoff.js';
import {convertCapture} from './image-tools.js';
const $=s=>document.querySelector(s), status=$('#status'), consent=$('#consent'), send=$('#send');
let payload=null, busy=false, handoffController=null, imageGeneration=0, imageUrl=null;
function clearImageOutput(){imageGeneration++;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;$('#image-download').removeAttribute('href');$('#image-download').hidden=true;}
window.addEventListener('pagehide',clearImageOutput);
window.addEventListener('pagehide',()=>handoffController?.abort());
const id=location.hash.slice(1), key='review:'+id;
if(/^[a-f0-9-]{36}$/.test(id)){
  const record=(await chrome.storage.session.get(key))[key];
  await chrome.storage.session.remove(key);
  try{if(!isFresh(record))throw Error('내용이 만료되었거나 이미 열었습니다. 원래 페이지에서 다시 실행해 주세요.');payload=validatePayload(record.payload);}catch(error){status.textContent=error.message;}
}else status.textContent='원래 페이지에서 매니툴 버튼을 눌러 시작해 주세요.';
function update(){send.disabled=busy||!payload||!consent.checked;$('#workbench').disabled=send.disabled;$('#clear').disabled=!payload;$('#local').disabled=busy||!payload;$('#search').disabled=busy||!payload;$('#text').disabled=busy;consent.disabled=busy||!payload;}
function current(){return payload?.kind==='text'?validatePayload({kind:'text',text:$('#text').value}):payload;}
if(payload){
  status.textContent='내용은 아직 다른 사이트로 전달되지 않았습니다.';
  if(payload.kind==='image'){$('#preview').hidden=false;$('#preview').src=payload.dataUrl;$('#title').textContent='선택한 캡처';$('#tool-title').textContent='사진 속 글자 추출 · OCR';$('#local').textContent='PNG 파일 저장';$('#image-tools').hidden=false;$('#preview').addEventListener('load',()=>{$('#width').value=String($('#preview').naturalWidth);$('#width').max=String(Math.min(8192,$('#preview').naturalWidth));},{once:true});}
  if(payload.kind==='text'){$('#text').hidden=false;$('#text').value=payload.text;$('#title').textContent='선택한 글';$('#local').textContent='글 복사';$('#search').hidden=false;$('#workbench').hidden=false;$('#tool-title').textContent='한국어 ↔ 영어 번역';$('#explanation').textContent='기존 도구는 3,000자까지 한국어↔영어 로컬 번역을 지원합니다. 페이지에서 원문 언어를 확인해 주세요.';$('#count').textContent=`${payload.text.length} / 3,000자`;}
  if(payload.kind==='video'){$('#url').hidden=false;$('#url').textContent=payload.url;$('#title').textContent='현재 영상 주소';$('#local').textContent='주소 복사';$('#tool-title').textContent='공개 영상 다운로드';$('#explanation').textContent='주소만 전달합니다. 로그인 상태는 공유되지 않으며, 실제 저장은 원본 서비스 접근 가능 여부와 권한에 따라 달라집니다. 본인 소유 또는 저장 권한이 있는 영상만 이용하세요.';}
}
update();
consent.addEventListener('change',update);
$('#text').addEventListener('input',()=>{consent.checked=false;$('#count').textContent=`${$('#text').value.length} / 3,000자`;update();});
$('#clear').addEventListener('click',()=>{handoffController?.abort();clearImageOutput();$('#image-tools').hidden=true;payload=null;$('#preview').removeAttribute('src');$('#preview').hidden=true;$('#text').value='';$('#text').hidden=true;$('#url').textContent='';$('#count').textContent='';consent.checked=false;status.textContent='내용을 지우고 대기를 취소했습니다. 이미 전달된 내용은 열린 도구 탭에서 따로 지워 주세요.';update();});
$('#local').addEventListener('click',async()=>{
  try{
    const data=current();
    if(data.kind==='image'){
      const a=document.createElement('a');a.href=data.dataUrl;a.download=`manytool-capture-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;a.click();status.textContent='PNG 저장을 요청했습니다.';
    }else{await navigator.clipboard.writeText(data.kind==='text'?data.text:data.url);status.textContent='복사했습니다.';}
  }catch(error){status.textContent=error.message;}
});
$('#search').addEventListener('click',()=>{
  try{const text=selectionText($('#text').value);if(!confirm('선택한 글을 Google 검색어로 전송합니다. 민감한 정보가 없는지 확인하셨나요?'))return;void chrome.tabs.create({url:'https://www.google.com/search?q='+encodeURIComponent(text)});}catch(error){status.textContent=error.message;}
});
async function forward(destination='default'){
  if(busy||!consent.checked||!payload)return;
  // Must remain on the direct user gesture for Chrome's optional permission prompt.
  let data;try{data=current();}catch(error){status.textContent=error.message;return;}
  const controller=new AbortController();handoffController=controller;
  const permissionRequest=chrome.permissions.request(PERMISSION);
  busy=true;update();status.textContent='도구 페이지를 준비합니다…';
  try{if(!await permissionRequest)throw Error('권한을 허용하지 않아 내용을 보내지 않았습니다. 저장/복사 후 직접 가져올 수 있습니다.');controller.signal.throwIfAborted();await sendToTool(data,controller.signal,destination);status.textContent='도구 입력란으로 전달했습니다. 새 탭에서 확인하고 실행해 주세요.';consent.checked=false;}
  catch(error){if(!controller.signal.aborted)status.textContent=error.message;}
  finally{if(handoffController===controller)handoffController=null;busy=false;update();}
}
send.addEventListener('click',()=>void forward());
$('#workbench').addEventListener('click',()=>void forward('workbench'));

$('#quality').addEventListener('input',()=>{$('#quality-label').textContent=$('#quality').value+'%';});
$('#format').addEventListener('change',()=>{$('#quality').disabled=$('#format').value==='image/png';});
$('#convert').addEventListener('click',async()=>{
  if(payload?.kind!=='image')return;
  clearImageOutput();const generation=imageGeneration;$('#convert').disabled=true;$('#image-status').textContent='기기에서 처리 중입니다…';
  try{
    const result=await convertCapture(payload.dataUrl,Number($('#width').value),$('#format').value,Number($('#quality').value)/100);
    if(generation!==imageGeneration)return;
    imageUrl=URL.createObjectURL(result.blob);const link=$('#image-download');link.href=imageUrl;link.download='manytool-image.'+({'image/jpeg':'jpg','image/webp':'webp','image/png':'png'}[result.blob.type]);link.hidden=false;
    $('#image-status').textContent=`${result.width} × ${result.height}px · 원본 ${(result.originalBytes/1024).toFixed(1)}KB → ${(result.blob.size/1024).toFixed(1)}KB${result.blob.size>=result.originalBytes?' (용량이 줄지 않았습니다. 품질이나 크기를 낮춰 보세요.)':''}`;
  }catch(error){if(generation===imageGeneration)$('#image-status').textContent=error.message;}
  finally{$('#convert').disabled=false;}
});

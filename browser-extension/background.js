import {webUrl, selectionText, validatePayload, cropBounds, isFresh} from './core.js';
import {selectRegion} from './capture.js';
import {installSelectionMenu} from './selection-menu.js';
import {readPageImage} from './image-source.js';
const selectionSessions=new Map();
const PREFIX='review:';
const CAPTURE='capture:';
const locks=new Set();
const captureWindows=new Map();
const captureEpochs=new Map();
function invalidateCapture(tabId) {
  captureEpochs.set(tabId,(captureEpochs.get(tabId)||0)+1);
  captureWindows.delete(tabId);
  void chrome.storage.session.remove(CAPTURE+tabId);
}
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='loading'||change.url){invalidateCapture(tabId);selectionSessions.delete(tabId);}});
chrome.tabs.onActivated.addListener(info=>{
  for(const [tabId,windowId] of captureWindows)if(windowId===info.windowId&&tabId!==info.tabId)invalidateCapture(tabId);
});
chrome.windows.onFocusChanged.addListener(windowId=>{
  for(const [tabId,ownerWindow] of captureWindows)if(ownerWindow!==windowId)invalidateCapture(tabId);
});
async function prune() {
  const all=await chrome.storage.session.get(null);
  const keys=Object.keys(all).filter(key=>(key.startsWith(PREFIX)||key.startsWith(CAPTURE)||key.startsWith('error:'))&&!isFresh(all[key]));
  if(keys.length)await chrome.storage.session.remove(keys);
}
chrome.runtime.onInstalled.addListener(()=>{
  chrome.contextMenus.removeAll(()=>{
    chrome.contextMenus.create({id:'text',title:'매니툴에서 선택한 글 검토',contexts:['selection'],documentUrlPatterns:['http://*/*','https://*/*']});
    chrome.contextMenus.create({id:'image',title:'매니툴에서 이미지 검토·변환',contexts:['image'],documentUrlPatterns:['http://*/*','https://*/*']});
    chrome.contextMenus.create({id:'video',title:'매니툴 영상 도구로 현재 주소 검토',contexts:['page','video','link'],documentUrlPatterns:['http://*/*','https://*/*']});
  });
  void chrome.alarms.create('purge-review',{periodInMinutes:1});
});
chrome.runtime.onStartup.addListener(()=>{void prune();void chrome.alarms.create('purge-review',{periodInMinutes:1});});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='purge-review')void prune();});
let reviewQueue=Promise.resolve();
function review(payload){
  const task=reviewQueue.then(()=>reviewImpl(payload));
  reviewQueue=task.catch(()=>{});return task;
}
async function reviewImpl(payload) {
  const clean=validatePayload(payload);
  await prune();
  const all=await chrome.storage.session.get(null);
  const pending=Object.keys(all).filter(k=>k.startsWith(PREFIX)).sort((a,b)=>all[a].createdAt-all[b].createdAt);
  if(pending.length)await chrome.storage.session.remove(pending);
  const id=crypto.randomUUID(), key=PREFIX+id;
  try{await chrome.storage.session.set({[key]:{payload:clean,createdAt:Date.now()}});}
  catch{throw Error('임시 저장 공간이 부족합니다. 검토 탭을 닫고 더 작은 영역으로 다시 시도해 주세요.');}
  try {
    const tab=await chrome.tabs.create({url:chrome.runtime.getURL(`review.html#${id}`)});
    // Do not write the payload again: the review can consume it immediately.
    await chrome.storage.session.set({['tab:'+tab.id]:key});
  } catch(error){await chrome.storage.session.remove(key);throw error;}
}
chrome.tabs.onRemoved.addListener(tabId=>{
  invalidateCapture(tabId);captureEpochs.delete(tabId);selectionSessions.delete(tabId);
  const key='tab:'+tabId;
  void chrome.storage.session.get(key).then(async result=>{if(result[key])await chrome.storage.session.remove([key,result[key]]);});
});
async function showError(error) {
  const id=crypto.randomUUID();
  await chrome.storage.session.set({['error:'+id]:{error:String(error?.message || '다시 시도해 주세요.'),createdAt:Date.now()}});
  await chrome.tabs.create({url:chrome.runtime.getURL('popup.html#'+id)});
}
chrome.contextMenus.onClicked.addListener((info,tab)=>{
  const task=Promise.resolve().then(async()=>{
    if(info.editable)throw Error('입력란의 글은 수집하지 않습니다. 일반 페이지 글자를 선택해 주세요.');
    if(info.menuItemId==='image'){
      if(!tab?.id)throw Error('웹페이지에서 실행해 주세요.');
      const live=await chrome.tabs.get(tab.id);webUrl(live.url);
      const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[info.frameId||0]},func:readPageImage,args:[info.srcUrl]});
      if((await chrome.tabs.get(tab.id)).url!==live.url)throw Error('페이지가 변경되었습니다. 다시 시도해 주세요.');
      return review({kind:'image',dataUrl:result.result});
    }
    if(info.menuItemId==='text')return review({kind:'text',text:selectionText(info.selectionText)});
    if(info.menuItemId==='video')return review({kind:'video',url:info.linkUrl||info.pageUrl});
    throw Error('지원하지 않는 메뉴입니다.');
  });
  void task.catch(showError);
});
async function activeTab() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error('활성 웹페이지를 열어 주세요.');
  webUrl(tab.url);return tab;
}
async function capture(tab) {
  const nonce=crypto.randomUUID();
  captureWindows.set(tab.id,tab.windowId);
  await chrome.storage.session.set({[CAPTURE+tab.id]:{nonce,createdAt:Date.now(),url:tab.url,windowId:tab.windowId}});
  try {
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:selectRegion,args:[nonce]});
    const key=CAPTURE+tab.id, record=(await chrome.storage.session.get(key))[key];
    if(record?.nonce===nonce)await chrome.storage.session.set({[key]:{...record,documentId:result.documentId}});
  }
  catch {await chrome.storage.session.remove(CAPTURE+tab.id);throw Error('이 페이지에서는 캡처를 실행할 수 없습니다. 일반 웹페이지에서 다시 시도해 주세요.');}
}
chrome.commands.onCommand.addListener(command=>{if(command==='capture-region')void activeTab().then(capture).catch(showError);});
async function finishCapture(message,sender) {
  const tab=sender.tab;
  if(!tab?.id || sender.frameId!==0)throw Error('허용되지 않은 캡처 요청입니다.');
  const key=CAPTURE+tab.id;
  const record=(await chrome.storage.session.get(key))[key];
  if(!isFresh(record)||record.nonce!==message.nonce)throw Error('캡처 요청이 만료되었습니다.');
  if(record.documentId && sender.documentId!==record.documentId)throw Error('페이지가 변경되어 캡처를 취소했습니다.');
  captureWindows.set(tab.id,record.windowId);
  const epoch=captureEpochs.get(tab.id)||0;
  const live=await chrome.tabs.get(tab.id);
  const win=await chrome.windows.get(live.windowId);
  if(!live.active||!win.focused||live.url!==record.url)throw Error('페이지가 변경되어 캡처를 취소했습니다.');
  const png=await chrome.tabs.captureVisibleTab(live.windowId,{format:'png'});
  // Check again so switching tabs while capture is running cannot expose another page.
  const after=await chrome.tabs.get(tab.id);
  const stillPending=(await chrome.storage.session.get(key))[key];
  if(!after.active||after.url!==record.url||stillPending?.nonce!==record.nonce||(captureEpochs.get(tab.id)||0)!==epoch)throw Error('탭이 변경되어 캡처를 취소했습니다.');
  await chrome.storage.session.remove(key);captureWindows.delete(tab.id);
  const bytes=Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  let blob;
  try {
    const bounds=cropBounds(message.rect,message.viewport,bitmap);
    const canvas=new OffscreenCanvas(bounds.width,bounds.height);
    const context=canvas.getContext('2d');if(!context)throw Error('캡처 처리에 실패했습니다.');
    context.drawImage(bitmap,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
    blob=await canvas.convertToBlob({type:'image/png'});
  } finally {bitmap.close();}
  const output=new Uint8Array(await blob.arrayBuffer());
  let binary='';for(let i=0;i<output.length;i+=32768)binary+=String.fromCharCode(...output.subarray(i,i+32768));
  await review({kind:'image',dataUrl:'data:image/png;base64,'+btoa(binary)});
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id)return;
  const ownPage=typeof sender.url==='string'&&sender.url.startsWith(chrome.runtime.getURL(''))&&!sender.tab?.url?.startsWith('http');
  const run=async()=>{
    if(message?.type==='capture-finish'){
      if(locks.has(sender.tab?.id))return;
      locks.add(sender.tab?.id);try{await finishCapture(message,sender);}finally{
        locks.delete(sender.tab?.id);
        const key=CAPTURE+sender.tab?.id, record=(await chrome.storage.session.get(key))[key];
        if(!record||record.nonce===message.nonce){captureWindows.delete(sender.tab?.id);await chrome.storage.session.remove(key);}
      }return;
    }
    if(message?.type==='capture-cancel'){
      const key=CAPTURE+sender.tab?.id, r=(await chrome.storage.session.get(key))[key];
      if(r?.nonce===message.nonce){await chrome.storage.session.remove(key);captureWindows.delete(sender.tab?.id);}return;
    }
    if(message?.type==='selection-review'){
      const record=selectionSessions.get(sender.tab?.id);
      if(!record||sender.frameId!==0||record.nonce!==message.nonce||!isFresh(record)||sender.documentId!==record.documentId)throw Error('선택 메뉴를 다시 켜 주세요.');
      const live=await chrome.tabs.get(sender.tab.id);
      if(live.url!==record.url||!live.active)throw Error('페이지가 변경되었습니다.');
      return review({kind:'text',text:message.text});
    }
    if(!ownPage)throw Error('확장프로그램 화면에서 실행해 주세요.');
    if(message?.type==='selection-menu'){
      const tab=await activeTab(),nonce=crypto.randomUUID();
      const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:installSelectionMenu,args:[nonce]});
      selectionSessions.set(tab.id,{nonce,url:tab.url,documentId:result.documentId,createdAt:Date.now()});
      return;
    }
    if(message?.type==='capture-start')return capture(await activeTab());
    if(message?.type==='selection'){
      const tab=await activeTab();
      const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
        const el=document.activeElement;
        if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable)return '';
        return window.getSelection()?.toString()||'';
      }});
      return review({kind:'text',text:result.result});
    }
    if(message?.type==='video')return review({kind:'video',url:(await activeTab()).url});
    throw Error('지원하지 않는 요청입니다.');
  };
  run().then(()=>respond({ok:true})).catch(error=>{
    respond({ok:false,error:String(error?.message||'실행하지 못했습니다.')});
    if(message?.type==='capture-finish')void showError(error);
  });
  return true;
});

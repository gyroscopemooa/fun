// Injected only after an explicit toolbar action. No persistent all-sites access.
export function installSelectionMenu(nonce) {
  globalThis.__manytoolSelectionCleanup?.();
  const host=document.createElement('div');
  host.style.cssText='position:fixed;z-index:2147483647;display:none';
  const root=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent='div{display:flex;gap:6px;padding:7px;background:#17223b;border-radius:10px;box-shadow:0 2px 12px #0005}button{font:13px sans-serif;background:white;color:#17223b;border:0;border-radius:5px;padding:8px;cursor:pointer}';
  const bar=document.createElement('div');
  const action=document.createElement('button');action.textContent='매니툴 · 번역/검색';
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','이 페이지 선택 메뉴 끄기');
  bar.append(action,close);root.append(style,bar);document.documentElement.append(host);
  let text='';
  const hide=()=>{host.style.display='none';text='';};
  const editable=node=>{const el=node?.nodeType===1?node:node?.parentElement;return !!el?.closest('input,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');};
  const selection=()=>{
    const s=window.getSelection();
    if(!s||!s.rangeCount||s.isCollapsed||editable(document.activeElement)||editable(s.anchorNode)||editable(s.focusNode)){hide();return;}
    const value=s.toString().trim();if(!value||value.length>3000){hide();return;}
    const rect=s.getRangeAt(0).getBoundingClientRect();
    if(!rect.width&&!rect.height){hide();return;}
    text=value;host.style.left=Math.max(4,Math.min(innerWidth-240,rect.left))+'px';
    host.style.top=Math.max(4,Math.min(innerHeight-55,rect.bottom+6))+'px';host.style.display='block';
  };
  const onUp=e=>{if(e.isTrusted)selection();};
  const onKey=e=>{if(e.key==='Escape')hide();else if(e.isTrusted&&e.key.startsWith('Arrow'))selection();};
  const cleanup=()=>{document.removeEventListener('mouseup',onUp);document.removeEventListener('keyup',onKey);window.removeEventListener('scroll',hide,true);window.removeEventListener('pagehide',cleanup);host.remove();delete globalThis.__manytoolSelectionCleanup;};
  action.addEventListener('mousedown',e=>e.preventDefault());
  action.addEventListener('click',async e=>{
    if(!e.isTrusted||!text)return;
    const chosen=text;hide();
    try{const result=await chrome.runtime.sendMessage({type:'selection-review',nonce,text:chosen});if(!result?.ok)cleanup();}catch{cleanup();}
  });
  close.addEventListener('click',e=>{if(e.isTrusted)cleanup();});
  document.addEventListener('mouseup',onUp);document.addEventListener('keyup',onKey);window.addEventListener('scroll',hide,true);window.addEventListener('pagehide',cleanup);
  globalThis.__manytoolSelectionCleanup=cleanup;
}

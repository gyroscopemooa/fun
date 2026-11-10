// Injected only after an explicit click/shortcut, in Chrome's isolated world.
export function selectRegion(nonce) {
  window.__manytoolCaptureCleanup?.();
  const abort = new AbortController();
  const layer = document.createElement('div');
  layer.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(15,23,42,.22);touch-action:none;';
  const shadow = layer.attachShadow({mode:'closed'});
  const help = document.createElement('div');
  help.textContent = '매니툴 · 저장할 영역을 드래그하세요. Esc: 취소';
  help.style.cssText = 'position:absolute;top:18px;left:50%;transform:translateX(-50%);padding:12px 18px;background:#0f172a;color:white;border-radius:12px;font:14px system-ui;pointer-events:none;white-space:nowrap';
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;border:2px solid #22d3ee;background:rgba(255,255,255,.15);pointer-events:none;box-sizing:border-box;display:none';
  shadow.append(help, box);
  const cleanup = () => {abort.abort();layer.remove();delete window.__manytoolCaptureCleanup;};
  window.__manytoolCaptureCleanup = cleanup;
  const cancel = () => {cleanup();void chrome.runtime.sendMessage({type:'capture-cancel', nonce}).catch(()=>{});};
  let start = null;
  const clamp = event => ({x:Math.max(0,Math.min(innerWidth,event.clientX)),y:Math.max(0,Math.min(innerHeight,event.clientY))});
  layer.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();event.stopPropagation();start=clamp(event);layer.setPointerCapture(event.pointerId);box.style.display='block';help.style.display='none';
  }, {signal:abort.signal});
  layer.addEventListener('pointermove', event => {
    if(!start)return;
    const p=clamp(event);Object.assign(box.style,{left:`${Math.min(p.x,start.x)}px`,top:`${Math.min(p.y,start.y)}px`,width:`${Math.abs(p.x-start.x)}px`,height:`${Math.abs(p.y-start.y)}px`});
  }, {signal:abort.signal});
  layer.addEventListener('pointerup', async event => {
    if(!start)return;
    event.preventDefault();event.stopPropagation();
    const p=clamp(event), rect={x:Math.min(p.x,start.x),y:Math.min(p.y,start.y),width:Math.abs(p.x-start.x),height:Math.abs(p.y-start.y)};
    const viewport={width:innerWidth,height:innerHeight};
    cleanup();
    if(rect.width<8 || rect.height<8){void chrome.runtime.sendMessage({type:'capture-cancel',nonce}).catch(()=>{});return;}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    try {await chrome.runtime.sendMessage({type:'capture-finish',nonce,rect,viewport});} catch {}
  }, {signal:abort.signal});
  layer.addEventListener('wheel', event=>event.preventDefault(),{passive:false,signal:abort.signal});
  document.addEventListener('keydown',event=>{event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')cancel();},{capture:true,signal:abort.signal});
  window.addEventListener('resize',cancel,{once:true,signal:abort.signal});
  window.addEventListener('blur',cancel,{once:true,signal:abort.signal});
  document.documentElement.append(layer);
  setTimeout(()=>{if(layer.isConnected)cancel();},60000);
}

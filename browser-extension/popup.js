const status=document.querySelector('#status');
for(const [id,type] of [['capture','capture-start'],['selection','selection'],['video','video'],['selectionMenu','selection-menu']]){
  document.getElementById(id).addEventListener('click',async()=>{
    const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status.textContent='준비 중입니다…';
    try{
      const result=await chrome.runtime.sendMessage({type});
      if(!result?.ok)throw Error(result?.error||'다시 시도해 주세요.');
      window.close();
    }catch(error){status.textContent=error.message;buttons.forEach(b=>b.disabled=false);}
  });
}
if(location.hash){
  const key='error:'+location.hash.slice(1);
  const record=(await chrome.storage.session.get(key))[key];
  await chrome.storage.session.remove(key);
  if(record)status.textContent=record.error;
}

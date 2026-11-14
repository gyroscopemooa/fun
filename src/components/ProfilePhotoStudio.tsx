import {useEffect,useRef,useState} from 'react';

type Options={purpose:string;background:string;expression:string;framing:string;ratio:string;retouch:string};
type Candidate={id:string;imageUrl:string};
const defaults:Options={purpose:'business',background:'gray',expression:'smile',framing:'shoulders',ratio:'portrait',retouch:'light'};
const backgrounds=[{id:'gray',label:'라이트 그레이',color:'#dedfe1'},{id:'ivory',label:'웜 아이보리',color:'#e9dfcc'},{id:'blue',label:'슬레이트 블루',color:'#71869e'},{id:'white',label:'클린 화이트',color:'#fff'}];
const purposes=[{id:'business',label:'비즈니스',detail:'회사 · LinkedIn',mark:'01'},{id:'resume',label:'취업 · 이력서',detail:'차분하고 신뢰감 있게',mark:'02'},{id:'social',label:'SNS · 개인 프로필',detail:'편안하고 자연스럽게',mark:'03'}];
const STORAGE='manytool:headshot-studio:v1';
export default function ProfilePhotoStudio({apiBase='https://api.manytool.net'}:{apiBase?:string}){
  const [options,setOptions]=useState<Options>(defaults),[outfit,setOutfit]=useState('current'),[source,setSource]=useState(''),[file,setFile]=useState<File|null>(null);
  const [config,setConfig]=useState<any>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('서버 연결 확인 중…'),[error,setError]=useState('');
  const [candidates,setCandidates]=useState<Candidate[]>([]),[selected,setSelected]=useState(''),[generatedOptions,setGeneratedOptions]=useState<Options|null>(null),[downloaded,setDownloaded]=useState('');
  const [photoId,setPhotoId]=useState(''),[orderId,setOrderId]=useState(''),[jobId,setJobId]=useState('');
  const [hydrated,setHydrated]=useState(false);
  const alive=useRef(true),objectUrl=useRef(''),activeController=useRef<AbortController|null>(null),running=useRef(false);
  const ready=Boolean(config?.readiness?.headshotReady&&config?.headshotOptionsVersion==='2026-11-15-v1');
  const paymentReady=config?.paymentMode==='mock'||Boolean(config?.paymentProducts?.base);
  const save=(patch:Record<string,unknown>={})=>{try{sessionStorage.setItem(STORAGE,JSON.stringify({options,outfit,photoId,orderId,jobId,generatedOptions,downloaded,...patch}));}catch{/* State recovery is optional; never persist the original image. */}};
  const absolute=(path:string)=>new URL(path,apiBase).href;
  const read=async(response:Response)=>{const data=await response.json();if(!response.ok)throw Error(data.error||'요청에 실패했습니다. 잠시 후 다시 시도해주세요.');return data;};
  const poll=async(id:string,signal?:AbortSignal)=>{
    const deadline=Date.now()+6*60*1000;
    while(alive.current&&Date.now()<deadline){
      const data=await read(await fetch(`${apiBase}/job/${encodeURIComponent(id)}`,{signal}));
      if(!alive.current)return;
      if(data.status==='failed'){
        setJobId('');
        if(data.creditRefunded){setOrderId('');save({orderId:'',jobId:''});}
        else save({jobId:''});
        throw Error(data.creditRefunded?'생성에 실패해 크레딧이 반환되었습니다. 새 주문으로 다시 시도해주세요.':'생성에 실패했습니다. 주문은 유지됩니다. 잠시 후 다시 시도해주세요.');
      }
      if(data.status==='done'){
        if(!Array.isArray(data.candidates)||!data.candidates.length)throw Error('생성 결과를 확인하지 못했습니다.');
        setCandidates(data.candidates);setSelected(data.candidates[0].id);setStatus('프로필 후보가 준비됐습니다. 한 장씩 크게 비교해보세요.');return;
      }
      await new Promise<void>((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,2000);const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};signal?.addEventListener('abort',abort,{once:true});});
    }
    if(alive.current)throw Error('생성이 지연되고 있습니다. 이 페이지를 다시 열면 같은 작업 상태를 이어서 확인할 수 있습니다. 중복 결제하지 마세요.');
  };
  useEffect(()=>{
    alive.current=true;setHydrated(true);const controller=new AbortController();
    void fetch(`${apiBase}/config`,{signal:controller.signal}).then(read).then(c=>{if(alive.current){setConfig(c);setStatus(c.readiness?.headshotReady?'프로필 스튜디오 연결됨':'프로필 생성 서버 준비 중입니다. 옵션을 먼저 둘러보세요.');}}).catch(e=>{if(e.name!=='AbortError'&&alive.current)setStatus('서버에 연결하지 못했습니다. 페이지를 새로고침해주세요.');});
    try{
      const saved=JSON.parse(sessionStorage.getItem(STORAGE)||'null');
      if(saved){setOptions({...defaults,...saved.options});setOutfit(saved.outfit||'current');setPhotoId(saved.photoId||'');setOrderId(saved.orderId||'');setJobId(saved.jobId||'');setGeneratedOptions(saved.generatedOptions||null);setDownloaded(saved.downloaded||'');
        if(saved.jobId){running.current=true;setBusy(true);activeController.current=controller;void poll(saved.jobId,controller.signal).catch(e=>{if(e.name!=='AbortError'&&alive.current)setError(e.message);}).finally(()=>{running.current=false;if(alive.current)setBusy(false);});}
      }
    }catch{sessionStorage.removeItem(STORAGE);}
    return()=>{alive.current=false;controller.abort();activeController.current?.abort();URL.revokeObjectURL(objectUrl.current);};
  },[]);
  useEffect(()=>{save();},[options,outfit,photoId,orderId,jobId,generatedOptions,downloaded]);
  const choose=(key:keyof Options,value:string)=>{if(busy||candidates.length)return;setOptions(v=>({...v,[key]:value}));};
  const pick=async(next?:File)=>{
    if(!next||busy||candidates.length)return;setError('');
    if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>12*1024*1024){setError('12MB 이하 JPG·PNG·WebP 사진을 선택해주세요.');return;}
    const url=URL.createObjectURL(next),img=new Image();
    try{await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=reject;img.src=url;});if(img.naturalWidth<300||img.naturalHeight<300)throw Error('얼굴이 잘 보이는 300px 이상의 사진을 선택해주세요.');URL.revokeObjectURL(objectUrl.current);objectUrl.current=url;setSource(url);setFile(next);setPhotoId('');setStatus('사진이 준비됐습니다. 원하는 분위기를 골라주세요.');}
    catch(e){URL.revokeObjectURL(url);setError(e instanceof Error?e.message:'사진을 열 수 없습니다.');}
  };
  const generate=async()=>{
    if(running.current||!ready||!paymentReady||(!file&&!photoId))return;
    running.current=true;setBusy(true);setError('');setStatus('사진과 주문을 확인하고 있습니다…');
    const controller=new AbortController();activeController.current=controller;let executionStarted=false;
    try{
      let id=photoId,order=orderId;
      if(!id){const form=new FormData();form.append('image',file!);form.append('sourceType','upload');const upload=await read(await fetch(`${apiBase}/upload`,{method:'POST',body:form,signal:controller.signal}));id=upload.photoId;setPhotoId(id);save({photoId:id});}
      if(order){const prior=await read(await fetch(`${apiBase}/order/${encodeURIComponent(order)}`,{signal:controller.signal}));
        if(prior.aiPhotoJobId){
          const existing=await read(await fetch(`${apiBase}/job/${encodeURIComponent(prior.aiPhotoJobId)}`,{signal:controller.signal}));
          if(existing.status!=='failed'){setJobId(prior.aiPhotoJobId);save({jobId:prior.aiPhotoJobId});await poll(prior.aiPhotoJobId,controller.signal);return;}
        }
        if(prior.status!=='paid'){if(prior.checkoutUrl){location.assign(prior.checkoutUrl);return;}throw Error('결제가 아직 확인되지 않았습니다. 결제 상태를 확인한 뒤 다시 눌러주세요.');}
      }
      if(!order){
        const checkoutFn=(window as any).manytoolCreditCheckout||fetch;
        const back=new URL(location.pathname,location.origin).href;
        const checkout=await read(await checkoutFn(`${apiBase}/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productType:'base',amount:990,currency:'USD',successUrl:back,returnUrl:back})}));
        if(!checkout.orderId)throw Error('주문을 확인하지 못했습니다.');order=checkout.orderId;setOrderId(order);save({photoId:id,orderId:order});
        if(!checkout.paid){if(!checkout.checkoutUrl)throw Error('결제 페이지를 열지 못했습니다.');location.assign(checkout.checkoutUrl);return;}
      }
      setStatus('선택한 스타일로 프로필 후보 3장을 만드는 중입니다. 최대 몇 분 걸릴 수 있습니다.');
      setGeneratedOptions({...options});save({photoId:id,orderId:order,generatedOptions:{...options}});
      executionStarted=true;
      const result=await read(await fetch(`${apiBase}/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoId:id,orderId:order,toolType:'headshot',outfitType:outfit,profileOptions:options}),signal:controller.signal}));
      setJobId(result.jobId);save({photoId:id,orderId:order,jobId:result.jobId,generatedOptions:{...options}});
      await poll(result.jobId,controller.signal);
    }catch(e){if(e instanceof Error&&e.name!=='AbortError'){setError(e.message);setStatus(executionStarted?'다시 시도하기 전에 주문·작업 상태를 확인합니다.':'사진과 결제 상태를 확인해주세요.');}}
    finally{running.current=false;if(alive.current)setBusy(false);}
  };
  const download=async()=>{
    if(!selected||busy||(downloaded&&downloaded!==selected))return;setBusy(true);setError('');
    try{const response=await fetch(`${apiBase}/download/${encodeURIComponent(selected)}`);if(!response.ok)throw Error('다운로드에 실패했습니다. 같은 결과로 다시 시도해주세요.');const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('이미지 파일을 확인하지 못했습니다.');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`manytool-profile-${generatedOptions?.ratio==='square'?'1000x1000':'800x1000'}.jpg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setDownloaded(selected);setStatus('선택한 프로필사진을 저장했습니다. 이 탭에서는 같은 파일을 다시 저장할 수 있습니다.');}
    catch(e){setError(e instanceof Error?e.message:'다운로드에 실패했습니다.');}finally{setBusy(false);}
  };
  const reset=()=>{if(busy)return;if(candidates.length&&!window.confirm('현재 후보를 닫고 새 프로필을 준비할까요? 새 생성은 별도 결제가 필요합니다.'))return;setCandidates([]);setSelected('');setJobId('');setOrderId('');setPhotoId('');setFile(null);setSource('');setGeneratedOptions(null);setDownloaded('');setError('');setStatus('새 사진과 스타일을 선택해주세요.');URL.revokeObjectURL(objectUrl.current);sessionStorage.removeItem(STORAGE);};
  const current=candidates.find(v=>v.id===selected);
  const locked=!hydrated||busy||candidates.length>0;
  const label=(items:{id:string;label:string}[],id:string)=>items.find(v=>v.id===id)?.label||id;
  const select=(key:keyof Options,title:string,items:[string,string][])=> <fieldset disabled={Boolean(locked)} className="profile-option"><legend>{title}</legend><div className="profile-pill-options">{items.map(([value,text])=><button type="button" key={value} aria-pressed={options[key]===value} onClick={()=>choose(key,value)}>{text}</button>)}</div></fieldset>;
  return <div className="profile-workbench" data-profile-studio>
    <section className="profile-controls" aria-labelledby="profile-style-title">
      <div className="purpose-section-title"><span>01</span><div><h2 id="profile-style-title">어디에서 쓰실 사진인가요?</h2><p>같은 얼굴, 용도에 맞는 분위기.</p></div></div>
      <fieldset disabled={Boolean(locked)} className="profile-purpose-options"><legend className="sr-only">사용 목적</legend>{purposes.map(p=><button key={p.id} type="button" aria-pressed={options.purpose===p.id} onClick={()=>choose('purpose',p.id)}><small>{p.mark}</small><strong>{p.label}</strong><span>{p.detail}</span></button>)}</fieldset>
      <label className="profile-upload">{source?<img src={source} alt="선택한 원본 사진"/>:<span className="profile-upload-symbol" aria-hidden="true">＋</span>}<span><strong>{photoId&&!file?'이전에 업로드한 사진으로 이어서 준비':'내 사진 선택'}</strong><small>정면에 가까운 사진 · JPG/PNG/WebP · 최대 12MB</small></span><input id="profile-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(locked)} onChange={e=>void pick(e.target.files?.[0])}/></label>
      <fieldset disabled={Boolean(locked)} className="profile-option"><legend>배경의 분위기</legend><div className="profile-backgrounds">{backgrounds.map(b=><button type="button" key={b.id} aria-label={b.label} aria-pressed={options.background===b.id} onClick={()=>choose('background',b.id)}><span style={{background:b.color}}/><small>{b.label}</small></button>)}</div></fieldset>
      <fieldset disabled={Boolean(locked)} className="profile-option"><legend>의상</legend><div className="profile-pill-options">{[['current','현재 옷 유지'],['suit','비즈니스 정장'],['smart','스마트 캐주얼']].map(([id,text])=><button type="button" key={id} aria-pressed={outfit===id} onClick={()=>setOutfit(id)}>{text}</button>)}</div></fieldset>
      {select('expression','표정',[['smile','자연스러운 미소'],['neutral','차분한 표정']])}
      {select('framing','구도',[['shoulders','얼굴 · 어깨 중심'],['upper','여유 있는 상반신']])}
      {select('ratio','사용할 비율',[['portrait','세로 4:5'],['square','정사각 1:1']])}
      {select('retouch','보정',[['light','가벼운 피부 · 조명 정리'],['off','원래 피부 유지']])}
      <div className="profile-purchase"><div><strong>$9.90</strong><span>후보 3장 생성 · 최종 1장 저장<br/>옵션 추가 비용 없음 · 최종 결제 금액은 결제 화면에서 확인</span></div><button id="profile-generate" className="purpose-primary" disabled={Boolean(!ready||!paymentReady||(!file&&!photoId)||locked)} onClick={()=>void generate()}>{busy?'프로필 준비 중…':orderId?'결제 확인하고 이어서 생성':'결제하고 프로필 3장 생성'}<span>↗</span></button><p className="purpose-fine">본인 사진 또는 처리 권한이 있는 사진을 사용해주세요. AI 편집 결과이며 여권·신분증 제출용이 아닙니다.</p></div>
      {(candidates.length>0||orderId)&&<button type="button" className="profile-reset" disabled={busy} onClick={reset}>새 프로필 준비하기</button>}
    </section>
    <section className="profile-results" aria-labelledby="profile-result-title"><div className="profile-result-heading"><div><span>프로필 미리보기</span><h2 id="profile-result-title">생성한 사진을 비교해보세요</h2></div><span className="profile-result-count">{candidates.length?`${candidates.length}개의 후보`:'생성 전 미리보기'}</span></div>
      {current?<><div className="profile-selected-image" style={{aspectRatio:generatedOptions?.ratio==='square'?'1':'4/5'}}><img src={absolute(current.imageUrl)} alt="선택한 AI 프로필 생성 결과"/><span>AI 생성 결과</span></div><div className="profile-candidates">{candidates.map((c,i)=><button key={c.id} type="button" disabled={Boolean(downloaded&&downloaded!==c.id)} aria-label={`프로필 후보 ${i+1}`} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}><img src={absolute(c.imageUrl)} alt={`프로필 후보 ${i+1}`}/><span>0{i+1}</span></button>)}</div><button id="profile-download" className="purpose-primary" disabled={busy} onClick={()=>void download()}>{downloaded?'선택한 사진 다시 저장':'선택한 프로필사진 저장'}<span>↓</span></button><p className="purpose-fine">{generatedOptions?.ratio==='square'?'1000×1000px 정사각':'800×1000px 세로'} JPG · 선택한 결과 1장</p></>:<><div className="profile-visual-preview" style={{background:backgrounds.find(b=>b.id===options.background)?.color,aspectRatio:options.ratio==='square'?'1':'4/5'}}>{source?<img src={source} alt="원본 사진의 구도 참고 미리보기" style={{objectFit:'contain'}}/>:<div className="profile-silhouette" aria-hidden="true"><div/><span/></div>}<span className="profile-preview-caption">{source?'원본 사진 · 생성 전 구도 참고':'배경색 · 비율 선택 미리보기'}</span></div><p className="purpose-fine">생성 전 미리보기는 합성 결과가 아닙니다. 선택한 배경·의상·표정·구도는 실제 생성 시 반영됩니다.</p><div className="profile-preview-spec"><span>{label(purposes,options.purpose)}</span><span>{label(backgrounds,options.background)}</span><span>{options.ratio==='square'?'1:1 정사각':'4:5 세로'}</span><span>{options.expression==='smile'?'자연스러운 미소':'차분한 표정'}</span></div></>}
      <div className={busy?'profile-live-status is-busy':'profile-live-status'} role="status" aria-live="polite"><span/>{status}</div>{error&&<p className="purpose-error" role="alert">{error}</p>}
      {!ready&&config&&<p className="purpose-fine">프로필 전용 옵션을 지원하는 서버가 준비되어야 결제와 생성이 열립니다. 증명사진 모드로 대신 생성하지 않습니다.</p>}
    </section>
  </div>;
}

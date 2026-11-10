import { useEffect, useRef, useState } from 'react';
import { listenForExtensionImport } from '../lib/extension/import';
import type { VideoPlatform } from '../data/video-tools';
type Job = {id?:string;state:string;title?:string;size?:number;extension?:string;duration?:number;message?:string;expiresAt?:number};
export default function VideoDownloader({ platform, placeholder }: {platform:VideoPlatform;placeholder:string}) {
  const [url,setUrl]=useState('');
  const [job,setJob]=useState<Job|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState<boolean|null>(null);
  const [expired,setExpired]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const extensionImported=useRef(false);
  const api='/api/video';
  useEffect(()=>{
    const abort=new AbortController();
    fetch(`${api}/health`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();setReady(data.ready===true);}).catch(()=>{if(!abort.signal.aborted)setReady(false);});
    return ()=>{abort.abort();controller.current?.abort();};
  },[]);
  useEffect(()=>{
    if(!job?.expiresAt || job.state!=='ready')return;
    setExpired(false);
    const timer=setTimeout(()=>setExpired(true),Math.max(0,job.expiresAt-Date.now()));
    return ()=>clearTimeout(timer);
  },[job]);
  useEffect(()=>{if(extensionImported.current)return;return listenForExtensionImport('video',payload=>{
    if(extensionImported.current||payload.kind!=='video'||busy||url||job)return false;
    extensionImported.current=true;setUrl(payload.url);return true;
  });},[busy,url,job]);
  async function start(e:React.FormEvent) {
    e.preventDefault();setError('');setJob(null);setExpired(false);
    let parsed:URL;
    try{parsed=new URL(url.trim());if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error();}
    catch{setError('HTTPS로 시작하는 영상 링크를 입력해주세요.');return;}
    controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);
    const timeout=setTimeout(()=>abort.abort('timeout'),240000);
    try {
      const response=await fetch(`${api}/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:parsed.href,platform}),signal:abort.signal});
      const result=await response.json().catch(()=>({error:'다운로드 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'}));
      if(!response.ok)throw Error(result.error);
      if(typeof result.id!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(result.id))throw Error('서버 응답을 확인할 수 없습니다.');
      const id=result.id;setJob({id,state:'processing'});
      while(!abort.signal.aborted){
        await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',cancel);resolve();},3000);const cancel=()=>{clearTimeout(timer);reject(new Error('요청이 종료되었습니다.'));};abort.signal.addEventListener('abort',cancel,{once:true});});
        const status=await fetch(`${api}/jobs/${id}`,{signal:abort.signal,cache:'no-store'});
        const data=await status.json();if(!status.ok)throw Error(data.error||'작업 상태를 확인할 수 없습니다.');
        setJob({...data,id});if(data.state==='failed')throw Error(data.message);if(data.state==='ready')break;
      }
    } catch(e){setJob(null);setError(abort.signal.aborted?'처리 대기 시간이 끝났습니다. 잠시 후 다시 시도해주세요.':e instanceof Error?e.message:'영상 준비에 실패했습니다.');}
    finally{clearTimeout(timeout);setBusy(false);}
  }
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    <form onSubmit={start}><label htmlFor="video-url" className="text-sm font-bold text-slate-900">영상 링크</label><input id="video-url" type="url" required maxLength={2048} value={url} onChange={e=>setUrl(e.target.value)} placeholder={placeholder} disabled={busy} autoComplete="off" className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"/><button disabled={busy||ready!==true} className="mt-4 w-full rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{busy?'영상 파일 준비 중…':ready===null?'서버 확인 중…':ready===false?'다운로드 서버 연결 대기':'영상 파일 준비하기'}</button></form>
    {ready===false&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">현재 다운로드 서버에 연결할 수 없습니다. 잠시 후 페이지를 새로고침해주세요.</p>}
    <p className="mt-4 text-xs leading-6 text-slate-500">최대 300MB · {platform==='direct'?'원본 형식·해상도 유지':'30분 이하 · 최대 720p'} · 준비된 파일은 최대 10분간 보관됩니다. 서비스가 제공하는 형식에 따라 품질이 달라집니다.</p>
    {busy&&<div role="status" className="mt-5 rounded-2xl bg-cyan-50 p-5 text-sm leading-6 text-cyan-900"><span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-cyan-500"/>원본 영상을 확인하고 파일을 준비합니다. 최대 3분 정도 걸릴 수 있습니다. 이 화면에서 기다려주세요.</div>}
    {!!error&&<p role="alert" className="mt-5 rounded-2xl bg-rose-50 p-5 text-sm leading-6 text-rose-800">{error}</p>}
    {job?.state==='ready'&&<div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold text-emerald-700">파일 준비 완료</p><h2 className="mt-2 break-words text-lg font-bold">{job.title}</h2><p className="mt-2 text-sm text-slate-600">{job.extension?.toUpperCase()} · {((job.size||0)/1024/1024).toFixed(1)}MB{job.duration?` · ${Math.floor(job.duration/60)}분 ${Math.round(job.duration%60)}초`:''}</p>{expired?<p className="mt-4 text-sm text-rose-700">다운로드 링크가 만료되었습니다. 다시 준비해주세요.</p>:<a href={`${api}/jobs/${job.id}/file`} download rel="noreferrer" className="mt-5 inline-block rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">영상 다운로드</a>}<p className="mt-3 text-xs text-slate-500">파일을 저장한 뒤 다른 곳에 재게시할 때는 원작자의 이용 허락을 확인해주세요.</p></div>}
    <p className="mt-6 border-t pt-4 text-xs leading-6 text-slate-500">본인 소유 또는 저장 권한이 있는 영상에 이용해주세요. 비공개·유료·DRM·로그인 제한을 우회하지 않으며 원본 사이트 상태에 따라 다운로드가 실패할 수 있습니다.</p>
  </section>;
}

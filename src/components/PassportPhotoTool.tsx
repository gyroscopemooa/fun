import {useEffect,useRef,useState} from 'react';
import {passportCrop,headLengthMm,jpegWith300Dpi} from '../lib/passport-photo';

const checks=[
  '6개월 이내 촬영한 원본 사진이며 AI 생성·합성·미용 보정을 하지 않았습니다.',
  '실제 촬영한 배경이 균일한 흰색이고 얼굴·배경에 그림자가 없습니다.',
  '얼굴과 어깨가 정면이며 입을 다문 무표정이고 두 눈이 잘 보입니다.',
  '머리카락이 눈썹·이마·광대·볼 등 얼굴 윤곽을 가리지 않습니다.',
  '안경 반사·색 렌즈·모자·얼굴을 가리는 장신구가 없습니다.',
  '가이드가 정수리(머리카락 부피 제외)와 턱 끝에 맞고 사진이 선명합니다.'
];
export default function PassportPhotoTool(){
  const canvas=useRef<HTMLCanvasElement>(null),image=useRef<HTMLImageElement|null>(null),objectUrl=useRef('');
  const [name,setName]=useState(''),[size,setSize]=useState({w:0,h:0}),[zoom,setZoom]=useState(1),[x,setX]=useState(0),[y,setY]=useState(0);
  const [crown,setCrown]=useState(9),[chin,setChin]=useState(84),[confirmed,setConfirmed]=useState<boolean[]>(checks.map(()=>false));
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [hydrated,setHydrated]=useState(false);
  const mm=headLengthMm(crown,chin),headOk=mm>=32&&mm<=36;
  const geometry=size.w?passportCrop(size.w,size.h,zoom,x/100,y/100):null;
  const resolutionOk=Boolean(geometry&&geometry.scale<=1);
  const canDownload=Boolean(name&&headOk&&resolutionOk&&confirmed.every(Boolean)&&!busy);
  useEffect(()=>{setHydrated(true);return()=>{URL.revokeObjectURL(objectUrl.current);};},[]);
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx||!image.current||!geometry)return;
    ctx.clearRect(0,0,413,531);ctx.drawImage(image.current,geometry.x,geometry.y,geometry.width,geometry.height);
  },[size,zoom,x,y]);
  const pick=async(file?:File)=>{
    if(!file)return;setError('');setMessage('');setConfirmed(checks.map(()=>false));
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){setError('20MB 이하 JPG·PNG·WebP 사진을 선택해주세요. HEIC는 JPG로 변환한 뒤 이용해주세요.');return;}
    const url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=reject;img.src=url;});
      if(img.naturalWidth>16000||img.naturalHeight>16000)throw Error('사진 한 변이 16,000px 이하인 파일을 사용해주세요.');
      const check=document.createElement('canvas');check.width=16;check.height=16;const ctx=check.getContext('2d')!;ctx.drawImage(img,0,0,16,16);
      if(ctx.getImageData(0,0,16,16).data.some((v,i)=>i%4===3&&v<255))throw Error('투명 배경 사진은 사용할 수 없습니다. 흰 배경에서 촬영한 원본을 선택해주세요.');
      URL.revokeObjectURL(objectUrl.current);objectUrl.current=url;image.current=img;setSize({w:img.naturalWidth,h:img.naturalHeight});setName(file.name);setZoom(1);setX(0);setY(0);setCrown(9);setChin(84);setConfirmed(checks.map(()=>false));
    }catch(e){URL.revokeObjectURL(url);setError(e instanceof Error?e.message:'사진을 열지 못했습니다. 다른 JPG 파일을 선택해주세요.');}
  };
  const save=async()=>{
    if(!canDownload||!canvas.current)return;setBusy(true);setError('');setMessage('');
    try{
      let blob:Blob|null=null;
      for(const quality of [.96,.9,.82,.72,.6,.45]){blob=await new Promise<Blob|null>(r=>canvas.current!.toBlob(r,'image/jpeg',quality));if(blob&&blob.size<=500*1024)break;}
      if(!blob||blob.size>500*1024)throw Error('파일을 저장하지 못했습니다. 다시 시도해주세요.');
      const bytes=jpegWith300Dpi(new Uint8Array(await blob.arrayBuffer()));const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'image/jpeg'}));
      const a=document.createElement('a');a.href=url;a.download='manytool-passport-413x531.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      setMessage('413×531px JPG를 저장했습니다. 가이드 선은 파일에 포함되지 않습니다. 외교부 사진 검증에서 한 번 더 확인해주세요.');
    }catch(e){setError(e instanceof Error?e.message:'저장에 실패했습니다.');}finally{setBusy(false);}
  };
  return <div className="passport-workbench" data-passport-tool>
    <section className="passport-editor" aria-labelledby="passport-edit-title">
      <div className="purpose-section-title"><span>01</span><div><h2 id="passport-edit-title">원본을 올리고, 프레임에 맞추세요</h2><p>얼굴·머리·배경을 바꾸지 않고 비율과 크기만 조정합니다.</p></div></div>
      <label className="passport-upload">사진 선택<input id="passport-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={!hydrated} onChange={e=>void pick(e.target.files?.[0])}/><span>{name||'JPG · PNG · WebP / 최대 20MB'}</span></label>
      <div className="passport-canvas-area">
        <div className="passport-frame">
          <canvas ref={canvas} width="413" height="531" aria-label="413×531 여권사진 자르기 미리보기"/>
          {!name&&<div className="passport-empty"><span aria-hidden="true">▤</span><strong>흰 배경에서 촬영한 원본</strong><p>사진을 선택하면 여기에 표시됩니다.</p></div>}
          {name&&<><div className="passport-guide-line" style={{top:`${crown}%`}}><span>정수리</span></div><div className="passport-guide-line" style={{top:`${chin}%`}}><span>턱 끝</span></div><div className="passport-center-line"/></>}
        </div>
        <div className="passport-dimension">35mm × 45mm · 저장 413 × 531px</div>
      </div>
      <div className="passport-sliders"><label>사진 확대 <output>{zoom.toFixed(2)}배</output><input aria-label="사진 확대" type="range" min="1" max="3" step=".01" value={zoom} disabled={!name} onChange={e=>{setZoom(+e.target.value);setConfirmed(checks.map(()=>false));}}/></label><label>좌우 위치<input aria-label="좌우 위치" type="range" min="-100" max="100" value={x} disabled={!name} onChange={e=>{setX(+e.target.value);setConfirmed(checks.map(()=>false));}}/></label><label>상하 위치<input aria-label="상하 위치" type="range" min="-100" max="100" value={y} disabled={!name} onChange={e=>{setY(+e.target.value);setConfirmed(checks.map(()=>false));}}/></label></div>
      <details className="passport-measure" open><summary>정수리와 턱 끝 가이드 맞추기</summary><p>자동 얼굴 인식이 아닙니다. 사진 속 정수리와 턱 끝에 두 선을 직접 맞추세요. 확대·위치를 바꿨다면 다시 확인하세요.</p><label>정수리 선<input aria-label="정수리 선" type="range" min="0" max="30" step=".5" value={crown} disabled={!name} onChange={e=>{setCrown(+e.target.value);setConfirmed(checks.map(()=>false));}}/></label><label>턱 끝 선<input aria-label="턱 끝 선" type="range" min="60" max="100" step=".5" value={chin} disabled={!name} onChange={e=>{setChin(+e.target.value);setConfirmed(checks.map(()=>false));}}/></label><p className={headOk?'measure-ok':'measure-alert'}>수동 가이드 기준 머리 길이 {mm.toFixed(1)}mm · 권장 32–36mm</p></details>
      {name&&!resolutionOk&&<p className="purpose-error">현재 자르기 영역의 원본 해상도가 부족합니다. 확대를 줄이거나 더 큰 원본을 사용해주세요.</p>}
    </section>
    <aside className="passport-checklist" aria-labelledby="passport-check-title"><div className="purpose-section-title"><span>02</span><div><h2 id="passport-check-title">저장 전, 직접 확인해주세요</h2><p>확인 목록이며 공식 적합 판정은 아닙니다.</p></div></div>
      <div className="passport-ear-note"><strong>양쪽 귀를 반드시 드러낼 필요는 없습니다.</strong><p>귀를 새로 만들거나 머리카락을 합성하지 않습니다. 눈썹과 이마·광대·볼 등 얼굴 윤곽이 가려지지 않도록 촬영하세요.</p></div>
      <div className="passport-check-items">{checks.map((text,i)=><label key={text}><input type="checkbox" checked={confirmed[i]} disabled={!name} onChange={e=>setConfirmed(values=>values.map((v,j)=>j===i?e.target.checked:v))}/><span>{text}</span></label>)}</div>
      <button id="passport-download" className="purpose-primary passport-save" disabled={!canDownload} onClick={()=>void save()}>{busy?'JPG 준비 중…':'규격 JPG 무료 저장'}<span>↓</span></button>
      <p className="purpose-fine">413×531px · JPG · 500KB 이하 · 인화 밀도 300dpi<br/>가이드 선 제외 · 사진 내용 보정 없음</p>
      <div role="status" aria-live="polite">{error&&<p className="purpose-error">{error}</p>}{message&&<p className="purpose-success">{message}</p>}</div>
      <a className="passport-official-link" href="https://www.passport.go.kr/home/kor/onlinePhotoVerify/index.do?menuPos=33" target="_blank" rel="noopener noreferrer">외교부 공식 사진 검증으로 확인 ↗</a>
      <p className="purpose-fine">파일 크기를 맞춰도 사진 내용에 따라 반려될 수 있습니다. 최종 판단은 여권 발급 기관이 합니다.</p>
    </aside>
  </div>;
}

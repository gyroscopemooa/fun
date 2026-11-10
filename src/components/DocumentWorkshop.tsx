import { useEffect, useRef, useState } from 'react';
import { MAX_TEXT } from '../lib/document-tools/text';
import { saveDocument } from '../lib/document-tools/export';
import './document-workshop.css';
import { nativeCapabilities, saveTextWithNative, shareTextWithNative, type NativeCapabilities } from '../lib/manytool-native';
import { captureFile, listenForExtensionImport } from '../lib/extension/import';

type Mode = 'photo' | 'voice' | 'translate';
const modes = [ ['photo', '/photo-to-document', '사진으로 문서 만들기'], ['voice', '/voice-to-document', '말해서 문서 만들기'], ['translate', '/text-translator', '글·음성 번역'] ] as const;

export default function DocumentWorkshop({ mode }: { mode: Mode }) {
  const [native, setNative] = useState<NativeCapabilities | null>(null);
  const [nativeBusy, setNativeBusy] = useState(false);
  useEffect(() => { let live = true; void nativeCapabilities().then(value => { if (live) setNative(value); }); return () => { live = false; }; }, []);
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [title, setTitle] = useState('매니툴 문서');
  const [language, setLanguage] = useState('ko');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState('파일을 선택하거나 아래에 글을 직접 입력해 시작하세요.');
  const [error, setError] = useState('');
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const worker = useRef<Worker | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const mounted = useRef(true);
  const extensionImported = useRef(false);

  const stopTracks = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; worker.current?.terminate(); if (recorder.current) recorder.current.onstop = null; stopTracks(); };
  }, []);
  useEffect(() => {
    if (!file || mode !== 'photo') { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, mode]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (source || result || recording || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [source, result, recording, busy]);

  useEffect(() => {
    if (mode === 'voice' || extensionImported.current) return;
    return listenForExtensionImport(mode === 'photo' ? 'image' : 'text', payload => {
      // Never replace work already entered, or start processing automatically.
      if (extensionImported.current || active.current || busy || recording || source || result || file) return false;
      try {
        if (mode === 'photo' && payload.kind === 'image') setFile(captureFile(payload.dataUrl));
        else if (mode === 'translate' && payload.kind === 'text') setSource(payload.text);
        else return false;
        extensionImported.current = true;
        setMessage('매니툴 확장에서 가져왔습니다. 내용을 확인하고 실행 버튼을 눌러 주세요.');
        return true;
      } catch { return false; }
    });
  }, [mode, busy, recording, source, result, file]);

  function cancel() {
    generation.current++;
    worker.current?.terminate(); worker.current = null;
    active.current = false; setBusy(false); setMessage('작업을 취소했습니다. 기존 글은 그대로 남아 있습니다.');
  }
  function launch(payload: Record<string, unknown>, onDone: (text: string) => void) {
    worker.current?.terminate();
    const w = new Worker(new URL('../lib/document-tools/processing.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const finish = () => { w.terminate(); if (worker.current === w) worker.current = null; active.current = false; setBusy(false); };
    w.onmessage = ({ data }) => {
      if (worker.current !== w) return;
      if (data.type === 'progress') setMessage(data.message);
      else if (data.type === 'done') {
        finish();
        if (!data.text) { setError('읽을 수 있는 글을 찾지 못했습니다. 더 선명한 사진이나 또렷한 음성으로 다시 시도해 주세요.'); return; }
        onDone(data.text); setMessage('완료했습니다. 내용을 확인하고 수정한 뒤 저장하세요.');
      } else { finish(); setError(data.message); }
    };
    w.onerror = () => { finish(); setError('실행에 실패했습니다. 새로고침한 뒤 최신 Chrome 또는 Edge에서 다시 시도해 주세요.'); };
    w.postMessage(payload);
  }
  async function run(kind: 'photo' | 'voice' | 'translate', input?: Blob) {
    if (active.current) return;
    active.current = true; setBusy(true); setError(''); setMessage('준비 중입니다…');
    const id = ++generation.current;
    try {
      if (kind === 'photo') {
        if (!file) throw new Error('사진을 먼저 선택해 주세요.');
        const bitmap = await createImageBitmap(file);
        let blob: Blob | null;
        try {
          if (bitmap.width * bitmap.height > 40000000) throw new Error('사진 크기가 너무 큽니다. 4천만 화소 이하의 사진을 선택해 주세요.');
          const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
          const context = canvas.getContext('2d'); if (!context) throw new Error('이 브라우저에서 사진을 열 수 없습니다.');
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        } finally { bitmap.close(); }
        if (id !== generation.current) return;
        if (!blob) throw new Error('사진을 열 수 없습니다. JPG 또는 PNG로 다시 시도해 주세요.');
        launch({ kind, image: blob }, text => setResult(old => old ? `${old}\n\n${text}` : text));
      } else if (kind === 'voice') {
        const audioFile = input || file;
        if (!audioFile) throw new Error('녹음하거나 음성 파일을 선택해 주세요.');
        if (audioFile.size > 30 * 1048576) throw new Error('음성 파일은 30MB 이하로 선택해 주세요.');
        const context = new AudioContext();
        let audio: Float32Array;
        try {
          const decoded = await context.decodeAudioData(await audioFile.arrayBuffer());
          if (decoded.duration > 120) throw new Error('2분 이하의 음성 파일을 선택해 주세요. 긴 녹음은 나누어 올려 주세요.');
          const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
          const node = offline.createBufferSource(); node.buffer = decoded; node.connect(offline.destination); node.start();
          audio = (await offline.startRendering()).getChannelData(0).slice();
        } finally { await context.close(); }
        if (id !== generation.current) return;
        launch({ kind, audio, language }, text => mode === 'translate'
          ? setSource(old => old ? `${old}\n${text}` : text)
          : setResult(old => old ? `${old}\n\n${text}` : text));
      } else {
        if (!source.trim()) throw new Error('번역할 글을 입력해 주세요.');
        if (source.length > MAX_TEXT) throw new Error(`한 번에 ${MAX_TEXT.toLocaleString()}자까지 번역할 수 있어요. 글을 나누어 주세요.`);
        launch({ kind, text: source, source: language }, setResult);
      }
    } catch (e) {
      if (id !== generation.current) return;
      active.current = false; setBusy(false);
      setError(e instanceof Error ? e.message : '파일을 읽지 못했습니다. 지원하는 형식인지 확인해 주세요.');
    }
  }
  async function startRecording() {
    if (active.current || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('이 브라우저에서는 녹음을 지원하지 않습니다. 휴대폰 녹음 앱에서 저장한 파일을 올려 주세요.'); return; }
    active.current = true; setBusy(true); setError(''); setMessage('마이크 사용 권한을 확인하고 있습니다.');
    const id = ++generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || id !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const rec = new MediaRecorder(media); recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onerror = () => { rec.onstop = null; stopTracks(); active.current = false; setRecording(false); setBusy(false); setError('녹음이 중단되었습니다. 다시 녹음하거나 파일을 올려 주세요.'); };
      rec.onstop = () => {
        stopTracks(); active.current = false; setRecording(false); setBusy(false);
        if (!mounted.current) return;
        const recorded = new File(chunks, '녹음', { type: rec.mimeType });
        setFile(recorded); setMessage('녹음이 준비되었습니다. ‘음성을 글로 바꾸기’를 눌러 주세요.');
      };
      rec.start(); active.current = false; setBusy(false); setRecording(true); setSeconds(0); setMessage('녹음 중입니다. 최대 60초 후 자동으로 멈춥니다.');
      let elapsed = 0;
      timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 60 && rec.state === 'recording') rec.stop(); }, 1000);
    } catch { stopTracks(); if (id === generation.current) { active.current = false; setBusy(false); setError('마이크를 사용할 수 없습니다. 브라우저의 마이크 권한을 허용하거나 녹음 파일을 올려 주세요.'); } }
  }
  async function chooseFile(selected?: File) {
    if (!selected) return;
    setError('');
    if (selected.size > (mode === 'photo' ? 15 : 30) * 1048576) { setError(mode === 'photo' ? '사진은 15MB 이하로 선택해 주세요.' : '파일은 30MB 이하로 선택해 주세요.'); return; }
    if (mode === 'photo' && !/\.(png|jpe?g|webp)$/i.test(selected.name)) { setError('JPG, PNG, WebP 사진을 선택해 주세요.'); return; }
    setFile(selected); setMessage(`${selected.name} 준비 완료`);
  }
  async function readText(selected?: File) {
    if (!selected) return;
    setError('');
    try {
      if (!/\.txt$/i.test(selected.name) || selected.size > 100000) throw new Error('100KB 이하의 UTF-8 TXT 파일을 선택해 주세요.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await selected.arrayBuffer());
      setSource(text.replace(/^\uFEFF/, '')); setMessage('글을 불러왔습니다. 원문 언어를 확인해 주세요.');
    } catch (e) { setError(e instanceof Error ? e.message : '파일을 읽지 못했습니다.'); }
  }
  async function download(format: 'txt' | 'docx') {
    try { setError(''); await saveDocument(result, title, format); setMessage('다운로드를 시작했습니다.'); }
    catch { setError('파일을 저장하지 못했습니다. 글을 복사하거나 다시 시도해 주세요.'); }
  }
  async function nativeExport(share: boolean) {
    if (nativeBusy) return;
    setNativeBusy(true); setError('');
    try {
      await (share ? shareTextWithNative(result) : saveTextWithNative(result));
      if (mounted.current) setMessage(share ? '공유창을 열었습니다. 받을 앱과 대상을 선택해 주세요.' : '저장창을 열었습니다. 저장 위치를 선택해 주세요.');
    } catch (e) {
      if (mounted.current) {
        if (e instanceof Error && e.message === 'cancelled') setMessage('취소했습니다.');
        else setError('앱 연결을 완료하지 못했습니다. 다시 시도하거나 TXT 저장을 이용해 주세요.');
      }
    } finally { if (mounted.current) setNativeBusy(false); }
  }
  const locked = busy || recording;
  return <div className="document-workshop">
    <nav aria-label="문서 도구" className="dw-tabs">{modes.map(([key, href, label]) => <a key={key} href={href} aria-current={mode === key ? 'page' : undefined}>{label}</a>)}</nav>
    <div className="dw-grid">
      <section className="dw-panel">
        <p className="dw-step">01 · 가져오기</p>
        <h2>{mode === 'photo' ? '사진 속 글자를 가져오세요' : mode === 'voice' ? '말한 내용을 글로 남기세요' : '짧은 글부터 번역해 보세요'}</h2>
        <p className="dw-note">별도 프로그램 설치 없이 실행합니다. 처음에는 필요한 파일을 내려받으므로 Wi-Fi 사용을 권장합니다. {mode === 'photo' ? '선명한 인쇄 글자에 적합하며 손글씨·표는 정확하지 않을 수 있어요.' : '기기 성능에 따라 시간이 걸리거나 실행이 어려울 수 있어요.'}</p>
        {mode !== 'photo' && <label className="dw-label">{mode === 'translate' ? '원문·음성 언어' : '말하는 언어'}<select disabled={locked} value={language} onChange={e => setLanguage(e.target.value)}><option value="ko">한국어{mode === 'translate' ? ' → 영어' : ''}</option><option value="en">영어{mode === 'translate' ? ' → 한국어' : ''}</option></select></label>}
        {mode === 'photo' ? <>
          <label className="dw-upload">사진 선택 · 휴대폰에서는 촬영도 가능<input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }} /><span>JPG · PNG · WebP / 최대 15MB</span></label>
          {preview && <img className="dw-preview" src={preview} alt="선택한 사진 미리보기" />}
          <button className="dw-primary" disabled={locked || !file} onClick={() => void run('photo')}>사진 속 글자 가져오기</button>
        </> : <>
          {mode === 'translate' && <>
            <label className="dw-label">번역할 글<textarea aria-label="번역할 글" value={source} disabled={locked} onChange={e => setSource(e.target.value)} placeholder="글을 입력하거나 TXT 파일을 가져오세요." rows={8} /></label>
            <p className="dw-note">{source.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}자 · 파일 전체의 서식은 유지하지 않습니다.</p>
            <label className="dw-label">TXT 파일 가져오기<input type="file" accept=".txt,text/plain" disabled={locked} onChange={e => { void readText(e.target.files?.[0]); e.target.value = ''; }} /></label>
            <p className="dw-note">첫 다운로드: 한국어 → 영어 약 170MB, 영어 → 한국어 약 500MB 이상. 브라우저가 파일을 보관하면 다음 실행에 재사용합니다.</p>
            <button className="dw-primary" disabled={locked || !source.trim() || source.length > MAX_TEXT} onClick={() => void run('translate')}>번역하기</button>
            <h3 className="dw-subtitle">음성으로 원문 입력하기</h3>
          </>}
          <p className="dw-note">첫 음성 준비에 약 100MB를 내려받습니다. 녹음은 최대 60초, 업로드는 2분·30MB까지 지원합니다.</p>
          <div className="dw-actions"><button disabled={busy} onClick={() => recording ? recorder.current?.stop() : void startRecording()}>{recording ? `녹음 마치기 · ${seconds}초` : '마이크로 녹음하기'}</button></div>
          <label className="dw-upload">녹음 파일 선택<input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm" disabled={locked} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }} /><span>MP3 · WAV · M4A 등 / 브라우저가 재생할 수 있는 파일</span></label>
          {file && <p className="dw-note">선택한 음성: {file.name} ({(file.size / 1048576).toFixed(1)} MB)</p>}
          <button className={mode === 'voice' ? 'dw-primary' : ''} disabled={locked || !file} onClick={() => void run('voice')}>음성을 글로 바꾸기</button>
        </>}
        <div className="dw-status" role="status" aria-live="polite">{message}</div>
        {busy && <button onClick={cancel}>작업 취소</button>}
        {error && <p className="dw-error" role="alert">{error}</p>}
      </section>
      <section className="dw-panel">
        <p className="dw-step">02 · 다듬고 저장하기</p><h2>{mode === 'translate' ? '번역문을 문서로 저장하세요' : '내 문서가 완성되는 공간'}</h2>
        <label className="dw-label">문서 제목<input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} /></label>
        <label className="dw-label">{mode === 'translate' ? '번역 결과' : '문서 내용'}<textarea aria-label={mode === 'translate' ? '번역 결과' : '문서 내용'} value={result} disabled={busy} onChange={e => setResult(e.target.value)} rows={16} placeholder="결과가 여기에 나타납니다. 직접 글을 입력해서 문서로 저장할 수도 있어요." /></label>
        <p className="dw-note">{result.length.toLocaleString()}자 · 자동 변환 결과는 틀릴 수 있으니 저장 전에 확인하세요.</p>
        <div className="dw-actions"><button disabled={!result.trim() || busy} onClick={() => void download('txt')}>TXT 저장</button><button className="dw-primary" disabled={!result.trim() || busy} onClick={() => void download('docx')}>Word 저장 (.docx)</button><button disabled={!result.trim() || busy} onClick={async () => { try { await navigator.clipboard.writeText(result); setMessage('글을 복사했습니다.'); } catch { setError('복사할 글을 직접 선택한 뒤 복사해 주세요.'); } }}>복사</button></div>
        {native && <div className="dw-actions">{native.saveText && <button disabled={!result.trim() || result.length > 64000 || busy || nativeBusy} onClick={() => void nativeExport(false)}>앱에서 텍스트 저장</button>}{native.shareText && <button disabled={!result.trim() || result.length > 64000 || busy || nativeBusy} onClick={() => void nativeExport(true)}>앱으로 텍스트 공유</button>}</div>}
        <p className="dw-note">한글에서는 DOCX 파일을 열어 필요한 형식으로 다시 저장할 수 있습니다. HWP·HWPX 직접 저장은 아직 지원하지 않습니다.</p>
        <p className="dw-note">사진과 음성, 입력한 글은 이 도구의 서버로 보내지 않고 기기에서 처리합니다. 필요한 파일은 외부 배포처에서 내려받습니다. 작업 내용은 자동 저장되지 않으므로 페이지를 떠나기 전에 내려받으세요.</p>
      </section>
    </div>
    <aside className="dw-promo"><div><p className="dw-step">함께 쓰면 좋은 서비스</p><h2>방송·회의를 실시간 번역 자막으로</h2><p>긴 방송이나 실시간 대화의 번역이 필요하다면 TranStream을 만나 보세요.</p><small>별도 서비스로 이동하며 이용 조건과 요금은 TranStream에서 확인할 수 있습니다. 입력한 내용은 링크로 전달하지 않습니다.</small></div><a href="https://transtream.app/" target="_blank" rel="noopener noreferrer">TranStream 알아보기 ↗</a></aside>
  </div>;
}

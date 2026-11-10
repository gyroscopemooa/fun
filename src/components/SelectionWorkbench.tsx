import { useEffect, useRef, useState } from 'react';
import { cleanText, errorHints, keySentences, MAX_INPUT, parseTable, tableCsv, type TableFormat } from '../lib/selection-workbench/core';
import { listenForExtensionImport } from '../lib/extension/import';
import { AI_CAPABILITY } from '../lib/selection-workbench/ai-contract';

type LocalAction = 'excerpt' | 'clean' | 'error' | 'table';
const labels: Record<LocalAction, string> = { excerpt: '핵심 문장 추출', clean: '공백 정리', error: '오류 코드 힌트', table: '표 → CSV' };
export default function SelectionWorkbench() {
  const [source, setSource] = useState('');
  const [action, setAction] = useState<LocalAction>('excerpt');
  const [format, setFormat] = useState<TableFormat>('tsv');
  const [result, setResult] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [message, setMessage] = useState('선택한 글 또는 OCR 결과를 붙여넣어 주세요. 자동 실행하지 않습니다.');
  const [error, setError] = useState('');
  const sourceRef = useRef('');
  const imported = useRef(false);
  useEffect(() => listenForExtensionImport('text', payload => {
    if (payload.kind !== 'text' || imported.current || sourceRef.current.trim()) return false;
    imported.current = true; sourceRef.current = payload.text; setSource(payload.text);
    setMessage('확장프로그램에서 선택한 글을 가져왔습니다. 내용을 확인한 뒤 실행해 주세요.');
    return true;
  }), []);
  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sourceRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  function invalidate() { setResult(''); setRows([]); setError(''); }
  function run() {
    invalidate();
    try {
      if (action === 'excerpt') {
        const excerpts = keySentences(source);
        setResult(excerpts.map((item, i) => `${i + 1}. ${item.text}\n[원문 ${item.start + 1}~${item.end}자]`).join('\n\n'));
        setMessage('원문의 문장만 뽑았습니다. AI 요약이 아니며 중요한 내용이 빠질 수 있어 원문과 비교해 주세요.');
      } else if (action === 'clean') {
        setResult(cleanText(source)); setMessage('공백과 줄바꿈을 정리했습니다. 맞춤법·의미는 교정하지 않았습니다.');
      } else if (action === 'error') {
        const hints = errorHints(source);
        setResult(hints.length ? hints.join('\n\n') : '알려진 오류 코드를 찾지 못했습니다. AI 진단은 아직 연결되지 않았습니다.');
        setMessage('코드 패턴에 따른 일반 안내입니다. 실제 원인 분석이나 AI 진단은 아닙니다.');
      } else {
        const parsed = parseTable(source, format); setRows(parsed); setResult(tableCsv(parsed));
        setMessage('표를 변환했습니다. OCR은 열·행을 잘못 읽을 수 있으므로 미리보기를 확인하세요. 수식처럼 시작하는 셀은 실행 방지를 위해 앞에 작은따옴표를 붙입니다.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : '입력 내용을 확인해 주세요.'); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(result); setMessage('결과를 복사했습니다.'); }
    catch { setError('복사 권한을 사용할 수 없습니다. 결과를 직접 선택해서 복사해 주세요.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([action === 'table' ? '\ufeff' + result : result], { type: action === 'table' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = action === 'table' ? 'manytool-table.csv' : 'manytool-text.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <p className="rounded-xl bg-teal-50 p-4 text-sm leading-6">이 도구는 입력·결과를 브라우저 메모리에서 계산하며, 도구 코드에서 서버·AI 업체로 전송하거나 크레딧을 차감하지 않습니다. 이 페이지는 공통 광고·분석 스크립트를 사용하지 않습니다. 비밀번호나 불필요한 민감정보는 입력하지 마세요. 공유 기기에서는 사용 후 지우기를 눌러 주세요.</p>
    <label className="block font-bold" htmlFor="selection-source">선택한 글 / 표 원문</label>
    <textarea id="selection-source" value={source} maxLength={MAX_INPUT} rows={9} className="w-full rounded-xl border border-slate-300 p-3" placeholder={'선택한 글을 붙여넣으세요. 표는 탭으로 열을 구분하거나 Markdown 표 형식으로 입력해 주세요.'} onChange={event => { sourceRef.current = event.target.value; setSource(event.target.value); invalidate(); }} />
    <div className="flex justify-between gap-3 text-sm text-slate-600"><span>{source.length.toLocaleString()} / {MAX_INPUT.toLocaleString()}자</span><button type="button" className="underline" onClick={() => { sourceRef.current = ''; setSource(''); invalidate(); setMessage('입력과 결과를 지웠습니다.'); }}>모두 지우기</button></div>
    <fieldset><legend className="mb-3 font-bold">무료 로컬 도구</legend><div className="flex flex-wrap gap-2">{(Object.keys(labels) as LocalAction[]).map(key => <label key={key} className={`cursor-pointer rounded-xl border px-3 py-2 ${action === key ? 'border-teal-700 bg-teal-50' : 'border-slate-200'}`}><input className="mr-2" type="radio" name="local-action" checked={action === key} onChange={() => { setAction(key); invalidate(); }} />{labels[key]}</label>)}</div></fieldset>
    {action === 'table' && <div className="space-y-2"><label className="block" htmlFor="table-format">입력 표 형식</label><select id="table-format" value={format} onChange={e => { setFormat(e.target.value as TableFormat); invalidate(); }} className="rounded-lg border p-2"><option value="tsv">탭 구분 (엑셀에서 복사)</option><option value="markdown">Markdown 표</option></select><p className="text-sm text-slate-600">사진의 표 구조를 자동으로 인식하는 AI 기능은 준비 중입니다. OCR 결과는 먼저 열과 행을 확인해 주세요.</p></div>}
    <button type="button" className="rounded-xl bg-teal-800 px-5 py-3 font-bold text-white disabled:opacity-40" onClick={run} disabled={!source.trim()}>선택한 도구 실행</button>
    <p role="status" aria-live="polite" className="text-sm leading-6 text-slate-600">{message}</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {rows.length > 0 && <div className="max-h-80 overflow-auto rounded-xl border"><table className="min-w-full text-sm"><caption className="p-3 text-left font-bold">원문 셀 미리보기 · {rows.length}행 × {rows[0].length}열</caption><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="max-w-xs whitespace-pre-wrap break-words border p-2">{cell}</td>)}</tr>)}</tbody></table></div>}
    {result && <div className="space-y-3"><label htmlFor="selection-result" className="block font-bold">결과</label><textarea id="selection-result" readOnly value={result} rows={8} className="w-full rounded-xl border p-3" /><div className="flex gap-3"><button type="button" onClick={copy} className="rounded-lg border px-4 py-2">복사</button><button type="button" onClick={download} className="rounded-lg border px-4 py-2">{action === 'table' ? 'CSV 저장' : 'TXT 저장'}</button></div></div>}
    <aside className="space-y-3 border-t pt-5"><h2 className="text-lg font-bold">AI 기능 준비 중</h2><p className="text-sm leading-6 text-slate-600">쉽게 설명 · AI 요약 · 문장 다듬기 · 답장 초안 · 오류 분석 · 이미지 번역 · 사진 속 표 인식은 아직 연결되지 않았습니다. 무료 로컬 결과를 AI 결과로 표시하지 않습니다.</p><button type="button" disabled={!AI_CAPABILITY.enabled} className="rounded-xl bg-slate-100 px-4 py-3 text-slate-500">AI 실행 준비 중 · 전송/차감 없음</button><p className="text-sm leading-6 text-slate-600">연결 시에는 선택한 내용, 처리 업체, 사용 크레딧을 먼저 표시하고 사용자가 실행을 승인한 경우에만 전송하도록 구성합니다.</p></aside>
    <nav className="flex flex-wrap gap-4 text-sm text-teal-800"><a className="underline" href="/photo-to-document/">사진에서 글자 추출</a><a className="underline" href="/text-translator/">한↔영 번역</a></nav>
  </section>;
}

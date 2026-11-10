export const MAX_TEXT = 200000;
function bounded(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('입력은 200,000자 이하로 제한됩니다.');
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
export function diffLines(before, after) {
  const a = bounded(before).split('\n'), b = bounded(after).split('\n');
  if (a.length > 1000 || b.length > 1000) throw new Error('문서 비교는 각 1,000줄 이하로 입력해 주세요.');
  const width = b.length + 1, matrix = new Uint16Array((a.length + 1) * width);
  for (let i=a.length-1;i>=0;i--) for(let j=b.length-1;j>=0;j--) matrix[i*width+j] = a[i] === b[j] ? 1+matrix[(i+1)*width+j+1] : Math.max(matrix[(i+1)*width+j],matrix[i*width+j+1]);
  const rows=[]; let i=0,j=0;
  while(i<a.length || j<b.length) {
    if(i<a.length && j<b.length && a[i]===b[j]) {rows.push({kind:'same',text:a[i],before:++i,after:++j});}
    else if(i<a.length && (j===b.length || matrix[(i+1)*width+j]>=matrix[i*width+j+1])) rows.push({kind:'removed',text:a[i],before:++i});
    else rows.push({kind:'added',text:b[j],after:++j});
  }
  return rows;
}
export function parseTime(value) {
  const match = /^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})$/.exec(value);
  if(!match || Number(match[2])>59 || Number(match[3])>59) throw new Error(`잘못된 시간: ${value}`);
  const ms=((Number(match[1]||0)*60+Number(match[2]))*60+Number(match[3]))*1000+Number(match[4]);
  if(!Number.isSafeInteger(ms) || ms>359999999) throw new Error('자막 시간은 100시간 미만이어야 합니다.');
  return ms;
}
export function parseSubtitles(source) {
  let text=bounded(source).trim();
  const vtt=/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(text);
  if(vtt) {
    const end=text.indexOf('\n\n');
    if(end<0) return [];
    const header=text.slice(0,end);
    if(header.split('\n').length>1) throw new Error('추가 WebVTT 헤더 정보는 지원하지 않습니다. 원본을 유지해 주세요.');
    text=text.slice(end+2);
  }
  if(!text.trim()) return [];
  const cues=[];
  for(const block of text.split(/\n[ \t]*\n/)) {
    const lines=block.trim().split('\n');
    if(vtt && /^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) throw new Error('NOTE·STYLE·REGION은 변환 시 손실될 수 있어 지원하지 않습니다.');
    let index=lines[0].includes('-->') ? 0 : 1;
    if(!lines[index]) throw new Error('자막 시간 줄이 없습니다.');
    const m=/^([^\s]+)[ \t]+-->[ \t]+([^\s]+)(.*)$/.exec(lines[index]);
    if(!m) throw new Error(`잘못된 자막 시간 줄: ${lines[index]}`);
    if(m[3].trim()) throw new Error('위치·정렬 설정이 있는 자막은 지원하지 않습니다.');
    const start=parseTime(m[1]),end=parseTime(m[2]),content=lines.slice(index+1).join('\n');
    if(end<=start) throw new Error('자막 종료 시간은 시작 시간보다 늦어야 합니다.');
    if(!content.trim()) throw new Error('빈 자막은 지원하지 않습니다.');
    if(/<[^>]*>/.test(content)) throw new Error('서식 태그가 있는 자막은 지원하지 않습니다. 일반 텍스트 자막을 사용해 주세요.');
    cues.push({start,end,text:content});
  }
  if(cues.length>2000) throw new Error('자막은 2,000개 이하로 제한됩니다.');
  return cues;
}
export function shiftSubtitles(cues, seconds) {
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||Math.abs(seconds)>86400) throw new Error('시간 이동은 ±86,400초 이내의 숫자로 입력해 주세요.');
  const offset=Math.round(seconds*1000);
  if(cues.some(c=>c.end+offset>359999999)) throw new Error('이동 후 자막 시간은 100시간 미만이어야 합니다.');
  if(cues.some(c=>c.start+offset<0)) throw new Error('이동 후 시작 시간이 음수가 됩니다. 이동량을 줄여 주세요.');
  return cues.map(c=>({...c,start:c.start+offset,end:c.end+offset}));
}
function formatTime(ms, separator) {
  const h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${separator}${String(ms%1000).padStart(3,'0')}`;
}
export function serializeSubtitles(cues, format='srt') {
  if(!['srt','vtt'].includes(format)) throw new Error('지원하지 않는 형식입니다.');
  const separator=format==='srt'?',':'.';
  return (format==='vtt'?'WEBVTT\n\n':'')+cues.map((c,i)=>`${format==='srt'?`${i+1}\n`:''}${formatTime(c.start,separator)} --> ${formatTime(c.end,separator)}\n${c.text}`).join('\n\n')+'\n';
}

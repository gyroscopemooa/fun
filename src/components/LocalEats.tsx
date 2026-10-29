import { useEffect, useMemo, useRef, useState } from 'react';
import './local-eats.css';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

type Solo = 'yes' | 'conditional' | 'no' | 'unknown';
type Review = { id: string; place_id: string; rating: number; body: string; solo: Solo; created_at: string };
type Place = { id: string; name: string; region: string; menu: string; address: string; solo: Solo; solo_note: string; lat: number; lng: number; created_at: string; local_eats_reviews: Review[] };
const labels: Record<Solo, string> = { yes: '혼밥 가능', conditional: '조건부 가능', no: '혼밥 어려움', unknown: '확인 필요' };
const regions: Record<string, [number, number]> = { 서울: [37.5665,126.978], 경기: [37.4138,127.5183], 인천: [37.4563,126.7052], 강원: [37.8228,128.1555], 충남: [36.5184,126.8], 충북: [36.8,127.7], 세종: [36.48,127.29], 대전: [36.3504,127.3845], 전북: [35.7175,127.153], 광주: [35.1595,126.8526], 전남: [34.8161,126.463], 경북: [36.4919,128.8889], 대구: [35.8714,128.6014], 경남: [35.4606,128.2132], 울산: [35.5384,129.3114], 부산: [35.1796,129.0756], 제주: [33.4996,126.5312] };
const average = (p: Place) => p.local_eats_reviews.length ? p.local_eats_reviews.reduce((s, r) => s + r.rating, 0) / p.local_eats_reviews.length : 0;
const currentSolo = (p: Place) => [...p.local_eats_reviews].sort((a,b) => b.created_at.localeCompare(a.created_at)).find(r => r.solo !== 'unknown')?.solo ?? p.solo;
function SoloOptions() { return <>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>; }

export default function LocalEats({ url, apiKey }: { url: string; apiKey: string }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [solo, setSolo] = useState('');
  const [sort, setSort] = useState('new');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const pin = useRef<any>(null);
  const saving = useRef(false);
  const addingRef = useRef(false);
  addingRef.current = adding;
  async function request(path: string, body?: object) {
    if (!url || !apiKey) throw new Error('공유 저장소 연결을 준비 중입니다. 잠시 후 다시 방문해 주세요.');
    const response = await fetch(`${url}/rest/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(body ? { Prefer: 'return=minimal' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(body ? '저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.' : '맛집 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
    return body ? null : response.json();
  }
  async function refresh() {
    setLoading(true);
    try { const data = await request('local_eats_places?select=*,local_eats_reviews(*)&order=created_at.desc'); setPlaces(data); setConnected(true); }
    catch (error) { setConnected(false); setMessage((error as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    let disposed = false;
    const win = window as any;
    async function init() {
      try {
        const leaflet = await import('leaflet');
        win.L = leaflet.default ?? leaflet;
        win.L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon, shadowUrl: markerShadow });
        if (disposed || !mapNode.current) return;
        map.current = win.L.map(mapNode.current).setView([36.2,127.8],7);
        win.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current);
        layer.current = win.L.layerGroup().addTo(map.current);
        map.current.on('click', (e: any) => { if (addingRef.current) setPoint([e.latlng.lat, e.latlng.lng]); });
        setMapReady(true);
      } catch { if (!disposed) setMapError('지도를 불러오지 못했습니다. 목록은 계속 이용할 수 있습니다. 페이지를 새로고침해 주세요.'); }
    }
    void init();
    return () => { disposed = true; map.current?.remove(); map.current = null; };
  }, []);
  const filtered = useMemo(() => places.filter(p => (!region || p.region === region) && (!solo || currentSolo(p) === solo) && `${p.name} ${p.region} ${p.menu} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => sort === 'rating' ? average(b)-average(a) : b.created_at.localeCompare(a.created_at)), [places, region, solo, query, sort]);
  useEffect(() => {
    if (!mapReady || !layer.current) return;
    const L = (window as any).L;
    layer.current.clearLayers();
    filtered.forEach(p => {
      const caption = document.createElement('div'); caption.textContent = `${p.name} · ${labels[currentSolo(p)]}`;
      L.circleMarker([p.lat,p.lng], { radius: 10, color: currentSolo(p) === 'yes' ? '#047857' : '#b45309', fillOpacity: .8 }).bindTooltip(caption).on('click', () => { setSelected(p.id); setAdding(false); }).addTo(layer.current);
    });
  }, [filtered, mapReady]);
  useEffect(() => {
    if (!mapReady) return;
    pin.current?.remove(); pin.current = null;
    if (point && adding) pin.current = (window as any).L.marker(point, { draggable: true }).addTo(map.current).on('dragend', (e: any) => { const p = e.target.getLatLng(); setPoint([p.lat,p.lng]); });
  }, [point, adding, mapReady]);
  const active = places.find(p => p.id === selected);
  function chooseRegion(value: string) { setRegion(value); map.current?.setView(value ? regions[value] : [36.2,127.8], value ? 11 : 7); }
  async function submitPlace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving.current) return;
    if (!point || point[0] < 33 || point[0] > 39 || point[1] < 124 || point[1] > 132) { setMessage('지도에서 대한민국 내 식당 위치를 선택해 주세요.'); return; }
    const form = event.currentTarget; const data = new FormData(form);
    const fields = Object.fromEntries(['name','region','menu','address','solo','solo_note'].map(key => [key, String(data.get(key) ?? '').trim()]));
    if (!fields.name || !fields.address) { setMessage('식당명과 상세 주소를 입력해 주세요.'); return; }
    saving.current = true; setBusy(true); setMessage('');
    try { await request('local_eats_places', { ...fields, lat: point[0], lng: point[1] }); form.reset(); setAdding(false); setPoint(null); setMessage('맛집 제보가 공개되었습니다.'); await refresh(); }
    catch(error) { setMessage((error as Error).message); }
    finally { saving.current = false; setBusy(false); }
  }
  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving.current || !active) return;
    const form = event.currentTarget; const data = new FormData(form); const body = String(data.get('body') ?? '').trim();
    if (!body) { setMessage('방문 후기를 입력해 주세요.'); return; }
    saving.current = true; setBusy(true); setMessage('');
    try { await request('local_eats_reviews', { place_id: active.id, rating: Number(data.get('rating')), solo: data.get('solo'), body }); form.reset(); setMessage('별점과 댓글이 등록되었습니다.'); await refresh(); }
    catch(error) { setMessage((error as Error).message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="eats">
    <header className="eats-hero"><p className="eats-eyebrow">나 혼자도, 맛있게 🍚</p><h1>혼밥가능 / 맛집추천 지도</h1><p>혼자 가도 괜찮을까? 방문자가 남긴 혼밥 정보와 별점으로 골라보세요.</p><button className="eats-primary" onClick={() => { setAdding(true); setSelected(null); setMessage('지도에서 식당 위치를 선택해 주세요.'); }}>+ 내가 아는 맛집 제보</button></header>
    <div className="eats-filters"><label>지역<select value={region} onChange={e => chooseRegion(e.target.value)}><option value="">전국</option>{Object.keys(regions).map(r => <option key={r}>{r}</option>)}</select></label><label className="eats-search">등록된 맛집 검색<input value={query} onChange={e => setQuery(e.target.value)} placeholder="지역, 식당명, 메뉴" /></label><label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="new">최신 제보순</option><option value="rating">별점 높은순</option></select></label></div>
    <div className="eats-chips" role="group" aria-label="혼밥 가능 여부 필터">{[['','전체'], ...Object.entries(labels)].map(([value,label]) => <button key={value} aria-pressed={solo === value} onClick={() => setSolo(value)}>{label}</button>)}</div>
    <p className="eats-note">혼밥 여부는 가장 최근 방문 후기 기준이며, 후기가 없으면 최초 제보를 표시합니다. 시간대·주문 조건은 방문 전 식당에 확인해 주세요.</p>
    {message && <div className="eats-status" role="status">{message}{!connected && !loading && <button onClick={() => { setMessage(''); void refresh(); }}>다시 불러오기</button>}</div>}
    <div className="eats-grid"><section className="eats-map-panel" aria-label="맛집 지도"><div className="eats-map" ref={mapNode} />{mapError && <p role="alert">{mapError}</p>}<div className="eats-map-actions"><button onClick={() => { if (!navigator.geolocation) { setMessage('현재 위치 기능을 지원하지 않는 브라우저입니다.'); return; } navigator.geolocation.getCurrentPosition(p => map.current?.setView([p.coords.latitude,p.coords.longitude],15), () => setMessage('위치 권한을 확인하거나 지역 선택을 이용해 주세요.'), { timeout: 10000 }); }}>내 위치로 이동</button>{adding && <button disabled={!mapReady} onClick={() => { const p = map.current.getCenter(); setPoint([p.lat,p.lng]); }}>지도 중심을 제보 위치로 선택</button>}</div><p className="eats-note">초록 핀: 혼밥 가능 · 주황 핀: 조건부 / 어려움 / 확인 필요</p></section>
    <section className="eats-results" aria-label="맛집 목록"><h2>등록된 맛집 <span>{filtered.length}곳</span></h2>{loading ? <p role="status">맛집을 불러오는 중…</p> : !connected ? <p>공유 저장소에 연결할 수 없습니다. 위의 다시 불러오기를 눌러주세요.</p> : filtered.length === 0 ? <div className="eats-empty"><strong>{places.length ? '조건에 맞는 맛집이 없어요.' : '첫 번째 동네 맛집을 기다리고 있어요.'}</strong><p>직접 방문한 식당의 혼밥 정보를 알려주세요.</p><button onClick={() => { setAdding(true); setSelected(null); }}>첫 맛집 제보하기</button></div> : filtered.map(p => <button className={`eats-card ${selected === p.id ? 'selected' : ''}`} key={p.id} onClick={() => { setSelected(p.id); setAdding(false); map.current?.setView([p.lat,p.lng],16); }}><span className={`eats-badge ${currentSolo(p)}`}>{labels[currentSolo(p)]}</span><h3>{p.name}</h3><p>{p.region} · {p.menu || '메뉴 정보 없음'}</p><p>{p.address}</p><strong className="eats-rating">★ {p.local_eats_reviews.length ? average(p).toFixed(1) : '아직 별점 없음'}</strong><span> · 후기 {p.local_eats_reviews.length}개</span>{p.solo_note && <p className="eats-note">최초 제보 · {p.solo_note}</p>}</button>)}</section></div>
    {adding && <section className="eats-detail"><h2>내가 아는 맛집 제보</h2><p>지도에서 위치를 누른 다음 식당 정보를 입력해 주세요.</p><p role="status">{point ? `선택 위치: ${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : '아직 위치를 선택하지 않았어요.'}</p><form onSubmit={submitPlace}><div className="eats-form-grid"><label>식당명<input name="name" required maxLength={80} /></label><label>지역<select name="region" required defaultValue={region}><option value="" disabled>지역 선택</option>{Object.keys(regions).map(r => <option key={r}>{r}</option>)}</select></label><label>대표 메뉴<input name="menu" maxLength={120} placeholder="예: 국밥, 덮밥" /></label><label>혼밥 가능 여부<select name="solo" defaultValue="unknown"><SoloOptions /></select></label></div><label>상세 주소 / 위치<input name="address" required maxLength={300} placeholder="도로명 주소, 층수, 가까운 출구 등" /></label><label>혼밥 조건 / 좌석 정보<textarea name="solo_note" maxLength={300} placeholder="예: 바 좌석 있음, 1인 주문 가능, 점심 피크 시간 제외" /></label><p className="eats-note">제보는 모든 방문자에게 공개됩니다. 개인정보는 적지 마세요.</p><button className="eats-primary" disabled={busy || !connected || !point}>{busy ? '저장 중…' : '맛집 공개 등록'}</button><button type="button" onClick={() => setAdding(false)}>닫기</button></form></section>}
    {active && !adding && <section className="eats-detail"><div className="eats-detail-heading"><h2>{active.name}</h2><button onClick={() => setSelected(null)}>닫기</button></div><span className={`eats-badge ${currentSolo(active)}`}>{labels[currentSolo(active)]}</span><p>{active.address}</p><p>최초 제보의 혼밥 정보: {active.solo_note || '상세 조건이 아직 없습니다.'}</p><a href={`https://map.kakao.com/link/search/${encodeURIComponent(`${active.region} ${active.name} ${active.address}`)}`} target="_blank" rel="noopener noreferrer">카카오맵에서 식당 확인 ↗</a><h3>★ {average(active) ? average(active).toFixed(1) : '별점 없음'} · 방문 후기 {active.local_eats_reviews.length}개</h3><div className="eats-reviews">{[...active.local_eats_reviews].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(r => <article key={r.id}><strong>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</strong><span className={`eats-badge ${r.solo}`}>{labels[r.solo]}</span><p>{r.body}</p><time>{new Date(r.created_at).toLocaleDateString('ko-KR')}</time></article>)}{!active.local_eats_reviews.length && <p>아직 후기가 없어요. 첫 방문 후기를 남겨주세요.</p>}</div><form key={active.id} onSubmit={submitReview}><h3>별점 · 댓글 남기기</h3><div className="eats-form-grid"><label>맛집 별점<select name="rating" required defaultValue=""><option value="" disabled>별점 선택</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)} {n}점</option>)}</select></label><label>방문 당시 혼밥 가능 여부<select name="solo" defaultValue="unknown"><SoloOptions /></select></label></div><label>방문 후기<textarea name="body" required maxLength={1000} placeholder="혼자 주문하기 편했나요? 1인석, 최소 주문, 시간대도 알려주세요." /></label><p className="eats-note">직접 방문한 경험을 남겨주세요. 별점과 댓글은 즉시 공개됩니다.</p><button className="eats-primary" disabled={busy || !connected}>{busy ? '등록 중…' : '별점과 댓글 등록'}</button></form></section>}
  </div>;
}

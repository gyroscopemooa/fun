import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ImagePlus, Plus, Shirt, SlidersHorizontal, ClipboardList, Info, Trash2, UserRound } from 'lucide-react';
import './ai-stylist.css';
import { AI_STYLIST_PRICING, quoteAiStylist } from '../../../shared/ai-stylist-pricing.js';

declare global { interface Window { manytoolShowPaymentChoices?: (options?: { stylistCount?: number }) => void; } }

const MAX_ITEMS = AI_STYLIST_PRICING.maxItems;
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['자동 판단', '상의', '하의', '겉옷', '원피스', '신발', '모자', '목도리', '가방', '기타'];
type Photo = { file: File; url: string };
type Garment = { id: string; category: string; photo: Photo | null };
const makeGarment = (): Garment => ({ id: crypto.randomUUID(), category: TYPES[0], photo: null });

function checkFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'JPG, PNG, WEBP 사진을 선택해주세요.';
  if (file.size > MAX_BYTES) return '사진 한 장은 8MB 이하로 올려주세요.';
  return '';
}

function PhotoInput({ photo, label, hint, onSelect, onRemove, disabled = false }: {
  photo: Photo | null; label: string; hint: string; onSelect: (file: File) => void; onRemove: () => void; disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  return <div className={`stylist-photo ${dragging ? 'is-dragging' : ''}`}>
    <label onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled && event.dataTransfer.files[0]) onSelect(event.dataTransfer.files[0]); }}>
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} disabled={disabled}
        onChange={event => { const file = event.target.files?.[0]; if (file) onSelect(file); event.target.value = ''; }} />
      {photo ? <><img src={photo.url} alt={label} /><span className="stylist-replace">클릭해서 사진 변경</span></> :
        <span className="stylist-upload-copy"><ImagePlus size={28} strokeWidth={1.5} /><strong>{label}</strong><span>{hint}</span><small>JPG · PNG · WEBP / 최대 8MB</small></span>}
    </label>
    {photo && <button type="button" className="stylist-remove-photo" onClick={onRemove} disabled={disabled} aria-label={`${label} 삭제`}><Trash2 size={16} /></button>}
  </div>;
}

export default function AiStylist() {
  const [person, setPerson] = useState<Photo | null>(null);
  // Use a deterministic initial ID to keep server rendering and hydration aligned.
  const [garments, setGarments] = useState<Garment[]>([{ id: 'first', category: TYPES[0], photo: null }]);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const urls = useRef(new Set<string>());
  const resultRef = useRef<HTMLElement>(null);
  const count = garments.filter(item => item.photo).length;
  const price = count ? quoteAiStylist(count) : null;
  const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
  const ready = Boolean(person && count);
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  function release(photo: Photo | null) {
    if (photo) { URL.revokeObjectURL(photo.url); urls.current.delete(photo.url); }
  }
  async function select(file: File, id?: string) {
    const issue = checkFile(file);
    if (issue) { setError(issue); return; }
    try {
      // Check actual decodability too; a renamed non-image must not become a preview.
      const bitmap = await createImageBitmap(file); bitmap.close();
    } catch { setError('사진을 읽을 수 없습니다. 다른 JPG, PNG, WEBP 파일을 선택해주세요.'); return; }
    const photo = { file, url: URL.createObjectURL(file) };
    urls.current.add(photo.url);
    if (id) setGarments(previous => {
      const target = previous.find(item => item.id === id);
      if (!target) { release(photo); return previous; }
      release(target.photo);
      return previous.map(item => item.id === id ? { ...item, photo } : item);
    });
    else { release(person); setPerson(photo); }
    setReviewed(false); setError('');
  }
  function review() {
    if (!ready) { setError('내 사진과 옷 사진을 각각 한 장 이상 올려주세요.'); return; }
    setReviewed(true); setError('');
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function openPaymentChoices() {
    if (!ready) { setError('내 사진과 옷 사진을 각각 한 장 이상 올려주세요.'); return; }
    if (!window.manytoolShowPaymentChoices) { setError('결제 안내를 불러오지 못했어요. 새로고침 후 다시 시도해주세요.'); return; }
    setError(''); window.manytoolShowPaymentChoices({ stylistCount: count });
  }
  return <div className="ai-stylist" data-stylist-count={count}>
    <header className="stylist-hero">
      <span className="stylist-eyebrow"><Shirt size={18} /> AI 코디</span>
      <h1>이 옷, <span>내가 입으면?</span></h1>
      <p>궁금했던 그 옷, 내 사진으로 입어보세요.<br />옷은 최대 5개까지. 코디 분석도 함께 준비해요.</p>
      <div className="stylist-hero-tags"><span>내 사진 + 옷 사진</span><span>최대 5개 아이템</span><span>상세 코디 분석</span></div>
    </header>

    <div className="stylist-service-note"><Info size={20} /><div><strong>NICE 결제창 연결 확인</strong><p>다른 AI 도구와 같은 연결 확인 단계예요. 결제 방법과 주문 금액을 확인할 수 있으며, 실제 결제 승인·AI 생성·사진 전송은 처리하지 않아요.</p></div></div>

    <div className="stylist-workspace">
      <section className="stylist-card stylist-person" aria-labelledby="stylist-person-title">
        <div className="stylist-section-heading"><span className="stylist-step">1</span><div><h2 id="stylist-person-title">내 사진</h2><p>코디의 주인공은 나</p></div><UserRound size={20} /></div>
        <PhotoInput photo={person} label="전신사진 또는 셀카 올리기" hint="사진을 끌어 놓거나 클릭하세요" onSelect={file => { void select(file); }}
          onRemove={() => { release(person); setPerson(null); setReviewed(false); }} />
        <div className="stylist-photo-tips"><strong>이런 사진이 좋아요</strong><p>혼자 나온 밝고 선명한 정면 사진을 준비해주세요. 전신사진은 전체 실루엣을 참고하기 좋아요.</p><p>셀카만 있으면 보이지 않는 체형과 하의는 AI가 추정해요.</p></div>
      </section>

      <section className="stylist-card stylist-garments" aria-labelledby="stylist-garments-title">
        <div className="stylist-section-heading"><span className="stylist-step">2</span><div><h2 id="stylist-garments-title">입어보고 싶은 옷</h2><p>티셔츠 하나도, 여러 옷의 조합도 OK</p></div><span className="stylist-count">{garments.length} / {MAX_ITEMS}</span></div>
        <p className="stylist-source-hint">옷가게에서 찍은 옷 · 내 옷장 속 옷 · 쇼핑몰이나 인터넷에서 저장한 사진</p>
        <div className="stylist-garment-grid">
          {garments.map((item, index) => <article key={item.id} className="stylist-garment">
            <div className="stylist-garment-heading"><strong>아이템 {index + 1}</strong>{garments.length > 1 && <button type="button" aria-label={`아이템 ${index + 1} 칸 삭제`} onClick={() => {
              release(item.photo); setGarments(previous => previous.filter(row => row.id !== item.id)); setReviewed(false);
            }}><Trash2 size={16} /></button>}</div>
            <PhotoInput photo={item.photo} label={`아이템 ${index + 1} 사진 올리기`} hint="옷 전체가 보이는 사진" onSelect={file => { void select(file, item.id); }} onRemove={() => {
              release(item.photo); setGarments(previous => previous.map(row => row.id === item.id ? { ...row, photo: null } : row)); setReviewed(false);
            }} />
            <label className="stylist-category">종류 <select value={item.category} aria-label={`아이템 ${index + 1} 종류`} onChange={event => {
              const category = event.target.value; setGarments(previous => previous.map(row => row.id === item.id ? { ...row, category } : row)); setReviewed(false);
            }}>{TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
          </article>)}
          {garments.length < MAX_ITEMS && <button type="button" className="stylist-add" onClick={() => { setGarments(previous => previous.length < MAX_ITEMS ? [...previous, makeGarment()] : previous); setReviewed(false); }}><Plus size={25} /><strong>옷 더 추가</strong><span>상의, 하의, 겉옷, 모자, 목도리…</span></button>}
        </div>
        <div className="stylist-auto-note"><Shirt size={18} /><span>추가하지 않은 옷은 AI가 어울리게 보완하는 방식이에요. 한 장이면 단품 코디, 여러 장이면 코디 패키지로 준비됩니다.</span></div>
      </section>
    </div>

    <section className="stylist-card stylist-prompt" aria-labelledby="stylist-prompt-title">
      <div className="stylist-section-heading"><SlidersHorizontal size={22} /><div><h2 id="stylist-prompt-title">어떤 느낌으로 입어볼까요?</h2><p>자세, 배경, 분위기까지 자유롭게 · 선택 사항</p></div></div>
      <label className="stylist-sr-only" htmlFor="stylist-request">추가 코디 요청</label>
      <textarea id="stylist-request" maxLength={600} value={prompt} onChange={event => { setPrompt(event.target.value); setReviewed(false); }} placeholder="예: 자연스럽게 서 있는 전신샷, 주말 카페에 갈 편안한 코디. 상의는 넣어 입고, 신발은 흰색 운동화로." />
      <div className="stylist-prompt-footer"><div>{['자연스러운 전신 포즈', '깔끔한 스튜디오 배경', '편안한 데일리룩'].map(text => <button type="button" key={text} onClick={() => { setPrompt(value => (value ? `${value}, ${text}` : text).slice(0, 600)); setReviewed(false); }}>{text} +</button>)}</div><span>{prompt.length}/600</span></div>
    </section>

    {error && <p className="stylist-error" role="alert">{error}</p>}
    <section className="stylist-pricing" aria-labelledby="stylist-pricing-title">
      <div className="stylist-pricing-heading"><div><h2 id="stylist-pricing-title">옷 사진 수만큼, 필요한 만큼</h2><p>내 사진 1장 + 착장 이미지 {AI_STYLIST_PRICING.outputImages}장 + 상세 코디 분석 포함</p></div><span>출시 예정가 · 부가세 포함</span></div>
      <div className="stylist-price-options">{Array.from({ length: MAX_ITEMS }, (_, i) => {
        const quote = quoteAiStylist(i + 1);
        return <div key={quote.itemCount} className={count === quote.itemCount ? 'is-selected' : ''} aria-current={count === quote.itemCount ? 'true' : undefined}><span>옷 {quote.itemCount}장</span><strong>{won(quote.amountKrw)}</strong><small>{quote.credits}크레딧</small></div>;
      })}</div>
      <div className="stylist-price-summary" aria-live="polite"><div><strong>{price ? `선택한 옷 ${count}장` : '옷 사진을 올리면 금액을 계산해요'}</strong><p>{price ? `기본 ${won(price.baseKrw)} (옷 1장)${price.extraItems ? ` + 추가 ${price.extraItems}장 × ${won(AI_STYLIST_PRICING.extraItemKrw)}` : ''}` : `옷 1장 ${won(AI_STYLIST_PRICING.baseKrw)}, 추가 1장마다 +${won(AI_STYLIST_PRICING.extraItemKrw)}`}</p></div><strong data-stylist-total>{price ? `${won(price.amountKrw)} · ${price.credits}크레딧` : '사진 선택 전'}</strong></div>
      <p className="stylist-pricing-note">사진을 올린 아이템만 계산하며, 빈 칸과 사진 교체·삭제에는 추가 요금이 없어요. 생성 1회 기준이며 재생성은 별도 이용입니다. 현재 NICE 결제창 연결 확인 단계로 결제 승인·크레딧 차감은 없어요. 원본 조합 미리보기는 무료예요.</p>
    </section>
    <div className="stylist-action"><div><strong>{count ? `${count}개 아이템으로 ${count > 1 ? '코디 패키지' : '단품 코디'}` : '나만의 첫 코디를 준비해보세요'}</strong><p>착장 이미지 1장 + 상세 코디 분석 · 출시 예정</p></div><div className="stylist-action-buttons"><button type="button" className="stylist-secondary" onClick={review} disabled={!ready}>무료 조합 미리보기</button><button type="button" className="stylist-primary" onClick={openPaymentChoices} disabled={!ready}>결제 방법 선택{price ? ` · ${won(price.amountKrw)}` : ''} <ArrowRight size={18} /></button></div></div>

    <section ref={resultRef} className="stylist-results" aria-labelledby="stylist-result-title" aria-live="polite">
      <div className="stylist-result-heading"><span className="stylist-eyebrow">YOUR OUTFIT</span><h2 id="stylist-result-title">{reviewed ? '이 조합으로 입어볼게요' : '나만의 코디가 완성되는 곳'}</h2><p>{reviewed ? '업로드한 원본 사진의 조합입니다. AI가 생성한 착장 이미지가 아니에요.' : '사진을 준비하면 조합을 먼저 확인할 수 있어요.'}</p></div>
      <div className="stylist-result-grid"><div className="stylist-result-image">
        {reviewed && person ? <div className="stylist-composition"><img className="stylist-composition-person" src={person.url} alt="내 원본 사진" /><span>+</span><div>{garments.filter(item => item.photo).map((item, index) => <figure key={item.id}><img src={item.photo!.url} alt={`선택한 옷 ${index + 1}`} /><figcaption>{item.category}</figcaption></figure>)}</div></div> : <div className="stylist-empty"><Shirt size={44} strokeWidth={1} /><strong>가상 착장 이미지</strong><p>내 얼굴과 선택한 옷을 반영하는<br />AI 피팅 결과가 이곳에 표시될 예정이에요.</p><span>사진을 올리고 조합을 확인해보세요</span></div>}
      </div><div className="stylist-analysis"><h3><ClipboardList size={22} /> 상세 코디 리포트</h3><p>정식 출시 후 이런 내용을 분석해드려요.</p>{[
        ['컬러 밸런스', '얼굴 주변 색감과 옷 사이의 배색 조화'],
        ['실루엣 & 비율', '기장과 볼륨의 균형, 넣어 입기와 레이어링 제안'],
        ['아이템별 코디', '업로드한 옷의 역할과 함께 입을 옷 추천'],
        ['상황별 스타일링', '데일리·출근·데이트 등 활용과 개선 팁']
      ].map(([title, text]) => <div className="stylist-analysis-row" key={title}><Check size={16} /><div><strong>{title}</strong><p>{text}</p></div></div>)}<small>퍼스널컬러는 사진 조명에 영향을 받으며, 실제 핏·사이즈를 측정하는 기능은 아니에요.</small></div></div>
    </section>
    <p className="stylist-privacy">사진은 현재 브라우저에서만 미리보기로 사용됩니다. 새로고침하면 초기화돼요. 본인 사진과 사용할 권한이 있는 옷 사진을 준비해주세요.</p>
  </div>;
}

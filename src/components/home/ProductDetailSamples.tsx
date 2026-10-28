import { useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';

const samples = [
  { id: 'stripe-lookbook', name: '스트라이프 리본 원피스', style: '사진 중심 룩북', images: 1, sections: 5, width: 860, theme: 'Playful Commerce' },
  { id: 'knit-editorial', name: '그레이 니트 원피스', style: '사진·텍스트 분할형', images: 2, sections: 7, width: 860, theme: 'Premium Commerce' },
  { id: 'ivory-catalog', name: '아이보리 리본 원피스', style: '간결한 상품 카탈로그', images: 2, sections: 5, width: 780, theme: 'Minimal Commerce' }
];

export default function ProductDetailSamples({ locale = 'ko' }: { locale?: 'ko' | 'en' | 'ja' }) {
  const [index, setIndex] = useState(0);
  const sample = samples[index];
  const ko = locale === 'ko';
  const ja = locale === 'ja';
  const title = ko ? '실제로 생성한 상세페이지' : ja ? '実際に生成した商品ページ' : 'Real generated product pages';
  const previous = ko ? '이전 샘플' : ja ? '前のサンプル' : 'Previous sample';
  const next = ko ? '다음 샘플' : ja ? '次のサンプル' : 'Next sample';
  const url = `/samples/product-detail/${sample.id}.html`;

  return (
    <section className="mt-6 min-w-0 border-t border-white/15 pt-6" aria-label={title} aria-roledescription="carousel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">Generated examples</p>
          <h2 className="mt-2 text-xl font-bold text-white">{title}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70">{index + 1} / {samples.length}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/70">
        {ko ? '상품 사진과 요청에 맞춰 구성한 결과입니다. 샘플 안에서 아래로 스크롤하면 전체 상세페이지를 볼 수 있어요.' : ja ? '商品写真とリクエストに合わせた生成例です。プレビュー内をスクロールして全体をご覧ください。' : 'Generated from product photos and specific requests. Scroll inside the preview to explore the full page.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {samples.map((item, i) => (
          <button key={item.id} type="button" onClick={() => setIndex(i)} aria-pressed={i === index}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${i === index ? 'border-amber-200 bg-amber-100 text-stone-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>
            {ko ? item.style : `${ja ? 'サンプル' : 'Example'} ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.3rem] border border-white/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600" aria-live="polite" aria-atomic="true">
          <span className="font-bold">{sample.name}</span>
          <span className="shrink-0">{sample.width}px · {sample.sections}{ko ? '개 주요 섹션' : ' main sections'}</span>
        </div>
        <iframe key={sample.id} src={url} title={`${title}: ${sample.name}`} loading="lazy" sandbox="allow-scripts" referrerPolicy="no-referrer"
          className="block h-[560px] w-full border-0 sm:h-[680px] lg:h-[780px]" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" aria-label={previous} onClick={() => setIndex((index + samples.length - 1) % samples.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"><ArrowLeft size={18} /></button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-100 underline-offset-4 hover:underline">
          {ko ? '전체 상세페이지 보기' : ja ? 'ページ全体を見る' : 'Open full page'}<ExternalLink size={14} />
        </a>
        <button type="button" aria-label={next} onClick={() => setIndex((index + 1) % samples.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"><ArrowRight size={18} /></button>
      </div>
      <p className="mt-3 text-center text-xs leading-5 text-white/55">{sample.theme} · {sample.images}{ko ? '장 입력' : ' input images'} · {ko ? 'AI 생성 카피·구성 + 제공된 상품 사진' : 'AI copy and layout with supplied product images'}</p>
    </section>
  );
}

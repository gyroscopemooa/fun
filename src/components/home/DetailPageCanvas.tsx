import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import type {
  GeneratedCopy,
  ProductDetailFormValues,
  ProductDetailResult,
  ProductSection,
  RenderSection,
  ThemeKey
} from '@/lib/product-detail-studio';

// The canvas is the actual sellable detail page. It uses inline styles only so the same
// markup can be rasterized (PNG/JPG/PDF) and serialized to standalone HTML unchanged.

export type SectionAction = 'image' | 'up' | 'down' | 'hide';

type Palette = {
  bg: string;
  surface: string;
  ink: string;
  sub: string;
  accent: string;
  accentInk: string;
  dark: string;
  darkInk: string;
  darkSub: string;
  line: string;
};

export const DETAIL_PAGE_PALETTES: Record<ThemeKey, Palette> = {
  premium: {
    bg: '#fbf8f3',
    surface: '#f2ece2',
    ink: '#1c1917',
    sub: '#57534e',
    accent: '#a87b3d',
    accentInk: '#ffffff',
    dark: '#1c1917',
    darkInk: '#faf7f2',
    darkSub: '#d6cfc4',
    line: '#e5ddd0'
  },
  minimal: {
    bg: '#ffffff',
    surface: '#f3f6fa',
    ink: '#0f172a',
    sub: '#475569',
    accent: '#2563eb',
    accentInk: '#ffffff',
    dark: '#0f172a',
    darkInk: '#f8fafc',
    darkSub: '#cbd5e1',
    line: '#e2e8f0'
  },
  playful: {
    bg: '#fff8f4',
    surface: '#ffebe3',
    ink: '#2a1717',
    sub: '#6b4c4c',
    accent: '#f0505a',
    accentInk: '#ffffff',
    dark: '#f0505a',
    darkInk: '#ffffff',
    darkSub: '#ffe1e3',
    line: '#f6d3c8'
  },
  forest: { bg: '#f7f9f0', surface: '#e8efdf', ink: '#203626', sub: '#4c624e', accent: '#356346', accentInk: '#ffffff', dark: '#203b2b', darkInk: '#f7f9f0', darkSub: '#cadbc6', line: '#cddbc5' },
  blush: { bg: '#fff7f8', surface: '#f8e5eb', ink: '#482634', sub: '#785563', accent: '#a33c62', accentInk: '#ffffff', dark: '#62253e', darkInk: '#fff7f8', darkSub: '#efcad8', line: '#e9cbd6' },
  lavender: { bg: '#faf7ff', surface: '#eee7f8', ink: '#342445', sub: '#6a577e', accent: '#7550a3', accentInk: '#ffffff', dark: '#3f2856', darkInk: '#faf7ff', darkSub: '#ded0ef', line: '#dcd0ec' },
  ocean: { bg: '#f3fbff', surface: '#e0f1f7', ink: '#173a4a', sub: '#4b6876', accent: '#096b88', accentInk: '#ffffff', dark: '#123d50', darkInk: '#f3fbff', darkSub: '#c3e2ed', line: '#c3e0eb' },
  sand: { bg: '#fcf6ed', surface: '#f0e3d2', ink: '#443025', sub: '#78614f', accent: '#a64d2d', accentInk: '#ffffff', dark: '#553829', darkInk: '#fff7ed', darkSub: '#e8d2bc', line: '#deccb5' },
  monochrome: { bg: '#ffffff', surface: '#f0f0f0', ink: '#171717', sub: '#525252', accent: '#171717', accentInk: '#ffffff', dark: '#171717', darkInk: '#ffffff', darkSub: '#d4d4d4', line: '#d4d4d4' },
  midnight: { bg: '#111827', surface: '#1e293b', ink: '#f8f2e6', sub: '#c3cbd8', accent: '#e7c77d', accentInk: '#1c2433', dark: '#080e1b', darkInk: '#f8f2e6', darkSub: '#d4c9b3', line: '#38465c' }
};

const FONT_STACK = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

type DetailPageCanvasProps = {
  result: ProductDetailResult;
  sections: RenderSection[];
  formValues: ProductDetailFormValues;
  theme: ThemeKey;
  width: number;
  imageSource?: 'url' | 'dataUrl';
  editable?: boolean;
  zoomable?: boolean;
  onEditCopy?: (patch: Partial<GeneratedCopy>) => void;
  onEditSection?: (index: number, patch: Partial<ProductSection>) => void;
  onSectionAction?: (index: number, action: SectionAction) => void;
};

type EditableProps = {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  value: string;
  style: CSSProperties;
  editable?: boolean;
  onCommit?: (value: string) => void;
};

function Editable({ as: Tag = 'p', value, style, editable, onCommit }: EditableProps) {
  if (!editable || !onCommit) {
    return <Tag style={style}>{value}</Tag>;
  }
  return (
    <Tag
      style={{ ...style, outline: '1.5px dashed rgba(37, 99, 235, 0.45)', outlineOffset: 4, borderRadius: 4, cursor: 'text' }}
      contentEditable
      suppressContentEditableWarning
      onBlur={(event) => {
        const next = event.currentTarget.innerText.replace(/\n{3,}/g, '\n\n').trim();
        if (next !== value) onCommit(next);
      }}
    >
      {value}
    </Tag>
  );
}

const CheckIcon = ({ color, size, ink = '#ffffff' }: { color: string; size: number; ink?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill={color} />
    <path d="M7 12.5l3.2 3.2L17 9" stroke={ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function DetailPageCanvas({
  result,
  sections,
  formValues,
  theme,
  width,
  imageSource = 'url',
  editable = false,
  zoomable = false,
  onEditCopy,
  onEditSection,
  onSectionAction
}: DetailPageCanvasProps) {
  const c = DETAIL_PAGE_PALETTES[theme] ?? DETAIL_PAGE_PALETTES.premium;
  const cardBackground = theme === 'midnight' ? c.bg : '#ffffff';
  const u = width / 860;
  const px = (value: number) => Math.round(value * u);
  const copy = result.generated_copy;
  const productName = formValues.productName.trim();
  const price = formValues.price.trim();
  const padX = px(64);

  const srcOf = (section: RenderSection | undefined) => {
    if (!section?.image) return '';
    return imageSource === 'dataUrl' ? section.image.dataUrl : section.image.url;
  };

  const heroSection = sections[0]?.type === 'hero' ? sections[0] : undefined;
  const bodySections = (heroSection ? sections.slice(1) : sections).filter((section) => !section.hidden);
  const specRows = copy.spec_rows ?? [];
  const comparisonRows = copy.comparison_rows ?? [];
  const faq = copy.faq ?? [];
  const notices = copy.notices ?? [];
  const hasIngredientSection = bodySections.some((section) => section.type === 'ingredient');
  let pointCounter = 0;

  const eyebrowStyle: CSSProperties = {
    margin: 0,
    fontSize: px(17),
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: c.accent,
    textTransform: 'uppercase'
  };
  const titleStyle: CSSProperties = {
    margin: `${px(14)}px 0 0`,
    fontSize: px(46),
    lineHeight: 1.28,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: c.ink,
    whiteSpace: 'pre-line',
    wordBreak: 'keep-all'
  };
  const bodyStyle: CSSProperties = {
    margin: `${px(22)}px auto 0`,
    maxWidth: px(640),
    fontSize: px(22),
    lineHeight: 1.75,
    color: c.sub,
    whiteSpace: 'pre-line',
    wordBreak: 'keep-all'
  };

  const renderImage = (section: RenderSection | undefined, options: { bleed?: boolean; radius?: number; ratio?: string; flush?: boolean } = {}) => {
    if (section?.layout === 'text-focus' && section.type !== 'hero') return null;
    const src = srcOf(section);
    const radius = options.bleed ? 0 : px(options.radius ?? 28);
    if (!src) {
      return (
        <div
          style={{
            margin: options.flush ? 0 : options.bleed ? `${px(44)}px 0 0` : `${px(44)}px ${padX}px 0`,
            aspectRatio: options.ratio ?? '4 / 3',
            borderRadius: radius,
            background: c.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.sub,
            fontSize: px(18)
          }}
        >
          상품 사진
        </div>
      );
    }
    return (
      <div style={{ margin: options.flush ? 0 : options.bleed ? `${px(44)}px 0 0` : `${px(44)}px ${padX}px 0`, borderRadius: radius, overflow: 'hidden', background: c.surface }}>
        <img
          src={src}
          alt={section?.title ?? productName}
          {...(zoomable ? { 'data-zoomable': true } : {})}
          style={{
            display: 'block',
            width: '100%',
            height: options.ratio ? '100%' : 'auto',
            aspectRatio: options.ratio,
            objectFit: 'contain'
          }}
        />
      </div>
    );
  };

  const renderBullets = (section: RenderSection, variant: 'check' | 'grid' | 'numbered', onSurface = false) => {
    const boxBg = onSurface ? cardBackground : c.surface;
    const bullets = section.bullets ?? [];
    if (!bullets.length) return null;
    const commit = (bulletIndex: number) => (value: string) => {
      const next = [...bullets];
      next[bulletIndex] = value;
      onEditSection?.(section.sourceIndex, { bullets: next.filter(Boolean) });
    };

    if (variant === 'grid') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: px(14), margin: `${px(36)}px ${padX}px 0` }}>
          {bullets.map((bullet, bulletIndex) => (
            <div key={`${section.id}-b-${bulletIndex}`} style={{ background: cardBackground, border: `1px solid ${c.line}`, borderRadius: px(20), padding: `${px(24)}px ${px(22)}px`, textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: px(15), fontWeight: 800, letterSpacing: '0.12em', color: c.accent }}>{String(bulletIndex + 1).padStart(2, '0')}</p>
              <Editable
                value={bullet}
                editable={editable}
                onCommit={commit(bulletIndex)}
                style={{ margin: `${px(10)}px 0 0`, fontSize: px(21), lineHeight: 1.5, fontWeight: 700, color: c.ink, wordBreak: 'keep-all' }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (variant === 'numbered') {
      return (
        <div style={{ margin: `${px(36)}px ${padX}px 0`, display: 'grid', gap: px(14) }}>
          {bullets.map((bullet, bulletIndex) => (
            <div key={`${section.id}-b-${bulletIndex}`} style={{ display: 'flex', alignItems: 'center', gap: px(20), background: boxBg, borderRadius: px(20), padding: `${px(22)}px ${px(26)}px`, textAlign: 'left' }}>
              <span style={{ fontSize: px(34), fontWeight: 900, color: c.accent, lineHeight: 1, minWidth: px(46) }}>{bulletIndex + 1}</span>
              <Editable
                value={bullet}
                editable={editable}
                onCommit={commit(bulletIndex)}
                style={{ margin: 0, fontSize: px(22), lineHeight: 1.5, fontWeight: 700, color: c.ink, wordBreak: 'keep-all' }}
              />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div style={{ margin: `${px(36)}px ${padX}px 0`, background: boxBg, borderRadius: px(24), padding: `${px(28)}px ${px(32)}px`, display: 'grid', gap: px(16), textAlign: 'left' }}>
        {bullets.map((bullet, bulletIndex) => (
          <div key={`${section.id}-b-${bulletIndex}`} style={{ display: 'flex', alignItems: 'center', gap: px(14) }}>
            <CheckIcon color={c.accent} ink={c.accentInk} size={px(28)} />
            <Editable
              value={bullet}
              editable={editable}
              onCommit={commit(bulletIndex)}
              style={{ margin: 0, fontSize: px(22), lineHeight: 1.5, fontWeight: 700, color: c.ink, wordBreak: 'keep-all' }}
            />
          </div>
        ))}
      </div>
    );
  };

  const renderHeading = (section: RenderSection, eyebrow: string, dark = false, compact = false) => (
    <div style={{ padding: compact ? 0 : `0 ${padX}px`, textAlign: compact ? 'left' : 'center' }}>
      {eyebrow ? (
        <Editable
          value={eyebrow}
          editable={editable}
          onCommit={(value) => onEditSection?.(section.sourceIndex, { eyebrow: value })}
          style={{ ...eyebrowStyle, color: dark ? c.darkSub : c.accent }}
        />
      ) : null}
      <Editable
        as="h2"
        value={section.title}
        editable={editable}
        onCommit={(value) => onEditSection?.(section.sourceIndex, { title: value })}
        style={{ ...titleStyle, fontSize: px(compact ? 36 : 46), color: dark ? c.darkInk : c.ink }}
      />
      <Editable
        value={section.text}
        editable={editable}
        onCommit={(value) => onEditSection?.(section.sourceIndex, { text: value })}
        style={{ ...bodyStyle, color: dark ? c.darkSub : c.sub }}
      />
    </div>
  );

  const renderTable = (rows: Array<{ label: string; value: string }>) => (
    <div style={{ margin: `${px(36)}px ${padX}px 0`, borderTop: `2px solid ${c.ink}`, textAlign: 'left' }}>
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} style={{ display: 'flex', borderBottom: `1px solid ${c.line}` }}>
          <div style={{ width: '32%', padding: `${px(20)}px ${px(20)}px`, background: c.surface, fontSize: px(18), fontWeight: 700, color: c.ink }}>{row.label}</div>
          <div style={{ flex: 1, padding: `${px(20)}px ${px(24)}px`, fontSize: px(19), lineHeight: 1.6, color: c.sub, wordBreak: 'keep-all' }}>{row.value}</div>
        </div>
      ))}
    </div>
  );

  const renderSectionBody = (section: RenderSection, order: number) => {
    const sectionPadding = `${px(110)}px 0 ${px(110)}px`;

    const flexible = ['feature', 'usage', 'detail', 'benefit'].includes(section.type);
    if (flexible && section.layout === 'split') {
      return (
        <div data-section-layout="split" style={{ padding: `${px(72)}px ${px(40)}px`, background: order % 2 ? c.surface : c.bg }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', alignItems: 'center', gap: px(36) }}>
            <div style={{ order: order % 2 ? 2 : 0, minWidth: 0 }}>{renderImage(section, { flush: true, radius: 16 })}</div>
            <div style={{ minWidth: 0 }}>{renderHeading(section, section.eyebrow || 'DETAIL', false, true)}</div>
          </div>
          {renderBullets(section, 'grid')}
        </div>
      );
    }
    if (flexible && section.layout === 'image-first') {
      return (
        <div data-section-layout="image-first" style={{ paddingBottom: px(80), background: c.surface }}>
          {renderImage(section, { flush: true, bleed: true })}
          <div style={{ marginTop: px(54) }}>{renderHeading(section, section.eyebrow || 'LOOK CLOSER')}</div>
          {renderBullets(section, 'check', true)}
        </div>
      );
    }
    if (flexible && section.layout === 'text-focus') {
      return (
        <div data-section-layout="text-focus" style={{ padding: sectionPadding, background: c.surface, borderTop: `1px solid ${c.line}` }}>
          {renderHeading(section, section.eyebrow || 'POINT')}
          {renderBullets(section, 'numbered', true)}
        </div>
      );
    }

    switch (section.type) {
      case 'feature': {
        pointCounter += 1;
        const eyebrow = section.eyebrow || `POINT ${String(pointCounter).padStart(2, '0')}`;
        return (
          <div style={{ padding: sectionPadding, background: c.bg }}>
            {renderHeading(section, eyebrow)}
            {renderImage(section, { radius: 28 })}
            {renderBullets(section, 'check')}
          </div>
        );
      }
      case 'usage':
        return (
          <div style={{ padding: `${px(110)}px 0 0`, background: c.surface }}>
            {renderHeading(section, section.eyebrow || 'HOW TO USE')}
            {renderBullets(section, 'check', true)}
            {renderImage(section, { bleed: true })}
          </div>
        );
      case 'detail':
        return (
          <div style={{ padding: sectionPadding, background: c.bg }}>
            {renderHeading(section, section.eyebrow || 'DETAIL')}
            {renderImage(section, { radius: 28, ratio: '1 / 1' })}
            {renderBullets(section, 'grid')}
          </div>
        );
      case 'benefit':
        return (
          <div style={{ padding: sectionPadding, background: c.surface }}>
            {renderHeading(section, section.eyebrow || 'BENEFIT')}
            {renderBullets(section, 'numbered', true)}
            {renderImage(section, { radius: 28 })}
          </div>
        );
      case 'ingredient':
        return (
          <div style={{ padding: sectionPadding, background: c.bg }}>
            {renderHeading(section, section.eyebrow || 'INFORMATION')}
            {specRows.length ? renderTable(specRows) : renderBullets(section, 'check')}
            {renderImage(section, { radius: 28 })}
          </div>
        );
      case 'comparison':
        return (
          <div style={{ padding: sectionPadding, background: c.bg }}>
            {renderHeading(section, section.eyebrow || 'COMPARE')}
            {comparisonRows.length ? (
              <div style={{ margin: `${px(40)}px ${padX}px 0`, borderRadius: px(24), overflow: 'hidden', border: `1px solid ${c.line}` }}>
                <div style={{ display: 'flex', fontSize: px(18), fontWeight: 800 }}>
                  <div style={{ width: '28%', padding: px(20), background: c.surface }} />
                  <div style={{ flex: 1, padding: px(20), background: c.surface, color: c.sub, textAlign: 'center' }}>일반적인 제품</div>
                  <div style={{ flex: 1, padding: px(20), background: c.accent, color: c.accentInk, textAlign: 'center' }}>{productName || '이 상품'}</div>
                </div>
                {comparisonRows.map((row) => (
                  <div key={row.label} style={{ display: 'flex', borderTop: `1px solid ${c.line}`, fontSize: px(19), alignItems: 'stretch' }}>
                    <div style={{ width: '28%', padding: px(20), fontWeight: 700, color: c.ink, background: cardBackground }}>{row.label}</div>
                    <div style={{ flex: 1, padding: px(20), color: c.sub, textAlign: 'center', background: cardBackground, wordBreak: 'keep-all' }}>{row.ordinary}</div>
                    <div style={{ flex: 1, padding: px(20), color: c.ink, fontWeight: 800, textAlign: 'center', background: cardBackground, wordBreak: 'keep-all' }}>{row.ours}</div>
                  </div>
                ))}
              </div>
            ) : renderBullets(section, 'check')}
            {renderImage(section, { radius: 28 })}
          </div>
        );
      case 'proof':
        return (
          <div style={{ padding: sectionPadding, background: c.dark }}>
            {renderHeading(section, section.eyebrow || 'WHY US', true)}
            {(section.bullets ?? []).length ? (
              <div style={{ margin: `${px(40)}px ${padX}px 0`, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: px(14) }}>
                {(section.bullets ?? []).map((bullet, bulletIndex) => (
                  <div key={`${section.id}-p-${bulletIndex}`} style={{ border: `1px solid rgba(255,255,255,0.22)`, borderRadius: px(20), padding: `${px(26)}px ${px(22)}px`, textAlign: 'center' }}>
                    <Editable
                      value={bullet}
                      editable={editable}
                      onCommit={(value) => {
                        const next = [...(section.bullets ?? [])];
                        next[bulletIndex] = value;
                        onEditSection?.(section.sourceIndex, { bullets: next.filter(Boolean) });
                      }}
                      style={{ margin: 0, fontSize: px(21), fontWeight: 800, lineHeight: 1.5, color: c.darkInk, wordBreak: 'keep-all' }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {renderImage(section, { radius: 28 })}
          </div>
        );
      case 'cta':
        return (
          <div style={{ padding: `${px(120)}px 0 ${px(120)}px`, background: c.dark, textAlign: 'center' }}>
            {renderImage(section, { radius: 28, ratio: '4 / 3' })}
            <div style={{ height: px(56) }} />
            {renderHeading(section, section.eyebrow || '', true)}
            {productName ? (
              <div style={{ margin: `${px(40)}px auto 0`, display: 'inline-flex', flexDirection: 'column', gap: px(6), padding: `${px(22)}px ${px(40)}px`, borderRadius: px(999), background: c.darkInk }}>
                <span style={{ fontSize: px(20), fontWeight: 800, color: c.dark === c.accent ? c.ink : c.dark }}>{productName}</span>
                {price ? <span style={{ fontSize: px(17), color: c.sub }}>{price}</span> : null}
              </div>
            ) : null}
          </div>
        );
      case 'hero':
      default:
        return (
          <div style={{ padding: sectionPadding, background: order % 2 ? c.surface : c.bg }}>
            {renderHeading(section, section.eyebrow || '')}
            {renderImage(section, { radius: 28 })}
            {renderBullets(section, 'check')}
          </div>
        );
    }
  };

  const heroImageSource = heroSection ?? sections[0];
  const heroLayout = heroImageSource?.layout ?? 'stacked';

  return (
    <div
      style={{
        width,
        margin: '0 auto',
        background: c.bg,
        color: c.ink,
        fontFamily: FONT_STACK,
        textAlign: 'center',
        overflow: 'hidden'
      }}
    >
      <header data-export-section="true" data-section-layout={heroLayout} style={{ background: c.bg }}>
        <div style={{ display: heroLayout === 'split' ? 'grid' : 'flex', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ minWidth: 0, width: '100%', order: heroLayout === 'image-first' ? 2 : 0, padding: `${px(72)}px ${px(heroLayout === 'split' ? 36 : 64)}px` }}>
          {copy.badge ? (
            <Editable
              as="span"
              value={copy.badge}
              editable={editable}
              onCommit={(value) => onEditCopy?.({ badge: value })}
              style={{ display: 'inline-block', padding: `${px(10)}px ${px(22)}px`, borderRadius: px(999), background: c.accent, color: c.accentInk, fontSize: px(17), fontWeight: 800 }}
            />
          ) : null}
          {productName && !copy.headline.includes(productName) ? (
            <p style={{ margin: `${px(26)}px 0 0`, fontSize: px(20), fontWeight: 700, color: c.sub, letterSpacing: '0.02em' }}>{productName}</p>
          ) : null}
          <Editable
            as="h1"
            value={copy.headline}
            editable={editable}
            onCommit={(value) => onEditCopy?.({ headline: value })}
            style={{ margin: `${px(16)}px 0 0`, fontSize: px(heroLayout === 'split' ? 42 : 62), lineHeight: 1.22, fontWeight: 900, letterSpacing: '-0.04em', color: c.ink, whiteSpace: 'pre-line', wordBreak: 'keep-all' }}
          />
          <Editable
            value={copy.subheadline}
            editable={editable}
            onCommit={(value) => onEditCopy?.({ subheadline: value })}
            style={{ ...bodyStyle, fontSize: px(23) }}
          />
        </div>
        <div style={{ minWidth: 0, width: '100%', order: 1 }}>{renderImage(heroImageSource, { bleed: true, flush: true })}</div>
        </div>
        {copy.key_selling_points.length ? (
          <div style={{ display: 'flex', background: c.dark }}>
            {copy.key_selling_points.slice(0, 3).map((point, pointIndex) => (
              <div
                key={`${point}-${pointIndex}`}
                style={{
                  flex: 1,
                  padding: `${px(34)}px ${px(16)}px`,
                  borderLeft: pointIndex ? '1px solid rgba(255,255,255,0.16)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: px(12)
                }}
              >
                <CheckIcon color={c.dark === c.accent ? 'rgba(255,255,255,0.28)' : c.accent} ink={c.accentInk} size={px(30)} />
                <Editable
                  value={point}
                  editable={editable}
                  onCommit={(value) => {
                    const next = [...copy.key_selling_points];
                    next[pointIndex] = value;
                    onEditCopy?.({ key_selling_points: next.filter(Boolean) });
                  }}
                  style={{ margin: 0, fontSize: px(19), fontWeight: 700, lineHeight: 1.45, color: c.darkInk, wordBreak: 'keep-all' }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </header>

      {bodySections.map((section, order) => (
        <section key={section.id} data-export-section="true" style={{ position: 'relative' }}>
          {editable && onSectionAction ? (
            <div
              data-export-ignore="true"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', gap: 6, fontFamily: FONT_STACK }}
            >
              {([
                ['image', '사진 변경'],
                ['up', '위로'],
                ['down', '아래로'],
                ['hide', '숨기기']
              ] as Array<[SectionAction, string]>).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => onSectionAction(section.sourceIndex, action)}
                  style={{ border: 0, borderRadius: 999, padding: '7px 12px', background: 'rgba(15,23,42,0.82)', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {renderSectionBody(section, order)}
        </section>
      ))}

      {!hasIngredientSection && specRows.length ? (
        <section data-export-section="true" style={{ padding: `${px(100)}px 0`, background: c.bg }}>
          <p style={eyebrowStyle}>INFORMATION</p>
          <h2 style={titleStyle}>상품 정보</h2>
          {renderTable(specRows)}
        </section>
      ) : null}

      {faq.length ? (
        <section data-export-section="true" style={{ padding: `${px(100)}px 0`, background: c.surface }}>
          <p style={eyebrowStyle}>FAQ</p>
          <h2 style={titleStyle}>자주 묻는 질문</h2>
          <div style={{ margin: `${px(40)}px ${padX}px 0`, display: 'grid', gap: px(14), textAlign: 'left' }}>
            {faq.map((item, faqIndex) => (
              <div key={`${item.question}-${faqIndex}`} style={{ background: cardBackground, borderRadius: px(20), padding: `${px(26)}px ${px(28)}px` }}>
                <p style={{ margin: 0, fontSize: px(21), fontWeight: 800, color: c.ink, lineHeight: 1.5 }}>
                  <span style={{ color: c.accent, marginRight: px(10) }}>Q.</span>
                  {item.question}
                </p>
                <p style={{ margin: `${px(12)}px 0 0`, fontSize: px(19), color: c.sub, lineHeight: 1.7, wordBreak: 'keep-all' }}>
                  <span style={{ fontWeight: 800, color: c.ink, marginRight: px(10) }}>A.</span>
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {notices.length || copy.closing_line ? (
        <section data-export-section="true" style={{ padding: `${px(80)}px ${padX}px ${px(90)}px`, background: c.bg }}>
          {copy.closing_line ? (
            <Editable
              value={copy.closing_line}
              editable={editable}
              onCommit={(value) => onEditCopy?.({ closing_line: value })}
              style={{ margin: `0 0 ${px(notices.length ? 56 : 0)}px`, fontSize: px(28), fontWeight: 800, color: c.ink, lineHeight: 1.5, wordBreak: 'keep-all' }}
            />
          ) : null}
          {notices.length ? (
            <div style={{ border: `1px solid ${c.line}`, borderRadius: px(20), padding: `${px(28)}px ${px(30)}px`, textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: px(19), fontWeight: 800, color: c.ink }}>구매 전 확인해주세요</p>
              <ul style={{ margin: `${px(14)}px 0 0`, paddingLeft: px(22), color: c.sub, fontSize: px(17), lineHeight: 1.8 }}>
                {notices.map((notice) => <li key={notice}>{notice}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export const renderDetailPageHtml = async (props: DetailPageCanvasProps & { title: string }): Promise<string> => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(<DetailPageCanvas {...props} imageSource="dataUrl" editable={false} zoomable={false} />);
  const escapedTitle = props.title.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapedTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
<style>*{box-sizing:border-box}body{margin:0;background:#f1f5f9}img{max-width:100%}</style>
</head>
<body>
${markup}
</body>
</html>`;
};

export const MARKETPLACE_WIDTHS: Array<{ key: string; label: string; width: number }> = [
  { key: 'smartstore', label: '스마트스토어', width: 860 },
  { key: 'coupang', label: '쿠팡', width: 780 },
  { key: 'gmarket', label: 'G마켓', width: 860 },
  { key: '11st', label: '11번가', width: 800 },
  { key: 'auction', label: '옥션', width: 980 },
  { key: 'own', label: '자사몰', width: 1000 }
];

// Shows a fixed-width canvas scaled down to fit its container, while the inner node keeps its
// real layout width so exports are pixel-accurate.
export const ScaledFrame = forwardRef<HTMLDivElement, { width: number; children: ReactNode }>(function ScaledFrame({ width, children }, ref) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const nextScale = Math.min(1, outer.clientWidth / width);
      setScale(nextScale);
      setHeight(inner.offsetHeight * nextScale);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} style={{ width: '100%', height: height || undefined, overflow: 'hidden' }}>
      <div ref={innerRef} style={{ width, margin: scale === 1 ? '0 auto' : 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div ref={ref} style={{ width }}>
          {children}
        </div>
      </div>
    </div>
  );
});

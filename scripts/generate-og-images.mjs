// Generates the 1200x630 link-preview images in public/og/ (JPEG) for shared results.
// Run locally (needs a Korean system font such as Malgun Gothic) and commit the images:
//   node scripts/generate-og-images.mjs
// Data files are imported straight from src/lib via Node's TypeScript type stripping (Node 22.18+).
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MBTI_INFO, MBTI_TYPES } from '../src/lib/mbti.ts';
import { TONES, readableText } from '../src/lib/personal-color-tones.ts';
import { LOVE_TYPE_TEST } from '../src/lib/type-tests/love-type.ts';
import { OFFICE_TYPE_TEST } from '../src/lib/type-tests/office-type.ts';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'og');
const FONT = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const W = 1200;
const H = 630;

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Rough width model: Hangul is about 1em wide, Latin/digits/spaces about 0.58em.
const textWidth = (text, size) => [...text].reduce((w, ch) => w + (/[ㄱ-힣]/.test(ch) ? 1 : 0.58) * size, 0);

const wrap = (text, size, maxWidth, maxLines) => {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,]?$/, '')}…`;
  }
  return lines;
};

const text = (x, y, size, content, { weight = 700, fill = '#fff', anchor = 'start', opacity = 1, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" fill-opacity="${opacity}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(content)}</text>`;

const lines = (x, y, size, list, gap, opts) => list.map((l, i) => text(x, y + i * gap, size, l, opts)).join('');

const chips = (x, y, list, { fill = '#ffffff', fillOpacity = 0.16, color = '#fff', size = 26 } = {}) => {
  let cx = x;
  return list.map((label) => {
    const w = textWidth(`#${label}`, size) + 40;
    const out = `<rect x="${cx}" y="${y}" width="${w}" height="${size + 26}" rx="${(size + 26) / 2}" fill="${fill}" fill-opacity="${fillOpacity}"/>${text(cx + 20, y + size + 6, size, `#${label}`, { fill: color })}`;
    cx += w + 12;
    return out;
  }).join('');
};

const footer = (label, dark = true) => `
  <rect x="64" y="${H - 96}" width="${textWidth(label, 26) + 56}" height="52" rx="26" fill="${dark ? '#ffffff' : '#0f172a'}"/>
  ${text(92, H - 61, 26, label, { fill: dark ? '#0f172a' : '#ffffff', weight: 800 })}
  ${text(W - 64, H - 60, 26, 'manytool.net', { anchor: 'end', opacity: dark ? 0.55 : 0.5, fill: dark ? '#fff' : '#0f172a' })}`;

const glow = (id, color, cx, cy, r) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${color}" stop-opacity="0.95"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const svg = (defs, body, bg = '#0f172a') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;

const mbtiImage = (type) => {
  const info = MBTI_INFO[type];
  const summary = wrap(info.summary, 28, 330, 4);
  return svg(glow('g', info.color, '0.85', '0.1', '0.75'), `
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${text(64, 96, 26, 'MY MBTI', { spacing: 8, opacity: 0.7 })}
    ${text(56, 300, 210, type, { weight: 900, spacing: -4 })}
    ${text(64, 372, 50, info.nickname, { weight: 800 })}
    ${chips(64, 404, info.strengths)}
    <rect x="${W - 460}" y="96" width="396" height="380" rx="36" fill="#ffffff" fill-opacity="0.1"/>
    ${text(W - 428, 150, 24, '이런 사람이에요', { opacity: 0.6 })}
    ${lines(W - 428, 200, 28, summary, 42, {})}
    ${text(W - 428, 386, 24, '연애 스타일', { opacity: 0.6 })}
    ${lines(W - 428, 424, 24, wrap(info.love, 24, 330, 2), 34, { opacity: 0.9 })}
    ${footer('나도 MBTI 테스트 하기 →')}`);
};

const toneImage = (tone) => {
  const main = tone.best[0].hex;
  const ink = readableText(main);
  const swatchW = (W - 128 - 7 * 12) / 8;
  return svg('', `
    <rect x="0" y="0" width="${W}" height="330" fill="${main}"/>
    ${text(64, 92, 26, 'PERSONAL COLOR', { spacing: 8, fill: ink, opacity: 0.7 })}
    ${text(60, 220, 104, tone.label, { weight: 900, fill: ink })}
    ${text(64, 284, 36, tone.english.toUpperCase(), { fill: ink, opacity: 0.75, spacing: 4 })}
    ${tone.best.map((s, i) => `<rect x="${64 + i * (swatchW + 12)}" y="362" width="${swatchW}" height="72" rx="16" fill="${s.hex}" stroke="#0f172a" stroke-opacity="0.08"/>`).join('')}
    ${lines(64, 490, 30, wrap(tone.tagline, 30, 1070, 1), 40, { fill: '#334155', weight: 700 })}
    ${footer('나도 퍼스널컬러 진단하기 →', false)}`, '#ffffff');
};

const typeImage = (test, result) => {
  const [c1] = test.gradient;
  const summary = wrap(result.summary, 32, 1060, 2);
  return svg(`${glow('g', result.color, '0.9', '0.05', '0.8')}${glow('h', c1, '0', '1', '0.7')}`, `
    <rect width="${W}" height="${H}" fill="url(#h)" fill-opacity="0.5"/>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${text(64, 96, 26, test.kicker, { spacing: 8, opacity: 0.7 })}
    ${text(64, 168, 36, `나의 ${test.title.replace(' 테스트', '')}은`, { opacity: 0.85 })}
    ${text(60, 290, 112, result.name, { weight: 900 })}
    ${lines(64, 360, 32, summary, 46, { opacity: 0.9 })}
    ${chips(64, 434, result.traits)}
    ${footer(`나도 ${test.title} 하기 →`)}`);
};

const coverImage = ({ kicker, title, sub, colors, cta, tags = [] }) => svg(`${glow('g', colors[0], '0.9', '0.05', '0.8')}${glow('h', colors[1], '0.05', '1', '0.8')}`, `
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#h)"/>
  ${text(64, 110, 28, kicker, { spacing: 8, opacity: 0.75 })}
  ${text(60, 240, 96, title, { weight: 900 })}
  ${lines(64, 320, 34, wrap(sub, 34, 1060, 2), 48, { opacity: 0.85 })}
  ${chips(64, 420, tags)}
  ${footer(cta)}`);

const write = async (file, markup) => {
  const target = path.join(outDir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(markup)).jpeg({ quality: 86, mozjpeg: true }).toFile(target);
  return file;
};

const jobs = [
  ...MBTI_TYPES.map((type) => write(`mbti/${type}.jpg`, mbtiImage(type))),
  ...TONES.map((tone) => write(`personal-color/${tone.id}.jpg`, toneImage(tone))),
  ...[LOVE_TYPE_TEST, OFFICE_TYPE_TEST].flatMap((test) => test.results.map((r) => write(`${test.slug}/${r.id}.jpg`, typeImage(test, r)))),
  write('mbti-test.jpg', coverImage({ kicker: 'MBTI TEST', title: 'MBTI 테스트', sub: '20문항으로 알아보는 나의 성향 · 연애 스타일과 찰떡 유형까지', colors: ['#8b5cf6', '#ec4899'], cta: '무료로 테스트하기 →', tags: ['20문항', '결과 카드', '궁합 연결'] })),
  write('love-compatibility.jpg', coverImage({ kicker: 'LOVE MATCH', title: '연애 궁합 테스트', sub: '이름 · 별자리 · MBTI로 보는 우리 둘의 궁합', colors: ['#fb7185', '#be185d'], cta: '우리 궁합 보기 →', tags: ['이름 케미', '별자리', 'MBTI'] })),
  write('game-team-balancer.jpg', coverImage({ kicker: 'TEAM BALANCER', title: '내전 팀 나누기 결과', sub: '티어 · 포인트 · 최근 승패로 나눈 공정한 팀과 캐릭터 조합', colors: ['#2563eb', '#dc2626'], cta: '우리 팀도 나누기 →', tags: ['롤', '발로란트', '오버워치'] })),
  write('love-type-test.jpg', coverImage({ kicker: 'LOVE TYPE TEST', title: '연애 유형 테스트', sub: '직진 불도저부터 집콕 힐링러까지, 8가지 연애 유형 중 나는?', colors: LOVE_TYPE_TEST.gradient, cta: '12문항 테스트하기 →', tags: ['12문항', '8가지 유형', '찰떡 상대'] })),
  write('office-type-test.jpg', coverImage({ kicker: 'OFFICE TYPE TEST', title: '직장인 유형 테스트', sub: '칼퇴 요정? 엑셀 장인? 회사에서 나의 일하는 스타일은?', colors: OFFICE_TYPE_TEST.gradient, cta: '12문항 테스트하기 →', tags: ['12문항', '8가지 유형', '찰떡 동료'] })),
  write('tests.jpg', coverImage({ kicker: 'MANYTOOL TESTS', title: '무료 테스트 모음', sub: 'MBTI · 연애 궁합 · 퍼스널컬러 · 직장인 유형까지 바로 해 보기', colors: ['#f59e0b', '#8b5cf6'], cta: '테스트 고르기 →', tags: ['성격', '연애', '외모', '운세'] }))
];

const done = await Promise.all(jobs);
console.log(`wrote ${done.length} images to public/og`);

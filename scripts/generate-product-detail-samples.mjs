import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../node-api/package.json', import.meta.url));
require('dotenv').config({ path: path.join(root, 'node-api/.env') });
const { generateCommerceDetailPage } = await import('../node-api/src/commerce/detailPage.js');
const target = path.join(root, 'src/data/product-detail-samples');
await fs.mkdir(target, { recursive: true });
const recipes = [
 { id: 'stripe-lookbook', label: '스트라이프 리본 원피스', summary: '사진 한 장으로 시작하는 산뜻한 룩북', theme: 'playful', width: 860, images: ['/images/product-model/women-01-garment.webp'], formValues: { productName: '스트라이프 리본 프릴 원피스', price: '', audience: '여름 원피스를 찾는 성인 여성', sellingPoints: '사진에 보이는 스트라이프, 가슴 리본, 어깨 끈, 프릴 밑단을 소개. 소재 성분과 치수는 미제공.', prompt: '사진부터 크게 보여주는 룩북형. 히어로는 image-first, 짧고 발랄한 문구. 사진은 한 장뿐이므로 중간에는 텍스트 중심 코디 제안도 넣어 반복을 줄여줘.', pageCount: 5 } },
 { id: 'knit-editorial', label: '그레이 니트 원피스', summary: '상품컷과 착장샷을 함께 쓰는 에디토리얼', theme: 'premium', width: 860, images: ['/images/product-model/women-02-garment.webp','/images/product-model/women-02-model.webp'], formValues: { productName: '그레이 레이스 숄더 니트 원피스', price: '', audience: '차분한 분위기의 니트 원피스를 찾는 성인 여성', sellingPoints: '사진에 보이는 골지 조직, 레이스 숄더 스트랩, 랩 형태 상단, 옆트임. 소재 성분 및 실측 미제공. 착장샷은 AI 생성 코디 예시.', prompt: '잡지 같은 에디토리얼 구성. 첫 화면은 split으로 사진과 제목을 나란히. 착장 분위기를 먼저 보여주고 디테일을 설명해줘. 짧은 카피와 큰 여백.', pageCount: 7 } },
 { id: 'ivory-catalog', label: '아이보리 리본 원피스', summary: '디자인과 코디를 간결하게 정리한 카탈로그', theme: 'minimal', width: 780, images: ['/images/product-model/women-03-garment.webp','/images/product-model/women-03-model.webp'], formValues: { productName: '아이보리 리본 반소매 원피스', price: '', audience: '단정한 외출복을 찾는 성인 여성', sellingPoints: '목 리본, 반소매, 절개선과 퍼지는 스커트 형태가 사진에 보임. 소재, 사이즈, 세탁법은 미제공. 착장샷은 AI 생성 예시.', prompt: '깔끔한 카탈로그형. 첫 화면은 stacked, 디자인 정보와 코디 안내를 순서대로. 상세 디자인은 split, 구매 전 확인은 text-focus로. 확인 안 된 스펙이나 비교 우위는 쓰지 마.', pageCount: 5 } }
];
for (const recipe of recipes) {
 const output = path.join(target, `${recipe.id}.json`);
 try { await fs.access(output); console.log(`${recipe.id}: existing result retained`); continue; } catch {}
 console.log(`${recipe.id}: generating actual detail page`);
 const images = await Promise.all(recipe.images.map(async url => `data:image/webp;base64,${(await fs.readFile(path.join(root,'public',url))).toString('base64')}`));
 const result = await generateCommerceDetailPage({ ...recipe.formValues, theme: recipe.theme, images });
 const record = { ...recipe, generatedAt: new Date().toISOString(), model: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini', pipeline: 'node-api/src/commerce/detailPage.js#generateCommerceDetailPage', result };
 await fs.writeFile(output, JSON.stringify(record, null, 2) + '\n');
 console.log(`${recipe.id}: saved ${result.sections.length} sections; ${result.sections.map(s => s.layout).join(', ')}`);
}

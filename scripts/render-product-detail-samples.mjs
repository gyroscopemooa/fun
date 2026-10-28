import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = path.join(root, 'node-api/node-api-storage/product-detail-samples');
await fs.mkdir(scratch, { recursive: true });
const bundle = path.join(scratch, 'renderer.mjs');
await build({ stdin: { contents: "export { renderDetailPageHtml } from './src/components/home/DetailPageCanvas'; export { buildRenderSections, ensureResultIntegrity } from './src/lib/product-detail-studio';", resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', outfile: bundle });
const { renderDetailPageHtml, buildRenderSections, ensureResultIntegrity } = await import(pathToFileURL(bundle).href);
const dir = path.join(root, 'src/data/product-detail-samples');
const output = path.join(root, 'public/samples/product-detail');
await fs.mkdir(output, { recursive: true });
for (const file of (await fs.readdir(dir)).filter(name => name.endsWith('.json'))) {
 const sample = JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));
 const images = sample.images.map((url,i) => ({ id: `sample-${i}`, file: new File([],`${i}.webp`), url, dataUrl: url }));
 const result = ensureResultIntegrity(sample.result, sample.formValues.pageCount);
 const sections = buildRenderSections(result, images);
 let html = await renderDetailPageHtml({ result, sections, formValues: sample.formValues, theme: sample.theme, width: sample.width, title: `${sample.label} · AI 상세페이지 생성 샘플` });
 const responsive = `<script>const page=document.body.querySelector(':scope > div');function fit(){if(page)page.style.zoom=String(Math.min(1,document.documentElement.clientWidth/${sample.width}));}window.addEventListener('resize',fit);fit();</script>`;
 html = html.replace('</body>', `${responsive}</body>`);
 await fs.writeFile(path.join(output, `${sample.id}.html`),html);
 console.log(`${sample.id}: rendered actual generated result through production DetailPageCanvas (${sections.length} sections)`);
}

import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {zipSync} from 'fflate';
const root=new URL('../browser-extension/',import.meta.url);
// Explicit allowlist: no tests, source maps, user data, tokens or dev settings.
const files=['manifest.json','background.js','capture.js','selection-menu.js','image-source.js','core.js','handoff.js','image-tools.js','popup.html','popup.js','review.html','review.js','ui.css','privacy.html'];
const archive={};for(const file of files)archive[file]=new Uint8Array(readFileSync(new URL(file,root)));
const manifest=JSON.parse(new TextDecoder().decode(archive['manifest.json']));
const out=new URL('../tmp/extension/',import.meta.url);mkdirSync(out,{recursive:true});
const file=new URL(`manytool-extension-${manifest.version}.zip`,out);writeFileSync(file,zipSync(archive,{level:9}));
console.log(file.pathname);

import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
const source = process.argv[2];
if (!source) throw new Error('Pass the approved source PNG path.');
await mkdir('public/brand', { recursive: true });
await copyFile(source, 'public/brand/manytool-master.png');
for (const [path, size] of [['public/logo.png',512],['public/favicon.png',64],['public/apple-touch-icon.png',180],['public/brand/manytool-96.png',96],['public/brand/manytool-192.png',192],['public/brand/manytool-512.png',512]]) {
  await sharp(source).resize(size,size,{fit:'contain',background:'#ffffff'}).png().toFile(path);
}
const sizes=[16,32,48,256], images=await Promise.all(sizes.map(size=>sharp(source).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
images.forEach((png,i)=>{const p=6+16*i;header[p]=sizes[i]===256?0:sizes[i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;});
await writeFile('public/favicon.ico',Buffer.concat([header,...images]));
// Also replace the old default SVG for consumers that cached its URL.
const png=await sharp(source).resize(64,64).png().toBuffer();
await writeFile('public/favicon.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${png.toString('base64')}"/></svg>`);
for (const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
  const dir=`mobile/android/app/src/main/res/mipmap-${density}`;await mkdir(dir,{recursive:true});
  await sharp(source).resize(size,size).png().toFile(`${dir}/ic_launcher.png`);
}
console.log('Prepared web logos, multi-resolution favicon, Apple touch icon and Android launcher icons from approved PNG.');

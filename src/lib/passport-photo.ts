export const PASSPORT_OUTPUT = {width:413,height:531};
export function passportCrop(width:number,height:number,zoom:number,x:number,y:number) {
  if (![width,height,zoom,x,y].every(Number.isFinite)||width<=0||height<=0||zoom<1) throw new Error('사진 크기를 확인해주세요.');
  const scale=Math.max(413/width,531/height)*zoom;
  const dw=width*scale,dh=height*scale;
  return {scale,width:dw,height:dh,x:(413-dw)/2-Math.max(-1,Math.min(1,x))*(dw-413)/2,y:(531-dh)/2-Math.max(-1,Math.min(1,y))*(dh-531)/2};
}
export function headLengthMm(crown:number,chin:number) {return (chin-crown)*45/100;}
export function jpegWith300Dpi(bytes:Uint8Array) {
  const out=bytes.slice();
  // Canvas JPEGs include JFIF APP0; physical print density does not alter pixels.
  for(let i=2;i+16<out.length;i++) if(out[i]===255&&out[i+1]===224&&String.fromCharCode(...out.slice(i+4,i+9))==='JFIF\0') {
    out[i+11]=1;out[i+12]=1;out[i+13]=44;out[i+14]=1;out[i+15]=44;break;
  }
  return out;
}

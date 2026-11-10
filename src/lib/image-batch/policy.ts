export const MAX_FILES=12, MAX_BYTES=12*1024*1024, MAX_PIXELS=24_000_000;
export function outputSize(w:number,h:number,maxW:number,maxH:number){
 if(![w,h,maxW,maxH].every(n=>Number.isFinite(n)&&n>0))throw new Error('잘못된 이미지 크기입니다.');
 const scale=Math.min(1,maxW/w,maxH/h);return {width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale))};
}
export function normalizedRect(x1:number,y1:number,x2:number,y2:number){return {x:Math.max(0,Math.min(x1,x2)),y:Math.max(0,Math.min(y1,y2)),w:Math.abs(x2-x1),h:Math.abs(y2-y1)};}

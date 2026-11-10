export function imageOptions(width,height,targetWidth,mime,quality) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>16000000)throw Error('이미지 크기가 너무 큽니다. 더 작은 캡처를 사용해 주세요.');
  if(!Number.isInteger(targetWidth)||targetWidth<16||targetWidth>Math.min(8192,width))throw Error(`가로 크기는 16~${Math.min(8192,width)}px로 입력해 주세요. 원본보다 크게 늘리지 않습니다.`);
  if(!['image/png','image/jpeg','image/webp'].includes(mime))throw Error('지원하지 않는 파일 형식입니다.');
  if(!Number.isFinite(quality)||quality<0.1||quality>1)throw Error('품질은 10~100%로 선택해 주세요.');
  return {width:targetWidth,height:Math.max(1,Math.round(height*targetWidth/width)),mime,quality};
}
export async function convertCapture(dataUrl,targetWidth,mime,quality) {
  const bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  try{
    const options=imageOptions(bitmap.width,bitmap.height,targetWidth,mime,quality);
    const canvas=document.createElement('canvas');canvas.width=options.width;canvas.height=options.height;
    const context=canvas.getContext('2d');if(!context)throw Error('이미지를 처리할 수 없습니다.');
    if(mime==='image/jpeg'){context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);}
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,quality));
    if(!blob || blob.type!==mime)throw Error('브라우저가 이 출력 형식을 지원하지 않습니다. PNG로 다시 시도해 주세요.');
    return {blob,width:canvas.width,height:canvas.height,originalBytes:bytes.length};
  }finally{bitmap.close();}
}

// Uses the already-rendered image. Never fetches with cookies or broad host permission.
export function readPageImage(source) {
  const image=[...document.images].find(img=>img.currentSrc===source||img.src===source);
  if(!image||!image.complete||!image.naturalWidth)throw Error('이미지를 읽을 수 없습니다. 영역 캡처를 이용해 주세요.');
  const width=image.naturalWidth,height=image.naturalHeight;
  if(width*height>16000000)throw Error('이미지가 너무 큽니다. 영역 캡처를 이용해 주세요.');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw Error('이미지 처리 실패');
  context.drawImage(image,0,0);
  try {const value=canvas.toDataURL('image/png');if(value.length>4*1024*1024)throw Error('size');return value;}
  catch {throw Error('원본 사이트가 이미지 읽기를 제한하거나 이미지가 너무 큽니다. 영역 캡처를 이용해 주세요.');}
}

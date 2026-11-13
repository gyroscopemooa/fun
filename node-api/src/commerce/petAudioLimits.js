import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Decode locally before sending audio to a paid provider. Client duration is untrusted.
export async function assertPetAudioDuration(audio,maxSeconds=30){
  if(!Buffer.isBuffer(audio?.buffer)||!audio.buffer.length||audio.buffer.length>10*1024*1024)throw Error('Invalid pet audio');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'manytool-pet-duration-'));
  try{
    const input=path.join(dir,'input');await fs.writeFile(input,audio.buffer);
    await new Promise((resolve,reject)=>{
      const binary=process.env.FFMPEG_PATH?.trim()||'ffmpeg';
      // Decoding through the limit+one second detects over-limit, malformed and hanging uploads.
      const child=spawn(binary,['-v','error','-i',input,'-t',String(maxSeconds+1),'-vn','-ac','1','-ar','8000','-f','s16le','pipe:1'],{stdio:['ignore','pipe','ignore'],windowsHide:true});
      let size=0,settled=false,failure=null;const limit=maxSeconds*8000*2;
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
      const timer=setTimeout(()=>{failure=Error('Pet audio validation timed out');child.kill();},15000);
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>limit&&!failure){failure=Error('Pet audio exceeds 30 seconds');child.kill();}});
      child.on('error',()=>finish(Error('Pet audio validator unavailable')));
      // Wait for close before removing input: Windows retains the file until FFmpeg exits.
      child.on('close',code=>finish(failure||(code!==0||!size?Error('Invalid pet audio'):null)));
    });
  }finally{await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
}

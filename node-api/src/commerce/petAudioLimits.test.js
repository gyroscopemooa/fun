import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {assertPetAudioDuration} from './petAudioLimits.js';
function wav(seconds){
  const bytes=seconds*8000*2,b=Buffer.alloc(44+bytes);b.write('RIFF');b.writeUInt32LE(36+bytes,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(bytes,40);return b;
}
test('duration validation never trusts declared filename or client metadata',async()=>{
  assert.equal(spawnSync(process.env.FFMPEG_PATH||'ffmpeg',['-version'],{windowsHide:true,stdio:'ignore'}).status,0,'FFmpeg is required for paid audio preflight');
  await assertPetAudioDuration({buffer:wav(1),filename:'untrusted'});
  await assertPetAudioDuration({buffer:wav(30)});
  await assert.rejects(assertPetAudioDuration({buffer:wav(31),durationSeconds:1}),/exceeds/);
  await assert.rejects(assertPetAudioDuration({buffer:Buffer.from('not audio')}),/Invalid/);
});

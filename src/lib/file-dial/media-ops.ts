// Video/audio conversion with ffmpeg.wasm. The ~31 MB core is fetched from jsDelivr on first use and
// cached by the browser; files never leave the device.
import type { FFmpeg } from '@ffmpeg/ffmpeg';

const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
/** Above this, browser memory limits make ffmpeg.wasm unreliable. */
export const MEDIA_MAX_BYTES = 500 * 1024 * 1024;

let loading: Promise<FFmpeg> | null = null;

const loadFfmpeg = (onStatus: (text: string) => void) => {
  if (!loading) {
    loading = (async () => {
      onStatus('변환 엔진을 불러오는 중… (처음 한 번만, 약 30MB)');
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
      });
      return ffmpeg;
    })().catch((error) => {
      loading = null;
      throw new Error(`변환 엔진을 불러오지 못했어요. 인터넷 연결을 확인해 주세요. (${(error as Error).message})`);
    });
  }
  return loading;
};

const extOf = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'bin').toLowerCase();

let runId = 0;

/** Runs one ffmpeg command on a single input file and returns the output as a Blob. */
export const runFfmpeg = async (file: File, outExt: string, args: string[], onStatus: (text: string) => void, mime: string) => {
  if (file.size > MEDIA_MAX_BYTES) throw new Error('500MB보다 큰 파일은 브라우저에서 변환하기 어려워요. 먼저 잘라서 나눠 주세요.');
  const ffmpeg = await loadFfmpeg(onStatus);
  const id = (runId += 1);
  const input = `in${id}.${extOf(file.name)}`;
  const output = `out${id}.${outExt}`;
  const onProgress = ({ progress }: { progress: number }) => {
    if (progress > 0 && progress <= 1) onStatus(`${file.name}: ${Math.round(progress * 100)}%`);
  };
  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => { logs.push(message); if (logs.length > 60) logs.shift(); };
  ffmpeg.on('progress', onProgress);
  ffmpeg.on('log', onLog);
  try {
    onStatus(`${file.name}: 준비 중…`);
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const code = await ffmpeg.exec(['-i', input, ...args, output]);
    if (code !== 0) {
      const log = logs.join(' ');
      if (/does not contain any stream|matches no streams|Output file is empty/i.test(log)) {
        throw new Error(args.includes('-vn') ? '이 영상에는 소리가 없어서 오디오로 바꿀 수 없어요.' : '이 파일에는 변환할 트랙이 없어요.');
      }
      throw new Error('이 파일은 변환하지 못했어요. 코덱을 지원하지 않거나 파일이 손상됐을 수 있어요.');
    }
    const data = await ffmpeg.readFile(output);
    if (typeof data === 'string' || !data.length) throw new Error('결과 파일이 비어 있어요.');
    return new Blob([new Uint8Array(data)], { type: mime });
  } finally {
    ffmpeg.off('progress', onProgress);
    ffmpeg.off('log', onLog);
    await ffmpeg.deleteFile(input).catch(() => undefined);
    await ffmpeg.deleteFile(output).catch(() => undefined);
  }
};

/** Media duration in seconds, read through a media element (fast, no ffmpeg needed). */
export const mediaDuration = (file: File) =>
  new Promise<number>((resolve) => {
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.onloadedmetadata = () => { resolve(Number.isFinite(el.duration) ? el.duration : 0); URL.revokeObjectURL(url); };
    el.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    el.src = url;
  });

// Presets. Encoders are tuned for speed because wasm runs single-threaded.
export const VIDEO_TO_MP4 = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];
export const VIDEO_COMPRESS = ['-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'];
export const VIDEO_MUTE = ['-c:v', 'copy', '-an'];
export const GIF_MAX_SECONDS = 15;
export const VIDEO_TO_GIF = ['-t', String(GIF_MAX_SECONDS), '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0'];
export const TO_MP3 = ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'];
export const TO_WAV = ['-vn', '-c:a', 'pcm_s16le'];
export const TO_M4A = ['-vn', '-c:a', 'aac', '-b:a', '160k'];
export const TO_OGG = ['-vn', '-c:a', 'libvorbis', '-q:a', '5'];
export const LOUDER = ['-af', 'volume=1.6', '-c:a', 'libmp3lame', '-q:a', '2'];

/** Cut [start, end] seconds without re-encoding (fast; cuts land on the nearest keyframe for video). */
export const trimArgs = (start: number, end: number) => ['-ss', start.toFixed(2), '-to', end.toFixed(2), '-c', 'copy', '-avoid_negative_ts', 'make_zero'];

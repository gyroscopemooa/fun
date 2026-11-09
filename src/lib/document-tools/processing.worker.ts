/// <reference lib="webworker" />
import { splitForTranslation } from './text';

const report = (message: string) => self.postMessage({ type: 'progress', message });
self.onmessage = async ({ data }) => {
  try {
    let text = '';
    if (data.kind === 'photo') {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('kor+eng', 1, {
        logger: (event) => report(event.status === 'recognizing text'
          ? `사진에서 글자를 가져오는 중 · ${Math.round(event.progress * 100)}%`
          : '사진 읽기를 준비하고 있습니다. 처음에는 필요한 파일을 내려받습니다.'),
      });
      try { text = (await worker.recognize(data.image)).data.text; }
      finally { await worker.terminate(); }
    } else {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.backends.onnx.wasm!.numThreads = 1;
      const files = new Map<string, number>();
      const progress_callback = (event: any) => {
        if (event.status === 'progress') {
          files.set(event.file, event.loaded || 0);
          const mb = Math.round([...files.values()].reduce((a, b) => a + b, 0) / 1048576);
          report(`필요한 파일을 내려받는 중 · ${mb} MB 받음`);
        } else if (event.status === 'initiate') report('필요한 파일을 확인하고 있습니다.');
      };
      if (data.kind === 'voice') {
        const transcribe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', { dtype: 'q8', device: 'wasm', progress_callback });
        try {
          report('음성을 글로 바꾸고 있습니다. 기기에 따라 몇 분 정도 걸릴 수 있어요.');
          const result = await transcribe(data.audio, { language: data.language === 'ko' ? 'korean' : 'english', task: 'transcribe', chunk_length_s: 25, stride_length_s: 5 });
          text = (Array.isArray(result) ? result[0] : result).text;
        } finally { await transcribe.dispose(); }
      } else {
        const model = data.source === 'ko' ? 'Xenova/opus-mt-ko-en' : 'Xenova/m2m100_418M';
        const translate = await pipeline('translation', model, { dtype: 'q8', device: 'wasm', progress_callback });
        try {
          const chunks = splitForTranslation(data.text);
          const output: string[] = [];
          for (let i = 0; i < chunks.length; i++) {
            report(`번역 중 · ${i + 1}/${chunks.length}`);
            if (!chunks[i].trim()) { output.push(''); continue; }
            const options = { src_lang: data.source, tgt_lang: data.source === 'ko' ? 'en' : 'ko', max_new_tokens: 256 };
            // v3's declaration requires a full config although the public API accepts partial options.
            const result = await translate(chunks[i], options as unknown as Parameters<typeof translate>[1]);
            const item = (Array.isArray(result) ? result[0] : result) as { translation_text: string };
            output.push(item.translation_text);
          }
          text = output.join('\n');
        } finally { await translate.dispose(); }
      }
    }
    self.postMessage({ type: 'done', text: text.trim() });
  } catch (error) {
    console.error(error);
    self.postMessage({ type: 'error', message: '처리하지 못했습니다. 인터넷 연결과 기기 여유 공간을 확인하고 다시 시도해 주세요. 계속 실패하면 PC의 최신 Chrome 또는 Edge에서 실행해 주세요.' });
  }
};

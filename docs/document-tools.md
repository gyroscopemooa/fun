# 사진·음성 문서와 번역 도구

## 공개 경로

- `/photo-to-document`: JPG/PNG/WebP 한글·영문 인쇄 글자 추출. 최대 15MB, 4천만 화소. 처리 전 긴 변을 2600px로 축소.
- `/voice-to-document`: 60초 마이크 녹음 또는 2분·30MB 이하 음성 업로드. 한국어/영어 선택. 브라우저가 해독 가능한 형식만 지원.
- `/text-translator`: 한국어↔영어, 한 번에 3000자. UTF-8 TXT 불러오기, 음성을 원문으로 입력한 뒤 번역. 서식 보존 번역은 지원하지 않음.

결과는 수정 후 BOM 포함 UTF-8 TXT 또는 정식 OOXML DOCX로 저장한다. HWP/HWPX 직접 출력은 아직 제공하지 않으며 DOCX를 한글에서 열어 저장하는 안내를 표시한다. 파일 확장자만 바꾸는 방식은 사용하지 않는다.

## 실행 구조

`DocumentWorkshop.tsx`가 입력 검증, 녹음, 미리보기, 취소, 편집을 담당한다. `processing.worker.ts`에서 CPU 기반 WASM으로 처리한다. 각 작업 뒤 worker를 종료하고 다운로드한 자료는 라이브러리의 브라우저 캐시에 맡긴다. 입력 사진·음성·글의 업로드 API는 없으며 작업 내용을 localStorage에 자동 보관하지 않는다. 서버 추론·유료 API·결제·예약 실행은 추가하지 않았다.

- Tesseract.js 6.0.1 (Apache-2.0): `kor+eng`. 기본 공개 배포처에서 worker, WASM, 언어 자료 다운로드.
- Transformers.js 3.8.1 (Apache-2.0), ONNX Runtime (MIT): Web Worker에서 단일 스레드 WASM.
- `Xenova/whisper-tiny` / OpenAI Whisper (Apache-2.0): 16kHz 모노, 전사만 수행. 번역으로 바꾸지 않는다.
- `Xenova/opus-mt-ko-en` / Helsinki-NLP (Apache-2.0): 한국어→영어.
- `Xenova/m2m100_418M` / Meta M2M100 (MIT): 영어→한국어.
- docx 9.5.1 (MIT): 사용자 글의 문단과 XML 특수문자를 안전하게 저장.

참고: https://github.com/naptha/tesseract.js · https://huggingface.co/Xenova/whisper-tiny · https://huggingface.co/Helsinki-NLP/opus-mt-ko-en · https://huggingface.co/facebook/m2m100_418M · https://github.com/dolanmiu/docx

TranStream 링크는 사용자가 직접 여는 외부 서비스 소개다. 원문·번역문·음성을 전달하지 않으며 API 연동으로 표시하지 않는다.

## 검증

`node scripts/test-document-tools.mjs`는 다운로드한 TXT와 DOCX 내부 XML, TXT 입력, 길이 제한, 깨진 음성 파일 오류 복구, 모바일 가로 넘침을 검사한다. 기본 URL은 `http://127.0.0.1:4371`, `DOCUMENT_TOOLS_TEST_URL`로 변경할 수 있다. 설치된 Chrome을 사용하며 `PLAYWRIGHT_CHANNEL`로 변경 가능하다.

`DOCUMENT_TOOLS_REAL=1`이면 공개 자료를 실제로 내려받아 인쇄 글자, 공개 JFK 음성 예제, 번역을 실행한다. `tmp/document-tools-jfk.wav`에 https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav 를 먼저 내려받아야 한다. 자료 다운로드가 수백 MB 발생하며 기기별 속도·정확도 차이가 크다. 테스트에서 광고·분석 요청은 차단한다.

## 추후 유료 처리 추가 위치

입력·편집·다운로드 UI는 유지하고 작업 실행 부분에 별도 서버 provider를 추가한다. 서버 측 인증, 사용량 한도, 가격, 크레딧 차감, 실패 환불, 파일 보존기간, 외부 전송 안내는 실제 API를 연결할 때 구현한다. 현재 무료 버튼에서 비용 발생 API를 호출하지 않는다. 기본 기능 사용량은 기존 사이트 분석과 별도로 구현하지 않았으며 입력 원문을 분석 이벤트에 넣지 않는다.

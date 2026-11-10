/** Provider boundary for later server integration. No paid provider is enabled here. */
export const AI_ACTIONS = ['explain', 'summarize', 'rewrite', 'reply', 'error', 'image-translate', 'image-table'] as const;
export type AiAction = typeof AI_ACTIONS[number];
export interface AiCapability { enabled: boolean; providerLabel: string; creditsReady: boolean }
export const AI_CAPABILITY: Readonly<AiCapability> = Object.freeze({ enabled: false, providerLabel: '', creditsReady: false });
export interface AiRequest { action: AiAction; text: string; consent: { providerLabel: string; shareSelectedContent: boolean } }
/** Prepare only the explicitly selected text, never page URL, cookies or hidden DOM. */
export function prepareAiRequest(action: AiAction, text: string, consent: AiRequest['consent'], capability: AiCapability = AI_CAPABILITY): AiRequest {
  if (!capability.enabled || !capability.creditsReady) throw new Error('AI 연결과 크레딧 검증을 준비하고 있습니다. 전송하거나 차감하지 않았습니다.');
  if (!AI_ACTIONS.includes(action)) throw new Error('지원하지 않는 작업입니다.');
  if (!text.trim() || text.length > 20000) throw new Error('선택한 내용은 1~20,000자여야 합니다.');
  if (!consent.shareSelectedContent || !capability.providerLabel || consent.providerLabel !== capability.providerLabel) throw new Error('내용과 처리 업체를 확인한 뒤 이번 전송에 동의해 주세요.');
  return { action, text, consent: { ...consent } };
}

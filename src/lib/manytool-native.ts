/** Optional Android capability adapter. Web remains functional without the native shell.
 * No secrets, cookies, arbitrary URLs, payment commands or automatic requests are supported. */
export interface NativeCapabilities {
  version: number;
  saveText: boolean;
  shareText: boolean;
  playCredits: boolean;
  notifications: boolean;
  authenticatedVideo: boolean;
}
type Reply = { id: string; ok: boolean; message?: string; capabilities?: NativeCapabilities };
type Port = { postMessage(data: string): void; onmessage: ((event: { data: string }) => void) | null };
declare global { interface Window { ManytoolNative?: Port } }
const waiting = new Map<string, { resolve: (value: Reply) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let attached: Port | undefined;
function request(command: 'capabilities' | 'saveText' | 'shareText', text?: string): Promise<Reply> {
  if (typeof window === 'undefined' || !window.ManytoolNative) return Promise.reject(new Error('native_unavailable'));
  const port = window.ManytoolNative;
  if (port !== attached) {
    for (const pending of waiting.values()) { clearTimeout(pending.timer); pending.reject(new Error('native_replaced')); }
    waiting.clear(); attached = port;
    port.onmessage = event => {
      try {
        const reply = JSON.parse(event.data) as Reply;
        const pending = waiting.get(reply.id);
        if (!pending || typeof reply.ok !== 'boolean') return;
        waiting.delete(reply.id); clearTimeout(pending.timer);
        if (reply.ok) pending.resolve(reply); else pending.reject(new Error(reply.message || 'native_rejected'));
      } catch { /* Ignore unrecognized messages, never log selected content. */ }
    };
  }
  if (waiting.size >= 4) return Promise.reject(new Error('native_busy'));
  if (text !== undefined && (!text.length || text.length > 64000)) return Promise.reject(new Error('invalid_text'));
  const id = crypto.randomUUID();
  const payload = JSON.stringify({ id, command, ...(text === undefined ? {} : { text }) });
  if (payload.length > 72000) return Promise.reject(new Error('invalid_text'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('native_timeout')); }, 60000);
    waiting.set(id, { resolve, reject, timer });
    try { port.postMessage(payload); }
    catch { clearTimeout(timer); waiting.delete(id); reject(new Error('native_unavailable')); }
  });
}
export async function nativeCapabilities(): Promise<NativeCapabilities | null> {
  try { const result = await request('capabilities'); return result.capabilities?.version === 1 ? result.capabilities : null; }
  catch { return null; }
}
/** Call only from a user click. Resolves when native UI launches, not when a file is saved. */
export async function saveTextWithNative(text: string): Promise<void> { await request('saveText', text); }
/** Call only from a user click. Native confirmation + Android chooser choose the recipient. */
export async function shareTextWithNative(text: string): Promise<void> { await request('shareText', text); }

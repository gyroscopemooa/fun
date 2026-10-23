export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Opens the native share sheet (KakaoTalk, Discord, …) on phones and falls back to copying the link. */
export const shareResult = async ({ url, title, text }: { url: string; title: string; text?: string }): Promise<ShareOutcome> => {
  const absolute = new URL(url, window.location.origin).toString();
  if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ url: absolute, title, text });
      return 'shared';
    } catch (error) {
      // The user closing the sheet is not a failure worth a fallback.
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(absolute);
    return 'copied';
  } catch {
    window.prompt('아래 링크를 복사해 공유하세요', absolute);
    return 'copied';
  }
};

/** Packs a small JSON payload into a URL-safe string (UTF-8 safe for Korean names). */
export const encodeSharePayload = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const decodeSharePayload = <T>(packed: string): T | null => {
  try {
    const binary = atob(packed.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
};

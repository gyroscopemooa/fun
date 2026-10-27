import type { CircuitDocument } from '../model/schema.ts';
import { validateDocument } from '../model/validate.ts';
export const STORAGE_KEY = 'manytool:electric-practical:v1';
export function serialize(doc: CircuitDocument) { return JSON.stringify(doc, null, 2); }
export function deserialize(text: string): CircuitDocument {
  if (text.length > 500_000) throw new Error('파일은 500 KB 이하만 지원합니다.');
  const value: unknown = JSON.parse(text);
  const errors = validateDocument(value).filter(f => ['INVALID_MODEL', 'INVALID_TERMINAL'].includes(f.code));
  if (errors.length) throw new Error(errors.map(f => f.detail).join(' '));
  return value as CircuitDocument;
}

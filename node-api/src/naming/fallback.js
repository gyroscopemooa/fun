export function buildFallback({ error, suggestion = null }) {
  return {
    ok: false,
    error,
    suggestion
  };
}

export function getMissingStrokeSuggestion(chars, strokeMap, metaMap) {
  const missing = chars.filter((char) => !strokeMap.has(char));
  if (missing.length === 0) return null;

  const related = [];
  for (const [hanja, meta] of metaMap.entries()) {
    if (related.length >= 5) break;
    if (!meta?.reading) continue;
    if (missing.some((char) => meta.reading === char || meta.meaning === char)) {
      related.push(hanja);
    }
  }

  return {
    missing,
    related
  };
}

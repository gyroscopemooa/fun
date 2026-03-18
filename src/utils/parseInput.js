const DEFAULT_PALETTE = [
  '#22d3ee',
  '#a78bfa',
  '#fb7185',
  '#34d399',
  '#f59e0b',
  '#60a5fa',
  '#f472b6',
  '#f97316'
];

export function parseInput(rawInput = '') {
  const tokens = rawInput
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const merged = new Map();

  for (const token of tokens) {
    const match = token.match(/^(.*?)(?:\s*\*\s*(\d+))?$/);
    const rawLabel = match?.[1]?.trim() ?? '';
    const weight = Number(match?.[2] ?? 1);
    if (!rawLabel) continue;

    const prev = merged.get(rawLabel) ?? 0;
    merged.set(rawLabel, prev + (Number.isFinite(weight) && weight > 0 ? weight : 1));
  }

  const items = [...merged.entries()].map(([label, weight], index) => ({
    id: `slot-${index}-${label}`,
    label,
    weight,
    color: DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]
  }));

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  return {
    items,
    totalWeight
  };
}

// Rank ladders for LoL, Valorant and Overwatch mapped onto one rating scale.
// Every division step is worth 100 rating points and in-division points (LP / RR / progress %) fill the gap,
// so ratings from the three games behave the same way in the balancer and goal calculator.

export type RankGame = 'lol' | 'valorant' | 'overwatch';

export type RankStep = { id: string; label: string; tier: string; color: string };

type TierDef = { id: string; label: string; color: string; divisions: string[] };

const LOL_TIERS: TierDef[] = [
  { id: 'iron', label: '아이언', color: '#6B7280', divisions: ['4', '3', '2', '1'] },
  { id: 'bronze', label: '브론즈', color: '#A16207', divisions: ['4', '3', '2', '1'] },
  { id: 'silver', label: '실버', color: '#94A3B8', divisions: ['4', '3', '2', '1'] },
  { id: 'gold', label: '골드', color: '#EAB308', divisions: ['4', '3', '2', '1'] },
  { id: 'platinum', label: '플래티넘', color: '#14B8A6', divisions: ['4', '3', '2', '1'] },
  { id: 'emerald', label: '에메랄드', color: '#10B981', divisions: ['4', '3', '2', '1'] },
  { id: 'diamond', label: '다이아몬드', color: '#6366F1', divisions: ['4', '3', '2', '1'] },
  { id: 'master', label: '마스터', color: '#A855F7', divisions: [''] },
  { id: 'grandmaster', label: '그랜드마스터', color: '#EF4444', divisions: [''] },
  { id: 'challenger', label: '챌린저', color: '#F59E0B', divisions: [''] }
];

const VALORANT_TIERS: TierDef[] = [
  { id: 'iron', label: '아이언', color: '#6B7280', divisions: ['1', '2', '3'] },
  { id: 'bronze', label: '브론즈', color: '#A16207', divisions: ['1', '2', '3'] },
  { id: 'silver', label: '실버', color: '#94A3B8', divisions: ['1', '2', '3'] },
  { id: 'gold', label: '골드', color: '#EAB308', divisions: ['1', '2', '3'] },
  { id: 'platinum', label: '플래티넘', color: '#14B8A6', divisions: ['1', '2', '3'] },
  { id: 'diamond', label: '다이아몬드', color: '#A855F7', divisions: ['1', '2', '3'] },
  { id: 'ascendant', label: '초월자', color: '#10B981', divisions: ['1', '2', '3'] },
  { id: 'immortal', label: '불멸', color: '#E11D48', divisions: ['1', '2', '3'] },
  { id: 'radiant', label: '레디언트', color: '#FACC15', divisions: [''] }
];

const OVERWATCH_TIERS: TierDef[] = [
  { id: 'bronze', label: '브론즈', color: '#A16207', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'silver', label: '실버', color: '#94A3B8', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'gold', label: '골드', color: '#EAB308', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'platinum', label: '플래티넘', color: '#14B8A6', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'diamond', label: '다이아몬드', color: '#6366F1', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'master', label: '마스터', color: '#10B981', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'grandmaster', label: '그랜드마스터', color: '#EF4444', divisions: ['5', '4', '3', '2', '1'] },
  { id: 'champion', label: '챔피언', color: '#F59E0B', divisions: ['5', '4', '3', '2', '1'] }
];

export const RANK_GAMES: Record<RankGame, { label: string; emoji: string; pointLabel: string; pointMax: number; tiers: TierDef[]; gain: number; loss: number; positions: string[] }> = {
  lol: { label: '리그 오브 레전드', emoji: '⚔️', pointLabel: 'LP', pointMax: 100, tiers: LOL_TIERS, gain: 22, loss: 20, positions: ['탑', '정글', '미드', '원딜', '서폿'] },
  valorant: { label: '발로란트', emoji: '🎯', pointLabel: 'RR', pointMax: 100, tiers: VALORANT_TIERS, gain: 18, loss: 15, positions: ['타격대', '척후대', '전략가', '감시자'] },
  overwatch: { label: '오버워치', emoji: '🛡️', pointLabel: '진행도 %', pointMax: 100, tiers: OVERWATCH_TIERS, gain: 25, loss: 22, positions: ['돌격', '공격', '지원'] }
};

/** Flattened ladder, lowest first. */
export const ladderOf = (game: RankGame): RankStep[] =>
  RANK_GAMES[game].tiers.flatMap((tier) =>
    tier.divisions.map((division) => ({ id: `${tier.id}${division}`, label: division ? `${tier.label} ${division}` : tier.label, tier: tier.id, color: tier.color }))
  );

/** Rating = step index × 100 + points within the step (capped so apex tiers keep growing with LP/RR). */
export const ratingOf = (game: RankGame, stepId: string, points = 0) => {
  const ladder = ladderOf(game);
  const index = Math.max(0, ladder.findIndex((step) => step.id === stepId));
  const isApex = index === ladder.length - 1 || ladder[index].label === RANK_GAMES[game].tiers.find((t) => t.id === ladder[index].tier)?.label;
  const cap = isApex ? 1000 : RANK_GAMES[game].pointMax;
  return index * 100 + Math.max(0, Math.min(cap, points));
};

export const stepOfRating = (game: RankGame, rating: number) => {
  const ladder = ladderOf(game);
  return ladder[Math.max(0, Math.min(ladder.length - 1, Math.floor(rating / 100)))];
};

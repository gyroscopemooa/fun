import { GAMES } from './games';
import type { GameCharacter, RoleDef } from './types';

export type CompGame = keyof typeof GAMES;
export type CompMember = { id: number; position: string };
export type CompPick = { role: RoleDef; character: GameCharacter };

// Position labels used by the team balancer (src/lib/game-ranks.ts) mapped to picker role ids.
const POSITION_TO_ROLE: Record<CompGame, Record<string, string>> = {
  lol: { 탑: 'top', 정글: 'jungle', 미드: 'mid', 원딜: 'bot', 서폿: 'support' },
  valorant: { 타격대: 'duelist', 척후대: 'initiator', 전략가: 'controller', 감시자: 'sentinel' },
  overwatch: { 돌격: 'tank', 공격: 'damage', 지원: 'support' }
};

const FLEX: RoleDef = { id: 'any', label: '자유', emoji: '🎲', color: '#64748B', tip: '' };

const shuffle = <T,>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Gives every member a role (their main position, otherwise the first team slot still open)
 * and a character for it. `taken` carries ids already used, e.g. by the other team in LoL draft.
 */
export const assignTeamComp = (game: CompGame, roster: GameCharacter[], members: CompMember[], taken = new Set<string>()) => {
  const config = GAMES[game];
  const openSlots = [...config.team];
  const roleFor = new Map<number, string>();

  members.forEach((m) => {
    const role = POSITION_TO_ROLE[game][m.position];
    if (!role) return;
    roleFor.set(m.id, role);
    const slot = openSlots.indexOf(role);
    if (slot >= 0) openSlots.splice(slot, 1);
  });
  members.forEach((m) => {
    if (roleFor.has(m.id)) return;
    roleFor.set(m.id, openSlots.shift() ?? 'any');
  });

  const used = new Set(taken);
  const picks = new Map<number, CompPick>();
  members.forEach((m) => {
    const roleId = roleFor.get(m.id) ?? 'any';
    const role = config.roles.find((r) => r.id === roleId) ?? FLEX;
    const free = roster.filter((c) => !used.has(c.id));
    const character = shuffle(free.filter((c) => roleId === 'any' || config.inRole(c, roleId)))[0] ?? shuffle(free)[0];
    if (!character) return;
    used.add(character.id);
    picks.set(m.id, { role, character });
  });
  return picks;
};

/** LoL draft forbids the same champion on both teams; Valorant and Overwatch only within a team. */
export const uniqueAcrossTeams = (game: CompGame) => game === 'lol';

/** Rebuilds a pick from a shared link; unknown characters are dropped. */
export const restoreCompPick = (game: CompGame, roster: GameCharacter[], roleId: string, characterId: string): CompPick | null => {
  const character = roster.find((c) => c.id === characterId);
  if (!character) return null;
  return { role: GAMES[game].roles.find((r) => r.id === roleId) ?? FLEX, character };
};

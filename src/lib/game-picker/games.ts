import { LOL_FALLBACK } from './lol-data';
import { OVERWATCH_FALLBACK } from './overwatch-data';
import type { GameCharacter, GameConfig } from './types';
import { VALORANT_FALLBACK } from './valorant-data';

const byRole = (character: GameCharacter, roleId: string) => character.role === roleId;

const VALORANT_ROLE: Record<string, string> = { Duelist: 'duelist', Initiator: 'initiator', Controller: 'controller', Sentinel: 'sentinel' };

export const VALORANT: GameConfig = {
  id: 'valorant',
  unit: '요원',
  accent: '#FF4655',
  roles: [
    { id: 'duelist', label: '타격대', emoji: '⚔️', color: '#FF4655', tip: '먼저 진입해 교전을 여는 역할이에요. 에임과 자신감이 중요해요.' },
    { id: 'initiator', label: '척후대', emoji: '🦉', color: '#22C55E', tip: '정보를 모으고 진입을 도와요. 스킬 타이밍을 맞춰 주세요.' },
    { id: 'controller', label: '전략가', emoji: '🌫️', color: '#8B5CF6', tip: '연막으로 시야를 끊어 팀이 들어갈 길을 만들어요.' },
    { id: 'sentinel', label: '감시자', emoji: '🛡️', color: '#0EA5E9', tip: '사이트를 지키고 뒤를 막아요. 설치형 스킬 위치가 핵심이에요.' }
  ],
  team: ['duelist', 'initiator', 'controller', 'sentinel', 'any'],
  inRole: byRole,
  fallback: VALORANT_FALLBACK,
  async load() {
    const [ko, en] = await Promise.all(['ko-KR', 'en-US'].map((lang) =>
      fetch(`https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=${lang}`).then((r) => r.json())
    ));
    const names = new Map<string, string>(ko.data.map((a: { uuid: string; displayName: string }) => [a.uuid, a.displayName]));
    return en.data.map((a: { uuid: string; displayName: string; displayIcon: string; role: { displayName: string }; backgroundGradientColors?: string[] }) => ({
      id: a.uuid,
      name: names.get(a.uuid) ?? a.displayName,
      en: a.displayName,
      role: VALORANT_ROLE[a.role.displayName] ?? 'duelist',
      icon: a.displayIcon,
      color: `#${(a.backgroundGradientColors?.[0] ?? '0f1923ff').slice(0, 6)}`
    }));
  }
};

export const OVERWATCH: GameConfig = {
  id: 'overwatch',
  unit: '영웅',
  accent: '#F99E1A',
  roles: [
    { id: 'tank', label: '돌격', emoji: '🛡️', color: '#3B82F6', tip: '앞에서 공간을 만들고 팀을 지켜요. 위치 선정이 승패를 갈라요.' },
    { id: 'damage', label: '공격', emoji: '🎯', color: '#EF4444', tip: '적을 처치해 수적 우위를 만들어요. 각을 보고 끊어 주세요.' },
    { id: 'support', label: '지원', emoji: '💉', color: '#22C55E', tip: '팀을 살리고 버프를 줘요. 내가 살아 있어야 팀도 살아요.' }
  ],
  team: ['tank', 'damage', 'damage', 'support', 'support'],
  inRole: byRole,
  fallback: OVERWATCH_FALLBACK,
  async load() {
    const [ko, en] = await Promise.all(['ko-kr', 'en-us'].map((locale) =>
      fetch(`https://overfast-api.tekrop.fr/heroes?locale=${locale}`).then((r) => r.json())
    ));
    const names = new Map<string, string>(ko.map((h: { key: string; name: string }) => [h.key, h.name]));
    return en.map((h: { key: string; name: string; portrait: string; role: string }) => ({
      id: h.key,
      name: names.get(h.key) ?? h.name,
      en: h.name,
      role: h.role,
      icon: h.portrait
    }));
  }
};

const hasTag = (character: GameCharacter, ...tags: string[]) => tags.some((tag) => character.tags?.includes(tag));

// Same position heuristics as the original LoL picker, based on Data Dragon class tags.
const LOL_POSITION_TAGS: Record<string, string[]> = {
  top: ['Fighter', 'Tank'],
  jungle: ['Fighter', 'Assassin', 'Tank'],
  mid: ['Mage', 'Assassin'],
  bot: ['Marksman'],
  support: ['Support', 'Tank']
};

export const LOL: GameConfig = {
  id: 'lol',
  unit: '챔피언',
  accent: '#06B6D4',
  roles: [
    { id: 'top', label: '탑', emoji: '🗡️', color: '#F97316', tip: '라인전에서 버티고 성장해 한타 때 앞을 맡아요.' },
    { id: 'jungle', label: '정글', emoji: '🌿', color: '#22C55E', tip: '갱킹과 오브젝트로 게임 템포를 만들어요.' },
    { id: 'mid', label: '미드', emoji: '🔮', color: '#8B5CF6', tip: '로밍과 딜로 맵 전체에 영향을 줘요.' },
    { id: 'bot', label: '원딜', emoji: '🏹', color: '#EF4444', tip: '안전하게 성장해서 한타 후반 딜을 책임져요.' },
    { id: 'support', label: '서폿', emoji: '💫', color: '#06B6D4', tip: '시야와 이니시로 원딜과 팀을 받쳐 줘요.' }
  ],
  styles: [
    { id: 'carry', label: '캐리형', tags: ['Marksman', 'Assassin'] },
    { id: 'tank', label: '탱커형', tags: ['Tank'] },
    { id: 'utility', label: '유틸형', tags: ['Support'] },
    { id: 'fighter', label: '난전형', tags: ['Fighter'] },
    { id: 'poke', label: '포킹형', tags: ['Mage'] }
  ],
  team: ['top', 'jungle', 'mid', 'bot', 'support'],
  inRole: (character, roleId) => hasTag(character, ...(LOL_POSITION_TAGS[roleId] ?? [])),
  fallback: LOL_FALLBACK,
  async load() {
    const [version] = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    const payload = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`).then((r) => r.json());
    return Object.values(payload.data as Record<string, { id: string; name: string; tags: string[]; image: { full: string } }>)
      .filter((c) => !c.id.startsWith('Jade_'))
      .map((c) => ({
        id: c.id,
        name: c.name,
        en: c.id,
        role: 'all',
        tags: c.tags,
        icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.image.full}`
      }));
  }
};

export const GAMES = { valorant: VALORANT, overwatch: OVERWATCH, lol: LOL } as const;
export type GameId = keyof typeof GAMES;

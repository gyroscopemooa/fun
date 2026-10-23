export type GameCharacter = {
  id: string;
  name: string;
  en?: string;
  /** Primary role id; LoL champions use 'all' and are placed by `tags` instead. */
  role: string;
  tags?: string[];
  icon: string;
  color?: string;
};

export type RoleDef = { id: string; label: string; emoji: string; color: string; tip: string };
export type StyleDef = { id: string; label: string; tags: string[] };

export type GameConfig = {
  id: 'valorant' | 'overwatch' | 'lol';
  unit: string;
  accent: string;
  roles: RoleDef[];
  styles?: StyleDef[];
  /** Role ids for the five slots of a full team. */
  team: string[];
  inRole: (character: GameCharacter, roleId: string) => boolean;
  fallback: GameCharacter[];
  load: () => Promise<GameCharacter[]>;
};

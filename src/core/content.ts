import type { BuildingId, CreatureId, DiscoveryCategory, ItemId, NpcId, PipAbility, QuestId } from './types';

export interface ItemDef {
  icon: string;
  /** Price when buying at the village shop (undefined = not sold). */
  buy?: number;
  /** Price when selling to the shop (undefined = cannot be sold). */
  sell?: number;
  /** Common resources can be partially lost on defeat; never quest items or relics. */
  common: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { icon: '🪵', sell: 1, common: true },
  stone: { icon: '🪨', sell: 2, common: true },
  glow_berry: { icon: '🫐', buy: 4, sell: 2, common: true },
  veggie: { icon: '🥕', sell: 3, common: true },
  seed: { icon: '🌱', buy: 5, common: false },
  essence: { icon: '✨', sell: 4, common: false },
  purifier: { icon: '💎', buy: 30, common: false },
};

export const ITEM_ORDER: ItemId[] = ['wood', 'stone', 'glow_berry', 'veggie', 'seed', 'essence', 'purifier'];

export interface BuildingDef {
  cost: Partial<Record<ItemId, number>>;
  harmony: number;
  xp: number;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  house: { cost: { wood: 8, stone: 4 }, harmony: 15, xp: 20 },
  garden: { cost: { wood: 6, stone: 2, seed: 2 }, harmony: 10, xp: 15 },
};

export interface CreatureDef {
  icon: string;
  /** Item a creature likes; feeding it raises bond. */
  likes?: ItemId;
  bondPerFeed: number;
}

export const CREATURES: Record<CreatureId, CreatureDef> = {
  glowfox: { icon: '🦊', likes: 'glow_berry', bondPerFeed: 34 },
  ripplet: { icon: '🐢', likes: 'veggie', bondPerFeed: 50 },
  mossprite: { icon: '🌿', likes: 'essence', bondPerFeed: 50 },
  sunchick: { icon: '🐥', likes: 'glow_berry', bondPerFeed: 50 },
};

/** All entries that can appear in the Discovery Book during Phase 0. */
export const DISCOVERY_CATALOG: Record<DiscoveryCategory, string[]> = {
  creatures: ['glowfox', 'ripplet', 'mossprite', 'sunchick'],
  plants: ['glow_berry', 'oak', 'moonlily', 'starbloom'],
  relics: ['echo_egg', 'temple_seal'],
  places: ['whisper_village', 'emerald_forest', 'moonlit_lake', 'memory_grove', 'temple_gate'],
};

/** Discovery Book milestones (total discoveries). Rewards are applied by world rules. */
export const DISCOVERY_MILESTONES = [3, 8];

export type QuestObjective =
  | { type: 'gather'; item: ItemId; count: number }
  | { type: 'find'; target: 'egg'; count: 1 }
  | { type: 'build'; building: BuildingId; count: number }
  | { type: 'clear'; count: number }
  | { type: 'plant'; count: number }
  | { type: 'bond'; creature: CreatureId; count: 1 };

export interface QuestDef {
  giver: NpcId | 'pip';
  objective: QuestObjective;
  rewards: { coins?: number; xp?: number; items?: Partial<Record<ItemId, number>>; ability?: PipAbility };
  /** Quests that become available when this one completes. */
  unlocks: QuestId[];
  /** Pip's quests start immediately; NPC quests must be accepted by talking. */
  autoAccept: boolean;
}

export const QUESTS: Record<QuestId, QuestDef> = {
  q_first_steps: {
    giver: 'pip',
    objective: { type: 'gather', item: 'wood', count: 3 },
    rewards: { coins: 10, xp: 20, ability: 'glow' },
    unlocks: ['q_egg'],
    autoAccept: true,
  },
  q_egg: {
    giver: 'pip',
    objective: { type: 'find', target: 'egg', count: 1 },
    rewards: { xp: 30 },
    unlocks: ['q_home', 'q_lake'],
    autoAccept: true,
  },
  q_home: {
    giver: 'rocco',
    objective: { type: 'build', building: 'house', count: 1 },
    rewards: { coins: 20, xp: 25, items: { seed: 3 } },
    unlocks: ['q_seeds'],
    autoAccept: false,
  },
  q_lake: {
    giver: 'luna',
    objective: { type: 'clear', count: 5 },
    rewards: { coins: 25, xp: 30 },
    unlocks: [],
    autoAccept: false,
  },
  q_seeds: {
    giver: 'rocco',
    objective: { type: 'plant', count: 3 },
    rewards: { coins: 15, xp: 25, items: { seed: 2 } },
    unlocks: [],
    autoAccept: false,
  },
  q_glowfox: {
    giver: 'pip',
    objective: { type: 'bond', creature: 'glowfox', count: 1 },
    rewards: { xp: 30, items: { essence: 2 } },
    unlocks: [],
    autoAccept: true,
  },
};

export const QUEST_ORDER: QuestId[] = ['q_first_steps', 'q_egg', 'q_home', 'q_lake', 'q_seeds', 'q_glowfox'];

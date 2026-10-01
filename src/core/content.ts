import type { BuildingId, CreatureId, DiscoveryCategory, ItemId, NpcId, PipAbility, QuestId } from './types';

export interface ItemDef {
  icon: string;
  /** Price when buying at the village shop (undefined = not sold). */
  buy?: number;
  /** Price when selling to the shop (undefined = cannot be sold). */
  sell?: number;
  /** Common resources can be partially lost on defeat; never quest items or relics. */
  common: boolean;
  /** Hearts restored when eaten. */
  heal?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { icon: '🪵', sell: 1, common: true },
  stone: { icon: '🪨', sell: 2, common: true },
  crystal: { icon: '🔷', sell: 6, common: true },
  glow_berry: { icon: '🫐', buy: 4, sell: 2, common: true, heal: 1 },
  veggie: { icon: '🥕', sell: 3, common: true, heal: 2 },
  minnow: { icon: '🐟', sell: 2, common: true, heal: 1 },
  moonfish: { icon: '🐠', sell: 5, common: true, heal: 2 },
  echo_koi: { icon: '🎏', sell: 15, common: false, heal: 3 },
  seed: { icon: '🌱', buy: 5, common: false },
  essence: { icon: '✨', sell: 4, common: false },
  purifier: { icon: '💎', buy: 30, common: false },
  tonic: { icon: '🧪', common: false, heal: 99 },
};

export const ITEM_ORDER: ItemId[] = [
  'wood', 'stone', 'crystal', 'essence', 'glow_berry', 'veggie', 'minnow', 'moonfish', 'echo_koi', 'tonic', 'seed', 'purifier',
];

/** Foods eaten automatically by quick-slot 1/2 (cheapest first). */
export const FOOD_ORDER: ItemId[] = ['glow_berry', 'minnow', 'veggie', 'moonfish', 'echo_koi', 'tonic'];

export interface RecipeDef {
  cost: Partial<Record<ItemId, number>>;
  /** Item produced, or 'charm' for the one-time attack upgrade. */
  makes: ItemId | 'charm';
}

/** Crafting at the Workshop (PRD 14: utility rewards). */
export const RECIPES: Record<string, RecipeDef> = {
  purifier: { cost: { crystal: 2, essence: 2 }, makes: 'purifier' },
  tonic: { cost: { glow_berry: 3, veggie: 1 }, makes: 'tonic' },
  charm: { cost: { crystal: 3, stone: 5 }, makes: 'charm' },
};

export interface BuildingDef {
  cost: Partial<Record<ItemId, number>>;
  harmony: number;
  xp: number;
  icon: string;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  house: { cost: { wood: 8, stone: 4 }, harmony: 15, xp: 20, icon: '🏠' },
  garden: { cost: { wood: 6, stone: 2, seed: 2 }, harmony: 10, xp: 15, icon: '🥕' },
  workshop: { cost: { wood: 12, stone: 8, crystal: 3 }, harmony: 20, xp: 30, icon: '🛠️' },
  sanctuary: { cost: { wood: 10, stone: 6, essence: 4 }, harmony: 25, xp: 30, icon: '🐾' },
  arch: { cost: { wood: 6, stone: 2, essence: 2 }, harmony: 20, xp: 15, icon: '🌸' },
};

export const BUILDING_ORDER: BuildingId[] = ['house', 'garden', 'workshop', 'sanctuary', 'arch'];

export interface CreatureDef {
  icon: string;
  likes: ItemId;
  bondPerFeed: number;
  /** Optional evolution (PRD 12: high bond + crystal). */
  evolution?: { into: string; cost: Partial<Record<ItemId, number>> };
}

export const CREATURES: Record<CreatureId, CreatureDef> = {
  glowfox: { icon: '🦊', likes: 'glow_berry', bondPerFeed: 34, evolution: { into: 'lumifox', cost: { crystal: 2 } } },
  ripplet: { icon: '🐢', likes: 'veggie', bondPerFeed: 50, evolution: { into: 'moonshell', cost: { crystal: 2, essence: 1 } } },
  mossprite: { icon: '🌿', likes: 'essence', bondPerFeed: 50 },
  sunchick: { icon: '🐥', likes: 'glow_berry', bondPerFeed: 50 },
  gleamwing: { icon: '🦇', likes: 'essence', bondPerFeed: 50 },
  pebblepup: { icon: '🐶', likes: 'stone', bondPerFeed: 34 },
  skyhare: { icon: '🐇', likes: 'veggie', bondPerFeed: 50 },
  thistlegoat: { icon: '🐐', likes: 'glow_berry', bondPerFeed: 34 },
  archowl: { icon: '🦉', likes: 'moonfish', bondPerFeed: 50 },
  wispling: { icon: '👻', likes: 'essence', bondPerFeed: 50 },
};

export const CREATURE_ORDER = Object.keys(CREATURES) as CreatureId[];

/** All entries in the Discovery Book. */
export const DISCOVERY_CATALOG: Record<DiscoveryCategory, string[]> = {
  creatures: [...CREATURE_ORDER],
  plants: ['glow_berry', 'oak', 'moonlily', 'starbloom', 'crystal_moss', 'skybloom', 'shadowcap'],
  relics: ['echo_egg', 'temple_seal', 'sun_key', 'rune_tablet', 'light_prism', 'echo_heart'],
  places: [
    'whisper_village', 'emerald_forest', 'moonlit_lake', 'memory_grove', 'temple_gate',
    'crystal_caves', 'ancient_temple', 'highlands', 'highland_view', 'shadow_grove',
  ],
};

/** Discovery Book milestones (total discoveries). Rewards are applied by world rules. */
export const DISCOVERY_MILESTONES = [3, 8, 15, 25];

export type QuestObjective =
  | { type: 'gather'; item: ItemId; count: number }
  | { type: 'find'; target: 'egg' | 'sun_key'; count: 1 }
  | { type: 'build'; building: BuildingId; count: number }
  | { type: 'clear'; count: number }
  | { type: 'plant'; count: number }
  | { type: 'bond'; creature: CreatureId; count: 1 }
  | { type: 'trials'; count: 3 }
  | { type: 'rescue'; count: 1 }
  | { type: 'evolve'; count: 1 }
  | { type: 'boss'; count: 1 };

export interface QuestDef {
  giver: NpcId | 'pip';
  objective: QuestObjective;
  rewards: { coins?: number; xp?: number; items?: Partial<Record<ItemId, number>>; ability?: PipAbility };
  unlocks: QuestId[];
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
    unlocks: ['q_home', 'q_lake', 'q_highlands'],
    autoAccept: true,
  },
  q_home: {
    giver: 'rocco',
    objective: { type: 'build', building: 'house', count: 1 },
    rewards: { coins: 20, xp: 25, items: { seed: 3 } },
    unlocks: ['q_seeds', 'q_workshop'],
    autoAccept: false,
  },
  q_lake: {
    giver: 'luna',
    objective: { type: 'clear', count: 5 },
    rewards: { coins: 25, xp: 30 },
    unlocks: ['q_caves'],
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
  q_workshop: {
    giver: 'rocco',
    objective: { type: 'build', building: 'workshop', count: 1 },
    rewards: { coins: 30, xp: 40, items: { essence: 2 } },
    unlocks: [],
    autoAccept: false,
  },
  q_caves: {
    giver: 'luna',
    objective: { type: 'find', target: 'sun_key', count: 1 },
    rewards: { xp: 40, items: { crystal: 3 } },
    unlocks: ['q_temple', 'q_evolve'],
    autoAccept: false,
  },
  q_temple: {
    giver: 'luna',
    objective: { type: 'trials', count: 3 },
    rewards: { coins: 40, xp: 60 },
    unlocks: ['q_finale'],
    autoAccept: false,
  },
  q_highlands: {
    giver: 'zed',
    objective: { type: 'rescue', count: 1 },
    rewards: { coins: 40, xp: 50 },
    unlocks: [],
    autoAccept: false,
  },
  q_evolve: {
    giver: 'luna',
    objective: { type: 'evolve', count: 1 },
    rewards: { xp: 40, items: { essence: 3 } },
    unlocks: [],
    autoAccept: false,
  },
  q_finale: {
    giver: 'pip',
    objective: { type: 'boss', count: 1 },
    rewards: { xp: 100 },
    unlocks: [],
    autoAccept: true,
  },
};

export const QUEST_ORDER = Object.keys(QUESTS) as QuestId[];

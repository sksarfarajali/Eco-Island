import type { BuffId, BuildingId, CreatureId, DecorId, DiscoveryCategory, ItemId, NpcId, PipAbility, QuestId, Season } from './types';

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
  /** Cooked meals give a timed boost (seconds of play). */
  buff?: { id: BuffId; seconds: number };
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
  coral: { icon: '🪸', sell: 5, common: true },
  shell: { icon: '🐚', sell: 3, common: true },
  coconut: { icon: '🥥', sell: 2, common: true, heal: 1 },
  sunfish: { icon: '🐡', sell: 9, common: true, heal: 2 },
  snowtrout: { icon: '🐟', sell: 9, common: true, heal: 2 },
  rainbow_carp: { icon: '🌈', sell: 14, common: true, heal: 2 },
  night_eel: { icon: '🪱', sell: 11, common: true, heal: 2 },
  coral_snapper: { icon: '🐠', sell: 10, common: true, heal: 2 },
  blossom_guppy: { icon: '🌸', sell: 8, common: true, heal: 1 },
  maple_perch: { icon: '🍁', sell: 8, common: true, heal: 2 },
  berry_pie: { icon: '🥧', sell: 8, common: false, heal: 1, buff: { id: 'swift', seconds: 180 } },
  fish_stew: { icon: '🍲', sell: 10, common: false, heal: 3, buff: { id: 'hearty', seconds: 240 } },
  garden_salad: { icon: '🥗', sell: 8, common: false, heal: 1, buff: { id: 'lucky', seconds: 180 } },
  coconut_curry: { icon: '🍛', sell: 12, common: false, heal: 2, buff: { id: 'strong', seconds: 240 } },
};

/** Meals cooked at the village cooking pot. */
export const MEALS: Partial<Record<ItemId, Partial<Record<ItemId, number>>>> = {
  berry_pie: { glow_berry: 3, wood: 1 },
  fish_stew: { minnow: 2, veggie: 1 },
  garden_salad: { veggie: 2, glow_berry: 1 },
  coconut_curry: { coconut: 1, moonfish: 1, veggie: 1 },
};

export const MEAL_ORDER = Object.keys(MEALS) as ItemId[];

export const BUFF_ICONS: Record<BuffId, string> = { swift: '💨', hearty: '❤️', lucky: '🍀', strong: '💪' };

export const ITEM_ORDER: ItemId[] = [
  'wood', 'stone', 'crystal', 'essence', 'coral', 'shell', 'glow_berry', 'veggie', 'coconut', 'minnow', 'moonfish', 'echo_koi', 'tonic',
  'sunfish', 'snowtrout', 'rainbow_carp', 'night_eel', 'coral_snapper', 'blossom_guppy', 'maple_perch',
  'berry_pie', 'fish_stew', 'garden_salad', 'coconut_curry', 'seed', 'purifier',
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
  /** Seasonal creatures only show up in their season. */
  season?: Season;
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
  shellcrab: { icon: '🦀', likes: 'minnow', bondPerFeed: 50 },
  seapup: { icon: '🦭', likes: 'moonfish', bondPerFeed: 34 },
  petalbee: { icon: '🐝', likes: 'glow_berry', bondPerFeed: 50, season: 'spring' },
  snowkit: { icon: '🐈', likes: 'glow_berry', bondPerFeed: 34, season: 'winter' },
};

export const CREATURE_ORDER = Object.keys(CREATURES) as CreatureId[];

/** All entries in the Discovery Book. */
export const DISCOVERY_CATALOG: Record<DiscoveryCategory, string[]> = {
  creatures: [...CREATURE_ORDER],
  plants: ['glow_berry', 'oak', 'moonlily', 'starbloom', 'crystal_moss', 'skybloom', 'shadowcap', 'coconut_palm', 'sea_coral'],
  relics: ['echo_egg', 'temple_seal', 'sun_key', 'rune_tablet', 'light_prism', 'echo_heart'],
  places: [
    'whisper_village', 'emerald_forest', 'moonlit_lake', 'memory_grove', 'temple_gate',
    'crystal_caves', 'ancient_temple', 'highlands', 'highland_view', 'shadow_grove', 'coral_isle',
  ],
  fish: ['minnow', 'moonfish', 'echo_koi', 'blossom_guppy', 'sunfish', 'maple_perch', 'snowtrout', 'rainbow_carp', 'night_eel', 'coral_snapper'],
  memories: Array.from({ length: 12 }, (_, i) => `memory_${i + 1}`),
};

/** Discovery Book milestones (total discoveries). Rewards are applied by world rules. */
export const DISCOVERY_MILESTONES = [3, 8, 15, 25, 35, 50];

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
  | { type: 'boss'; count: 1 }
  | { type: 'repair'; count: 1 }
  | { type: 'reef'; count: number };

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
  q_voyage: {
    giver: 'zed',
    objective: { type: 'repair', count: 1 },
    rewards: { coins: 30, xp: 50 },
    unlocks: ['q_reef'],
    autoAccept: false,
  },
  q_reef: {
    giver: 'marina',
    objective: { type: 'reef', count: 4 },
    rewards: { coins: 60, xp: 80, items: { crystal: 3 } },
    unlocks: [],
    autoAccept: false,
  },
};

export const QUEST_ORDER = Object.keys(QUESTS) as QuestId[];

export interface DecorDef {
  icon: string;
  /** Coin price at the shop; festival decorations cannot be bought. */
  price?: number;
  /** Given as the reward of this season's festival. */
  festival?: Season;
  /** One-time Harmony the first time this kind is placed. */
  harmony: number;
  /** Gives light at night. */
  light?: boolean;
}

export const DECOR: Record<DecorId, DecorDef> = {
  flower_pot: { icon: '🪴', price: 15, harmony: 4 },
  hedge: { icon: '🌳', price: 18, harmony: 4 },
  birdhouse: { icon: '🐦', price: 20, harmony: 5 },
  bench: { icon: '🪑', price: 25, harmony: 5 },
  lamp_post: { icon: '💡', price: 30, harmony: 6, light: true },
  statue: { icon: '🗿', price: 60, harmony: 12 },
  fountain: { icon: '⛲', price: 80, harmony: 15 },
  blossom_tree: { icon: '🌸', festival: 'spring', harmony: 10 },
  paper_lantern: { icon: '🏮', festival: 'summer', harmony: 10, light: true },
  pumpkin: { icon: '🎃', festival: 'autumn', harmony: 10, light: true },
  snowman: { icon: '⛄', festival: 'winter', harmony: 10 },
};

export const DECOR_ORDER = Object.keys(DECOR) as DecorId[];

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_ICONS: Record<Season, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };

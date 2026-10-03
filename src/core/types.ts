export type ItemId =
  | 'wood' | 'stone' | 'crystal' | 'glow_berry' | 'veggie' | 'seed' | 'essence' | 'purifier'
  | 'minnow' | 'moonfish' | 'echo_koi' | 'tonic'
  | 'coral' | 'shell' | 'coconut'
  | 'berry_pie' | 'fish_stew' | 'garden_salad' | 'coconut_curry';

/** Timed boosts from cooked meals. */
export type BuffId = 'swift' | 'hearty' | 'lucky' | 'strong';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherKind = 'clear' | 'rain' | 'fog' | 'snow';
export type DecorId =
  | 'bench' | 'flower_pot' | 'lamp_post' | 'birdhouse' | 'hedge' | 'fountain' | 'statue'
  | 'blossom_tree' | 'paper_lantern' | 'pumpkin' | 'snowman';
export type MinigameKind = 'seek' | 'race';
export type DailyKind = 'wood' | 'stone' | 'berries' | 'fish' | 'plant' | 'feed' | 'enemies' | 'cook' | 'photo' | 'harvest' | 'play';

export interface DailyTask {
  kind: DailyKind;
  target: number;
  progress: number;
  done: boolean;
}

/** Zones are named regions of the world; the island holds three, each other area is one zone. */
export type ZoneId = 'village' | 'forest' | 'lake' | 'caves' | 'temple' | 'highlands' | 'grove' | 'isle';
/** Areas are separate maps. The island is the hub; the others are reached from it. */
export type AreaId = 'island' | 'caves' | 'temple' | 'highlands' | 'grove' | 'isle';
export type BuildingId = 'house' | 'garden' | 'workshop' | 'sanctuary' | 'arch';
export type CreatureId =
  | 'glowfox' | 'ripplet' | 'mossprite' | 'sunchick' | 'gleamwing'
  | 'pebblepup' | 'skyhare' | 'thistlegoat' | 'archowl' | 'wispling'
  | 'shellcrab' | 'seapup' | 'petalbee' | 'snowkit';
export type NpcId = 'rocco' | 'luna' | 'zed' | 'tilly' | 'marina';
export type QuestId =
  | 'q_first_steps' | 'q_egg' | 'q_home' | 'q_lake' | 'q_seeds' | 'q_glowfox'
  | 'q_workshop' | 'q_caves' | 'q_temple' | 'q_highlands' | 'q_evolve' | 'q_finale'
  | 'q_voyage' | 'q_reef';
export type CreatureState = 'unknown' | 'observed' | 'friendly' | 'bonded';
export type EggChoice = 'hatch' | 'sell' | 'temple';
export type EggState = 'hidden' | 'nest' | 'hatched' | 'sold' | 'temple';
export type PipAbility = 'glow' | 'sense' | 'echo';
export type PipMood = 'happy' | 'sad' | 'excited';
export type QuestStatus = 'locked' | 'available' | 'active' | 'done';
export type DiscoveryCategory = 'creatures' | 'plants' | 'relics' | 'places';
export type Ending = 'heal' | 'seal';

/** Growth stage of a world node (tree, rock, bush, grove spot, crystal). */
export type NodeStage = 'full' | 'empty' | 'stump' | 'sapling' | 'soil' | 'tree';

export interface Appearance {
  skin: number;
  hair: number;
  outfit: number;
}

export interface NodeState {
  stage: NodeStage;
  /** Game minutes remaining until the next growth step (0 = none pending). */
  timer: number;
  planted?: boolean;
}

export interface ChoiceRecord {
  id: string;
  value: string;
  day: number;
}

export interface TempleState {
  /** Rune pillars activated so far in the current attempt. */
  runeProgress: number[];
  /** Mirror orientations: true = '\', false = '/'. */
  mirrors: boolean[];
  /** Push-block positions in tiles. */
  blocks: [number, number][];
  solved: [boolean, boolean, boolean];
  echoSeen: boolean;
}

export interface GameState {
  saveVersion: number;
  createdAt: string;
  lastPlayedAt: string;
  lastExportAt: string | null;
  player: {
    name: string;
    appearance: Appearance;
    level: number;
    xp: number;
    coins: number;
    health: number;
    /** Permanent attack bonus from the crafted Crystal Charm. */
    attackBonus: number;
    position: { area: AreaId; zone: ZoneId; x: number; y: number };
    cosmetics: string[];
    /** Active meal boosts: seconds of play time left. */
    buffs: Partial<Record<BuffId, number>>;
  };
  island: {
    level: number;
    harmony: number;
    treesPlanted: number;
    lakeRestored: boolean;
    corruption: Record<ZoneId, number>;
    harvestPressure: number;
    fishPressure: number;
    cleanseProgress: number;
    warnedPressure: boolean;
    zonesUnlocked: ZoneId[];
    visuals: string[];
    firedRules: string[];
  };
  world: {
    minutes: number;
    nodes: Record<string, NodeState>;
    plots: Record<string, BuildingId | null>;
    debrisCleared: string[];
    egg: EggState;
    eggHatchTimer: number;
    gardenProduce: Record<string, number>;
    gardenTimer: Record<string, number>;
    templeOpen: boolean;
    temple: TempleState;
    sunKeyFound: boolean;
    skyhareFreed: boolean;
    enemiesDefeated: number;
    bossDefeated: boolean;
    ending: Ending | null;
    fishCaught: number;
    /** Common resources gathered since Nova last left Whisper Village (PRD 14: defeat loss). */
    trip: Partial<Record<ItemId, number>>;
    weather: { kind: WeatherKind; until: number };
    /** Festivals already celebrated, e.g. `summer_0`. */
    festivals: string[];
    /** Decorations placed in village and porch slots. */
    decor: Record<string, DecorId | null>;
    /** Decorations owned but not placed. */
    decorOwned: Partial<Record<DecorId, number>>;
    /** Decoration types that already gave their one-time Harmony. */
    decorSeen: DecorId[];
    boatRepaired: boolean;
    reefHealed: string[];
    minigames: { seekWins: number; raceWins: number; rewardDay: Partial<Record<MinigameKind, number>> };
  };
  /** Daily tasks and the login streak (real calendar days). */
  daily: {
    date: string;
    tasks: DailyTask[];
    bonusClaimed: boolean;
    streak: number;
    lastLogin: string;
    completed: number;
  };
  achievements: string[];
  inventory: Record<ItemId, number>;
  buildings: Record<BuildingId, number>;
  creatures: Record<CreatureId, { state: CreatureState; bond: number; present: boolean; evolved: boolean }>;
  pip: {
    abilities: PipAbility[];
    enabled: Record<PipAbility, boolean>;
    mood: PipMood;
    cosmetic: string | null;
  };
  npcs: Record<NpcId, { trust: number; present: boolean; met: boolean }>;
  quests: Record<QuestId, { status: QuestStatus; progress: number }>;
  choices: ChoiceRecord[];
  discoveries: Record<DiscoveryCategory, string[]>;
  stats: {
    sessions: number; playSeconds: number; questsDone: number; worldChanges: number; errors: number; defeats: number;
    mealsCooked: number; photos: number; weatherSeen: WeatherKind[];
  };
}

export type ActionKey = 'interact' | 'dodge' | 'block' | 'ability';

export interface Settings {
  music: boolean;
  musicVolume: number;
  sfx: boolean;
  sfxVolume: number;
  haptics: boolean;
  graphics: 'low' | 'medium' | 'high';
  reducedMotion: boolean;
  textSize: 'small' | 'medium' | 'large';
  colorBlind: boolean;
  language: 'en';
  /** Desktop key bindings (PRD 24: simple control remapping). Values are Phaser key names. */
  keys: Record<ActionKey, string>;
}

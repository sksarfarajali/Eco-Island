export type ItemId = 'wood' | 'stone' | 'glow_berry' | 'veggie' | 'seed' | 'essence' | 'purifier';
export type ZoneId = 'village' | 'forest' | 'lake';
export type BuildingId = 'house' | 'garden';
export type CreatureId = 'glowfox' | 'ripplet' | 'mossprite' | 'sunchick';
export type NpcId = 'rocco' | 'luna' | 'zed' | 'tilly';
export type QuestId = 'q_first_steps' | 'q_egg' | 'q_home' | 'q_lake' | 'q_seeds' | 'q_glowfox';
export type CreatureState = 'unknown' | 'observed' | 'friendly' | 'bonded';
export type EggChoice = 'hatch' | 'sell' | 'temple';
export type EggState = 'hidden' | 'nest' | 'hatched' | 'sold' | 'temple';
export type PipAbility = 'glow' | 'sense' | 'echo';
export type PipMood = 'happy' | 'sad' | 'excited';
export type QuestStatus = 'locked' | 'available' | 'active' | 'done';
export type DiscoveryCategory = 'creatures' | 'plants' | 'relics' | 'places';

/** Growth stage of a world node (tree, rock, bush, grove spot). */
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
  /** True when a sapling was planted by the player (it grows into a choppable tree). */
  planted?: boolean;
}

export interface ChoiceRecord {
  id: string;
  value: string;
  day: number;
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
    position: { zone: ZoneId; x: number; y: number };
    cosmetics: string[];
  };
  island: {
    level: number;
    harmony: number;
    treesPlanted: number;
    lakeRestored: boolean;
    corruption: Record<ZoneId, number>;
    /** Careless-harvest pressure in the forest; reaching the limit raises corruption. */
    harvestPressure: number;
    /** Trees planted in a corrupted forest since the last cleanse step. */
    cleanseProgress: number;
    warnedPressure: boolean;
    zonesUnlocked: ZoneId[];
    /** Visual world changes switched on by world rules. */
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
  };
  inventory: Record<ItemId, number>;
  buildings: Record<BuildingId, number>;
  creatures: Record<CreatureId, { state: CreatureState; bond: number; present: boolean }>;
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
  stats: { sessions: number; playSeconds: number; questsDone: number; worldChanges: number; errors: number };
}

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
}

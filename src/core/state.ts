import { AREAS, TEMPLE_BLOCK_START, TEMPLE_MIRRORS } from './areas';
import { maxHealth } from './combat';
import { START_MINUTES, STARTING_COINS } from './config';
import { CREATURE_ORDER, QUEST_ORDER, QUESTS } from './content';
import { NODES, PLOTS, POI } from './layout';
import type { Appearance, GameState, NodeState, QuestId, QuestStatus, TempleState } from './types';

export const SAVE_VERSION = 3;

/** Resource nodes in the other areas use ids like `caves:c3`. */
const AREA_NODE_CHARS = 'crf';

export function initialNodes(): Record<string, NodeState> {
  const island = NODES.map((n) => [n.id, { stage: n.kind === 'grove' ? 'soil' : 'full', timer: 0 } as NodeState]);
  const areas = Object.values(AREAS).flatMap((a) =>
    a.objects.filter((o) => AREA_NODE_CHARS.includes(o.ch)).map((o) => [o.id, { stage: 'full', timer: 0 } as NodeState]),
  );
  return Object.fromEntries([...island, ...areas]);
}

export function initialTemple(): TempleState {
  return {
    runeProgress: [],
    mirrors: TEMPLE_MIRRORS.map(() => false),
    blocks: TEMPLE_BLOCK_START.map(([x, y]) => [x, y] as [number, number]),
    solved: [false, false, false],
    echoSeen: false,
  };
}

export function newGameState(appearance: Appearance = { skin: 0, hair: 0, outfit: 0 }, now = new Date()): GameState {
  const iso = now.toISOString();
  const quests = Object.fromEntries(
    QUEST_ORDER.map((id) => [id, { status: (id === 'q_first_steps' ? 'active' : 'locked') as QuestStatus, progress: 0 }]),
  ) as GameState['quests'];
  return {
    saveVersion: SAVE_VERSION,
    createdAt: iso,
    lastPlayedAt: iso,
    lastExportAt: null,
    player: {
      name: 'Nova',
      appearance,
      level: 1,
      xp: 0,
      coins: STARTING_COINS,
      health: maxHealth(1),
      attackBonus: 0,
      position: { area: 'island', zone: 'village', x: POI.start.x, y: POI.start.y },
      cosmetics: [],
    },
    island: {
      level: 1,
      harmony: 0,
      treesPlanted: 0,
      lakeRestored: false,
      corruption: { village: 0, forest: 0, lake: 0, caves: 0, temple: 0, highlands: 0, grove: 0 },
      harvestPressure: 0,
      fishPressure: 0,
      cleanseProgress: 0,
      warnedPressure: false,
      zonesUnlocked: ['village', 'forest', 'lake'],
      visuals: [],
      firedRules: [],
    },
    world: {
      minutes: START_MINUTES,
      nodes: initialNodes(),
      plots: Object.fromEntries(PLOTS.map((p) => [p.id, null])),
      debrisCleared: [],
      egg: 'hidden',
      eggHatchTimer: 0,
      gardenProduce: {},
      gardenTimer: {},
      templeOpen: false,
      temple: initialTemple(),
      sunKeyFound: false,
      skyhareFreed: false,
      enemiesDefeated: 0,
      bossDefeated: false,
      ending: null,
      fishCaught: 0,
      trip: {},
    },
    inventory: {
      wood: 0, stone: 0, crystal: 0, glow_berry: 0, veggie: 0, seed: 1, essence: 0, purifier: 0,
      minnow: 0, moonfish: 0, echo_koi: 0, tonic: 0,
    },
    buildings: { house: 0, garden: 0, workshop: 0, sanctuary: 0, arch: 0 },
    creatures: Object.fromEntries(
      CREATURE_ORDER.map((id) => [
        id,
        // creatures that live in their home area from the start; others appear through world changes
        { state: 'unknown', bond: 0, present: ['glowfox', 'gleamwing', 'pebblepup', 'thistlegoat', 'archowl'].includes(id), evolved: false },
      ]),
    ) as GameState['creatures'],
    pip: {
      abilities: [],
      enabled: { glow: true, sense: true, echo: true },
      mood: 'happy',
      cosmetic: null,
    },
    npcs: {
      rocco: { trust: 0, present: true, met: false },
      luna: { trust: 0, present: false, met: false },
      zed: { trust: 0, present: false, met: false },
      tilly: { trust: 0, present: false, met: false },
    },
    quests,
    choices: [],
    discoveries: { creatures: [], plants: [], relics: [], places: [] },
    stats: { sessions: 0, playSeconds: 0, questsDone: 0, worldChanges: 0, errors: 0, defeats: 0 },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Migrate a save of any known version to the current version (PRD 19/20).
 * Version 1 is the shape described in PRD v1.0 (no `saveVersion` field).
 * Throws when the data is not a recognisable save.
 */
export function migrateSave(raw: unknown): GameState {
  if (!isObj(raw)) throw new Error('Save is not an object');
  const version = num(raw.saveVersion, 1);
  if (version > SAVE_VERSION) throw new Error(`Save version ${version} is newer than this game (${SAVE_VERSION})`);
  if (version === 1) return migrateV1(raw);
  return fillDefaults(raw);
}

function migrateV1(raw: Record<string, unknown>): GameState {
  if (!isObj(raw.player) || !isObj(raw.island)) throw new Error('Not an Echo Island save');
  const s = newGameState();
  const p = raw.player;
  const i = raw.island;
  s.player.level = num(p.level, 1);
  s.player.xp = num(p.xp, 0);
  s.player.coins = num(p.coins, STARTING_COINS);
  if (Array.isArray(p.cosmetics)) s.player.cosmetics = p.cosmetics.filter((c): c is string => typeof c === 'string');
  s.island.level = num(i.level, 1);
  s.island.treesPlanted = num(i.treesPlanted, 0);
  s.island.lakeRestored = i.lakeRestored === true;
  s.island.corruption.forest = Math.min(3, Math.max(0, num(i.corruption, 0)));
  if (isObj(raw.buildings)) {
    s.buildings.house = num(raw.buildings.house, 0);
    s.buildings.garden = num(raw.buildings.garden, 0);
  }
  if (isObj(raw.creatures)) {
    for (const [id, c] of Object.entries(raw.creatures)) {
      if (id in s.creatures && isObj(c)) {
        const bond = num(c.bond, 0);
        const key = id as keyof GameState['creatures'];
        s.creatures[key].bond = bond;
        s.creatures[key].state = bond >= 100 ? 'bonded' : bond > 0 ? 'friendly' : c.discovered ? 'observed' : 'unknown';
      }
    }
  }
  if (isObj(raw.discoveries)) {
    for (const cat of ['plants', 'relics', 'creatures'] as const) {
      const list = raw.discoveries[cat];
      if (Array.isArray(list)) s.discoveries[cat] = list.filter((x): x is string => typeof x === 'string');
    }
  }
  if (isObj(raw.quests) && raw.quests.eggQuest) {
    const value = String(raw.quests.eggQuest) === 'hatched' ? 'hatch' : String(raw.quests.eggQuest);
    s.choices.push({ id: 'egg_choice', value, day: 1 });
  }
  return s;
}

/** Fill any missing fields of a current-version save with defaults (forward-compatible loading). */
function fillDefaults(raw: Record<string, unknown>): GameState {
  const base = newGameState();
  const merged = deepMerge(base, raw) as GameState;
  if (!isObj(merged.player) || !isObj(merged.island) || !isObj(merged.world)) throw new Error('Save is missing core data');
  // Keep quest table complete if new quests were added since the save was made.
  for (const id of Object.keys(QUESTS) as QuestId[]) {
    if (!merged.quests[id]) merged.quests[id] = { status: 'locked', progress: 0 };
  }
  // Quests added in later versions open up if the quest that leads to them is already done.
  for (const id of QUEST_ORDER) {
    if (merged.quests[id].status !== 'done') continue;
    for (const next of QUESTS[id].unlocks) {
      const q = merged.quests[next];
      if (q.status === 'locked') q.status = QUESTS[next].autoAccept ? 'active' : 'available';
    }
  }
  if (merged.choices.some((c) => c.id === 'egg_choice' && c.value === 'temple')) merged.world.templeOpen = true;
  merged.saveVersion = SAVE_VERSION;
  return merged;
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (isObj(base) && isObj(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
    return out;
  }
  return over;
}

/** Lightweight structural validation before a save is trusted. */
export function validateSave(s: GameState): string | null {
  if (typeof s.player.coins !== 'number' || s.player.coins < 0) return 'coins';
  if (typeof s.world.minutes !== 'number' || s.world.minutes < 0) return 'clock';
  if (!Array.isArray(s.choices)) return 'choices';
  if (!isObj(s.inventory)) return 'inventory';
  if (Number.isNaN(Date.parse(s.lastPlayedAt))) return 'lastPlayedAt';
  return null;
}

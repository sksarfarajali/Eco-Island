import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AWAY_CAP_SECONDS, GROW, MINUTES_PER_SECOND } from '../src/core/config';
import { BUILDINGS, CREATURES, DISCOVERY_CATALOG, DISCOVERY_MILESTONES, ITEMS, QUESTS, RECIPES } from '../src/core/content';
import { DEFAULT_RULES, Game } from '../src/core/game';
import { applyTimeAway } from '../src/core/growth';
import { hasKey, t } from '../src/core/i18n';
import { NODES } from '../src/core/layout';
import { computeMetrics, dueRules, evaluateCondition } from '../src/core/rules';
import { SAVE_VERSION, migrateSave, newGameState, validateSave } from '../src/core/state';

describe('rules engine', () => {
  it('evaluates comparisons and conjunctions', () => {
    const m = { trees_planted: 10, egg_choice: 'hatch' };
    expect(evaluateCondition('trees_planted >= 10', m)).toBe(true);
    expect(evaluateCondition("trees_planted >= 10 && egg_choice == 'hatch'", m)).toBe(true);
    expect(evaluateCondition("egg_choice != 'hatch'", m)).toBe(false);
    expect(() => evaluateCondition('nonsense', m)).toThrow();
    expect(() => evaluateCondition('missing > 1', m)).toThrow(/Unknown/);
  });

  it('every rule in rules.json parses against real metrics', () => {
    const s = newGameState();
    const metrics = computeMetrics(s);
    for (const r of DEFAULT_RULES) expect(() => evaluateCondition(r.when, metrics)).not.toThrow();
    expect(dueRules(DEFAULT_RULES, s)).toEqual([]);
  });

  it('rules fire only once', () => {
    const g = new Game(newGameState());
    g.state.island.treesPlanted = 3;
    g.runRules();
    const harmony = g.state.island.harmony;
    g.runRules();
    expect(g.state.island.harmony).toBe(harmony);
    expect(g.state.island.firedRules).toContain('forest_density_1');
  });
});

describe('time away (capped at 24 hours)', () => {
  const at = (s: ReturnType<typeof newGameState>, secondsLater: number) => new Date(Date.parse(s.lastPlayedAt) + secondsLater * 1000);

  it('ignores very short absences', () => {
    const s = newGameState();
    expect(applyTimeAway(s, at(s, 30))).toBeNull();
  });

  it('grows saplings and regrows trees while away', () => {
    const s = newGameState();
    const grove = NODES.find((n) => n.kind === 'grove')!.id;
    s.world.nodes[grove] = { stage: 'sapling', timer: GROW.sapling, planted: true };
    const tree = NODES.find((n) => n.kind === 'tree')!.id;
    s.world.nodes[tree] = { stage: 'stump', timer: GROW.stumpRegrow };
    const sum = applyTimeAway(s, at(s, 2 * 3600))!;
    expect(sum.saplingsGrown).toBe(1);
    expect(sum.treesRegrown).toBe(1);
    expect(s.world.nodes[grove].stage).toBe('tree');
  });

  it('caps progress at 24 hours', () => {
    const s = newGameState();
    const start = s.world.minutes;
    const sum = applyTimeAway(s, at(s, 10 * 24 * 3600))!;
    expect(sum.capped).toBe(true);
    expect(s.world.minutes - start).toBe(AWAY_CAP_SECONDS * MINUTES_PER_SECOND);
  });

  it('applies nothing and removes nothing if the clock went backwards', () => {
    const s = newGameState();
    s.inventory.wood = 5;
    const start = s.world.minutes;
    const sum = applyTimeAway(s, at(s, -3600))!;
    expect(sum.clockWentBack).toBe(true);
    expect(s.world.minutes).toBe(start);
    expect(s.inventory.wood).toBe(5);
  });

  it('a bonded Glowfox brings a gift', () => {
    const s = newGameState();
    s.creatures.glowfox.state = 'bonded';
    const sum = applyTimeAway(s, at(s, 3600))!;
    expect(sum.gift).toBe(2);
    expect(s.inventory.glow_berry).toBe(2);
  });
});

describe('saves', () => {
  it('round-trips the current version', () => {
    const s = newGameState();
    s.player.coins = 99;
    const loaded = migrateSave(JSON.parse(JSON.stringify(s)));
    expect(loaded.player.coins).toBe(99);
    expect(validateSave(loaded)).toBeNull();
  });

  it('migrates a v1 save from the PRD v1.0 data model', () => {
    const v1 = {
      player: { level: 3, xp: 130, coins: 55, cosmetics: ['hat'] },
      island: { level: 2, treesPlanted: 4, lakeRestored: true, corruption: 1 },
      buildings: { house: 1, workshop: 0 },
      creatures: { glowfox: { discovered: true, bond: 62 } },
      quests: { eggQuest: 'hatched' },
      discoveries: { plants: ['glow_berry'], relics: [], creatures: ['glowfox'] },
      settings: { music: true, sfx: true },
    };
    const s = migrateSave(v1);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.player.coins).toBe(55);
    expect(s.island.lakeRestored).toBe(true);
    expect(s.island.corruption.forest).toBe(1);
    expect(s.creatures.glowfox).toMatchObject({ bond: 62, state: 'friendly' });
    expect(s.choices[0]).toMatchObject({ id: 'egg_choice', value: 'hatch' });
  });

  it('fills fields missing from an older v2 save', () => {
    const s = JSON.parse(JSON.stringify(newGameState())) as Record<string, unknown>;
    delete (s.island as Record<string, unknown>).visuals;
    const loaded = migrateSave(s);
    expect(loaded.island.visuals).toEqual([]);
  });

  it('rejects data that is not a save or comes from a newer game', () => {
    expect(() => migrateSave('hello')).toThrow();
    expect(() => migrateSave({ foo: 1 })).toThrow();
    expect(() => migrateSave({ ...newGameState(), saveVersion: 99 })).toThrow(/newer/);
  });

  it('validation catches corrupted values', () => {
    const s = newGameState();
    s.player.coins = -5;
    expect(validateSave(s)).toBe('coins');
  });
});

describe('localization (PRD 23: all player-visible text in language files)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(p) ? [p] : [];
    });

  it('every literal t("key") used in the source exists in en.json', () => {
    const missing: string[] = [];
    for (const file of files('src')) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\('([a-z0-9_.]+)'/g)) if (!hasKey(m[1])) missing.push(`${file}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('every dynamic key family is complete', () => {
    const keys: string[] = [];
    for (const [cat, list] of Object.entries(DISCOVERY_CATALOG)) {
      keys.push(`book.${cat}`);
      for (const id of list) keys.push(`disc.${id}`, `disc.${id}.desc`, `icon.${id}`);
    }
    for (const item of Object.keys(ITEMS)) keys.push(`item.${item}`, `item.${item}.desc`);
    for (const [id, q] of Object.entries(QUESTS)) {
      keys.push(`quest.${id}.title`, `quest.${id}.desc`, `npc.${q.giver}`);
      if (q.giver !== 'pip') keys.push(`quest.${id}.offer`, `quest.${id}.reminder`);
    }
    for (const r of DEFAULT_RULES) for (const e of r.then) if (e.startsWith('toast:')) keys.push(e.slice(6));
    for (const npc of ['rocco', 'luna', 'zed', 'tilly']) keys.push(`${npc}.intro`, `npc.${npc}`, `${npc}.ending_heal`, `${npc}.ending_seal`);
    for (const b of Object.keys(BUILDINGS)) keys.push(`building.${b}`, `building.${b}.desc`);
    for (const r of Object.keys(RECIPES)) keys.push(`recipe.${r}`, `recipe.${r}.desc`);
    for (const c of Object.values(CREATURES)) if (c.evolution) keys.push(`evo.${c.evolution.into}`);
    for (const a of ['caves', 'temple', 'highlands', 'grove']) keys.push(`area.${a}.first`, `zone.${a}`);
    for (const e of ['heal', 'seal']) {
      keys.push(`ending.title_${e}`, `ending.body_${e}`, `finale.after_${e}_1`, `finale.after_${e}_2`, `pip.ending_${e}`, `choice.final_choice.${e}`);
    }
    for (const c of ['village', 'wild']) keys.push(`highlands.after_${c}`, `pip.memory_skyhare_${c}`, `choice.skyhare_choice.${c}`);
    for (const i of [1, 2, 3]) keys.push(`temple.trial_${i}_done`, `temple.door_${i}`);
    for (const k of ['interact', 'dodge', 'block', 'ability']) keys.push(`settings.key_${k}`);
    for (const m of DISCOVERY_MILESTONES) keys.push(`book.milestone_${m}`);
    for (const r of DEFAULT_RULES) for (const e of r.then) if (e.startsWith('cosmetic:')) keys.push(`cosmetic.${e.slice(9)}`);
    keys.push('act.mine_crystal', 'act.pick_flower', 'zone.island');
    for (const c of ['hatch', 'sell', 'temple']) {
      keys.push(`choice.egg_choice.${c}`, `egg.after_${c}`, `zed.after_${c}`, `luna.egg_${c}`, `rocco.egg_${c}`);
    }
    for (const a of ['glow', 'sense', 'echo']) keys.push(`ability.${a}`, `ability.${a}.desc`, `ability.${a}.locked`);
    for (const z of ['village', 'forest', 'lake']) keys.push(`zone.${z}`);
    for (const c of Object.keys(CREATURES)) keys.push(`creature.${c}.bonded_line`);
    for (const st of ['unknown', 'observed', 'friendly', 'bonded']) keys.push(`cstate.${st}`);
    for (const m of ['happy', 'sad', 'excited']) keys.push(`mood.${m}`);
    for (const p of ['journal', 'book', 'bag', 'build', 'shop', 'map', 'companion', 'settings']) keys.push(`panel.${p}`);
    expect(keys.filter((k) => !hasKey(k))).toEqual([]);
  });

  it('substitutes parameters', () => {
    expect(t('hud.day', { day: 3 })).toBe('Day 3');
  });
});

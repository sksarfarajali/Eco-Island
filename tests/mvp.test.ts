import { describe, expect, it } from 'vitest';
import {
  AREAS,
  RUNE_ORDER,
  TEMPLE_MIRRORS,
  objectsOf,
  terrainSolid,
  traceBeam,
} from '../src/core/areas';
import { DEFEAT_LOSS_SHARE, bossHealth, canHealHollow, damageTaken, maxHealth } from '../src/core/combat';
import { FISH_PRESSURE_LIMIT } from '../src/core/config';
import { BUILDINGS, CREATURES, DISCOVERY_CATALOG, QUESTS } from '../src/core/content';
import { Game } from '../src/core/game';
import { SAVE_VERSION, migrateSave, newGameState } from '../src/core/state';

const newGame = (rng = () => 0.9) => new Game(newGameState(), undefined, rng);

describe('MVP scope (PRD 8.2)', () => {
  it('has the MVP content plus Coral Isle: 8 zones, 14 creatures with 2 evolutions, 5 buildings and 14 quests', () => {
    expect(Object.keys(AREAS)).toHaveLength(5); // + village, forest, lake on the island = 8
    expect(Object.keys(CREATURES)).toHaveLength(14);
    expect(Object.values(CREATURES).filter((c) => c.evolution)).toHaveLength(2);
    expect(Object.values(CREATURES).filter((c) => c.season)).toHaveLength(2);
    expect(Object.keys(BUILDINGS)).toHaveLength(5);
    expect(Object.keys(QUESTS)).toHaveLength(14);
    expect(DISCOVERY_CATALOG.creatures).toHaveLength(14);
  });
});

describe('area maps are solvable', () => {
  // flood fill from the arrival point; doors count as open, objects are reachable from a neighbour
  for (const area of Object.values(AREAS)) {
    it(`${area.id}: every object can be reached`, () => {
      const passable = (x: number, y: number) => !terrainSolid(area, x, y) && !'crf1234M/LTORHKCGV'.includes(area.rows[y][x]);
      const sx = Math.floor(area.spawn.x / 32);
      const sy = Math.floor(area.spawn.y / 32);
      const seen = new Set([`${sx},${sy}`]);
      const stack = [[sx, sy]];
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${y + dy}`;
          if (!seen.has(k) && passable(x + dx, y + dy)) {
            seen.add(k);
            stack.push([x + dx, y + dy]);
          }
        }
      }
      const unreachable = area.objects.filter((o) => ![-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => seen.has(`${o.tx + dx},${o.ty + dy}`))));
      expect(unreachable.map((o) => o.id)).toEqual([]);
      expect(objectsOf(area, 'X')).toHaveLength(1);
    });
  }
});

describe('Ancient Temple trials', () => {
  it('the light beam reaches the lock only with the right mirrors', () => {
    expect(traceBeam(TEMPLE_MIRRORS.map(() => false)).hitTarget).toBe(false);
    expect(traceBeam(TEMPLE_MIRRORS.map(() => true)).hitTarget).toBe(true);
  });

  it('runes must be touched in the order Pip’s Echo shows; mistakes just reset', () => {
    const g = newGame();
    expect(g.activateRune(RUNE_ORDER[1]).ok).toBe(false);
    expect(g.viewEcho().text).toContain('△');
    for (const n of RUNE_ORDER) g.activateRune(n);
    expect(g.state.world.temple.solved[0]).toBe(true);
    expect(g.state.discoveries.relics).toContain('rune_tablet');
  });

  it('toggling every mirror to "\\" solves the light trial', () => {
    const g = newGame();
    TEMPLE_MIRRORS.forEach((_, i) => g.toggleMirror(i));
    expect(g.state.world.temple.solved[1]).toBe(true);
  });

  it('pushing both blocks onto the plates solves the weight trial; the lever resets', () => {
    const g = newGame();
    const plates = objectsOf(AREAS.temple, 'P');
    g.pushBlock(0, 1, 0);
    g.resetBlocks();
    expect(g.state.world.temple.blocks[0]).toEqual([objectsOf(AREAS.temple, 'O')[0].tx, objectsOf(AREAS.temple, 'O')[0].ty]);
    for (let i = 0; i < 2; i++) {
      while (g.state.world.temple.blocks[i][0] < plates[i].tx) expect(g.pushBlock(i, 1, 0).ok).toBe(true);
    }
    expect(g.state.world.temple.solved[2]).toBe(true);
    expect(g.pushBlock(0, 1, 0).ok).toBe(false);
  });

  it('completing all trials finishes the quest, wakes the heart and opens the grove gate', () => {
    const g = newGame();
    g.state.quests.q_temple.status = 'active';
    for (const n of RUNE_ORDER) g.activateRune(n);
    TEMPLE_MIRRORS.forEach((_, i) => g.toggleMirror(i));
    const plates = objectsOf(AREAS.temple, 'P');
    for (let i = 0; i < 2; i++) while (g.state.world.temple.blocks[i][0] < plates[i].tx) g.pushBlock(i, 1, 0);
    expect(g.state.quests.q_temple.status).toBe('done');
    expect(g.state.quests.q_finale.status).toBe('active');
    expect(g.state.island.visuals).toContain('grove_gate_open');
    expect(g.touchEchoHeart()?.lines.length).toBeGreaterThan(0);
  });
});

describe('two paths into the temple', () => {
  it('the Sun Key opens the temple for players who did not bring the egg there', () => {
    const g = newGame();
    expect(g.state.world.templeOpen).toBe(false);
    g.findSunKey();
    expect(g.state.world.templeOpen).toBe(true);
    expect(g.state.island.visuals).toContain('temple_open');
  });

  it('bringing the egg to the temple opens it and offers the temple quest right away', () => {
    const g = newGame();
    g.state.quests.q_egg.status = 'active';
    g.chooseEgg('temple');
    expect(g.state.world.templeOpen).toBe(true);
    expect(g.state.quests.q_temple.status).toBe('available');
  });
});

describe('combat rules', () => {
  it('health grows with level; blocking halves damage', () => {
    expect(maxHealth(1)).toBe(5);
    expect(maxHealth(5)).toBe(7);
    expect(damageTaken(1, true)).toBe(0);
    expect(damageTaken(2, true)).toBe(1);
    expect(damageTaken(2, false)).toBe(2);
  });

  it('defeat is gentle: Nova wakes in the village and loses at most 20% of this trip’s common resources', () => {
    const g = newGame();
    const lost: unknown[] = [];
    g.events.on('defeated', (e) => lost.push(e.lost));
    g.state.player.position = { area: 'highlands', zone: 'highlands', x: 100, y: 100 };
    g.state.inventory.wood = 50;
    g.give('stone', 10); // gathered on this trip
    g.give('essence', 5); // not a common resource
    g.state.player.coins = 99;
    expect(g.hurt(99)).toBe(true);
    expect(g.state.inventory.stone).toBe(10 - Math.floor(10 * DEFEAT_LOSS_SHARE));
    expect(g.state.inventory.wood).toBe(50);
    expect(g.state.inventory.essence).toBe(5);
    expect(g.state.player.coins).toBe(99);
    expect(g.state.player.health).toBe(g.maxHealth());
    expect(g.state.player.position.area).toBe('island');
    expect(lost).toHaveLength(1);
  });

  it('eating heals; quick-slot eats the cheapest food first', () => {
    const g = newGame();
    g.state.player.health = 1;
    g.state.inventory.glow_berry = 1;
    g.state.inventory.tonic = 1;
    g.eatBest();
    expect(g.state.player.health).toBe(2);
    expect(g.state.inventory.glow_berry).toBe(0);
    g.eat('tonic');
    expect(g.state.player.health).toBe(g.maxHealth());
  });

  it('the Hollow is weaker, and can be healed, when the island is well cared for', () => {
    const s = newGameState();
    const raw = bossHealth(s);
    expect(canHealHollow(s)).toBe(false);
    s.island.level = 3;
    expect(canHealHollow(s)).toBe(true);
    expect(bossHealth(s)).toBeLessThan(raw);
    s.island.corruption.forest = 1;
    expect(canHealHollow(s)).toBe(false);
  });

  it('the final choice decides the ending and is remembered', () => {
    const g = newGame();
    g.state.quests.q_finale.status = 'active';
    g.state.island.level = 3;
    const d = g.bossDefeated();
    expect(d.options?.map((o) => o.id)).toEqual(['final:heal', 'final:seal']);
    g.respond('final:heal');
    expect(g.state.world.ending).toBe('heal');
    expect(g.state.creatures.wispling.present).toBe(true);
    expect(g.state.island.visuals).toEqual(expect.arrayContaining(['grove_healed', 'island_radiant']));
    expect(g.state.quests.q_finale.status).toBe('done');
    expect(g.endingSummary().some((r) => r.value.includes('healed'))).toBe(true);
  });

  it('an uncared-for island can only seal the Hollow', () => {
    const g = newGame();
    expect(g.bossDefeated().options?.map((o) => o.id)).toEqual(['final:seal']);
    expect(g.chooseEnding('heal').ok).toBe(false);
    expect(g.chooseEnding('seal').ok).toBe(true);
    expect(g.state.island.visuals).toContain('grove_sealed');
  });
});

describe('Highlands rescue (branching choice)', () => {
  it('both choices free the Skyhare with a different visible result', () => {
    for (const choice of ['village', 'wild'] as const) {
      const g = newGame();
      g.state.quests.q_highlands.status = 'active';
      g.respond(`skyhare:${choice}`);
      expect(g.state.world.skyhareFreed).toBe(true);
      expect(g.state.quests.q_highlands.status).toBe('done');
      expect(g.state.island.visuals).toContain(choice === 'village' ? 'skyhare_village' : 'highlands_bloom');
    }
  });
});

describe('fishing, crafting and evolution', () => {
  it('catches minnows in a dim lake and moonfish once it is restored', () => {
    const g = newGame(() => 0.3);
    expect(g.catchFish()).toBe('minnow');
    g.state.island.lakeRestored = true;
    expect(g.catchFish()).toBe('moonfish');
  });

  it('over-fishing darkens the lake; a purifier cleanses it', () => {
    const g = newGame();
    for (let i = 0; i < FISH_PRESSURE_LIMIT; i++) g.catchFish();
    expect(g.state.island.corruption.lake).toBe(1);
    g.state.inventory.purifier = 1;
    expect(g.usePurifier().ok).toBe(true);
    expect(g.state.island.corruption.lake).toBe(0);
  });

  it('fishing pressure fades with time', () => {
    const g = newGame();
    for (let i = 0; i < 4; i++) g.catchFish();
    g.tick(600);
    expect(g.state.island.fishPressure).toBe(0);
  });

  it('the workshop crafts items and a one-time charm', () => {
    const g = newGame();
    Object.assign(g.state.inventory, { crystal: 10, essence: 4, stone: 10 });
    expect(g.craft('purifier').ok).toBe(false); // no workshop yet
    g.state.buildings.workshop = 1;
    expect(g.craft('purifier').ok).toBe(true);
    expect(g.state.inventory.purifier).toBe(1);
    const before = g.attackDamage();
    expect(g.craft('charm').ok).toBe(true);
    expect(g.attackDamage()).toBe(before + 1);
    expect(g.craft('charm').ok).toBe(false);
  });

  it('a bonded Glowfox evolves into a Lumifox with crystal', () => {
    const g = newGame();
    g.state.quests.q_evolve.status = 'active';
    g.state.inventory.glow_berry = 3;
    for (let i = 0; i < 3; i++) g.interactCreature('glowfox');
    expect(g.canEvolve('glowfox')).toBe(true);
    expect(g.evolve('glowfox').ok).toBe(false); // needs crystal
    g.state.inventory.crystal = 2;
    expect(g.respond('evolve:glowfox').ok).toBe(true);
    expect(g.creatureName('glowfox')).toBe('Lumifox');
    expect(g.state.quests.q_evolve.status).toBe('done');
  });
});

describe('save migration v2 → current', () => {
  it('fills new fields and opens quests unlocked by already-finished quests', () => {
    const v2 = JSON.parse(JSON.stringify(newGameState())) as Record<string, any>;
    v2.saveVersion = 2;
    delete v2.world.temple;
    delete v2.player.health;
    delete v2.quests.q_highlands;
    v2.quests.q_egg.status = 'done';
    v2.choices = [{ id: 'egg_choice', value: 'temple', day: 1 }];
    const s = migrateSave(v2);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.world.temple.mirrors).toHaveLength(3);
    expect(s.player.health).toBe(5);
    expect(s.quests.q_highlands.status).toBe('available');
    expect(s.world.templeOpen).toBe(true);
  });
});

describe('quests never get stuck', () => {
  it('trials solved before accepting the temple quest still count, and the finale opens', () => {
    const g = newGame();
    for (const n of RUNE_ORDER) g.activateRune(n);
    TEMPLE_MIRRORS.forEach((_, i) => g.toggleMirror(i));
    const plates = objectsOf(AREAS.temple, 'P');
    for (let i = 0; i < 2; i++) while (g.state.world.temple.blocks[i][0] < plates[i].tx) g.pushBlock(i, 1, 0);
    g.state.quests.q_temple.status = 'available';
    g.acceptQuest('q_temple');
    expect(g.state.quests.q_temple.status).toBe('done');
    expect(g.state.quests.q_finale.status).toBe('active');
  });

  it('an older save with an active quest whose goal is already met is repaired on load', () => {
    const s = newGameState();
    s.world.temple.solved = [true, true, true];
    s.quests.q_temple = { status: 'active', progress: 0 };
    s.world.sunKeyFound = true;
    s.quests.q_caves = { status: 'active', progress: 0 };
    const g = new Game(s);
    expect(g.state.quests.q_temple.status).toBe('done');
    expect(g.state.quests.q_caves.status).toBe('done');
    expect(g.state.quests.q_finale.status).toBe('active');
  });
});

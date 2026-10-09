import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_COINS } from '../src/core/achievements';
import { maxHealth } from '../src/core/combat';
import { BOAT_COST, GROW, ISLAND_HARMONY_LEVELS, LOGIN_REWARDS, MAX_GATHER_YIELD, PLAYER_XP_LEVELS, SEASON_DAYS } from '../src/core/config';
import { DAILY_BONUS, DAILY_COUNT, DAILY_POOL, dateKey, dayBefore } from '../src/core/daily';
import { Game, levelFor } from '../src/core/game';
import { processGrowth } from '../src/core/growth';
import { DECOR_SLOTS, MEMORY_SHARDS, NODES } from '../src/core/layout';
import { AREAS, terrainSolid } from '../src/core/areas';
import { isWalkableGround } from '../src/core/layout';
import { SAVE_VERSION, migrateSave, newGameState } from '../src/core/state';
import type { GameState } from '../src/core/types';

/** A game whose calendar clock can be moved by the test. */
function setup(rng = () => 0.9, state: GameState = newGameState(undefined, new Date(2026, 9, 3, 9))) {
  const clock = { now: new Date(2026, 9, 3, 10) };
  const g = new Game(state, undefined, rng, () => clock.now);
  const nextDay = (days = 1) => (clock.now = new Date(clock.now.getFullYear(), clock.now.getMonth(), clock.now.getDate() + days, 10));
  /** Jump the calendar to island day `day` (day 1 = 3 Oct 2026, when the save was made). */
  const goToDay = (day: number, hour = 10) => (clock.now = new Date(2026, 9, 2 + day, hour));
  return { g, clock, nextDay, goToDay };
}

describe('daily tasks', () => {
  it('picks three tasks per calendar day, the same all day and new the next day', () => {
    const { g, nextDay } = setup();
    expect(g.refreshDaily()).toBe(true);
    const first = g.state.daily.tasks.map((x) => x.kind);
    expect(first).toHaveLength(DAILY_COUNT);
    expect(new Set(first).size).toBe(DAILY_COUNT);
    expect(g.refreshDaily()).toBe(false);
    nextDay();
    expect(g.refreshDaily()).toBe(true);
    expect(g.state.daily.date).toBe(dateKey(new Date(2026, 9, 4)));
  });

  it('completing a task pays out, and finishing all three gives the bonus once', () => {
    const { g } = setup();
    g.refreshDaily();
    const coins = g.state.player.coins;
    const tasks = g.state.daily.tasks;
    const firstReward = DAILY_POOL[tasks[0].kind].coins;
    g.dailyProgress(tasks[0].kind, tasks[0].target);
    expect(tasks[0].done).toBe(true);
    expect(g.state.player.coins).toBe(coins + firstReward);
    for (const task of tasks) g.dailyProgress(task.kind, task.target);
    expect(g.state.daily.bonusClaimed).toBe(true);
    const total = tasks.reduce((n, x) => n + DAILY_POOL[x.kind].coins, 0);
    expect(g.state.player.coins).toBeGreaterThanOrEqual(coins + total + DAILY_BONUS.coins);
    expect(g.state.daily.completed).toBe(DAILY_COUNT);
  });

  it('only offers tasks the player can do', () => {
    const { g } = setup();
    for (let i = 0; i < 40; i++) {
      g.state.daily.date = '';
      g.state.createdAt = new Date(2026, 0, i + 1).toISOString();
      g.refreshDaily();
      const kinds = g.state.daily.tasks.map((x) => x.kind);
      expect(kinds).not.toContain('harvest'); // no garden yet
      expect(kinds).not.toContain('play'); // no bonded friend yet
    }
  });

  it('bonded friends take a treat while a feeding task is open, and it counts', () => {
    const { g } = setup();
    for (const c of Object.values(g.state.creatures)) Object.assign(c, { state: 'bonded', bond: 100 });
    g.state.daily = { ...g.state.daily, date: g.today(), tasks: [{ kind: 'feed', target: 2, progress: 0, done: false }] };
    expect(g.wantsTreat('glowfox')).toBe(false); // no berries yet: just petting
    g.state.inventory.glow_berry = 2;
    expect(g.wantsTreat('glowfox')).toBe(true);
    g.interactCreature('glowfox');
    g.interactCreature('glowfox');
    expect(g.state.daily.tasks[0].done).toBe(true);
    expect(g.state.inventory.glow_berry).toBe(0);
    // once the task is done, petting no longer uses up food
    g.state.inventory.glow_berry = 1;
    expect(g.wantsTreat('glowfox')).toBe(false);
    g.interactCreature('glowfox');
    expect(g.state.inventory.glow_berry).toBe(1);
  });

});

describe('login rewards', () => {
  it('counts a streak of consecutive days and resets after a missed day', () => {
    const { g, nextDay } = setup();
    expect(g.pendingLogin()).toEqual({ streak: 1, coins: LOGIN_REWARDS[0], first: true });
    expect(g.claimLogin().ok).toBe(true);
    expect(g.pendingLogin()).toBeNull();
    expect(g.claimLogin().ok).toBe(false);
    nextDay();
    expect(g.pendingLogin()).toEqual({ streak: 2, coins: LOGIN_REWARDS[1], first: false });
    g.claimLogin();
    nextDay(2);
    expect(g.pendingLogin()?.streak).toBe(1);
  });

  it('knows the day before across month ends', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
  });
});

describe('higher level caps', () => {
  it('player levels go to 15 and island levels to 10', () => {
    expect(levelFor(PLAYER_XP_LEVELS.at(-1)!, PLAYER_XP_LEVELS)).toBe(15);
    expect(levelFor(ISLAND_HARMONY_LEVELS.at(-1)!, ISLAND_HARMONY_LEVELS)).toBe(10);
  });

  it('hearts and gathering stay sensible at high levels', () => {
    expect(maxHealth(15)).toBe(10);
    const { g } = setup();
    g.state.player.level = 15;
    expect(g.gatherYield()).toBe(MAX_GATHER_YIELD);
  });

  it('new building plots open at island levels 6 to 9', () => {
    const { g } = setup();
    g.state.island.level = 5;
    expect(g.plotStatus('plot9')).toBe('locked');
    g.state.island.level = 9;
    expect(['plot9', 'plot10', 'plot11', 'plot12'].map((p) => g.plotStatus(p))).toEqual(['free', 'free', 'free', 'free']);
  });
});

describe('cooking and meal boosts', () => {
  it('cooks a meal from ingredients and its boost wears off', () => {
    const { g } = setup();
    expect(g.cook('berry_pie').ok).toBe(false);
    Object.assign(g.state.inventory, { glow_berry: 3, wood: 1 });
    expect(g.cook('berry_pie').ok).toBe(true);
    expect(g.state.inventory.berry_pie).toBe(1);
    expect(g.state.inventory.glow_berry).toBe(0);
    // meals can be eaten at full health for their boost
    expect(g.eat('berry_pie').ok).toBe(true);
    expect(g.speedMultiplier()).toBeGreaterThan(1);
    g.tick(181);
    expect(g.speedMultiplier()).toBe(1);
  });

  it('a hearty meal adds two hearts until it wears off', () => {
    const { g } = setup();
    g.state.inventory.fish_stew = 1;
    g.eat('fish_stew');
    expect(g.maxHealth()).toBe(7);
    g.state.player.health = 7;
    g.tick(241);
    expect(g.maxHealth()).toBe(5);
    expect(g.state.player.health).toBe(5);
  });

  it('a lucky salad doubles gathering and a curry adds attack', () => {
    const { g } = setup();
    Object.assign(g.state.inventory, { garden_salad: 1, coconut_curry: 1 });
    const base = g.gatherYield();
    const attack = g.attackDamage();
    g.eat('garden_salad');
    g.eat('coconut_curry');
    expect(g.gatherYield()).toBe(base * 2);
    expect(g.attackDamage()).toBe(attack + 1);
  });
});

describe('badges', () => {
  it('awards a badge once, with coins', () => {
    const { g } = setup();
    g.state.inventory.seed = 20;
    const coins = g.state.player.coins;
    const spots = NODES.filter((n) => n.kind === 'grove').slice(0, 10);
    spots.forEach((n) => g.plant(n.id));
    expect(g.state.achievements).toContain('green_thumb');
    expect(g.state.player.coins).toBeGreaterThanOrEqual(coins + ACHIEVEMENT_COINS);
    const count = g.state.achievements.filter((a) => a === 'green_thumb').length;
    expect(count).toBe(1);
  });
});

describe('seasons, festivals and weather', () => {
  it('cycles through four seasons with a festival on the last day of each', () => {
    const { g, goToDay } = setup();
    goToDay(1);
    expect(g.season()).toBe('spring');
    expect(g.festivalToday()).toBeNull();
    goToDay(SEASON_DAYS);
    expect(g.festivalToday()).toBe('spring');
    goToDay(SEASON_DAYS + 1);
    expect(g.season()).toBe('summer');
    goToDay(SEASON_DAYS * 4 + 1);
    expect(g.season()).toBe('spring');
  });

  it('a festival can be celebrated once and gives its decoration', () => {
    const { g, goToDay } = setup();
    goToDay(3);
    expect(g.celebrateFestival().ok).toBe(false);
    goToDay(SEASON_DAYS * 2);
    expect(g.celebrateFestival().ok).toBe(true);
    expect(g.state.world.decorOwned.paper_lantern).toBe(1);
    expect(g.celebrateFestival().ok).toBe(false);
    expect(g.state.player.cosmetics).toContain('party_hat');
  });

  it('rolls weather from the season and rain makes saplings grow twice as fast', () => {
    const { g } = setup(() => 0);
    g.state.world.weather.until = 0;
    g.tick(1);
    expect(g.weather()).toBe('rain');
    expect(g.state.stats.weatherSeen).toContain('rain');

    const dry = newGameState();
    const wet = newGameState();
    for (const s of [dry, wet]) Object.assign(s.world.nodes.grove1, { stage: 'sapling', timer: GROW.sapling });
    wet.world.weather = { kind: 'rain', until: wet.world.minutes + 1000 };
    processGrowth(dry, GROW.sapling / 2);
    processGrowth(wet, GROW.sapling / 2);
    expect(dry.world.nodes.grove1.stage).toBe('sapling');
    expect(wet.world.nodes.grove1.stage).toBe('tree');
  });
});

describe('decorating', () => {
  it('buys, places and picks up decorations; Harmony only the first time', () => {
    const { g } = setup();
    g.state.player.coins = 100;
    expect(g.buyDecor('bench').ok).toBe(true);
    expect(g.buyDecor('snowman').ok).toBe(false); // festival gift only
    const harmony = g.state.island.harmony;
    expect(g.placeDecor('bench', 'd1').ok).toBe(true);
    expect(g.state.island.harmony).toBeGreaterThan(harmony);
    expect(g.placeDecor('bench', 'd2').ok).toBe(false); // none left
    expect(g.removeDecor('d1').ok).toBe(true);
    const after = g.state.island.harmony;
    g.placeDecor('bench', 'd2');
    expect(g.state.island.harmony).toBe(after);
  });

  it('porch spots open only when a house stands on the plot', () => {
    const { g } = setup();
    const porch = DECOR_SLOTS.find((d) => d.plot === 'plot1')!;
    expect(g.decorSlotOpen(porch.id)).toBe(false);
    g.state.world.plots.plot1 = 'house';
    expect(g.decorSlotOpen(porch.id)).toBe(true);
  });
});

describe('Coral Isle', () => {
  it('island level 3 opens the boat quest; repairing the boat and healing the reef bring the Seapup', () => {
    const { g } = setup();
    expect(g.state.quests.q_voyage.status).toBe('locked');
    g.addHarmony(ISLAND_HARMONY_LEVELS[2]);
    g.runRules();
    expect(g.state.quests.q_voyage.status).toBe('available');
    expect(g.repairBoat().ok).toBe(false);
    g.acceptQuest('q_voyage');
    Object.assign(g.state.inventory, BOAT_COST);
    expect(g.repairBoat().ok).toBe(true);
    expect(g.state.quests.q_voyage.status).toBe('done');
    expect(g.state.quests.q_reef.status).toBe('available');
    g.acceptQuest('q_reef');
    g.state.inventory.essence = 4;
    for (const id of ['isle:z1', 'isle:z2', 'isle:z3', 'isle:z4']) expect(g.healReef(id).ok).toBe(true);
    expect(g.state.quests.q_reef.status).toBe('done');
    expect(g.state.creatures.seapup.present).toBe(true);
  });

  it('coral, shells and coconuts can be gathered there', () => {
    const { g } = setup();
    expect(g.gather('isle:k1', { x: 0, y: 0 }).ok).toBe(true);
    expect(g.gather('isle:q1', { x: 0, y: 0 }).ok).toBe(true);
    expect(g.gather('isle:j1', { x: 0, y: 0 }).ok).toBe(true);
    expect(g.state.inventory.coral).toBeGreaterThan(0);
    expect(g.state.inventory.shell).toBeGreaterThan(0);
    expect(g.state.inventory.coconut).toBeGreaterThan(0);
  });
});

describe('mini-games', () => {
  it('the first win of a game day gives a prize; later wins give XP', () => {
    const { g } = setup();
    const coins = g.state.player.coins;
    g.minigameResult('seek', true);
    expect(g.state.player.coins).toBe(coins + 15);
    expect(g.state.inventory.glow_berry).toBe(3);
    g.minigameResult('seek', true);
    expect(g.state.player.coins).toBe(coins + 15);
    expect(g.state.world.minigames.seekWins).toBe(2);
    g.minigameResult('race', false);
    expect(g.state.world.minigames.raceWins).toBe(0);
  });
});

describe('photo mode', () => {
  it('counts photos for daily tasks and badges', () => {
    const { g } = setup();
    for (let i = 0; i < 5; i++) g.photoTaken();
    expect(g.state.stats.photos).toBe(5);
    expect(g.state.achievements).toContain('photographer');
  });
});

describe('save migration v3 → v4', () => {
  it('adds the new systems to an older save', () => {
    const v3 = JSON.parse(JSON.stringify(newGameState())) as Record<string, any>;
    v3.saveVersion = 3;
    delete v3.daily;
    delete v3.achievements;
    delete v3.world.weather;
    delete v3.world.decor;
    delete v3.player.buffs;
    delete v3.npcs.marina;
    delete v3.inventory.coral;
    delete v3.stats.photos;
    const s = migrateSave(v3);
    expect(s.saveVersion).toBe(SAVE_VERSION);
    expect(s.daily.tasks).toEqual([]);
    expect(s.achievements).toEqual([]);
    expect(s.world.weather.kind).toBe('clear');
    expect(Object.keys(s.world.decor)).toHaveLength(DECOR_SLOTS.length);
    expect(s.player.buffs).toEqual({});
    expect(s.npcs.marina.present).toBe(true);
    expect(s.inventory.coral).toBe(0);
    expect(s.stats.photos).toBe(0);
    const { g } = setup(() => 0.9, s);
    expect(g.refreshDaily()).toBe(true);
  });
});

describe('surprise events', () => {
  it('a new event starts after a few minutes of play on the island, and fades if ignored', () => {
    const { g } = setup(() => 0.1);
    g.state.world.nextEventIn = 5;
    g.tick(6);
    expect(g.state.world.event).not.toBeNull();
    g.tick(1000);
    expect(g.state.world.event).toBeNull();
    expect(g.state.world.nextEventIn).toBeGreaterThan(0);
  });

  it('events do not start while Nova is away from the main island', () => {
    const { g } = setup();
    g.state.player.position.area = 'caves';
    g.state.world.nextEventIn = 1;
    g.tick(10);
    expect(g.state.world.event).toBeNull();
  });

  it('treasure, stars and golden butterflies give rewards and count as events', () => {
    const { g } = setup(() => 0.5);
    for (const [kind, act] of [['treasure', () => g.digTreasure()], ['star', () => g.catchStar()], ['golden', () => g.catchGolden()]] as const) {
      const coins = g.state.player.coins;
      g.startEvent(kind);
      expect(act().ok).toBe(true);
      expect(g.state.world.event).toBeNull();
      expect(g.state.player.coins + g.state.inventory.crystal).toBeGreaterThan(coins);
    }
    expect(g.state.stats.eventsDone).toBe(3);
  });

  it('a lost item is found, then returned to its owner by talking to them', () => {
    const { g } = setup(() => 0);
    const ev = g.startEvent('lost');
    const npc = ev.npc!;
    expect(g.pickLost().ok).toBe(true);
    const coins = g.state.player.coins;
    const d = g.talk(npc);
    expect(d.lines.join(' ')).toContain('Thank you');
    expect(g.state.player.coins).toBe(coins + 30);
    expect(g.state.world.event).toBeNull();
  });

  it('a gloom outbreak ends when all its gloomlings are calmed', () => {
    const { g } = setup();
    const ev = g.startEvent('gloom');
    const size = ev.count!;
    for (let i = 0; i < size; i++) g.outbreakCalmed();
    expect(g.state.world.event).toBeNull();
    expect(g.state.inventory.essence).toBe(3);
  });

  it('the merchant sells three offers, each once', () => {
    const { g } = setup();
    g.startEvent('merchant');
    g.state.player.coins = 500;
    expect(g.merchantOffers()).toHaveLength(3);
    expect(g.buyOffer(0).ok).toBe(true);
    expect(g.buyOffer(0).ok).toBe(false);
  });

  it('every event spot is open ground', () => {
    const { g } = setup();
    for (let i = 0; i < 30; i++) {
      const ev = g.startEvent();
      expect(isWalkableGround(ev.x, ev.y)).toBe(true);
    }
  });
});

describe('memory shards', () => {
  it('twelve shards lie on open ground across every area', () => {
    expect(MEMORY_SHARDS).toHaveLength(12);
    for (const m of MEMORY_SHARDS) {
      if (m.area === 'island') expect(isWalkableGround(m.tx * 32 + 16, m.ty * 32 + 16)).toBe(true);
      else expect(terrainSolid(AREAS[m.area], m.tx, m.ty)).toBe(false);
    }
  });

  it('each shard tells part of the story once; all twelve give the memory charm', () => {
    const { g } = setup();
    expect(g.collectMemory('memory_1')?.lines.length).toBeGreaterThan(1);
    expect(g.collectMemory('memory_1')).toBeNull();
    for (const m of MEMORY_SHARDS) g.collectMemory(m.id);
    expect(g.state.discoveries.memories).toHaveLength(12);
    expect(g.state.player.cosmetics).toContain('memory_charm');
    expect(g.state.achievements).toContain('memory_keeper');
  });
});

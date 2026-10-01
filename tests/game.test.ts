import { describe, expect, it } from 'vitest';
import { CLEANSE_PLANTS_NEEDED, EGG_SALE_PRICE, GROW, HARVEST_PRESSURE_LIMIT, ISLAND_HARMONY_LEVELS, STARTING_COINS } from '../src/core/config';
import { Game, levelFor } from '../src/core/game';
import { NODES } from '../src/core/layout';
import { newGameState } from '../src/core/state';

const ids = (kind: string, zone?: string) => NODES.filter((n) => n.kind === kind && (!zone || n.zone === zone)).map((n) => n.id);
const newGame = () => new Game(newGameState(), undefined, () => 0);

/** Play through the first two quests and make the egg choice. */
function toEggChoice(g: Game, choice: 'hatch' | 'sell' | 'temple') {
  for (const id of ids('tree', 'village').slice(0, 3)) g.gather(id);
  expect(g.state.quests.q_egg.status).toBe('active');
  expect(g.examineEgg()?.options).toHaveLength(3);
  expect(g.respond(`egg:${choice}`).ok).toBe(true);
}

describe('quests', () => {
  it('First Steps completes after 3 wood and unlocks Glow and the egg quest', () => {
    const g = newGame();
    for (const id of ids('tree', 'village').slice(0, 3)) g.gather(id);
    expect(g.state.quests.q_first_steps.status).toBe('done');
    expect(g.state.pip.abilities).toContain('glow');
    expect(g.state.player.coins).toBe(STARTING_COINS + 10);
    expect(g.state.quests.q_egg.status).toBe('active');
    expect(g.state.npcs.zed.present).toBe(true);
  });

  it('NPC quests must be accepted by talking, and objectives already met count', () => {
    const g = newGame();
    toEggChoice(g, 'hatch');
    expect(g.state.quests.q_home.status).toBe('available');
    expect(g.questsOfferedBy('rocco')).toEqual(['q_home']);
    const d = g.talk('rocco');
    expect(d.options?.map((o) => o.id)).toContain('accept:q_home');
    g.respond('accept:q_home');
    expect(g.state.quests.q_home.status).toBe('active');
  });

  it('the egg cannot be chosen before its quest is active', () => {
    const g = newGame();
    expect(g.examineEgg()?.options).toBeUndefined();
    expect(g.state.world.egg).toBe('hidden');
  });
});

describe('egg choice — every branch has a visible consequence', () => {
  it('hatch: egg goes to the nest, hatches over time and Sunchick appears', () => {
    const g = newGame();
    toEggChoice(g, 'hatch');
    expect(g.state.world.egg).toBe('nest');
    expect(g.state.island.visuals).toContain('nest_warm');
    g.tick(GROW.eggHatch);
    expect(g.state.world.egg).toBe('hatched');
    expect(g.state.creatures.sunchick.present).toBe(true);
    expect(g.state.discoveries.creatures).toContain('sunchick');
  });

  it('sell: coins, Zed camp, and the forest becomes corrupted', () => {
    const g = newGame();
    const before = g.state.player.coins;
    toEggChoice(g, 'sell');
    expect(g.state.player.coins).toBe(before + 10 + EGG_SALE_PRICE);
    expect(g.state.island.corruption.forest).toBe(1);
    expect(g.state.island.visuals).toContain('zed_camp');
    expect(g.state.pip.mood).toBe('sad');
  });

  it('temple: the gate glows and the seal is discovered', () => {
    const g = newGame();
    toEggChoice(g, 'temple');
    expect(g.state.island.visuals).toContain('temple_glow');
    expect(g.state.discoveries.relics).toContain('temple_seal');
    expect(g.state.npcs.luna.present).toBe(true);
  });

  it('records the choice in the history and NPCs remember it', () => {
    const g = newGame();
    toEggChoice(g, 'sell');
    expect(g.state.choices).toEqual([{ id: 'egg_choice', value: 'sell', day: 1 }]);
    g.state.npcs.zed.met = true;
    expect(g.talk('zed').lines.join(' ')).toMatch(/business/);
    expect(g.pipChatter()).toBeTruthy();
  });
});

describe('corruption is caused by choices and always reversible', () => {
  it('over-harvesting the forest raises corruption; planting cleanses it', () => {
    const g = newGame();
    const forestTrees = ids('tree', 'forest');
    for (const id of forestTrees.slice(0, HARVEST_PRESSURE_LIMIT)) g.gather(id);
    expect(g.state.island.corruption.forest).toBe(1);
    g.state.inventory.seed = 10;
    const groves = ids('grove');
    for (const id of groves.slice(0, CLEANSE_PLANTS_NEEDED)) expect(g.plant(id).ok).toBe(true);
    expect(g.state.island.corruption.forest).toBe(0);
  });

  it('a purifier removes one level, and corruption never removes progress', () => {
    const g = newGame();
    g.state.inventory.wood = 30;
    g.raiseCorruption('forest', 'test');
    g.raiseCorruption('forest', 'test');
    expect(g.state.inventory.wood).toBe(30);
    expect(g.usePurifier('forest').ok).toBe(false);
    g.buy('purifier'); // not enough coins at start
    g.state.player.coins = 100;
    expect(g.buy('purifier').ok).toBe(true);
    expect(g.usePurifier('forest').ok).toBe(true);
    expect(g.state.island.corruption.forest).toBe(1);
  });
});

describe('building, economy and levels', () => {
  it('builds a house on a free plot, spends resources and earns Harmony', () => {
    const g = newGame();
    expect(g.build('house', 'plot1').ok).toBe(false);
    g.state.inventory.wood = 8;
    g.state.inventory.stone = 4;
    expect(g.build('house', 'plot3').ok).toBe(false); // locked until island level 2
    expect(g.build('house', 'plot1').ok).toBe(true);
    expect(g.state.inventory.wood).toBe(0);
    expect(g.state.world.plots.plot1).toBe('house');
    expect(g.state.island.harmony).toBeGreaterThan(0);
    expect(g.build('garden', 'plot1').ok).toBe(false); // occupied
  });

  it('gardens grow vegetables over time that can be harvested and sold', () => {
    const g = newGame();
    Object.assign(g.state.inventory, { wood: 6, stone: 2, seed: 2 });
    expect(g.build('garden', 'plot2').ok).toBe(true);
    expect(g.state.island.visuals).toContain('butterflies');
    g.tick(GROW.garden / 2);
    expect(g.harvestGarden('plot2').ok).toBe(true);
    const coins = g.state.player.coins;
    expect(g.sell('veggie', 2).ok).toBe(true);
    expect(g.state.player.coins).toBe(coins + 6);
  });

  it('shop rejects purchases without enough coins', () => {
    const g = newGame();
    g.state.player.coins = 3;
    const r = g.buy('seed');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/2 more coins/);
  });

  it('player and island levels are separate', () => {
    expect(levelFor(0, ISLAND_HARMONY_LEVELS)).toBe(1);
    expect(levelFor(40, ISLAND_HARMONY_LEVELS)).toBe(2);
    const g = newGame();
    g.addHarmony(100);
    expect(g.state.island.level).toBe(3);
    expect(g.state.player.level).toBe(1);
    expect(g.plotStatus('plot4')).toBe('free');
  });
});

describe('world changes (PRD: at least five visible changes in the slice)', () => {
  it('planting trees, restoring the lake and bonding creatures all change the world', () => {
    const g = newGame();
    g.state.inventory.seed = 20;
    for (const id of ids('grove').slice(0, 10)) g.plant(id);
    expect(g.state.island.visuals).toEqual(expect.arrayContaining(['forest_flowers', 'forest_lush']));
    expect(g.state.creatures.mossprite.present).toBe(true);

    for (const id of ids('debris')) g.gather(id);
    expect(g.state.island.lakeRestored).toBe(true);
    expect(g.state.island.visuals).toContain('lake_bright');
    expect(g.state.creatures.ripplet.present).toBe(true);

    g.state.inventory.glow_berry = 3;
    for (let i = 0; i < 3; i++) g.interactCreature('glowfox');
    expect(g.state.creatures.glowfox.state).toBe('bonded');

    // saplings grow into memory trees
    g.tick(GROW.sapling);
    expect(g.state.world.nodes[ids('grove')[0]].stage).toBe('tree');
  });

  it('three discoveries teach Pip Sense, eight earn a crown', () => {
    const g = newGame();
    g.enterZone('village');
    g.enterZone('forest');
    expect(g.state.pip.abilities).not.toContain('sense');
    g.enterZone('lake');
    expect(g.state.pip.abilities).toContain('sense');
    for (const id of ['glowfox', 'ripplet', 'mossprite', 'sunchick', 'echo_egg'] as const) {
      g.discover(id === 'echo_egg' ? 'relics' : 'creatures', id);
    }
    expect(g.state.pip.cosmetic).toBe('flower_crown');
  });
});

describe('time', () => {
  it('sleeping in a house skips to the next morning', () => {
    const g = newGame();
    expect(g.sleep().ok).toBe(false);
    g.state.buildings.house = 1;
    const day = g.day;
    expect(g.sleep().ok).toBe(true);
    expect(g.day).toBe(day + 1);
    expect(g.hour).toBe(6);
  });

  it('darkness is zero by day and full at midnight', () => {
    const g = newGame();
    expect(g.darkness()).toBe(0);
    g.state.world.minutes = 24 * 60;
    expect(g.darkness()).toBe(1);
  });
});

import rulesData from '../data/rules.json';
import {
  CLEANSE_PLANTS_NEEDED,
  CORRUPTION_MAX,
  EGG_SALE_PRICE,
  GROW,
  HARVEST_PRESSURE_LIMIT,
  HARVEST_PRESSURE_WARN,
  ISLAND_HARMONY_LEVELS,
  MINUTES_PER_DAY,
  MINUTES_PER_SECOND,
  PLAYER_XP_LEVELS,
} from './config';
import { BUILDINGS, CREATURES, ITEMS, QUESTS, QUEST_ORDER, type QuestObjective } from './content';
import { Emitter } from './events';
import { processGrowth, type GrowthSummary } from './growth';
import { t } from './i18n';
import { NODE_BY_ID, NODES, PLOTS } from './layout';
import { dueRules, type WorldRule } from './rules';
import type {
  BuildingId,
  CreatureId,
  DiscoveryCategory,
  EggChoice,
  GameState,
  ItemId,
  NpcId,
  PipAbility,
  QuestId,
  ZoneId,
} from './types';

export type SfxName =
  | 'collect' | 'chop' | 'mine' | 'success' | 'build' | 'error' | 'coin' | 'plant' | 'levelup' | 'magic' | 'splash';

export interface ToastEvent {
  text: string;
  icon?: string;
  kind: 'info' | 'reward' | 'warn' | 'world' | 'quest';
}

export interface GameEvents {
  changed: undefined;
  toast: ToastEvent;
  float: { x: number; y: number; text: string };
  levelup: { kind: 'player' | 'island'; level: number };
  questComplete: { id: QuestId };
  pipSay: { text: string };
  sfx: SfxName;
  worldChange: { id: string };
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface DialogOption {
  id: string;
  label: string;
}

export interface Dialog {
  npc: NpcId | 'pip';
  speaker: string;
  lines: string[];
  /** Optional per-line speaker when several characters talk in one dialogue. */
  speakers?: (NpcId | 'pip')[];
  options?: DialogOption[];
}

export const DEFAULT_RULES = rulesData as WorldRule[];

export function levelFor(value: number, thresholds: readonly number[]): number {
  let level = 1;
  thresholds.forEach((need, i) => {
    if (value >= need) level = i + 1;
  });
  return level;
}

/** Share of the way from the current level threshold to the next (0..1), and the next threshold. */
export function levelProgress(value: number, thresholds: readonly number[]): { pct: number; next: number | null } {
  const level = levelFor(value, thresholds);
  const cur = thresholds[level - 1];
  const next = thresholds[level];
  if (next === undefined) return { pct: 1, next: null };
  return { pct: (value - cur) / (next - cur), next };
}

/**
 * The game core: owns the save state and every rule of play.
 * It has no rendering code so it can be unit-tested and reused by any front end.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  private rng: () => number;

  constructor(
    public state: GameState,
    private rules: readonly WorldRule[] = DEFAULT_RULES,
    rng: () => number = Math.random,
  ) {
    this.rng = rng;
  }

  // ---------------------------------------------------------------- time

  get day(): number {
    return Math.floor(this.state.world.minutes / MINUTES_PER_DAY) + 1;
  }

  get hour(): number {
    return (this.state.world.minutes % MINUTES_PER_DAY) / 60;
  }

  /** 0 in daylight, 1 in deep night, smooth at dusk and dawn. */
  darkness(): number {
    const h = this.hour;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 21) return (h - 18) / 3;
    if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
    return 1;
  }

  timeLabel(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor(this.state.world.minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Advance play time by real seconds. */
  tick(realSeconds: number): void {
    this.state.stats.playSeconds += realSeconds;
    const growth = processGrowth(this.state, realSeconds * MINUTES_PER_SECOND);
    if (this.reportGrowth(growth)) this.changed();
  }

  /** Sleep in a house until 06:00 the next morning. */
  sleep(): ActionResult {
    if (this.state.buildings.house < 1) return { ok: false, message: t('msg.need_house') };
    const minutesToday = this.state.world.minutes % MINUTES_PER_DAY;
    const until = (MINUTES_PER_DAY - minutesToday + 6 * 60) % MINUTES_PER_DAY || MINUTES_PER_DAY;
    const growth = processGrowth(this.state, until);
    this.reportGrowth(growth);
    this.toast(t('msg.slept', { day: this.day }), 'info', '🌙');
    this.changed();
    return { ok: true };
  }

  private reportGrowth(g: GrowthSummary): boolean {
    let any = false;
    if (g.saplingsGrown) {
      this.toast(t('msg.saplings_grown', { n: g.saplingsGrown }), 'world', '🌳');
      any = true;
    }
    if (g.eggHatched) {
      this.state.pip.mood = 'excited';
      this.discover('creatures', 'sunchick');
      this.toast(t('msg.egg_hatched'), 'world', '🐥');
      this.events.emit('worldChange', { id: 'egg_hatched' });
      this.state.stats.worldChanges++;
      any = true;
    }
    if (g.treesRegrown || g.bushesRefilled || g.rocksRestored || g.produce) any = true;
    return any;
  }

  // ---------------------------------------------------------------- helpers

  private changed(): void {
    this.events.emit('changed', undefined);
  }

  private toast(text: string, kind: ToastEvent['kind'] = 'info', icon?: string): void {
    this.events.emit('toast', { text, kind, icon });
  }

  itemName(item: ItemId): string {
    return t(`item.${item}`);
  }

  has(item: ItemId, n = 1): boolean {
    return this.state.inventory[item] >= n;
  }

  missingFor(cost: Partial<Record<ItemId, number>>): Partial<Record<ItemId, number>> {
    const missing: Partial<Record<ItemId, number>> = {};
    for (const [item, n] of Object.entries(cost) as [ItemId, number][]) {
      const lack = n - this.state.inventory[item];
      if (lack > 0) missing[item] = lack;
    }
    return missing;
  }

  give(item: ItemId, n: number, at?: { x: number; y: number }): void {
    this.state.inventory[item] += n;
    if (at) this.events.emit('float', { ...at, text: `+${n} ${ITEMS[item].icon}` });
  }

  addCoins(n: number): void {
    this.state.player.coins += n;
    if (n > 0) this.events.emit('sfx', 'coin');
  }

  addXp(n: number): void {
    const p = this.state.player;
    p.xp += n;
    const level = levelFor(p.xp, PLAYER_XP_LEVELS);
    if (level > p.level) {
      p.level = level;
      this.events.emit('levelup', { kind: 'player', level });
      this.events.emit('sfx', 'levelup');
    }
  }

  addHarmony(n: number): void {
    const i = this.state.island;
    i.harmony += n;
    const level = levelFor(i.harmony, ISLAND_HARMONY_LEVELS);
    if (level > i.level) {
      i.level = level;
      this.events.emit('levelup', { kind: 'island', level });
      this.events.emit('sfx', 'levelup');
      this.state.stats.worldChanges++;
    }
  }

  /** Gathering yield grows with Nova's level. */
  gatherYield(): number {
    return 1 + Math.floor((this.state.player.level - 1) / 2);
  }

  discoveryCount(): number {
    return Object.values(this.state.discoveries).reduce((n, list) => n + list.length, 0);
  }

  discover(cat: DiscoveryCategory, id: string): boolean {
    const list = this.state.discoveries[cat];
    if (list.includes(id)) return false;
    list.push(id);
    if (cat === 'creatures') {
      const c = this.state.creatures[id as CreatureId];
      if (c && c.state === 'unknown') c.state = 'observed';
    }
    this.addXp(5);
    this.toast(t('msg.discovered', { name: t(`disc.${id}`) }), 'reward', '📖');
    this.events.emit('sfx', 'magic');
    if (cat === 'creatures' && id === 'glowfox' && this.state.quests.q_glowfox.status === 'locked') {
      this.unlockQuest('q_glowfox');
    }
    this.runRules();
    this.changed();
    return true;
  }

  enterZone(zone: ZoneId): void {
    this.state.player.position.zone = zone;
    const place = { village: 'whisper_village', forest: 'emerald_forest', lake: 'moonlit_lake' }[zone];
    this.discover('places', place);
  }

  // ---------------------------------------------------------------- world interactions

  /** Chop a tree, mine a rock, pick a bush or clear lake debris. */
  gather(nodeId: string): ActionResult {
    const def = NODE_BY_ID[nodeId];
    const node = this.state.world.nodes[nodeId];
    if (!def || !node) return { ok: false };
    const at = { x: def.x, y: def.y - 24 };
    const amount = this.gatherYield();

    if (def.kind === 'debris') {
      if (this.state.world.debrisCleared.includes(nodeId)) return { ok: false };
      this.state.world.debrisCleared.push(nodeId);
      this.give('essence', 1, at);
      this.addXp(3);
      this.events.emit('sfx', 'splash');
      this.progress('clear', undefined, 1);
      if (!this.state.island.lakeRestored && this.state.world.debrisCleared.length >= NODES.filter((n) => n.kind === 'debris').length) {
        this.state.island.lakeRestored = true;
        this.state.pip.mood = 'excited';
      }
      this.runRules();
      this.changed();
      return { ok: true };
    }

    if (node.stage !== 'full') return { ok: false };
    if (def.kind === 'tree') {
      node.stage = 'stump';
      node.timer = GROW.stumpRegrow;
      this.give('wood', amount, at);
      this.events.emit('sfx', 'chop');
      this.discover('plants', 'oak');
      this.progress('gather', 'wood', amount);
      if (def.zone === 'forest') this.addHarvestPressure();
    } else if (def.kind === 'rock') {
      node.stage = 'empty';
      node.timer = GROW.rockRegrow;
      this.give('stone', amount, at);
      this.events.emit('sfx', 'mine');
      this.progress('gather', 'stone', amount);
    } else if (def.kind === 'bush') {
      node.stage = 'empty';
      node.timer = GROW.bushRegrow;
      this.give('glow_berry', amount + 1, at);
      this.events.emit('sfx', 'collect');
      this.discover('plants', 'glow_berry');
      this.progress('gather', 'glow_berry', amount + 1);
    } else {
      return { ok: false };
    }
    this.addXp(2);
    this.changed();
    return { ok: true };
  }

  private addHarvestPressure(): void {
    const i = this.state.island;
    i.harvestPressure++;
    if (i.harvestPressure >= HARVEST_PRESSURE_WARN && !i.warnedPressure) {
      i.warnedPressure = true;
      this.events.emit('pipSay', { text: t('pip.pressure_warning') });
    }
    if (i.harvestPressure >= HARVEST_PRESSURE_LIMIT) {
      i.harvestPressure = 0;
      this.raiseCorruption('forest', t('msg.corruption_harvest'));
    }
  }

  raiseCorruption(zone: ZoneId, reason: string): void {
    const c = this.state.island.corruption;
    if (c[zone] >= CORRUPTION_MAX) return;
    c[zone]++;
    this.state.pip.mood = 'sad';
    this.state.stats.worldChanges++;
    this.toast(reason, 'warn', '🌑');
    this.events.emit('worldChange', { id: `corruption_${zone}_${c[zone]}` });
    this.events.emit('pipSay', { text: t('pip.corruption_rose') });
  }

  private lowerCorruption(zone: ZoneId): void {
    const c = this.state.island.corruption;
    if (c[zone] <= 0) return;
    c[zone]--;
    this.state.island.cleanseProgress = 0;
    this.addHarmony(10);
    this.state.pip.mood = 'excited';
    this.state.stats.worldChanges++;
    this.toast(c[zone] === 0 ? t('msg.cleansed_full') : t('msg.cleansed_step'), 'world', '🌿');
    this.events.emit('worldChange', { id: `cleanse_${zone}_${c[zone]}` });
    this.events.emit('sfx', 'magic');
  }

  /** Plant a seed in a grove spot or on a tree stump. */
  plant(nodeId: string): ActionResult {
    const def = NODE_BY_ID[nodeId];
    const node = this.state.world.nodes[nodeId];
    if (!def || !node) return { ok: false };
    if (!(node.stage === 'soil' || (node.stage === 'stump' && def.kind === 'tree'))) return { ok: false };
    if (!this.has('seed')) {
      this.events.emit('sfx', 'error');
      return { ok: false, message: t('msg.need_seed') };
    }
    this.state.inventory.seed--;
    node.stage = 'sapling';
    node.timer = GROW.sapling;
    node.planted = true;
    const i = this.state.island;
    i.treesPlanted++;
    this.events.emit('float', { x: def.x, y: def.y - 20, text: '🌱' });
    this.events.emit('sfx', 'plant');
    this.addHarmony(3);
    this.addXp(3);
    if (def.zone === 'forest') {
      i.harvestPressure = Math.max(0, i.harvestPressure - 2);
      if (i.corruption.forest > 0) {
        i.cleanseProgress++;
        if (i.cleanseProgress >= CLEANSE_PLANTS_NEEDED) this.lowerCorruption('forest');
      }
    }
    if (def.kind === 'grove') this.discover('places', 'memory_grove');
    this.progress('plant', undefined, 1);
    this.runRules();
    this.changed();
    return { ok: true };
  }

  usePurifier(zone: ZoneId): ActionResult {
    if (!this.has('purifier')) return { ok: false, message: t('msg.need_purifier') };
    if (this.state.island.corruption[zone] <= 0) return { ok: false, message: t('msg.nothing_to_purify') };
    this.state.inventory.purifier--;
    this.lowerCorruption(zone);
    this.changed();
    return { ok: true };
  }

  plotStatus(plotId: string): 'free' | 'occupied' | 'locked' {
    const plot = PLOTS.find((p) => p.id === plotId);
    if (!plot) return 'locked';
    if (this.state.world.plots[plotId]) return 'occupied';
    return this.state.island.level >= plot.islandLevel ? 'free' : 'locked';
  }

  build(building: BuildingId, plotId: string): ActionResult {
    const status = this.plotStatus(plotId);
    if (status === 'occupied') return { ok: false, message: t('msg.plot_occupied') };
    if (status === 'locked') {
      const need = PLOTS.find((p) => p.id === plotId)?.islandLevel ?? 0;
      return { ok: false, message: t('msg.plot_locked', { level: need }) };
    }
    const def = BUILDINGS[building];
    const missing = this.missingFor(def.cost);
    if (Object.keys(missing).length) {
      this.events.emit('sfx', 'error');
      return { ok: false, message: t('msg.missing_resources') };
    }
    for (const [item, n] of Object.entries(def.cost) as [ItemId, number][]) this.state.inventory[item] -= n;
    this.state.world.plots[plotId] = building;
    this.state.buildings[building]++;
    if (building === 'garden') {
      this.state.world.gardenProduce[plotId] = 0;
      this.state.world.gardenTimer[plotId] = GROW.garden;
    }
    this.events.emit('sfx', 'build');
    this.toast(t('msg.built', { name: t(`building.${building}`) }), 'world', '🏡');
    this.addHarmony(def.harmony);
    this.addXp(def.xp);
    this.state.stats.worldChanges++;
    this.progress('build', building, 1);
    this.runRules();
    this.changed();
    return { ok: true };
  }

  harvestGarden(plotId: string, at?: { x: number; y: number }): ActionResult {
    const produce = this.state.world.gardenProduce[plotId] ?? 0;
    if (this.state.world.plots[plotId] !== 'garden') return { ok: false };
    if (produce <= 0) return { ok: false, message: t('msg.garden_growing') };
    this.give('veggie', produce, at);
    this.state.world.gardenProduce[plotId] = 0;
    this.state.world.gardenTimer[plotId] = GROW.garden;
    this.events.emit('sfx', 'collect');
    this.addXp(2);
    this.changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- creatures

  /** Seeing a creature up close records it in the Discovery Book. */
  observe(id: CreatureId): void {
    this.discover('creatures', id);
  }

  interactCreature(id: CreatureId, at?: { x: number; y: number }): ActionResult {
    const c = this.state.creatures[id];
    const def = CREATURES[id];
    this.observe(id);
    if (c.state === 'bonded') {
      this.events.emit('float', { x: at?.x ?? 0, y: (at?.y ?? 0) - 24, text: '💛' });
      return { ok: true, message: t(`creature.${id}.bonded_line`) };
    }
    if (!def.likes || !this.has(def.likes)) {
      return { ok: false, message: t('msg.creature_wants', { name: t(`disc.${id}`), item: this.itemName(def.likes ?? 'glow_berry') }) };
    }
    this.state.inventory[def.likes]--;
    c.bond = Math.min(100, c.bond + def.bondPerFeed);
    c.state = c.bond >= 100 ? 'bonded' : 'friendly';
    if (at) this.events.emit('float', { x: at.x, y: at.y - 24, text: c.state === 'bonded' ? '💛' : '♥' });
    this.events.emit('sfx', 'collect');
    if (c.state === 'bonded') {
      this.toast(t('msg.bonded', { name: t(`disc.${id}`) }), 'world', def.icon);
      this.addHarmony(10);
      this.addXp(10);
      this.state.stats.worldChanges++;
      this.events.emit('worldChange', { id: `bonded_${id}` });
      this.progress('bond', id, 1);
    }
    this.changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- the egg

  examineEgg(): Dialog | null {
    if (this.state.world.egg !== 'hidden') return null;
    if (this.state.quests.q_egg.status !== 'active') {
      return { npc: 'pip', speaker: 'Pip', lines: [t('egg.not_yet')] };
    }
    this.discover('relics', 'echo_egg');
    this.state.npcs.zed.met = true;
    return {
      npc: 'zed',
      speaker: t('npc.zed'),
      lines: [t('egg.pip_1'), t('egg.zed_offer', { coins: EGG_SALE_PRICE }), t('egg.pip_2')],
      speakers: ['pip', 'zed', 'pip'],
      options: [
        { id: 'egg:hatch', label: t('egg.choice_hatch') },
        { id: 'egg:sell', label: t('egg.choice_sell', { coins: EGG_SALE_PRICE }) },
        { id: 'egg:temple', label: t('egg.choice_temple') },
      ],
    };
  }

  chooseEgg(choice: EggChoice): ActionResult {
    const s = this.state;
    if (s.world.egg !== 'hidden') return { ok: false };
    s.choices.push({ id: 'egg_choice', value: choice, day: this.day });
    if (choice === 'hatch') {
      s.world.egg = 'nest';
      s.world.eggHatchTimer = GROW.eggHatch;
      s.pip.mood = 'excited';
      s.npcs.zed.trust = Math.max(0, s.npcs.zed.trust - 5);
    } else if (choice === 'sell') {
      s.world.egg = 'sold';
      this.addCoins(EGG_SALE_PRICE);
      s.npcs.zed.trust += 20;
      this.raiseCorruption('forest', t('msg.corruption_egg'));
      s.pip.mood = 'sad';
    } else {
      s.world.egg = 'temple';
      this.give('essence', 3);
      s.pip.mood = 'excited';
      this.discover('places', 'temple_gate');
    }
    s.npcs.zed.present = true;
    s.npcs.luna.present = true;
    s.stats.worldChanges++;
    this.events.emit('worldChange', { id: `egg_${choice}` });
    this.progress('find', 'egg', 1);
    this.runRules();
    this.changed();
    return { ok: true };
  }

  eggChoice(): EggChoice | null {
    return (this.state.choices.find((c) => c.id === 'egg_choice')?.value as EggChoice) ?? null;
  }

  // ---------------------------------------------------------------- shop

  buy(item: ItemId, qty = 1): ActionResult {
    const price = ITEMS[item].buy;
    if (price === undefined) return { ok: false };
    if (this.state.player.coins < price * qty) {
      this.events.emit('sfx', 'error');
      return { ok: false, message: t('msg.not_enough_coins', { n: price * qty - this.state.player.coins }) };
    }
    this.state.player.coins -= price * qty;
    this.state.inventory[item] += qty;
    this.events.emit('sfx', 'coin');
    this.changed();
    return { ok: true };
  }

  sell(item: ItemId, qty = 1): ActionResult {
    const price = ITEMS[item].sell;
    if (price === undefined || !this.has(item, qty)) return { ok: false };
    this.state.inventory[item] -= qty;
    this.addCoins(price * qty);
    this.changed();
    return { ok: true };
  }

  // ---------------------------------------------------------------- quests

  private unlockQuest(id: QuestId): void {
    const q = this.state.quests[id];
    if (q.status !== 'locked') return;
    const def = QUESTS[id];
    if (def.autoAccept) {
      this.acceptQuest(id);
    } else {
      q.status = 'available';
      this.toast(t('msg.quest_available', { name: t(`quest.${id}.title`), npc: t(`npc.${def.giver}`) }), 'quest', '❗');
    }
  }

  acceptQuest(id: QuestId): ActionResult {
    const q = this.state.quests[id];
    if (q.status !== 'available' && q.status !== 'locked') return { ok: false };
    q.status = 'active';
    q.progress = this.initialProgress(QUESTS[id].objective);
    if (id === 'q_egg') this.state.npcs.zed.present = true;
    this.toast(t('msg.quest_started', { name: t(`quest.${id}.title`) }), 'quest', '📜');
    if (q.progress >= QUESTS[id].objective.count) this.completeQuest(id);
    this.changed();
    return { ok: true };
  }

  /** Some objectives may already be partly met when a quest is accepted. */
  private initialProgress(o: QuestObjective): number {
    switch (o.type) {
      case 'build':
        return Math.min(o.count, this.state.buildings[o.building]);
      case 'clear':
        return Math.min(o.count, this.state.world.debrisCleared.length);
      case 'bond':
        return this.state.creatures[o.creature].state === 'bonded' ? 1 : 0;
      default:
        return 0;
    }
  }

  progress(type: QuestObjective['type'], key: string | undefined, amount: number): void {
    for (const id of QUEST_ORDER) {
      const q = this.state.quests[id];
      if (q.status !== 'active') continue;
      const o = QUESTS[id].objective;
      if (o.type !== type) continue;
      if (o.type === 'gather' && o.item !== key) continue;
      if (o.type === 'build' && o.building !== key) continue;
      if (o.type === 'bond' && o.creature !== key) continue;
      q.progress = Math.min(o.count, q.progress + amount);
      if (q.progress >= o.count) this.completeQuest(id);
    }
  }

  private completeQuest(id: QuestId): void {
    const q = this.state.quests[id];
    if (q.status === 'done') return;
    q.status = 'done';
    const def = QUESTS[id];
    const r = def.rewards;
    if (r.coins) this.addCoins(r.coins);
    if (r.xp) this.addXp(r.xp);
    for (const [item, n] of Object.entries(r.items ?? {}) as [ItemId, number][]) this.give(item, n);
    if (r.ability) this.unlockAbility(r.ability);
    if (def.giver !== 'pip') this.state.npcs[def.giver].trust += 20;
    this.state.stats.questsDone++;
    this.toast(t('msg.quest_complete', { name: t(`quest.${id}.title`) }), 'quest', '🏆');
    this.events.emit('questComplete', { id });
    this.events.emit('sfx', 'success');
    for (const next of def.unlocks) this.unlockQuest(next);
    this.runRules();
  }

  unlockAbility(a: PipAbility): void {
    if (this.state.pip.abilities.includes(a)) return;
    this.state.pip.abilities.push(a);
    this.toast(t('msg.ability', { name: t(`ability.${a}`) }), 'reward', '✨');
  }

  questsOfferedBy(npc: NpcId): QuestId[] {
    return QUEST_ORDER.filter((id) => QUESTS[id].giver === npc && this.state.quests[id].status === 'available');
  }

  // ---------------------------------------------------------------- dialogue

  talk(npc: NpcId): Dialog {
    const s = this.state;
    const info = s.npcs[npc];
    const lines: string[] = [];
    if (!info.met) {
      info.met = true;
      lines.push(t(`${npc}.intro`));
    }
    info.trust = Math.min(100, info.trust + 1);
    const offer = this.questsOfferedBy(npc)[0];
    if (offer) {
      lines.push(t(`quest.${offer}.offer`));
      return {
        npc,
        speaker: t(`npc.${npc}`),
        lines,
        options: [
          { id: `accept:${offer}`, label: t('dialog.accept') },
          { id: 'later', label: t('dialog.later') },
        ],
      };
    }
    const active = QUEST_ORDER.find((id) => QUESTS[id].giver === npc && s.quests[id].status === 'active');
    if (active) {
      const o = QUESTS[active].objective;
      lines.push(t(`quest.${active}.reminder`, { progress: s.quests[active].progress, count: o.count }));
    } else {
      lines.push(this.memoryLine(npc));
    }
    this.changed();
    return { npc, speaker: t(`npc.${npc}`), lines };
  }

  respond(optionId: string): ActionResult {
    if (optionId.startsWith('accept:')) return this.acceptQuest(optionId.slice(7) as QuestId);
    if (optionId.startsWith('egg:')) return this.chooseEgg(optionId.slice(4) as EggChoice);
    return { ok: true };
  }

  /** NPC small talk that refers back to the player's own history (PRD 13.3). */
  private memoryLine(npc: NpcId): string {
    const s = this.state;
    const egg = this.eggChoice();
    if (npc === 'zed') return egg ? t(`zed.after_${egg}`) : t('zed.idle');
    if (npc === 'luna') {
      if (s.island.corruption.forest > 0) return t('luna.corruption');
      if (s.island.lakeRestored) return t('luna.lake_done');
      return egg ? t(`luna.egg_${egg}`) : t('luna.idle');
    }
    if (npc === 'tilly') return t('tilly.idle', { houses: s.buildings.house });
    if (s.island.treesPlanted >= 10) return t('rocco.forest_grew');
    return egg ? t(`rocco.egg_${egg}`) : t('rocco.idle');
  }

  /** Something Pip says unprompted, preferring lines about the player's own past. */
  pipChatter(): string {
    const s = this.state;
    const options: string[] = [];
    const egg = s.choices.find((c) => c.id === 'egg_choice');
    if (egg?.value === 'hatch' && s.world.egg === 'hatched') options.push(t('pip.memory_hatch', { day: egg.day }));
    if (egg?.value === 'sell') options.push(t('pip.memory_sell'));
    if (egg?.value === 'temple') options.push(t('pip.memory_temple'));
    if (s.island.corruption.forest > 0) options.push(t('pip.corruption_hint'));
    if (s.quests.q_lake.status === 'active' && !s.island.lakeRestored) options.push(t('pip.lake_hint'));
    if (s.island.lakeRestored) options.push(t('pip.memory_lake'));
    if (s.island.treesPlanted > 0) options.push(t('pip.memory_trees', { n: s.island.treesPlanted }));
    if (this.darkness() > 0.5 && s.pip.abilities.includes('glow')) options.push(t('pip.night'));
    if (!options.length) options.push(t('pip.generic_1'), t('pip.generic_2'));
    return options[Math.floor(this.rng() * options.length)];
  }

  // ---------------------------------------------------------------- world rules

  /** Apply all world rules that are now due (PRD 13.2). Effects may make further rules due. */
  runRules(): void {
    for (let pass = 0; pass < 10; pass++) {
      const due = dueRules(this.rules, this.state);
      if (!due.length) return;
      for (const rule of due) {
        this.state.island.firedRules.push(rule.id);
        for (const effect of rule.then) this.applyEffect(effect);
      }
    }
  }

  private applyEffect(effect: string): void {
    const [kind, a, b] = effect.split(':');
    const s = this.state;
    switch (kind) {
      case 'visual':
        if (!s.island.visuals.includes(a)) s.island.visuals.push(a);
        s.stats.worldChanges++;
        this.events.emit('worldChange', { id: a });
        break;
      case 'harmony':
        this.addHarmony(Number(a));
        break;
      case 'discover':
        this.discover(a as DiscoveryCategory, b);
        break;
      case 'creature':
        s.creatures[a as CreatureId].present = true;
        break;
      case 'npc':
        s.npcs[a as NpcId].present = true;
        break;
      case 'ability':
        this.unlockAbility(a as PipAbility);
        break;
      case 'cosmetic':
        s.pip.cosmetic = a;
        if (!s.player.cosmetics.includes(a)) s.player.cosmetics.push(a);
        break;
      case 'toast':
        this.toast(t(a), 'world', '🌟');
        break;
      default:
        throw new Error(`Unknown rule effect: ${effect}`);
    }
  }
}

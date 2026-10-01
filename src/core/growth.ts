import { AWAY_CAP_SECONDS, AWAY_MIN_SECONDS, FISH_PRESSURE_DECAY, GARDEN_MAX_PRODUCE, GROW, MINUTES_PER_SECOND } from './config';
import { NODE_BY_ID } from './layout';
import type { GameState } from './types';

export interface GrowthSummary {
  saplingsGrown: number;
  treesRegrown: number;
  bushesRefilled: number;
  rocksRestored: number;
  produce: number;
  eggHatched: boolean;
}

export const emptyGrowth = (): GrowthSummary => ({
  saplingsGrown: 0,
  treesRegrown: 0,
  bushesRefilled: 0,
  rocksRestored: 0,
  produce: 0,
  eggHatched: false,
});

/** Advance the world clock and every growth timer by `minutes` game minutes. */
export function processGrowth(s: GameState, minutes: number): GrowthSummary {
  const out = emptyGrowth();
  if (minutes <= 0) return out;
  s.world.minutes += minutes;
  s.island.fishPressure = Math.max(0, s.island.fishPressure - minutes / FISH_PRESSURE_DECAY);
  const forestSlow = s.island.corruption.forest >= 2 ? 0.5 : 1;

  for (const [id, node] of Object.entries(s.world.nodes)) {
    if (node.timer <= 0) continue;
    const def = NODE_BY_ID[id];
    const rate = def?.zone === 'forest' ? forestSlow : 1;
    node.timer -= minutes * rate;
    if (node.timer > 0) continue;
    node.timer = 0;
    if (node.stage === 'sapling') {
      // Grove saplings become permanent memory trees; stump saplings become choppable trees again.
      node.stage = def?.kind === 'grove' ? 'tree' : 'full';
      out.saplingsGrown++;
    } else if (node.stage === 'stump') {
      node.stage = 'full';
      out.treesRegrown++;
    } else if (node.stage === 'empty') {
      node.stage = 'full';
      if (def?.kind === 'bush') out.bushesRefilled++;
      else out.rocksRestored++;
    }
  }

  for (const [plotId, building] of Object.entries(s.world.plots)) {
    if (building !== 'garden') continue;
    let produce = s.world.gardenProduce[plotId] ?? 0;
    let timer = (s.world.gardenTimer[plotId] ?? GROW.garden) - minutes;
    while (timer <= 0 && produce < GARDEN_MAX_PRODUCE) {
      produce = Math.min(GARDEN_MAX_PRODUCE, produce + 2);
      out.produce += 2;
      timer += GROW.garden;
    }
    if (produce >= GARDEN_MAX_PRODUCE) timer = GROW.garden;
    s.world.gardenProduce[plotId] = produce;
    s.world.gardenTimer[plotId] = timer;
  }

  if (s.world.egg === 'nest') {
    s.world.eggHatchTimer -= minutes;
    if (s.world.eggHatchTimer <= 0) {
      s.world.egg = 'hatched';
      s.world.eggHatchTimer = 0;
      s.creatures.sunchick.present = true;
      out.eggHatched = true;
    }
  }
  return out;
}

export interface AwaySummary extends GrowthSummary {
  seconds: number;
  capped: boolean;
  clockWentBack: boolean;
  gift: number;
  exportReminder: boolean;
}

/**
 * Apply progress for real time spent away from the game (PRD 13.5).
 * Capped at 24 hours; if the clock went backwards nothing is applied or removed.
 * Returns null when the absence was too short to report.
 */
export function applyTimeAway(s: GameState, now: Date): AwaySummary | null {
  const last = Date.parse(s.lastPlayedAt);
  const elapsed = (now.getTime() - last) / 1000;
  s.lastPlayedAt = now.toISOString();
  if (elapsed < 0) {
    return { ...emptyGrowth(), seconds: 0, capped: false, clockWentBack: true, gift: 0, exportReminder: false };
  }
  if (elapsed < AWAY_MIN_SECONDS) return null;
  const seconds = Math.min(elapsed, AWAY_CAP_SECONDS);
  const growth = processGrowth(s, seconds * MINUTES_PER_SECOND);
  // A bonded Glowfox brings a small gift after longer absences.
  let gift = 0;
  if (s.creatures.glowfox.state === 'bonded' && seconds >= 30 * 60) {
    gift = 2;
    s.inventory.glow_berry += gift;
  }
  const lastExport = s.lastExportAt ? Date.parse(s.lastExportAt) : Date.parse(s.createdAt);
  const exportReminder = now.getTime() - lastExport > 3 * 24 * 60 * 60 * 1000;
  return { ...growth, seconds, capped: elapsed > AWAY_CAP_SECONDS, clockWentBack: false, gift, exportReminder };
}

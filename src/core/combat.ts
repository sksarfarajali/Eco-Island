import { ITEMS } from './content';
import type { GameState, ItemId } from './types';

/**
 * Combat rules (PRD 14 / App Flow 19). The scene runs the real-time part;
 * every number that decides an outcome lives here so it can be tested.
 */
export type EnemyKind = 'gloomling' | 'wisp' | 'hollow';

export interface EnemyDef {
  hp: number;
  damage: number;
  speed: number;
  /** How long the attack is telegraphed before it lands (ms). */
  windupMs: number;
  recoverMs: number;
  sight: number;
  reach: number;
  ranged: boolean;
  xp: number;
  drop: Partial<Record<ItemId, number>>;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  gloomling: { hp: 3, damage: 1, speed: 70, windupMs: 700, recoverMs: 650, sight: 190, reach: 46, ranged: false, xp: 6, drop: { essence: 1 } },
  wisp: { hp: 2, damage: 1, speed: 45, windupMs: 650, recoverMs: 1700, sight: 230, reach: 210, ranged: true, xp: 6, drop: { essence: 1 } },
  hollow: { hp: 40, damage: 2, speed: 55, windupMs: 950, recoverMs: 1500, sight: 600, reach: 80, ranged: false, xp: 0, drop: {} },
};

export const DODGE_MS = 260;
export const DODGE_COOLDOWN_MS = 750;
export const ATTACK_COOLDOWN_MS = 330;
export const ATTACK_REACH = 50;
export const PIP_BURST_COOLDOWN_MS = 8000;
export const PIP_BURST_RADIUS = 130;
export const PIP_BURST_STUN_MS = 2000;
export const INVULN_MS = 900;
/** Defeat loses at most this share of the common resources gathered on the current trip (PRD 14). */
export const DEFEAT_LOSS_SHARE = 0.2;

export function maxHealth(level: number): number {
  return 5 + Math.floor((level - 1) / 2);
}

export function attackDamage(level: number, bonus: number): number {
  return 1 + Math.floor((level - 1) / 3) + bonus;
}

/** Blocking turns aside half the damage (rounded down), so ordinary hits do nothing. */
export function damageTaken(raw: number, blocking: boolean): number {
  return blocking ? Math.floor(raw / 2) : raw;
}

const totalCorruption = (s: GameState) => Object.values(s.island.corruption).reduce((a, b) => a + b, 0);

/** The Hollow is weaker when the player has cared for the island (PRD 3, Act 3). */
export function bossHealth(s: GameState): number {
  let hp = ENEMIES.hollow.hp - 2 * (s.island.level - 1);
  if (totalCorruption(s) === 0) hp -= 4;
  return Math.max(24, hp);
}

/** Healing the Hollow is only possible for an island that is well cared for. */
export function canHealHollow(s: GameState): boolean {
  return s.island.level >= 3 && totalCorruption(s) === 0;
}

/** What a defeat costs: up to 20% of each common resource gathered on this trip. */
export function defeatLoss(s: GameState): Partial<Record<ItemId, number>> {
  const loss: Partial<Record<ItemId, number>> = {};
  for (const [item, n] of Object.entries(s.world.trip) as [ItemId, number][]) {
    if (!ITEMS[item].common) continue;
    const lose = Math.min(s.inventory[item], Math.floor(n * DEFEAT_LOSS_SHARE));
    if (lose > 0) loss[item] = lose;
  }
  return loss;
}

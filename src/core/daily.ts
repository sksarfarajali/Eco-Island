import type { DailyKind, DailyTask, GameState } from './types';

/**
 * Daily tasks and the login streak. Days are real calendar days in the player's time zone,
 * so the tasks refresh each morning however long the player has been away.
 */
export interface DailyDef {
  target: number;
  coins: number;
  xp: number;
  /** Only offered once the player can actually do it. */
  needs?: (s: GameState) => boolean;
}

export const DAILY_POOL: Record<DailyKind, DailyDef> = {
  wood: { target: 8, coins: 10, xp: 10 },
  stone: { target: 6, coins: 10, xp: 10 },
  berries: { target: 6, coins: 10, xp: 10 },
  fish: { target: 3, coins: 15, xp: 12 },
  plant: { target: 3, coins: 15, xp: 12 },
  feed: { target: 2, coins: 12, xp: 10 },
  enemies: { target: 3, coins: 20, xp: 15, needs: (s) => s.player.level >= 2 },
  cook: { target: 1, coins: 15, xp: 12 },
  photo: { target: 1, coins: 10, xp: 8 },
  harvest: { target: 1, coins: 12, xp: 10, needs: (s) => s.buildings.garden > 0 },
  play: { target: 1, coins: 15, xp: 12, needs: (s) => s.creatures.glowfox.state === 'bonded' || s.creatures.ripplet.state === 'bonded' },
};

export const DAILY_KINDS = Object.keys(DAILY_POOL) as DailyKind[];
export const DAILY_COUNT = 3;
/** Extra reward for finishing all of the day's tasks. */
export const DAILY_BONUS = { coins: 25, harmony: 10, seed: 1 };

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The calendar day before `key` (YYYY-MM-DD). */
export function dayBefore(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Pick the day's tasks: the same for a given date and save, different from day to day. */
export function pickDaily(key: string, s: GameState): DailyTask[] {
  const eligible = DAILY_KINDS.filter((k) => DAILY_POOL[k].needs?.(s) ?? true);
  let h = hash(`${key}|${s.createdAt}`);
  const out: DailyTask[] = [];
  while (out.length < DAILY_COUNT && eligible.length) {
    const kind = eligible.splice(h % eligible.length, 1)[0];
    h = Math.imul(h, 2654435761) >>> 0 || 1;
    out.push({ kind, target: DAILY_POOL[kind].target, progress: 0, done: false });
  }
  return out;
}

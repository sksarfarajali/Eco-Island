import type { GameState } from './types';

/**
 * Data-driven world rules (PRD 13.2).
 * A rule has a condition (`when`) over island metrics and a list of effects (`then`).
 * Each rule fires once; its effects are applied by the game (see Game.applyEffect).
 */
export interface WorldRule {
  id: string;
  when: string;
  then: string[];
}

export type Metrics = Record<string, number | string>;

/** The metrics world rules can reference. */
export function computeMetrics(s: GameState): Metrics {
  const egg = s.choices.find((c) => c.id === 'egg_choice');
  return {
    trees_planted: s.island.treesPlanted,
    lake_restored: s.island.lakeRestored ? 1 : 0,
    houses: s.buildings.house,
    gardens: s.buildings.garden,
    egg_choice: egg ? egg.value : '',
    discoveries: Object.values(s.discoveries).reduce((n, list) => n + list.length, 0),
    corruption_forest: s.island.corruption.forest,
    island_level: s.island.level,
    player_level: s.player.level,
    bonded: Object.values(s.creatures).filter((c) => c.state === 'bonded').length,
    evolved: Object.values(s.creatures).filter((c) => c.evolved).length,
    workshops: s.buildings.workshop,
    sanctuaries: s.buildings.sanctuary,
    arches: s.buildings.arch,
    temple_open: s.world.templeOpen ? 1 : 0,
    trials: s.world.temple.solved.filter(Boolean).length,
    skyhare_choice: s.choices.find((c) => c.id === 'skyhare_choice')?.value ?? '',
    ending: s.world.ending ?? '',
    corruption_lake: s.island.corruption.lake,
  };
}

const COMPARISON = /^\s*([a-z_]+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?|'[^']*')\s*$/;

/** Evaluate a condition such as `trees_planted >= 10 && egg_choice == 'hatch'`. */
export function evaluateCondition(expr: string, metrics: Metrics): boolean {
  return expr.split('&&').every((part) => {
    const m = COMPARISON.exec(part);
    if (!m) throw new Error(`Invalid rule condition: "${part.trim()}"`);
    const [, key, op, raw] = m;
    if (!(key in metrics)) throw new Error(`Unknown rule metric: "${key}"`);
    const left = metrics[key];
    const right: number | string = raw.startsWith("'") ? raw.slice(1, -1) : Number(raw);
    switch (op) {
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case '>':
        return Number(left) > Number(right);
      default:
        return Number(left) < Number(right);
    }
  });
}

/** Returns the rules whose condition is now true and which have not fired yet. */
export function dueRules(rules: readonly WorldRule[], s: GameState): WorldRule[] {
  const metrics = computeMetrics(s);
  return rules.filter((r) => !s.island.firedRules.includes(r.id) && evaluateCondition(r.when, metrics));
}

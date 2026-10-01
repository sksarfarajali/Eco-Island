import { MAP_H, MAP_W, TILE } from './config';
import type { ZoneId } from './types';

/**
 * Hand-placed island layout for the Phase 0 vertical slice.
 * Positions are in tiles and converted to world pixels (tile centre) via `px`.
 */
export const px = (t: number): number => t * TILE + TILE / 2;

export type NodeKind = 'tree' | 'rock' | 'bush' | 'grove' | 'debris';

export interface NodeDef {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  zone: ZoneId;
}

export interface PlotDef {
  id: string;
  x: number;
  y: number;
  islandLevel: number;
}

/** Lake ellipse (tiles). */
export const LAKE = { cx: 47, cy: 33, rx: 11, ry: 5.5 };
/** Wooden dock reaching into the lake (tiles, inclusive). */
export const DOCK = { x0: 35, x1: 38, y0: 33, y1: 33 };

export function isLand(tx: number, ty: number): boolean {
  // Rounded rectangle island with a gently wavy coastline.
  const inset = 2 + (Math.sin(tx * 0.7) + Math.cos(ty * 0.9)) * 0.35;
  const r = 7;
  const x0 = inset;
  const y0 = inset;
  const x1 = MAP_W - 1 - inset;
  const y1 = MAP_H - 1 - inset;
  if (tx < x0 || ty < y0 || tx > x1 || ty > y1) return false;
  const cx = Math.min(Math.max(tx, x0 + r), x1 - r);
  const cy = Math.min(Math.max(ty, y0 + r), y1 - r);
  return (tx - cx) ** 2 + (ty - cy) ** 2 <= r * r;
}

export function isLakeWater(tx: number, ty: number): boolean {
  const d = ((tx - LAKE.cx) / LAKE.rx) ** 2 + ((ty - LAKE.cy) / LAKE.ry) ** 2;
  return d <= 1;
}

export function isDock(tx: number, ty: number): boolean {
  return tx >= DOCK.x0 && tx <= DOCK.x1 && ty >= DOCK.y0 && ty <= DOCK.y1;
}

/** Is a world-pixel position walkable ground (ignores object blockers)? */
export function isWalkableGround(x: number, y: number): boolean {
  const tx = x / TILE - 0.5;
  const ty = y / TILE - 0.5;
  if (!isLand(Math.round(tx), Math.round(ty))) return false;
  if (isDock(Math.round(tx), Math.round(ty))) return true;
  return !isLakeWater(tx, ty);
}

export function zoneAt(x: number, y: number): ZoneId {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 30) return 'village';
  return ty <= 21 ? 'forest' : 'lake';
}

const nodes: NodeDef[] = [];
const add = (kind: NodeKind, list: [number, number][], prefix: string, zone?: ZoneId) =>
  list.forEach(([x, y], i) =>
    nodes.push({ id: `${prefix}${i + 1}`, kind, x: px(x), y: px(y), zone: zone ?? zoneAt(px(x), px(y)) }),
  );

// Choppable trees: most in the Emerald Forest, a few around the village.
add(
  'tree',
  [
    [33, 9], [36, 12], [34, 15], [38, 18], [40, 6], [53, 6], [55, 13], [58, 10],
    [57, 17], [52, 19], [38, 9], [42, 19], [60, 14], [35, 19], [50, 4], [59, 7],
    [6, 15], [10, 12], [25, 13], [5, 34], [27, 38],
  ],
  'tree',
);
add('rock', [[23, 33], [4, 25], [28, 22], [33, 39], [40, 40], [58, 37], [26, 9]], 'rock');
add('bush', [[37, 15], [41, 13], [54, 9], [56, 19], [33, 17], [49, 18]], 'bush');
// Memory Grove: twelve soil spots in a forest clearing.
add(
  'grove',
  [42, 45, 48, 51].flatMap((x) => [9, 12, 15].map((y) => [x, y] as [number, number])),
  'grove',
  'forest',
);
// Lake debris floats just inside the shoreline.
add('debris', [[38, 30], [41, 37], [52, 37], [56, 30], [47, 28]], 'debris', 'lake');

export const NODES: readonly NodeDef[] = nodes;
export const NODE_BY_ID: Record<string, NodeDef> = Object.fromEntries(nodes.map((n) => [n.id, n]));

export const PLOTS: readonly PlotDef[] = [
  { id: 'plot1', x: px(7), y: px(29), islandLevel: 1 },
  { id: 'plot2', x: px(12), y: px(31), islandLevel: 1 },
  { id: 'plot3', x: px(19), y: px(31), islandLevel: 2 },
  { id: 'plot4', x: px(24), y: px(29), islandLevel: 3 },
];

/** Points of interest (world pixels). */
export const POI = {
  start: { x: px(16), y: px(26) },
  plaza: { x: px(16), y: px(24) },
  well: { x: px(16), y: px(22) },
  shop: { x: px(11), y: px(19) },
  workshop: { x: px(21), y: px(17) },
  rocco: { x: px(21), y: px(20) },
  nest: { x: px(8), y: px(23) },
  tilly: { x: px(14), y: px(27) },
  zedForest: { x: px(55), y: px(9) },
  zedEdge: { x: px(31), y: px(20) },
  zedCamp: { x: px(25), y: px(36) },
  lunaTent: { x: px(33), y: px(25) },
  luna: { x: px(34), y: px(27) },
  egg: { x: px(57), y: px(5) },
  den: { x: px(35), y: px(6) },
  templeGate: { x: px(46), y: px(3) },
  grove: { x: px(46.5), y: px(12) },
  mossprite: { x: px(44), y: px(17) },
  ripplet: { x: px(50), y: px(33) },
  lakeShore: { x: px(34), y: px(31) },
  forestEntry: { x: px(31), y: px(13) },
} as const;

/** Zone travel destinations for the map's fast travel. */
export const ZONE_SPAWN: Record<ZoneId, { x: number; y: number }> = {
  village: POI.start,
  forest: POI.forestEntry,
  lake: POI.lakeShore,
};

/** Static solid rectangles (world pixels, x/y = centre) for decorative structures. */
export const STATIC_BLOCKERS: { x: number; y: number; w: number; h: number }[] = [
  { x: POI.well.x, y: POI.well.y, w: 34, h: 22 },
  { x: POI.shop.x, y: POI.shop.y - 4, w: 70, h: 30 },
  { x: POI.workshop.x, y: POI.workshop.y - 6, w: 92, h: 44 },
  { x: POI.templeGate.x, y: POI.templeGate.y, w: 110, h: 34 },
];

/** Paths drawn on the ground (tile polylines). */
export const PATHS: [number, number][][] = [
  [[16, 26], [16, 20], [22, 15], [30, 13], [40, 12], [46, 12]],
  [[16, 26], [24, 28], [30, 31], [35, 33]],
  [[16, 24], [11, 21]],
  [[16, 26], [9, 24]],
  [[40, 12], [46, 6], [46, 4]],
];

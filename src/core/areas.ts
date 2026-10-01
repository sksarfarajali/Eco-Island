import { TILE } from './config';
import type { AreaId, CreatureId, ZoneId } from './types';

/**
 * The zones beyond the island hub (PRD 10), defined as text maps so they are data, not code.
 *
 * Legend
 *   #  wall / cliff        ~  water or chasm       .  floor       ,  floor (variant)
 *   S  arrival point       X  exit back
 *   c  crystal node        r  rock node            f  flower node (berries / skybloom / shadowcap)
 *   g  gloomling           w  shade wisp           B  the Hollow (boss)
 *   K  Sun Key pedestal    H  Echo Heart pedestal  M  memory mural (Pip's Echo)
 *   1-4 rune pillars       D E F trial doors (1, 2, 3)
 *   L  light emitter       /  mirror               T  light lock crystal
 *   O  stone block         P  pressure plate       R  reset lever
 *   V  viewpoint           C  bramble cage         G  Shadow Grove gate
 *   a p h t o i  creature homes (gleamwing, pebblepup, skyhare, thistlegoat, archowl, wispling)
 */
const MAPS: Record<Exclude<AreaId, 'island'>, string> = {
  caves: `
####################################
#X.,....#.......c......#####.......#
#S......#..a...........#...#..c....#
#.......#....c....##...#.c.#.......#
#..,....######....##...#...#..###..#
#.............r........#...#..#K#..#
###.....c..........c......,...#.#..#
###...........####.............p...#
###..r....c...####...~~~~..c.......#
#####.........,......~~~~....r..c..#
#####..c...r.........~~~~..........#
####################################`,
  temple: `
#########################
#########.....###########
#########..H..###########
#########..o..###########
#########.....###########
###########F#############
####...............######
####.O.........P...######
####...............######
####.O.........P...######
####R..............######
####...............######
###########E#############
####...............######
####.L.../.........######
####...............######
####...............######
####...../...../...######
####...............######
####...........T...######
####...............######
###########D#############
##.....................##
##..1.............2....##
##.....................##
##.........M...........##
##.....................##
##..3.............4....##
##.....................##
##.........S...........##
##########...############
##########.X.############
#########################`,
  highlands: `
########################################
#########......V.........###########G###
########.....,,.....r........#####..,.##
#######..t.......f.......g.......##...##
######.......,........r......g.........#
#####....f.......~~~~~.................#
####...r.........~~~~~.....hh..........#
###.........g....~~~~~......f....r.....#
###..f..............................####
##.......,....r.......####....g.......##
##.............g.....######...........##
##...r...,..........######....gCg...f.##
##.............................g......##
#X..S....f......r...........g.........##
########################################`,
  grove: `
##################################
###########..........#############
#########.....B........###########
########................##########
########.......i........##########
#########..............###########
###########....,,....#############
#############......###############
###########...f....w...###########
#########..w.......,.....#########
########.....g.....f......########
#######..f.....,....w......#######
########.....w....g.......########
##########.........f....##########
############.....S....############
##############..X...##############
##################################`,
};

export interface AreaObject {
  ch: string;
  /** Stable id, e.g. `caves:c3`. */
  id: string;
  tx: number;
  ty: number;
  x: number;
  y: number;
}

export interface AreaDef {
  id: Exclude<AreaId, 'island'>;
  zone: ZoneId;
  rows: string[];
  w: number;
  h: number;
  spawn: { x: number; y: number };
  objects: AreaObject[];
  /** Where an exit from this area leads. */
  exitTo: { area: AreaId; poi: 'caveEntrance' | 'templeGate' | 'highlandsPath' | 'groveGate' };
  theme: 'caves' | 'temple' | 'highlands' | 'grove';
  /** Minimum darkness regardless of time of day (caves are always dark). */
  baseDark: number;
}

const CREATURE_HOMES: Record<string, CreatureId> = {
  a: 'gleamwing',
  p: 'pebblepup',
  h: 'skyhare',
  t: 'thistlegoat',
  o: 'archowl',
  i: 'wispling',
};

export const creatureForHome = (ch: string): CreatureId | undefined => CREATURE_HOMES[ch];

const META: Record<Exclude<AreaId, 'island'>, Pick<AreaDef, 'exitTo' | 'theme' | 'baseDark'>> = {
  caves: { exitTo: { area: 'island', poi: 'caveEntrance' }, theme: 'caves', baseDark: 0.85 },
  temple: { exitTo: { area: 'island', poi: 'templeGate' }, theme: 'temple', baseDark: 0.3 },
  highlands: { exitTo: { area: 'island', poi: 'highlandsPath' }, theme: 'highlands', baseDark: 0 },
  grove: { exitTo: { area: 'highlands', poi: 'groveGate' }, theme: 'grove', baseDark: 0.45 },
};

const centre = (t: number) => t * TILE + TILE / 2;

function parse(id: Exclude<AreaId, 'island'>): AreaDef {
  const rows = MAPS[id].replace(/^\n/, '').split('\n');
  const w = rows[0].length;
  if (rows.some((r) => r.length !== w)) throw new Error(`Area ${id} has uneven rows`);
  const objects: AreaObject[] = [];
  const counts: Record<string, number> = {};
  let spawn = { x: 0, y: 0 };
  rows.forEach((row, ty) =>
    [...row].forEach((ch, tx) => {
      if (ch === 'S') spawn = { x: centre(tx), y: centre(ty) };
      if ('#~.,S '.includes(ch)) return;
      counts[ch] = (counts[ch] ?? 0) + 1;
      objects.push({ ch, id: `${id}:${ch}${counts[ch]}`, tx, ty, x: centre(tx), y: centre(ty) });
    }),
  );
  return { id, zone: id, rows, w, h: rows.length, spawn, objects, ...META[id] };
}

export const AREAS: Record<Exclude<AreaId, 'island'>, AreaDef> = {
  caves: parse('caves'),
  temple: parse('temple'),
  highlands: parse('highlands'),
  grove: parse('grove'),
};

export const objectsOf = (area: AreaDef, ch: string): AreaObject[] => area.objects.filter((o) => o.ch === ch);

/** Is a tile part of the static terrain that blocks movement (walls, water, void)? */
export function terrainSolid(area: AreaDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= area.w || ty >= area.h) return true;
  return '#~ '.includes(area.rows[ty][tx]);
}

// ---------------------------------------------------------------- temple puzzles (pure logic)

/** Rune pillar order revealed by Pip's Echo at the mural. */
export const RUNE_ORDER = [3, 1, 4, 2];
export const RUNE_SYMBOLS: Record<number, string> = { 1: '○', 2: '□', 3: '△', 4: '◇' };

export const TEMPLE_MIRRORS = objectsOf(AREAS.temple, '/');
export const TEMPLE_PLATES = objectsOf(AREAS.temple, 'P');
export const TEMPLE_BLOCK_START: [number, number][] = objectsOf(AREAS.temple, 'O').map((o) => [o.tx, o.ty]);

export interface BeamResult {
  /** Tiles the beam passes through, in order. */
  path: [number, number][];
  hitTarget: boolean;
}

/**
 * Trace the light beam from the emitter. Mirrors set to `true` are '\', `false` are '/'.
 * The beam stops at walls and solid objects, and succeeds when it reaches the lock crystal.
 */
export function traceBeam(mirrors: boolean[]): BeamResult {
  const area = AREAS.temple;
  const emitter = objectsOf(area, 'L')[0];
  let [x, y] = [emitter.tx, emitter.ty];
  let [dx, dy] = [1, 0];
  const path: [number, number][] = [];
  for (let steps = 0; steps < 200; steps++) {
    x += dx;
    y += dy;
    if (terrainSolid(area, x, y)) return { path, hitTarget: false };
    const ch = area.rows[y][x];
    path.push([x, y]);
    if (ch === 'T') return { path, hitTarget: true };
    if (ch === '/') {
      const i = TEMPLE_MIRRORS.findIndex((m) => m.tx === x && m.ty === y);
      if (mirrors[i]) [dx, dy] = [dy, dx]; // '\'
      else [dx, dy] = [-dy, -dx]; // '/'
    } else if (!'.,PSX'.includes(ch)) {
      return { path, hitTarget: false };
    }
  }
  return { path, hitTarget: false };
}

/** Can a push-block move onto this tile? */
export function blockCanEnter(tx: number, ty: number, blocks: [number, number][]): boolean {
  const area = AREAS.temple;
  if (terrainSolid(area, tx, ty)) return false;
  if (!'.,P'.includes(area.rows[ty][tx])) return false;
  return !blocks.some(([bx, by]) => bx === tx && by === ty);
}

export const platesCovered = (blocks: [number, number][]): boolean =>
  TEMPLE_PLATES.every((p) => blocks.some(([bx, by]) => bx === p.tx && by === p.ty));

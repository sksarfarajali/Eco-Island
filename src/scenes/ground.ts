import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../core/config';
import { DOCK, LAKE, PATHS, isDock, isLakeWater, isLand } from '../core/layout';

/** Deterministic pseudo-random generator so decorations land in the same place every session. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const coastal = (tx: number, ty: number) =>
  isLand(tx, ty) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => !isLand(tx + dx, ty + dy));

const lakeShore = (tx: number, ty: number) => {
  const d = ((tx - LAKE.cx) / (LAKE.rx + 1.3)) ** 2 + ((ty - LAKE.cy) / (LAKE.ry + 1.3)) ** 2;
  return d <= 1 && !isLakeWater(tx, ty);
};

/** Paint the static island ground (ocean, sand, grass, paths, dock) into one canvas texture. */
export function makeGround(scene: Phaser.Scene): void {
  if (scene.textures.exists('ground')) return;
  const tex = scene.textures.createCanvas('ground', WORLD_W, WORLD_H)!;
  const ctx = tex.getContext();
  const rnd = seeded(7);

  // ocean
  const sea = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  sea.addColorStop(0, '#4cc3e6');
  sea.addColorStop(1, '#2b9fd0');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 260; i++) ctx.fillRect(rnd() * WORLD_W, rnd() * WORLD_H, 6 + rnd() * 10, 2);

  // Land is painted as overlapping soft circles so coasts and zone borders look organic, not blocky.
  const R = TILE * 0.8;
  const blob = (tx: number, ty: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, R, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) if (isLand(tx, ty)) blob(tx, ty, '#f1dc9c');
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (!isLand(tx, ty) || coastal(tx, ty)) continue;
      // gentle low-frequency variation instead of a visible checkerboard
      const n = (Math.sin(tx * 0.35 + ty * 0.15) + Math.cos(ty * 0.3 - tx * 0.1)) * 0.5;
      const forest = tx >= 30 && ty <= 21;
      const rgb = forest ? [78, 168, 89] : [127, 207, 106];
      const k = 1 + n * 0.035;
      blob(tx, ty, `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`);
    }
  }
  // sandy lake shore
  ctx.fillStyle = '#f1dc9c';
  ctx.beginPath();
  ctx.ellipse((LAKE.cx + 0.5) * TILE, (LAKE.cy + 0.5) * TILE, (LAKE.rx + 1.4) * TILE, (LAKE.ry + 1.3) * TILE, 0, 0, Math.PI * 2);
  ctx.fill();

  // soft grass tufts
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * WORLD_W;
    const y = rnd() * WORLD_H;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!isLand(tx, ty) || coastal(tx, ty) || lakeShore(tx, ty) || isLakeWater(tx, ty)) continue;
    ctx.fillStyle = tx >= 30 && ty <= 21 ? 'rgba(30,90,40,0.35)' : 'rgba(60,140,60,0.4)';
    ctx.fillRect(x, y, 2, 5);
    ctx.fillRect(x + 3, y + 1, 2, 4);
  }

  // dirt paths
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, c] of [[30, '#c9a36a'], [22, '#dcb97f']] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    for (const path of PATHS) {
      ctx.beginPath();
      path.forEach(([tx, ty], i) => {
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
  // village plaza
  ctx.fillStyle = '#d9b47c';
  ctx.beginPath();
  ctx.ellipse(16.5 * TILE, 24.5 * TILE, 4.2 * TILE, 3 * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e6c58e';
  ctx.beginPath();
  ctx.ellipse(16.5 * TILE, 24.5 * TILE, 3.4 * TILE, 2.3 * TILE, 0, 0, Math.PI * 2);
  ctx.fill();

  tex.refresh();

  makeLake(scene, 'lake_dim', ['#5f7f86', '#4a676e'], false);
  makeLake(scene, 'lake_bright', ['#5fd4f0', '#2fa5d6'], true);

  // dock (drawn as its own texture so it sits above the water)
  const dw = (DOCK.x1 - DOCK.x0 + 1) * TILE;
  const dock = scene.textures.createCanvas('dock', dw, TILE)!;
  const dctx = dock.getContext();
  dctx.fillStyle = '#a8784a';
  dctx.fillRect(0, 4, dw, TILE - 8);
  dctx.strokeStyle = '#7a522c';
  dctx.lineWidth = 2;
  for (let x = 0; x < dw; x += 10) {
    dctx.beginPath();
    dctx.moveTo(x, 4);
    dctx.lineTo(x, TILE - 4);
    dctx.stroke();
  }
  dock.refresh();
}

function makeLake(scene: Phaser.Scene, key: string, [light, deep]: [string, string], sparkle: boolean): void {
  const w = (LAKE.rx * 2 + 1) * TILE;
  const h = (LAKE.ry * 2 + 1) * TILE;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  g.addColorStop(0, deep);
  g.addColorStop(1, light);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, (LAKE.rx + 0.5) * TILE, (LAKE.ry + 0.5) * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = sparkle ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  const rnd = seeded(sparkle ? 3 : 4);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.85;
    const x = w / 2 + Math.cos(a) * r * LAKE.rx * TILE;
    const y = h / 2 + Math.sin(a) * r * LAKE.ry * TILE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + rnd() * 8, y);
    ctx.stroke();
  }
  tex.refresh();
}

/** Is the tile free for scattering decorations (land, not water/dock)? */
export function decorFree(tx: number, ty: number): boolean {
  return isLand(tx, ty) && !isLakeWater(tx, ty) && !isDock(tx, ty) && !coastal(tx, ty);
}

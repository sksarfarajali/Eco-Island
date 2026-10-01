import Phaser from 'phaser';
import type { Appearance, NpcId, PipMood } from '../core/types';

/**
 * Procedural placeholder art for the Phase 0 slice (PRD 22: swap for a custom style before release).
 * Textures are drawn at 2x resolution and displayed at half scale so they stay crisp when zoomed.
 */
export const RES = 2;

type Ctx = CanvasRenderingContext2D;

export const SKIN = ['#f6d3b3', '#e2a97e', '#b9794b', '#7a4a2b'];
export const HAIR = ['#3a2716', '#e0a83f', '#c4452c', '#3b4ba8'];
export const OUTFIT = ['#3aa6d8', '#ec6b3c', '#4fc386', '#9a62e3'];

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * RES, h * RES)!;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(RES, RES);
  draw(ctx);
  ctx.restore();
  tex.refresh();
}

const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
};

const circle = (ctx: Ctx, x: number, y: number, r: number, fill: string) => ellipse(ctx, x, y, r, r, fill);

const rrect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

interface PersonLook {
  skin: string;
  hair: string;
  outfit: string;
  hat?: 'hard' | 'wide' | 'bun' | 'braids';
  goggles?: boolean;
  backpack?: boolean;
}

/** Draw a chibi character in a 28x40 box, feet at the bottom centre. */
export function drawPerson(ctx: Ctx, look: PersonLook): void {
  const dark = shade(look.outfit, -0.35);
  // legs
  rrect(ctx, 9, 30, 4, 9, 2, '#4a3b56');
  rrect(ctx, 15, 30, 4, 9, 2, '#4a3b56');
  // backpack
  if (look.backpack) rrect(ctx, 3, 19, 6, 11, 2, '#a0703c', '#6d4a24');
  // body
  rrect(ctx, 7, 18, 14, 14, 5, look.outfit, dark);
  rrect(ctx, 12, 19, 4, 12, 2, shade(look.outfit, 0.25));
  // arms
  rrect(ctx, 4, 20, 4, 9, 2, look.outfit);
  rrect(ctx, 20, 20, 4, 9, 2, look.outfit);
  circle(ctx, 6, 29, 2, look.skin);
  circle(ctx, 22, 29, 2, look.skin);
  // head
  circle(ctx, 14, 11, 9, look.skin);
  // hair
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(14, 10, 9.5, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(23, 10);
  ctx.quadraticCurveTo(18, 6, 14, 8);
  ctx.quadraticCurveTo(9, 6, 5, 11);
  ctx.fill();
  if (look.hat === 'bun') circle(ctx, 14, 1.5, 4, look.hair);
  if (look.hat === 'braids') {
    rrect(ctx, 3, 10, 4, 12, 2, look.hair);
    rrect(ctx, 21, 10, 4, 12, 2, look.hair);
  }
  // eyes + cheeks
  circle(ctx, 10.5, 12, 1.4, '#2b2135');
  circle(ctx, 17.5, 12, 1.4, '#2b2135');
  circle(ctx, 11, 11.5, 0.5, '#fff');
  circle(ctx, 18, 11.5, 0.5, '#fff');
  ellipse(ctx, 8.5, 15, 1.8, 1.1, 'rgba(255,120,120,0.45)');
  ellipse(ctx, 19.5, 15, 1.8, 1.1, 'rgba(255,120,120,0.45)');
  ctx.strokeStyle = '#7a3b3b';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(14, 14.5, 2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  if (look.goggles) {
    ctx.strokeStyle = '#2d7f86';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 6.5);
    ctx.lineTo(24, 6.5);
    ctx.stroke();
    circle(ctx, 10, 6, 2.8, '#79e0e8');
    circle(ctx, 18, 6, 2.8, '#79e0e8');
  }
  if (look.hat === 'hard') {
    ctx.fillStyle = '#f7c531';
    ctx.beginPath();
    ctx.arc(14, 7, 9, Math.PI, 0);
    ctx.fill();
    rrect(ctx, 3, 6, 22, 3, 1.5, '#e0a81e');
  }
  if (look.hat === 'wide') {
    ellipse(ctx, 14, 5.5, 13, 3, '#7a5230');
    rrect(ctx, 8, -1, 12, 7, 3, '#8f6238');
    rrect(ctx, 8, 3, 12, 1.6, 0.5, '#d94f3d');
  }
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch(n >> 16);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function novaLook(a: Appearance): PersonLook {
  return { skin: SKIN[a.skin % 4], hair: HAIR[a.hair % 4], outfit: OUTFIT[a.outfit % 4], backpack: true };
}

const NPC_LOOKS: Record<NpcId, PersonLook> = {
  rocco: { skin: SKIN[2], hair: '#2a1d12', outfit: '#e8892f', hat: 'hard' },
  luna: { skin: SKIN[0], hair: '#e9e4f5', outfit: '#7b5fd6', hat: 'bun', goggles: true },
  zed: { skin: SKIN[3], hair: '#1d1410', outfit: '#3f8f4f', hat: 'wide' },
  tilly: { skin: SKIN[1], hair: '#8a3b2a', outfit: '#ef7fa6', hat: 'braids' },
};

export function makeNovaTexture(scene: Phaser.Scene, a: Appearance): void {
  canvasTex(scene, 'nova', 28, 40, (ctx) => drawPerson(ctx, novaLook(a)));
}

function drawPip(ctx: Ctx, mood: PipMood): void {
  const g = ctx.createRadialGradient(12, 11, 2, 12, 12, 11);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#bff3ff');
  g.addColorStop(1, '#6fd0f0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(12, 12, 10, 0, Math.PI * 2);
  ctx.fill();
  // little leaf sprout
  ctx.fillStyle = '#5fcf6a';
  ctx.beginPath();
  ctx.ellipse(15, 2.5, 4, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b2135';
  ctx.fillStyle = '#2b2135';
  ctx.lineWidth = 1.4;
  if (mood === 'happy') {
    circle(ctx, 8.5, 12, 1.6, '#2b2135');
    circle(ctx, 15.5, 12, 1.6, '#2b2135');
    ctx.beginPath();
    ctx.arc(12, 14.5, 2.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else if (mood === 'sad') {
    circle(ctx, 8.5, 13, 1.4, '#2b2135');
    circle(ctx, 15.5, 13, 1.4, '#2b2135');
    ctx.beginPath();
    ctx.moveTo(6.5, 10);
    ctx.lineTo(10, 11);
    ctx.moveTo(17.5, 10);
    ctx.lineTo(14, 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 18.5, 2.2, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ellipse(ctx, 16.5, 16, 0.9, 1.5, '#5fb8ff');
  } else {
    for (const x of [8.5, 15.5]) {
      ctx.beginPath();
      ctx.moveTo(x - 2, 13);
      ctx.lineTo(x, 10.5);
      ctx.lineTo(x + 2, 13);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(12, 15.5, 2.2, 1.8, 0, 0, Math.PI);
    ctx.fill();
  }
  ellipse(ctx, 6, 15.5, 1.5, 1, 'rgba(255,130,160,0.5)');
  ellipse(ctx, 18, 15.5, 1.5, 1, 'rgba(255,130,160,0.5)');
}

/** Create every static texture used by the world. */
export function makeTextures(scene: Phaser.Scene): void {
  (Object.keys(NPC_LOOKS) as NpcId[]).forEach((id) =>
    canvasTex(scene, `npc_${id}`, 28, 40, (ctx) => drawPerson(ctx, NPC_LOOKS[id])),
  );
  (['happy', 'sad', 'excited'] as PipMood[]).forEach((m) => canvasTex(scene, `pip_${m}`, 24, 24, (ctx) => drawPip(ctx, m)));

  canvasTex(scene, 'crown', 24, 10, (ctx) => {
    ['#ff7aa8', '#ffd84a', '#ff7aa8', '#9be36a', '#ffd84a'].forEach((c, i) => circle(ctx, 3 + i * 4.5, 5, 2.6, c));
  });

  canvasTex(scene, 'shadow', 28, 10, (ctx) => ellipse(ctx, 14, 5, 13, 4.5, 'rgba(20,30,40,0.28)'));

  canvasTex(scene, 'glow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  canvasTex(scene, 'spark', 8, 8, (ctx) => {
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(5, 3);
    ctx.lineTo(8, 4);
    ctx.lineTo(5, 5);
    ctx.lineTo(4, 8);
    ctx.lineTo(3, 5);
    ctx.lineTo(0, 4);
    ctx.lineTo(3, 3);
    ctx.fill();
  });

  // ---- trees
  const tree = (key: string, leaf: string, leafDark: string, w = 64, h = 80, berries?: string) =>
    canvasTex(scene, key, w, h, (ctx) => {
      const cx = w / 2;
      rrect(ctx, cx - 5, h - 26, 10, 24, 3, '#8a5a32', '#5e3b1e');
      circle(ctx, cx - 14, h - 40, 16, leafDark);
      circle(ctx, cx + 14, h - 40, 16, leafDark);
      circle(ctx, cx, h - 56, 20, leafDark);
      circle(ctx, cx - 12, h - 44, 14, leaf);
      circle(ctx, cx + 12, h - 44, 14, leaf);
      circle(ctx, cx, h - 58, 17, leaf);
      circle(ctx, cx - 6, h - 62, 7, shade(leaf, 0.25));
      if (berries) [[-12, -42], [10, -50], [2, -36], [14, -36]].forEach(([dx, dy]) => circle(ctx, cx + dx, h + dy, 2.4, berries));
    });
  tree('tree', '#5cb85c', '#3d8b47');
  tree('tree_border', '#3f9b55', '#2c7040');
  tree('memory_tree', '#6fd3a3', '#3fa37e', 64, 80, '#c9f7ff');
  canvasTex(scene, 'ancient_tree', 120, 150, (ctx) => {
    rrect(ctx, 48, 80, 24, 68, 6, '#7a4f2c', '#4d3018');
    const g = ctx.createRadialGradient(60, 60, 10, 60, 60, 60);
    g.addColorStop(0, '#d9fff0');
    g.addColorStop(0.5, '#7ee0b5');
    g.addColorStop(1, '#3a9c78');
    ctx.fillStyle = g;
    for (const [x, y, r] of [[30, 70, 28], [90, 70, 28], [60, 40, 38], [60, 78, 26]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) circle(ctx, 20 + ((i * 37) % 80), 20 + ((i * 53) % 80), 2, '#fffbe0');
  });
  canvasTex(scene, 'stump', 28, 18, (ctx) => {
    rrect(ctx, 4, 5, 20, 12, 3, '#8a5a32', '#5e3b1e');
    ellipse(ctx, 14, 6, 10, 4, '#d8b07a');
    ctx.strokeStyle = '#a77d4b';
    ctx.beginPath();
    ctx.ellipse(14, 6, 5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  canvasTex(scene, 'sapling', 20, 28, (ctx) => {
    ellipse(ctx, 10, 25, 8, 3, '#7a5233');
    rrect(ctx, 9, 10, 2, 15, 1, '#6a8f3a');
    ellipse(ctx, 6, 11, 5, 3, '#7ad66a');
    ellipse(ctx, 14, 8, 5, 3, '#8fe27a');
    ellipse(ctx, 10, 4, 4, 3, '#a3ec88');
  });
  canvasTex(scene, 'soil', 26, 16, (ctx) => {
    ellipse(ctx, 13, 9, 12, 6, '#8a5f3a');
    ellipse(ctx, 13, 8, 10, 4.5, '#a5774c');
    circle(ctx, 9, 7, 1, '#6d4a2c');
    circle(ctx, 16, 9, 1, '#6d4a2c');
  });

  // ---- rocks & bushes
  canvasTex(scene, 'rock', 34, 26, (ctx) => {
    ellipse(ctx, 17, 16, 16, 10, '#7d8794');
    ellipse(ctx, 14, 13, 12, 8, '#a2abb6');
    ellipse(ctx, 11, 10, 4, 2.5, '#c9d0d8');
    circle(ctx, 25, 17, 1.6, '#5f6874');
  });
  canvasTex(scene, 'rock_empty', 24, 12, (ctx) => {
    circle(ctx, 6, 7, 3.5, '#8d96a2');
    circle(ctx, 14, 8, 2.6, '#a2abb6');
    circle(ctx, 19, 6, 2, '#7d8794');
  });
  const bush = (key: string, berries: boolean) =>
    canvasTex(scene, key, 34, 28, (ctx) => {
      circle(ctx, 10, 17, 9, '#3f9a4e');
      circle(ctx, 24, 17, 9, '#3f9a4e');
      circle(ctx, 17, 11, 10, '#56b860');
      if (berries) {
        for (const [x, y] of [[9, 14], [16, 8], [23, 13], [13, 19], [21, 20], [27, 18]]) {
          circle(ctx, x, y, 2.8, '#5aa8ff');
          circle(ctx, x - 0.8, y - 0.8, 0.9, '#e6f4ff');
        }
      }
    });
  bush('bush_full', true);
  bush('bush_empty', false);

  canvasTex(scene, 'debris', 30, 16, (ctx) => {
    ellipse(ctx, 15, 9, 14, 6, '#4b4a3c');
    ellipse(ctx, 12, 8, 7, 3, '#625f4a');
    rrect(ctx, 16, 4, 9, 3, 1, '#7a6a52');
    circle(ctx, 7, 10, 1.5, '#8a8a6a');
  });
  canvasTex(scene, 'lilypad', 18, 12, (ctx) => {
    ellipse(ctx, 9, 6, 8, 5, '#4fae5e');
    ctx.fillStyle = '#3c8a4a';
    ctx.beginPath();
    ctx.moveTo(9, 6);
    ctx.lineTo(17, 4);
    ctx.lineTo(17, 7);
    ctx.fill();
    circle(ctx, 6, 5, 2, '#ffd1ea');
  });

  // ---- flowers & corruption
  ['#ff8fb8', '#ffd84a', '#ffffff', '#b98cff'].forEach((c, i) =>
    canvasTex(scene, `flower${i}`, 10, 12, (ctx) => {
      rrect(ctx, 4.4, 5, 1.2, 7, 0.5, '#3f8f3f');
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        circle(ctx, 5 + Math.cos(a) * 2.4, 4 + Math.sin(a) * 2.4, 1.8, c);
      }
      circle(ctx, 5, 4, 1.3, '#ffb347');
    }),
  );
  canvasTex(scene, 'dark_plant', 20, 24, (ctx) => {
    ctx.fillStyle = '#3b2150';
    for (const [x, h] of [[4, 14], [8, 20], [12, 17], [16, 12]]) {
      ctx.beginPath();
      ctx.moveTo(x - 3, 24);
      ctx.lineTo(x, 24 - h);
      ctx.lineTo(x + 3, 24);
      ctx.fill();
    }
    circle(ctx, 8, 6, 1.6, '#c86bff');
    circle(ctx, 12, 9, 1.3, '#c86bff');
  });
  canvasTex(scene, 'wisp', 14, 14, (ctx) => {
    const g = ctx.createRadialGradient(7, 7, 0, 7, 7, 7);
    g.addColorStop(0, 'rgba(120,60,170,0.9)');
    g.addColorStop(1, 'rgba(60,20,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 14, 14);
  });
  canvasTex(scene, 'butterfly', 12, 9, (ctx) => {
    ellipse(ctx, 3.5, 3.5, 3.2, 2.6, '#ffb03b');
    ellipse(ctx, 8.5, 3.5, 3.2, 2.6, '#ffb03b');
    ellipse(ctx, 4, 6.5, 2.2, 1.8, '#ff7a3b');
    ellipse(ctx, 8, 6.5, 2.2, 1.8, '#ff7a3b');
    rrect(ctx, 5.5, 1.5, 1, 7, 0.5, '#3a2a1a');
  });

  // ---- buildings & structures
  canvasTex(scene, 'house', 84, 84, (ctx) => {
    rrect(ctx, 10, 36, 64, 44, 4, '#f3e2c0', '#b9935c');
    ctx.fillStyle = '#d9573e';
    ctx.beginPath();
    ctx.moveTo(2, 40);
    ctx.lineTo(42, 6);
    ctx.lineTo(82, 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8432e';
    ctx.fillRect(2, 38, 80, 5);
    rrect(ctx, 56, 10, 9, 18, 1, '#8a6a52');
    rrect(ctx, 36, 54, 14, 26, 6, '#8a5a32', '#5e3b1e');
    circle(ctx, 46, 68, 1.2, '#ffd84a');
    rrect(ctx, 16, 50, 14, 12, 2, '#9fd8ff', '#7a5a3a');
    rrect(ctx, 56, 50, 14, 12, 2, '#9fd8ff', '#7a5a3a');
  });
  canvasTex(scene, 'garden', 84, 60, (ctx) => {
    rrect(ctx, 4, 10, 76, 46, 4, '#8a5f3a', '#6d4a2c');
    for (let r = 0; r < 3; r++) rrect(ctx, 10, 16 + r * 13, 64, 8, 3, '#a5774c');
    ctx.strokeStyle = '#c8a06a';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 8, 80, 50);
  });
  canvasTex(scene, 'veggie', 10, 14, (ctx) => {
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.moveTo(2, 5);
    ctx.lineTo(8, 5);
    ctx.lineTo(5, 14);
    ctx.fill();
    ellipse(ctx, 3.5, 3, 2, 3, '#4fc34f');
    ellipse(ctx, 6.5, 3, 2, 3, '#4fc34f');
  });
  canvasTex(scene, 'sprout', 10, 10, (ctx) => {
    ellipse(ctx, 3, 5, 3, 2, '#7ad66a');
    ellipse(ctx, 7, 4, 3, 2, '#8fe27a');
  });
  canvasTex(scene, 'plot', 80, 56, (ctx) => {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(3, 6, 74, 46, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    rrect(ctx, 36, 0, 4, 18, 1, '#8a5a32');
    rrect(ctx, 26, 0, 24, 10, 2, '#d8b07a', '#8a5a32');
  });
  canvasTex(scene, 'shop', 76, 64, (ctx) => {
    rrect(ctx, 6, 30, 64, 30, 3, '#b07a45', '#7a522c');
    rrect(ctx, 6, 28, 64, 6, 2, '#8a5a32');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#fff4e0' : '#ef6b5b';
      ctx.beginPath();
      ctx.moveTo(4 + i * 8.5, 8);
      ctx.lineTo(12.5 + i * 8.5, 8);
      ctx.lineTo(12.5 + i * 8.5, 22);
      ctx.quadraticCurveTo(8 + i * 8.5, 27, 4 + i * 8.5, 22);
      ctx.fill();
    }
    rrect(ctx, 4, 4, 68, 5, 2, '#c4452c');
    rrect(ctx, 6, 8, 3, 24, 1, '#7a522c');
    rrect(ctx, 67, 8, 3, 24, 1, '#7a522c');
    circle(ctx, 20, 34, 4, '#ff8a2a');
    circle(ctx, 30, 34, 4, '#5aa8ff');
    circle(ctx, 46, 34, 4, '#7ad66a');
    circle(ctx, 56, 34, 4, '#ffd84a');
  });
  canvasTex(scene, 'workshop', 100, 84, (ctx) => {
    rrect(ctx, 8, 34, 84, 46, 4, '#c69a6a', '#8a6340');
    for (let i = 0; i < 6; i++) rrect(ctx, 10 + i * 14, 36, 2, 42, 1, '#a87d50');
    ctx.fillStyle = '#5b7a8c';
    ctx.beginPath();
    ctx.moveTo(0, 38);
    ctx.lineTo(16, 10);
    ctx.lineTo(84, 10);
    ctx.lineTo(100, 38);
    ctx.closePath();
    ctx.fill();
    rrect(ctx, 38, 52, 24, 28, 3, '#6a4528');
    ctx.strokeStyle = '#3b2b1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(70, 50);
    ctx.lineTo(84, 64);
    ctx.stroke();
    rrect(ctx, 66, 46, 10, 6, 1, '#9aa4ae');
  });
  canvasTex(scene, 'well', 36, 40, (ctx) => {
    rrect(ctx, 4, 20, 28, 18, 5, '#9aa4ae', '#6c7680');
    ellipse(ctx, 18, 21, 13, 4, '#2c4a6a');
    rrect(ctx, 5, 2, 3, 20, 1, '#8a5a32');
    rrect(ctx, 28, 2, 3, 20, 1, '#8a5a32');
    ctx.fillStyle = '#b8432e';
    ctx.beginPath();
    ctx.moveTo(1, 6);
    ctx.lineTo(18, -2);
    ctx.lineTo(35, 6);
    ctx.fill();
  });
  const tent = (key: string, color: string, w: number, h: number) =>
    canvasTex(scene, key, w, h, (ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(4, h - 4);
      ctx.lineTo(w / 2, 6);
      ctx.lineTo(w - 4, h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(color, -0.4);
      ctx.beginPath();
      ctx.moveTo(w / 2 - 9, h - 4);
      ctx.lineTo(w / 2, h - 26);
      ctx.lineTo(w / 2 + 9, h - 4);
      ctx.fill();
      rrect(ctx, w / 2 - 1, 0, 2, 10, 1, '#5e3b1e');
    });
  tent('tent_luna', '#7b5fd6', 70, 56);
  tent('tent_zed', '#3f8f4f', 64, 52);
  canvasTex(scene, 'temple_gate', 120, 84, (ctx) => {
    rrect(ctx, 6, 22, 22, 62, 3, '#9a9583', '#6d6858');
    rrect(ctx, 92, 22, 22, 62, 3, '#9a9583', '#6d6858');
    rrect(ctx, 0, 8, 120, 18, 4, '#b0aa95', '#6d6858');
    rrect(ctx, 30, 30, 60, 54, 2, '#5a5648', '#3e3b30');
    ctx.strokeStyle = '#8a8470';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 30);
    ctx.lineTo(60, 84);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(60, 56, 10, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 5; i++) circle(ctx, 18 + i * 21, 17, 2.4, '#7d7764');
  });
  canvasTex(scene, 'temple_rune', 120, 84, (ctx) => {
    ctx.strokeStyle = '#7ff3ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#7ff3ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(60, 56, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(60, 30);
    ctx.lineTo(60, 84);
    ctx.stroke();
    for (let i = 0; i < 5; i++) circle(ctx, 18 + i * 21, 17, 3, '#bff9ff');
  });
  canvasTex(scene, 'egg', 20, 24, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 1, 10, 13, 12);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(1, '#f2c96a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(10, 13, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, 7, 12, 1.6, '#7fd3ff');
    circle(ctx, 13, 16, 2, '#7fd3ff');
    circle(ctx, 11, 7, 1.2, '#7fd3ff');
  });
  canvasTex(scene, 'log', 44, 22, (ctx) => {
    rrect(ctx, 2, 6, 40, 15, 7, '#7a4f2c', '#4d3018');
    ellipse(ctx, 38, 13.5, 5, 7, '#3b2414');
    ellipse(ctx, 6, 13.5, 4, 6.5, '#c8a06a');
  });
  canvasTex(scene, 'nest', 34, 18, (ctx) => {
    ellipse(ctx, 17, 11, 16, 7, '#9a6b3c');
    ellipse(ctx, 17, 9, 12, 4.5, '#6d4a2c');
    ctx.strokeStyle = '#c8a06a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(3 + i * 5, 14);
      ctx.lineTo(8 + i * 5, 8);
      ctx.stroke();
    }
  });
  canvasTex(scene, 'den', 46, 30, (ctx) => {
    ellipse(ctx, 23, 18, 22, 12, '#7d8794');
    ellipse(ctx, 23, 21, 11, 8, '#2c2530');
    ellipse(ctx, 14, 10, 7, 4, '#a2abb6');
  });
  canvasTex(scene, 'lantern', 10, 24, (ctx) => {
    rrect(ctx, 4, 8, 2, 16, 1, '#5e3b1e');
    rrect(ctx, 1, 2, 8, 8, 2, '#ffd36a', '#a8742a');
  });
  canvasTex(scene, 'flag', 10, 10, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(10, 0);
    ctx.lineTo(5, 9);
    ctx.fill();
  });
  canvasTex(scene, 'marker_quest', 18, 22, (ctx) => {
    rrect(ctx, 1, 1, 16, 16, 5, '#ffd84a', '#a8742a');
    ctx.fillStyle = '#5a3a10';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 9, 14);
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(6, 16);
    ctx.lineTo(9, 21);
    ctx.lineTo(12, 16);
    ctx.fill();
  });
  canvasTex(scene, 'arrow', 20, 20, (ctx) => {
    ctx.fillStyle = '#bff3ff';
    ctx.strokeStyle = '#2a7d99';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, 10);
    ctx.lineTo(4, 2);
    ctx.lineTo(8, 10);
    ctx.lineTo(4, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // ---- creatures
  canvasTex(scene, 'glowfox', 36, 28, (ctx) => {
    const tail = ctx.createRadialGradient(6, 12, 1, 6, 12, 9);
    tail.addColorStop(0, '#fffbd0');
    tail.addColorStop(1, '#ffb84a');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.ellipse(7, 13, 7, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, 18, 18, 10, 7, '#f08a3c');
    ellipse(ctx, 18, 21, 6, 3.5, '#fff1de');
    rrect(ctx, 11, 22, 3, 6, 1, '#c86a28');
    rrect(ctx, 22, 22, 3, 6, 1, '#c86a28');
    circle(ctx, 28, 12, 7, '#f08a3c');
    ctx.fillStyle = '#f08a3c';
    ctx.beginPath();
    ctx.moveTo(23, 8);
    ctx.lineTo(25, 0);
    ctx.lineTo(28, 6);
    ctx.moveTo(29, 6);
    ctx.lineTo(33, 0);
    ctx.lineTo(34, 9);
    ctx.fill();
    ellipse(ctx, 32, 15, 4, 2.5, '#fff1de');
    circle(ctx, 35, 14.5, 1.2, '#2b2135');
    circle(ctx, 28, 11, 1.4, '#2b2135');
  });
  canvasTex(scene, 'ripplet', 32, 24, (ctx) => {
    ellipse(ctx, 6, 18, 4, 2.5, '#6ccf9a');
    ellipse(ctx, 26, 18, 4, 2.5, '#6ccf9a');
    ellipse(ctx, 16, 14, 12, 8, '#3f8fb0');
    ellipse(ctx, 16, 12, 9, 5, '#5fb6d6');
    circle(ctx, 28, 10, 5, '#6ccf9a');
    circle(ctx, 30, 9, 1.2, '#2b2135');
    circle(ctx, 13, 11, 1.5, '#bff3ff');
    circle(ctx, 19, 13, 1.2, '#bff3ff');
  });
  canvasTex(scene, 'mossprite', 24, 24, (ctx) => {
    circle(ctx, 12, 14, 9, '#5fbf5f');
    circle(ctx, 7, 9, 5, '#79d36a');
    circle(ctx, 17, 8, 5, '#79d36a');
    circle(ctx, 12, 6, 5, '#8fe27a');
    circle(ctx, 9, 15, 1.4, '#2b2135');
    circle(ctx, 15, 15, 1.4, '#2b2135');
    circle(ctx, 12, 3, 2, '#ff8fb8');
  });
  canvasTex(scene, 'sunchick', 20, 20, (ctx) => {
    circle(ctx, 10, 12, 7, '#ffd84a');
    circle(ctx, 10, 7, 5, '#ffe27a');
    ctx.fillStyle = '#ff9a2a';
    ctx.beginPath();
    ctx.moveTo(14, 7);
    ctx.lineTo(18, 8);
    ctx.lineTo(14, 9);
    ctx.fill();
    circle(ctx, 12, 6, 1.1, '#2b2135');
    ellipse(ctx, 6, 13, 3, 2, '#f2c030');
    rrect(ctx, 8, 18, 1.5, 2, 0.5, '#ff9a2a');
    rrect(ctx, 11, 18, 1.5, 2, 0.5, '#ff9a2a');
  });
}

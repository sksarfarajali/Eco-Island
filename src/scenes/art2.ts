import Phaser from 'phaser';
import { TILE } from '../core/config';
import type { AreaDef } from '../core/areas';
import { canvasTex, circle, ellipse, rrect, shade, type Ctx } from './art';
import { seeded } from './ground';

/** Placeholder art for the full-MVP zones, creatures, enemies, puzzles and buildings. */
export function makeMvpTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('gloomling')) return;

  // ---- entrances & landmarks on the island
  canvasTex(scene, 'cave_entrance', 96, 64, (ctx) => {
    ellipse(ctx, 48, 40, 46, 26, '#7d8794');
    ellipse(ctx, 40, 30, 30, 18, '#a2abb6');
    ellipse(ctx, 48, 48, 22, 16, '#1d1726');
    ellipse(ctx, 48, 52, 18, 10, '#2c2235');
    [[30, 40], [66, 38], [58, 22]].forEach(([x, y]) => circle(ctx, x, y, 3, '#7fe3ff'));
  });
  canvasTex(scene, 'mountain_path', 56, 56, (ctx) => {
    ctx.fillStyle = '#9aa1ab';
    ctx.beginPath();
    ctx.moveTo(4, 52);
    ctx.lineTo(28, 4);
    ctx.lineTo(52, 52);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(28, 4);
    ctx.lineTo(36, 20);
    ctx.fill();
    for (let i = 0; i < 4; i++) rrect(ctx, 18 - i, 46 - i * 8, 20 + i * 2, 4, 1, '#c9a36a');
    rrect(ctx, 2, 26, 3, 26, 1, '#7a522c');
    rrect(ctx, 0, 24, 18, 8, 2, '#d8b07a', '#7a522c');
  });
  canvasTex(scene, 'temple_gate_open', 120, 84, (ctx) => {
    rrect(ctx, 6, 22, 22, 62, 3, '#9a9583', '#6d6858');
    rrect(ctx, 92, 22, 22, 62, 3, '#9a9583', '#6d6858');
    rrect(ctx, 0, 8, 120, 18, 4, '#b0aa95', '#6d6858');
    const g = ctx.createLinearGradient(0, 30, 0, 84);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(1, '#ffd36a');
    ctx.fillStyle = g;
    ctx.fillRect(30, 30, 60, 54);
    for (let i = 0; i < 5; i++) circle(ctx, 18 + i * 21, 17, 2.6, '#bff9ff');
  });
  canvasTex(scene, 'exit', 40, 30, (ctx) => {
    ellipse(ctx, 20, 22, 18, 7, 'rgba(255,246,176,0.55)');
    ctx.fillStyle = '#fff6b0';
    ctx.strokeStyle = '#a8742a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, 2);
    ctx.lineTo(31, 13);
    ctx.lineTo(24, 13);
    ctx.lineTo(24, 22);
    ctx.lineTo(16, 22);
    ctx.lineTo(16, 13);
    ctx.lineTo(9, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  canvasTex(scene, 'fishing_spot', 22, 22, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (const r of [4, 7, 10]) {
      ctx.globalAlpha = 1 - r / 12;
      ctx.beginPath();
      ctx.ellipse(11, 11, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  // ---- buildings
  canvasTex(scene, 'bld_workshop', 88, 84, (ctx) => {
    rrect(ctx, 8, 36, 72, 44, 4, '#d9b47c', '#8a6340');
    ctx.fillStyle = '#4f7f9c';
    ctx.beginPath();
    ctx.moveTo(2, 40);
    ctx.lineTo(44, 10);
    ctx.lineTo(86, 40);
    ctx.fill();
    rrect(ctx, 34, 54, 20, 26, 3, '#6a4528');
    circle(ctx, 66, 54, 7, '#9aa4ae');
    circle(ctx, 66, 54, 3, '#6c7680');
    rrect(ctx, 14, 52, 12, 10, 2, '#9fd8ff', '#7a5a3a');
    rrect(ctx, 64, 12, 8, 16, 1, '#8a6a52');
  });
  canvasTex(scene, 'bld_sanctuary', 88, 64, (ctx) => {
    ellipse(ctx, 44, 38, 42, 22, '#9fe08a');
    ctx.strokeStyle = '#a8784a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(44, 38, 42, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      rrect(ctx, 44 + Math.cos(a) * 42 - 1.5, 38 + Math.sin(a) * 22 - 6, 3, 8, 1, '#8a5a32');
    }
    rrect(ctx, 30, 12, 28, 18, 4, '#f3e2c0', '#b9935c');
    ctx.fillStyle = '#4fc386';
    ctx.beginPath();
    ctx.moveTo(26, 14);
    ctx.lineTo(44, 2);
    ctx.lineTo(62, 14);
    ctx.fill();
    circle(ctx, 44, 22, 4, '#ff7aa8');
  });
  canvasTex(scene, 'bld_arch', 80, 80, (ctx) => {
    ctx.strokeStyle = '#7a522c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(40, 46, 30, Math.PI, 0);
    ctx.stroke();
    rrect(ctx, 7, 44, 6, 34, 2, '#7a522c');
    rrect(ctx, 67, 44, 6, 34, 2, '#7a522c');
    const cols = ['#ff7aa8', '#ffd84a', '#ffffff', '#b98cff', '#7ad66a'];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      circle(ctx, 40 + Math.cos(a) * 30, 46 + Math.sin(a) * 30, 4, cols[i % 5]);
    }
    for (let i = 0; i < 6; i++) {
      circle(ctx, 10, 50 + i * 5, 3, cols[i % 5]);
      circle(ctx, 70, 52 + i * 5, 3, cols[(i + 2) % 5]);
    }
  });
  // house/garden keep their original art under build ids
  for (const b of ['house', 'garden']) {
    const src = scene.textures.get(b).getSourceImage() as HTMLCanvasElement;
    if (!scene.textures.exists(`bld_${b}`)) scene.textures.addCanvas(`bld_${b}`, src);
  }

  // ---- area resource nodes
  canvasTex(scene, 'crystal', 30, 34, (ctx) => {
    const shard = (x: number, h: number, w: number, c: string) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - w, 32);
      ctx.lineTo(x, 32 - h);
      ctx.lineTo(x + w, 32);
      ctx.fill();
    };
    shard(9, 18, 6, '#4fb8e6');
    shard(21, 22, 6, '#6fd6ff');
    shard(15, 30, 7, '#9be9ff');
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(14, 8, 2, 14);
  });
  canvasTex(scene, 'crystal_empty', 24, 10, (ctx) => {
    ellipse(ctx, 12, 6, 10, 4, '#5a5470');
    circle(ctx, 8, 5, 1.5, '#4fb8e6');
  });
  const flower = (key: string, petal: string, center: string) =>
    canvasTex(scene, key, 22, 22, (ctx) => {
      rrect(ctx, 10, 10, 2, 12, 1, '#3f8f3f');
      ellipse(ctx, 6, 16, 4, 2, '#4fae5e');
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        circle(ctx, 11 + Math.cos(a) * 4.5, 8 + Math.sin(a) * 4.5, 3, petal);
      }
      circle(ctx, 11, 8, 2.5, center);
    });
  flower('skybloom', '#9ad8ff', '#ffffff');
  flower('shadowcap', '#8a5ad6', '#ff9ad6');
  canvasTex(scene, 'flower_empty', 14, 10, (ctx) => ellipse(ctx, 7, 6, 6, 3, '#4fae5e'));

  // ---- temple pieces
  canvasTex(scene, 'pedestal', 30, 34, (ctx) => {
    rrect(ctx, 6, 14, 18, 18, 2, '#b0aa95', '#6d6858');
    rrect(ctx, 3, 10, 24, 6, 2, '#c9c2ab', '#6d6858');
    rrect(ctx, 3, 30, 24, 4, 2, '#8a8470');
  });
  canvasTex(scene, 'sun_key', 18, 18, (ctx) => {
    circle(ctx, 9, 7, 6, '#ffd84a');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      circle(ctx, 9 + Math.cos(a) * 7.5, 7 + Math.sin(a) * 7.5, 1.4, '#ffb03b');
    }
    rrect(ctx, 8, 11, 2, 7, 1, '#c88a1a');
  });
  canvasTex(scene, 'echo_heart', 22, 22, (ctx) => {
    const g = ctx.createRadialGradient(11, 10, 1, 11, 11, 10);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#9ff3ff');
    g.addColorStop(1, '#4fb8e6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(11, 20);
    ctx.bezierCurveTo(0, 12, 2, 2, 11, 7);
    ctx.bezierCurveTo(20, 2, 22, 12, 11, 20);
    ctx.fill();
  });
  canvasTex(scene, 'mural', 34, 40, (ctx) => {
    rrect(ctx, 2, 2, 30, 36, 3, '#8a8470', '#5a5648');
    ctx.strokeStyle = '#d9d2b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(17, 16, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#e9e4cf';
    ctx.textAlign = 'center';
    ctx.fillText('△ ○ ◇ □', 17, 32);
  });
  for (const [n, sym] of [[1, '○'], [2, '□'], [3, '△'], [4, '◇']] as const) {
    for (const lit of [false, true]) {
      canvasTex(scene, `rune${n}${lit ? '_lit' : ''}`, 26, 40, (ctx) => {
        rrect(ctx, 4, 6, 18, 32, 3, lit ? '#d6fbff' : '#a39d88', '#6d6858');
        rrect(ctx, 2, 2, 22, 6, 2, '#c9c2ab', '#6d6858');
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = lit ? '#1f8fb0' : '#5a5648';
        ctx.fillText(sym, 13, 27);
      });
    }
  }
  for (const [key, flip] of [['mirror_a', false], ['mirror_b', true]] as const) {
    canvasTex(scene, key, 32, 32, (ctx) => {
      rrect(ctx, 2, 2, 28, 28, 4, '#8a8470', '#5a5648');
      ctx.strokeStyle = '#e8fbff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (flip) {
        ctx.moveTo(7, 7);
        ctx.lineTo(25, 25);
      } else {
        ctx.moveTo(25, 7);
        ctx.lineTo(7, 25);
      }
      ctx.stroke();
    });
  }
  canvasTex(scene, 'emitter', 32, 32, (ctx) => {
    rrect(ctx, 2, 4, 24, 24, 4, '#8a8470', '#5a5648');
    circle(ctx, 22, 16, 6, '#fff6b0');
  });
  for (const lit of [false, true]) {
    canvasTex(scene, lit ? 'lock_lit' : 'lock', 30, 34, (ctx) => {
      rrect(ctx, 6, 22, 18, 10, 2, '#8a8470');
      ctx.fillStyle = lit ? '#fff2a0' : '#7a98a6';
      ctx.beginPath();
      ctx.moveTo(15, 2);
      ctx.lineTo(24, 14);
      ctx.lineTo(15, 26);
      ctx.lineTo(6, 14);
      ctx.fill();
    });
  }
  canvasTex(scene, 'stone_block', 32, 34, (ctx) => {
    rrect(ctx, 1, 6, 30, 27, 3, '#9a9583', '#5a5648');
    rrect(ctx, 1, 1, 30, 10, 3, '#b8b29c', '#5a5648');
    ctx.strokeStyle = '#7d7764';
    ctx.beginPath();
    ctx.arc(16, 20, 6, 0, Math.PI * 2);
    ctx.stroke();
  });
  canvasTex(scene, 'plate', 32, 32, (ctx) => {
    rrect(ctx, 3, 3, 26, 26, 4, '#6d6858');
    rrect(ctx, 6, 6, 20, 20, 3, '#c9b98f');
    circle(ctx, 16, 16, 4, '#8a8470');
  });
  canvasTex(scene, 'lever', 24, 30, (ctx) => {
    rrect(ctx, 4, 22, 16, 8, 2, '#6d6858');
    ctx.strokeStyle = '#8a5a32';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 24);
    ctx.lineTo(6, 6);
    ctx.stroke();
    circle(ctx, 6, 6, 3.5, '#d94f3d');
  });
  canvasTex(scene, 'door', 32, 40, (ctx) => {
    rrect(ctx, 0, 0, 32, 40, 2, '#5a5648', '#3e3b30');
    ctx.strokeStyle = '#8a8470';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(16, 20, 7, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ---- highlands & grove
  canvasTex(scene, 'viewpoint', 26, 34, (ctx) => {
    rrect(ctx, 11, 8, 3, 26, 1, '#7a522c');
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(26, 13);
    ctx.lineTo(14, 18);
    ctx.fill();
    circle(ctx, 12.5, 6, 3, '#ffd84a');
  });
  canvasTex(scene, 'cage', 40, 36, (ctx) => {
    ctx.strokeStyle = '#5b3a6b';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(4 + i * 6.5, 34);
      ctx.quadraticCurveTo(20, -6, 36 - i * 6.5, 34);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) circle(ctx, 6 + ((i * 13) % 30), 8 + ((i * 7) % 24), 1.5, '#c86bff');
  });
  for (const open of [false, true]) {
    canvasTex(scene, open ? 'grove_gate_open' : 'grove_gate', 64, 70, (ctx) => {
      rrect(ctx, 2, 10, 12, 60, 3, '#3b2150');
      rrect(ctx, 50, 10, 12, 60, 3, '#3b2150');
      ctx.fillStyle = '#4b2a66';
      ctx.beginPath();
      ctx.arc(32, 16, 28, Math.PI, 0);
      ctx.fill();
      if (open) {
        const g = ctx.createLinearGradient(0, 20, 0, 70);
        g.addColorStop(0, '#c9a6ff');
        g.addColorStop(1, '#5a3a8a');
        ctx.fillStyle = g;
        ctx.fillRect(14, 20, 36, 50);
      } else {
        ctx.strokeStyle = '#8a5ad6';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(14, 24 + i * 10);
          ctx.lineTo(50, 30 + i * 9);
          ctx.stroke();
        }
      }
    });
  }

  // ---- creatures (new + evolved)
  canvasTex(scene, 'gleamwing', 34, 24, (ctx) => {
    ctx.fillStyle = '#5a4b8a';
    ctx.beginPath();
    ctx.moveTo(17, 12);
    ctx.quadraticCurveTo(6, 0, 0, 10);
    ctx.quadraticCurveTo(8, 10, 10, 18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(17, 12);
    ctx.quadraticCurveTo(28, 0, 34, 10);
    ctx.quadraticCurveTo(26, 10, 24, 18);
    ctx.fill();
    circle(ctx, 17, 14, 6, '#7a68b8');
    circle(ctx, 15, 13, 1.3, '#ffffff');
    circle(ctx, 19, 13, 1.3, '#ffffff');
    circle(ctx, 17, 20, 2, '#7fe3ff');
  });
  canvasTex(scene, 'pebblepup', 30, 24, (ctx) => {
    ellipse(ctx, 14, 16, 10, 7, '#9aa4ae');
    circle(ctx, 23, 11, 6, '#a9b2bc');
    ellipse(ctx, 25, 6, 2.5, 4, '#7d8794');
    circle(ctx, 25, 10, 1.2, '#2b2135');
    circle(ctx, 28, 13, 1.2, '#2b2135');
    rrect(ctx, 7, 20, 3, 4, 1, '#7d8794');
    rrect(ctx, 17, 20, 3, 4, 1, '#7d8794');
    circle(ctx, 10, 13, 2, '#7fe3ff');
  });
  canvasTex(scene, 'skyhare', 28, 28, (ctx) => {
    ellipse(ctx, 9, 4, 3, 8, '#e9f4ff');
    ellipse(ctx, 16, 4, 3, 8, '#e9f4ff');
    ellipse(ctx, 14, 19, 10, 8, '#f6fbff');
    circle(ctx, 13, 12, 6, '#ffffff');
    circle(ctx, 11, 12, 1.2, '#2b2135');
    circle(ctx, 15, 12, 1.2, '#2b2135');
    ellipse(ctx, 22, 19, 3, 2, '#9ad8ff');
  });
  canvasTex(scene, 'thistlegoat', 34, 30, (ctx) => {
    ellipse(ctx, 15, 18, 11, 7, '#e8dcc4');
    rrect(ctx, 7, 22, 3, 8, 1, '#8a7a60');
    rrect(ctx, 20, 22, 3, 8, 1, '#8a7a60');
    circle(ctx, 26, 12, 6, '#efe5d0');
    ctx.strokeStyle = '#8a6a9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(24, 5, 4, Math.PI, Math.PI * 1.9);
    ctx.stroke();
    circle(ctx, 28, 11, 1.2, '#2b2135');
    circle(ctx, 9, 13, 2.2, '#b98cff');
  });
  canvasTex(scene, 'archowl', 26, 30, (ctx) => {
    ellipse(ctx, 13, 18, 10, 11, '#9a7a5a');
    ellipse(ctx, 13, 21, 6, 7, '#e8dcc4');
    circle(ctx, 9, 12, 4, '#fff6c8');
    circle(ctx, 17, 12, 4, '#fff6c8');
    circle(ctx, 9, 12, 1.8, '#2b2135');
    circle(ctx, 17, 12, 1.8, '#2b2135');
    ctx.fillStyle = '#e0a83f';
    ctx.beginPath();
    ctx.moveTo(11.5, 15);
    ctx.lineTo(14.5, 15);
    ctx.lineTo(13, 18);
    ctx.fill();
  });
  canvasTex(scene, 'wispling', 24, 28, (ctx) => {
    const g = ctx.createRadialGradient(12, 11, 1, 12, 12, 11);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c9b8ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 11, 9, Math.PI, 0);
    ctx.lineTo(21, 24);
    ctx.lineTo(16, 20);
    ctx.lineTo(12, 26);
    ctx.lineTo(8, 20);
    ctx.lineTo(3, 24);
    ctx.closePath();
    ctx.fill();
    circle(ctx, 9, 11, 1.5, '#5a3a8a');
    circle(ctx, 15, 11, 1.5, '#5a3a8a');
  });
  canvasTex(scene, 'lumifox', 40, 30, (ctx) => {
    const tail = ctx.createRadialGradient(7, 12, 1, 7, 12, 10);
    tail.addColorStop(0, '#ffffff');
    tail.addColorStop(1, '#7fe3ff');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.ellipse(8, 13, 8, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, 20, 19, 11, 7, '#f6d6ff');
    rrect(ctx, 13, 23, 3, 6, 1, '#c9a6ff');
    rrect(ctx, 24, 23, 3, 6, 1, '#c9a6ff');
    circle(ctx, 31, 12, 7, '#f6d6ff');
    ctx.fillStyle = '#f6d6ff';
    ctx.beginPath();
    ctx.moveTo(26, 8);
    ctx.lineTo(28, 0);
    ctx.lineTo(31, 6);
    ctx.moveTo(32, 6);
    ctx.lineTo(36, 0);
    ctx.lineTo(37, 9);
    ctx.fill();
    circle(ctx, 31, 11, 1.4, '#2b2135');
    circle(ctx, 20, 15, 2, '#7fe3ff');
  });
  canvasTex(scene, 'moonshell', 36, 26, (ctx) => {
    ellipse(ctx, 6, 20, 4, 2.5, '#9ad8ff');
    ellipse(ctx, 30, 20, 4, 2.5, '#9ad8ff');
    ellipse(ctx, 18, 15, 14, 9, '#3a4aa8');
    ellipse(ctx, 18, 13, 10, 6, '#6f8cff');
    circle(ctx, 18, 12, 4, '#fff6c8');
    circle(ctx, 32, 11, 5, '#9ad8ff');
    circle(ctx, 34, 10, 1.2, '#2b2135');
  });

  // ---- enemies & combat effects
  canvasTex(scene, 'gloomling', 30, 28, (ctx) => {
    ctx.fillStyle = '#3b2150';
    ctx.beginPath();
    ctx.moveTo(3, 26);
    ctx.quadraticCurveTo(0, 4, 15, 3);
    ctx.quadraticCurveTo(30, 4, 27, 26);
    ctx.lineTo(22, 22);
    ctx.lineTo(18, 27);
    ctx.lineTo(14, 22);
    ctx.lineTo(10, 27);
    ctx.lineTo(7, 22);
    ctx.closePath();
    ctx.fill();
    circle(ctx, 10, 13, 2.5, '#ff9ad6');
    circle(ctx, 20, 13, 2.5, '#ff9ad6');
  });
  canvasTex(scene, 'shade_wisp', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 1, 12, 12, 11);
    g.addColorStop(0, '#d6a6ff');
    g.addColorStop(0.5, '#6a3a9a');
    g.addColorStop(1, 'rgba(40,10,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
    circle(ctx, 9, 11, 1.6, '#ffffff');
    circle(ctx, 15, 11, 1.6, '#ffffff');
  });
  canvasTex(scene, 'orb', 12, 12, (ctx) => {
    const g = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#a35ad6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(6, 6, 5.5, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'hollow', 110, 110, (ctx) => {
    const g = ctx.createRadialGradient(55, 55, 8, 55, 55, 54);
    g.addColorStop(0, '#2a1240');
    g.addColorStop(0.7, '#3b2150');
    g.addColorStop(1, 'rgba(30,10,45,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(55, 55, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2150';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(55 + Math.cos(a) * 30, 55 + Math.sin(a) * 30);
      ctx.lineTo(55 + Math.cos(a + 0.2) * 52, 55 + Math.sin(a + 0.2) * 52);
      ctx.lineTo(55 + Math.cos(a + 0.4) * 30, 55 + Math.sin(a + 0.4) * 30);
      ctx.fill();
    }
    circle(ctx, 42, 48, 6, '#ff9ad6');
    circle(ctx, 68, 48, 6, '#ff9ad6');
    circle(ctx, 55, 66, 8, '#c86bff');
  });
  canvasTex(scene, 'hollow_core', 30, 30, (ctx) => {
    const g = ctx.createRadialGradient(15, 15, 1, 15, 15, 14);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 30, 30);
  });
  canvasTex(scene, 'slash', 44, 44, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(8, 22, 30, -0.9, 0.9);
    ctx.stroke();
  });
  canvasTex(scene, 'shield', 22, 24, (ctx) => {
    ctx.fillStyle = '#9ad8ff';
    ctx.strokeStyle = '#2a7d99';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 1);
    ctx.lineTo(21, 5);
    ctx.quadraticCurveTo(21, 18, 11, 23);
    ctx.quadraticCurveTo(1, 18, 1, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  canvasTex(scene, 'warn', 16, 20, (ctx) => {
    rrect(ctx, 1, 1, 14, 14, 4, '#ff5a5a', '#7a1010');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 8, 12.5);
  });
  canvasTex(scene, 'ring', 64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(255,90,90,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.stroke();
  });
  canvasTex(scene, 'pulse', 64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(191,243,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.stroke();
  });
}

const THEMES: Record<string, { floor: string; floor2: string; wall: string; wallTop: string; water: string; bg: string }> = {
  caves: { floor: '#3d3755', floor2: '#463f62', wall: '#221c33', wallTop: '#4a4268', water: '#14304a', bg: '#100c18' },
  temple: { floor: '#cdbd92', floor2: '#c3b286', wall: '#6d6858', wallTop: '#9a9583', water: '#2c4a6a', bg: '#3e3b30' },
  highlands: { floor: '#a7d982', floor2: '#97cc74', wall: '#8a8f98', wallTop: '#b4bac2', water: '#2a2f45', bg: '#7cc7ec' },
  grove: { floor: '#3f3a56', floor2: '#4a4462', wall: '#221a30', wallTop: '#3b2150', water: '#1a1026', bg: '#120c1c' },
  isle: { floor: '#f1dc9c', floor2: '#8fd17a', wall: '#2b9fd0', wallTop: '#2b9fd0', water: '#3bb5e3', bg: '#2b9fd0' },
  grove_healed: { floor: '#7fcf8a', floor2: '#72c27e', wall: '#2f6b48', wallTop: '#4fa95a', water: '#2b6f9a', bg: '#1f4a36' },
};

/** Paint an area's terrain into one canvas texture. */
export function makeAreaGround(scene: Phaser.Scene, area: AreaDef, healed = false): string {
  const theme = area.theme === 'grove' && healed ? 'grove_healed' : area.theme;
  const key = `ground_${theme}`;
  if (scene.textures.exists(key)) return key;
  const c = THEMES[theme];
  const W = area.w * TILE;
  const H = area.h * TILE;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx: Ctx = tex.getContext();
  const rnd = seeded(area.w * 31 + area.h);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  if (area.theme === 'highlands') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 18; i++) ellipse(ctx, rnd() * W, rnd() * H, 30 + rnd() * 30, 10, 'rgba(255,255,255,0.6)');
  }
  for (let ty = 0; ty < area.h; ty++) {
    for (let tx = 0; tx < area.w; tx++) {
      const ch = area.rows[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#' && area.theme === 'isle') {
        ctx.fillStyle = c.water;
        ctx.fillRect(x, y, TILE, TILE);
        continue;
      }
      if (ch === '#') {
        const below = ty + 1 < area.h && area.rows[ty + 1][tx] !== '#';
        ctx.fillStyle = c.wall;
        ctx.fillRect(x, y, TILE, TILE);
        if (below) {
          ctx.fillStyle = c.wallTop;
          ctx.fillRect(x, y + TILE - 10, TILE, 10);
          ctx.fillStyle = shade(c.wallTop, -0.25);
          ctx.fillRect(x, y + TILE - 3, TILE, 3);
        }
        if (area.theme === 'temple') {
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
        continue;
      }
      if (ch === '~') {
        ctx.fillStyle = c.water;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + rnd() * 20, y + rnd() * 26, 8, 2);
        continue;
      }
      if (ch === ' ') continue;
      ctx.fillStyle = ch === ',' || (area.theme !== 'isle' && (tx * 7 + ty * 3) % 5 === 0) ? c.floor2 : c.floor;
      ctx.fillRect(x, y, TILE, TILE);
      if (area.theme === 'temple') {
        ctx.strokeStyle = 'rgba(90,80,60,0.25)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (rnd() < 0.35) {
        ctx.fillStyle = area.theme === 'highlands' || theme === 'grove_healed' ? 'rgba(40,110,40,0.35)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + rnd() * 26, y + rnd() * 26, 2, 5);
      }
    }
  }
  tex.refresh();
  return key;
}

import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../core/config';
import { isLakeWater, isLand } from '../core/layout';
import { SKIN, canvasTex, circle, drawPerson, ellipse, outlineTexture, rrect, shade, type Ctx } from './art';

/**
 * Art for the newer systems: Coral Isle, cooking, decorations, festivals,
 * seasonal creatures and weather particles. Same procedural style as art.ts.
 */
export function makeExtraTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('cook_pot')) return;
  makeCreatures(scene);
  makeDecor(scene);
  makeVillage(scene);
  makeIsle(scene);
  makeWeather(scene);
  makeSurprises(scene);
}

/** Surprise events and memory shards. */
function makeSurprises(scene: Phaser.Scene): void {
  canvasTex(scene, 'dig_spot', 34, 20, (ctx) => {
    ellipse(ctx, 17, 13, 15, 6, '#8a5a32');
    ellipse(ctx, 17, 12, 12, 4.5, '#a5743f');
    ctx.strokeStyle = '#5a3a24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(24, 12);
    ctx.moveTo(17, 7);
    ctx.lineTo(17, 17);
    ctx.stroke();
    [[6, 4], [28, 5], [24, 2]].forEach(([x, y]) => circle(ctx, x, y, 1.6, '#fff6b0'));
  });
  canvasTex(scene, 'fallen_star', 30, 30, (ctx) => {
    const g = ctx.createRadialGradient(15, 15, 1, 15, 15, 14);
    g.addColorStop(0, 'rgba(255,250,210,0.95)');
    g.addColorStop(1, 'rgba(255,216,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 30, 30);
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4 : 10;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(15 + Math.cos(a) * r, 15 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    circle(ctx, 13, 13, 1.5, '#ffffff');
  });
  canvasTex(scene, 'lost_item', 24, 22, (ctx) => {
    rrect(ctx, 3, 7, 18, 13, 3, '#c88a52', '#6d4a24');
    rrect(ctx, 6, 3, 12, 6, 3, '#a5743f');
    rrect(ctx, 10.5, 7, 3, 13, 1, '#ff7aa8');
    circle(ctx, 12, 12, 2.4, '#ffd84a');
  });
  canvasTex(scene, 'memory_shard', 22, 34, (ctx) => {
    const glow = ctx.createRadialGradient(11, 18, 1, 11, 18, 11);
    glow.addColorStop(0, 'rgba(200,170,255,0.8)');
    glow.addColorStop(1, 'rgba(160,120,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 6, 22, 24);
    const g = ctx.createLinearGradient(6, 4, 16, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#c9b3ff');
    g.addColorStop(1, '#7b5fd6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(11, 2);
    ctx.lineTo(17, 16);
    ctx.lineTo(11, 31);
    ctx.lineTo(5, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11, 3);
    ctx.lineTo(11, 30);
    ctx.stroke();
  });
  canvasTex(scene, 'merchant_cart', 64, 50, (ctx) => {
    rrect(ctx, 4, 20, 50, 18, 3, '#b07a45', '#6d4a24');
    [[12, 18, '#ff7aa8'], [24, 17, '#ffd84a'], [36, 18, '#7ad66a'], [46, 17, '#5aa8ff']].forEach(([x, y, c]) => circle(ctx, x as number, y as number, 4, c as string));
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#fff8ea' : '#7b5fd6';
      ctx.fillRect(4 + i * 10, 2, 10, 9);
    }
    rrect(ctx, 5, 9, 2, 12, 1, '#5a3a24');
    rrect(ctx, 51, 9, 2, 12, 1, '#5a3a24');
    circle(ctx, 16, 42, 7, '#5a3a24');
    circle(ctx, 16, 42, 3, '#c88a52');
    circle(ctx, 44, 42, 7, '#5a3a24');
    circle(ctx, 44, 42, 3, '#c88a52');
    rrect(ctx, 54, 26, 10, 3, 1, '#6d4a24');
  });
  canvasTex(scene, 'npc_kiko', 28, 40, (ctx) =>
    drawPerson(ctx, { skin: SKIN[1], hair: '#f2c14e', outfit: '#7b5fd6', hat: 'wide', backpack: true }),
  );
  outlineTexture(scene, 'npc_kiko');
}

const eyes = (ctx: Ctx, pts: [number, number][], r = 1.4) =>
  pts.forEach(([x, y]) => {
    circle(ctx, x, y, r, '#2b2135');
    circle(ctx, x + r * 0.35, y - r * 0.35, r * 0.4, '#ffffff');
  });

function makeCreatures(scene: Phaser.Scene): void {
  canvasTex(scene, 'shellcrab', 32, 24, (ctx) => {
    // legs
    ctx.strokeStyle = '#c4452c';
    ctx.lineWidth = 1.6;
    for (const dx of [-7, -3, 3, 7]) {
      ctx.beginPath();
      ctx.moveTo(16 + dx, 17);
      ctx.lineTo(16 + dx * 1.5, 22);
      ctx.stroke();
    }
    // claws
    circle(ctx, 4, 11, 4, '#ff6a4a');
    circle(ctx, 28, 11, 4, '#ff6a4a');
    ctx.fillStyle = '#ffd9c8';
    ctx.fillRect(3, 9, 3, 1.5);
    ctx.fillRect(27, 9, 3, 1.5);
    // spiral shell on its back
    ellipse(ctx, 16, 15, 9, 6, '#ff7a5a');
    ellipse(ctx, 16, 10, 7, 6, '#f6d3a8');
    ctx.strokeStyle = '#c99a6a';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(16, 10, 4, 0, Math.PI * 1.6);
    ctx.arc(16, 10, 2, Math.PI * 1.6, Math.PI * 3);
    ctx.stroke();
    // eye stalks
    rrect(ctx, 12, 12, 1.4, 4, 0.6, '#c4452c');
    rrect(ctx, 18.6, 12, 1.4, 4, 0.6, '#c4452c');
    eyes(ctx, [[12.7, 12], [19.3, 12]], 1.6);
    ellipse(ctx, 16, 18.5, 2.2, 1, '#2b2135');
  });
  canvasTex(scene, 'seapup', 36, 26, (ctx) => {
    ellipse(ctx, 6, 20, 5, 2.5, '#8f9fb0');
    const body = ctx.createLinearGradient(0, 8, 0, 24);
    body.addColorStop(0, '#dfe8f2');
    body.addColorStop(1, '#a9b8c8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(16, 17, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, 27, 11, 7, '#e6eef6');
    ellipse(ctx, 31, 13.5, 3, 2, '#ffffff');
    circle(ctx, 33.4, 13, 1.1, '#2b2135');
    eyes(ctx, [[26, 9.5], [30, 9.5]], 1.5);
    ellipse(ctx, 25, 13, 1.6, 1, 'rgba(255,130,160,0.6)');
    ellipse(ctx, 20, 22, 4, 2, '#8f9fb0');
    [[12, 15], [17, 13], [9, 18]].forEach(([x, y]) => circle(ctx, x, y, 1, '#b9c6d4'));
  });
  canvasTex(scene, 'petalbee', 26, 24, (ctx) => {
    ellipse(ctx, 8, 7, 6, 4, 'rgba(255,220,240,0.85)');
    ellipse(ctx, 18, 6, 6, 4, 'rgba(255,220,240,0.85)');
    const g = ctx.createLinearGradient(5, 0, 21, 0);
    g.addColorStop(0, '#ffd84a');
    g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(13, 15, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a24';
    ctx.fillRect(9, 10, 2.2, 11);
    ctx.fillRect(14.5, 9.5, 2.2, 11);
    circle(ctx, 21, 13, 4.5, '#ffe27a');
    eyes(ctx, [[22.5, 12.2]], 1.3);
    ellipse(ctx, 21, 15.5, 1.4, 0.8, 'rgba(255,120,160,0.7)');
    // flower crown
    [[18, 8], [21, 7.5], [24, 8.5]].forEach(([x, y], i) => circle(ctx, x, y, 1.6, ['#ff7aa8', '#ffffff', '#ff9ad6'][i]));
  });
  canvasTex(scene, 'snowkit', 32, 28, (ctx) => {
    const tail = ctx.createRadialGradient(5, 12, 1, 5, 12, 8);
    tail.addColorStop(0, '#ffffff');
    tail.addColorStop(1, '#bfe4ff');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.ellipse(6, 14, 6, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, 16, 19, 9, 6, '#f4f9ff');
    rrect(ctx, 10, 22, 3, 5, 1, '#d7e6f5');
    rrect(ctx, 19, 22, 3, 5, 1, '#d7e6f5');
    circle(ctx, 24, 12, 7, '#ffffff');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(18, 9);
    ctx.lineTo(19, 2);
    ctx.lineTo(23, 6);
    ctx.moveTo(25, 6);
    ctx.lineTo(29, 2);
    ctx.lineTo(30, 9);
    ctx.fill();
    ctx.fillStyle = '#9fd4ff';
    ctx.beginPath();
    ctx.moveTo(19.5, 7);
    ctx.lineTo(20, 4);
    ctx.lineTo(22, 6);
    ctx.fill();
    eyes(ctx, [[21.5, 11.5], [26.5, 11.5]], 1.5);
    ellipse(ctx, 24, 15, 1.2, 0.8, '#ff9ab8');
    // frosty sparkles
    [[11, 15], [15, 22], [7, 9]].forEach(([x, y]) => circle(ctx, x, y, 0.9, '#9fd4ff'));
  });
}

function makeDecor(scene: Phaser.Scene): void {
  canvasTex(scene, 'decor_spot', 26, 14, (ctx) => {
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(13, 7, 11, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  canvasTex(scene, 'decor_flower_pot', 20, 26, (ctx) => {
    ellipse(ctx, 10, 9, 8, 6, '#4fae5e');
    [[6, 7, '#ff7aa8'], [12, 5, '#ffd84a'], [14, 10, '#ffffff'], [8, 11, '#ff9ad6']].forEach(([x, y, c]) => circle(ctx, x as number, y as number, 2, c as string));
    ctx.fillStyle = '#c8673a';
    ctx.beginPath();
    ctx.moveTo(3, 14);
    ctx.lineTo(17, 14);
    ctx.lineTo(15, 25);
    ctx.lineTo(5, 25);
    ctx.fill();
    rrect(ctx, 2, 13, 16, 3, 1, '#e08050');
  });
  canvasTex(scene, 'decor_hedge', 34, 24, (ctx) => {
    ellipse(ctx, 17, 15, 16, 9, '#3f8f3f');
    circle(ctx, 9, 11, 7, '#4fae5e');
    circle(ctx, 18, 9, 8, '#5fbf5f');
    circle(ctx, 26, 12, 6, '#4fae5e');
    [[10, 9], [20, 7], [26, 11]].forEach(([x, y]) => circle(ctx, x, y, 1.2, '#ff7aa8'));
  });
  canvasTex(scene, 'decor_birdhouse', 22, 40, (ctx) => {
    rrect(ctx, 10, 18, 3, 22, 1, '#7a5230');
    rrect(ctx, 3, 8, 16, 13, 2, '#ffd36a', '#a8742a');
    ctx.fillStyle = '#c4452c';
    ctx.beginPath();
    ctx.moveTo(1, 9);
    ctx.lineTo(11, 1);
    ctx.lineTo(21, 9);
    ctx.fill();
    circle(ctx, 11, 14, 2.5, '#5a3a24');
    circle(ctx, 16, 6, 2.5, '#5aa8ff');
    circle(ctx, 17, 5.5, 0.7, '#2b2135');
  });
  canvasTex(scene, 'decor_bench', 40, 24, (ctx) => {
    rrect(ctx, 4, 16, 3, 8, 1, '#5a3a24');
    rrect(ctx, 33, 16, 3, 8, 1, '#5a3a24');
    rrect(ctx, 2, 4, 36, 4, 1.5, '#b07a45');
    rrect(ctx, 2, 9, 36, 3, 1.5, '#b07a45');
    rrect(ctx, 1, 14, 38, 4, 1.5, '#d9a35c');
  });
  canvasTex(scene, 'decor_lamp_post', 16, 48, (ctx) => {
    rrect(ctx, 6.5, 12, 3, 34, 1, '#3b3f4a');
    rrect(ctx, 3, 44, 10, 4, 1, '#3b3f4a');
    const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 7);
    g.addColorStop(0, '#fffbd0');
    g.addColorStop(1, '#ffc94a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(2, 2, 12, 12, 3);
    ctx.fill();
    ctx.strokeStyle = '#3b3f4a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  canvasTex(scene, 'decor_statue', 30, 48, (ctx) => {
    rrect(ctx, 3, 36, 24, 12, 2, '#9a9583', '#6d6858');
    ellipse(ctx, 15, 26, 8, 10, '#c9c4b2');
    circle(ctx, 15, 13, 6, '#d6d1bf');
    ctx.fillStyle = '#d6d1bf';
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(11, 3);
    ctx.lineTo(14, 8);
    ctx.moveTo(16, 8);
    ctx.lineTo(19, 3);
    ctx.lineTo(20, 10);
    ctx.fill();
    circle(ctx, 13, 13, 0.9, '#6d6858');
    circle(ctx, 17, 13, 0.9, '#6d6858');
  });
  canvasTex(scene, 'decor_fountain', 56, 44, (ctx) => {
    ellipse(ctx, 28, 34, 26, 9, '#9aa3ae');
    ellipse(ctx, 28, 32, 22, 7, '#5ec8f0');
    ellipse(ctx, 26, 31, 8, 2, 'rgba(255,255,255,0.6)');
    rrect(ctx, 24, 12, 8, 20, 2, '#b4bac2');
    ellipse(ctx, 28, 13, 11, 4, '#9aa3ae');
    ellipse(ctx, 28, 12, 8, 2.5, '#5ec8f0');
    ctx.strokeStyle = 'rgba(160,230,255,0.9)';
    ctx.lineWidth = 2;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(28, 6);
      ctx.quadraticCurveTo(28 + dir * 10, -2, 28 + dir * 16, 28);
      ctx.stroke();
    }
    circle(ctx, 28, 5, 2.5, '#bff3ff');
  });
  canvasTex(scene, 'decor_blossom_tree', 44, 60, (ctx) => {
    rrect(ctx, 19, 30, 6, 30, 2, '#7a5230');
    [[22, 20, 15], [12, 24, 10], [32, 24, 10], [22, 10, 10]].forEach(([x, y, r]) => circle(ctx, x, y, r, '#ffb7d5'));
    [[16, 16], [28, 14], [22, 26], [11, 24], [34, 25], [24, 6]].forEach(([x, y]) => circle(ctx, x, y, 2.2, '#ffffff'));
  });
  canvasTex(scene, 'decor_paper_lantern', 22, 44, (ctx) => {
    rrect(ctx, 10, 14, 2, 30, 1, '#5e3b1e');
    rrect(ctx, 4, 0, 14, 4, 1, '#5e3b1e');
    const g = ctx.createRadialGradient(11, 12, 1, 11, 12, 10);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(1, '#ff6a4a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(11, 12, 9, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,40,30,0.5)';
    for (const x of [6, 11, 16]) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x, 20);
      ctx.stroke();
    }
  });
  canvasTex(scene, 'decor_pumpkin', 30, 24, (ctx) => {
    rrect(ctx, 13.5, 0, 3, 6, 1, '#4f7a2a');
    for (const [x, rx] of [[9, 7], [21, 7], [15, 8]] as const) ellipse(ctx, x, 15, rx, 8.5, x === 15 ? '#ff9a2a' : '#f08a1c');
    ctx.fillStyle = '#5a2a10';
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(12, 9);
    ctx.lineTo(14, 12);
    ctx.moveTo(16, 12);
    ctx.lineTo(18, 9);
    ctx.lineTo(20, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(10, 16);
    ctx.quadraticCurveTo(15, 21, 20, 16);
    ctx.quadraticCurveTo(15, 18, 10, 16);
    ctx.fill();
  });
  canvasTex(scene, 'decor_snowman', 28, 44, (ctx) => {
    circle(ctx, 14, 33, 11, '#ffffff');
    circle(ctx, 14, 16, 8, '#f4f9ff');
    rrect(ctx, 8, 2, 12, 7, 1.5, '#2b2135');
    rrect(ctx, 5, 8, 18, 2.5, 1, '#2b2135');
    rrect(ctx, 7, 22, 14, 3, 1.5, '#e8473a');
    rrect(ctx, 16, 22, 3, 8, 1.5, '#e8473a');
    eyes(ctx, [[11.5, 14], [16.5, 14]], 1.2);
    ctx.fillStyle = '#ff9a2a';
    ctx.beginPath();
    ctx.moveTo(14, 16);
    ctx.lineTo(20, 17.5);
    ctx.lineTo(14, 18.5);
    ctx.fill();
    [30, 35, 40].forEach((y) => circle(ctx, 14, y, 1.2, '#2b2135'));
  });
}

function makeVillage(scene: Phaser.Scene): void {
  canvasTex(scene, 'cook_pot', 34, 34, (ctx) => {
    // stones and fire
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI;
      ellipse(ctx, 17 + Math.cos(a) * 13, 29 + Math.sin(a) * 3, 3.5, 2.5, '#8a8f98');
    }
    ctx.fillStyle = '#ff9a2a';
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.quadraticCurveTo(17, 18, 24, 30);
    ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(13, 30);
    ctx.quadraticCurveTo(17, 22, 21, 30);
    ctx.fill();
    // pot
    ellipse(ctx, 17, 19, 12, 9, '#3b3f4a');
    ellipse(ctx, 17, 13, 12, 3.5, '#545a68');
    ellipse(ctx, 17, 13, 10, 2.5, '#d98a3a');
    ellipse(ctx, 14, 12.6, 3, 1, '#ffd36a');
    rrect(ctx, 4, 12, 3, 4, 1, '#3b3f4a');
    rrect(ctx, 27, 12, 3, 4, 1, '#3b3f4a');
    // steam
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    for (const x of [13, 20]) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.quadraticCurveTo(x - 3, 6, x, 3);
      ctx.quadraticCurveTo(x + 3, 0, x, -2);
      ctx.stroke();
    }
  });
  canvasTex(scene, 'festival_stand', 60, 56, (ctx) => {
    rrect(ctx, 4, 18, 4, 38, 1, '#7a5230');
    rrect(ctx, 52, 18, 4, 38, 1, '#7a5230');
    // striped awning
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff6a8a';
      ctx.beginPath();
      ctx.moveTo(i * 10, 18);
      ctx.lineTo(i * 10 + 10, 18);
      ctx.lineTo(i * 10 + 12, 6);
      ctx.lineTo(i * 10 - 2, 6);
      ctx.fill();
    }
    for (let i = 0; i < 6; i++) ellipse(ctx, i * 10 + 5, 19, 5, 3, i % 2 ? '#ffffff' : '#ff6a8a');
    rrect(ctx, 2, 38, 56, 10, 2, '#d9a35c', '#8a5a32');
    [[12, 35, '#ffd84a'], [24, 34, '#ff7aa8'], [36, 35, '#7ad66a'], [47, 34, '#5aa8ff']].forEach(([x, y, c]) => circle(ctx, x as number, y as number, 4, c as string));
  });
  canvasTex(scene, 'sky_lantern', 14, 18, (ctx) => {
    const g = ctx.createRadialGradient(7, 8, 1, 7, 8, 8);
    g.addColorStop(0, '#fff6c0');
    g.addColorStop(1, '#ff9a4a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(12, 2);
    ctx.lineTo(10, 15);
    ctx.lineTo(4, 15);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 7, 15.5, 3, 1.2, '#ffd84a');
  });
  canvasTex(scene, 'boat_broken', 70, 30, (ctx) => {
    ctx.fillStyle = '#8a5a32';
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(68, 8);
    ctx.lineTo(58, 26);
    ctx.lineTo(12, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a3a24';
    ctx.fillRect(4, 8, 62, 3);
    // missing planks
    ctx.fillStyle = '#2b9fd0';
    ctx.fillRect(24, 14, 8, 8);
    ctx.fillRect(40, 16, 10, 6);
    rrect(ctx, 30, 0, 3, 10, 1, '#5a3a24');
  });
  canvasTex(scene, 'boat', 70, 64, (ctx) => {
    // sail
    ctx.fillStyle = '#fff8ea';
    ctx.beginPath();
    ctx.moveTo(36, 2);
    ctx.lineTo(36, 40);
    ctx.lineTo(62, 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7aa8';
    ctx.beginPath();
    ctx.moveTo(36, 30);
    ctx.lineTo(36, 40);
    ctx.lineTo(62, 40);
    ctx.lineTo(53, 30);
    ctx.closePath();
    ctx.fill();
    rrect(ctx, 33, 0, 3, 44, 1, '#5a3a24');
    const hull = ctx.createLinearGradient(0, 42, 0, 62);
    hull.addColorStop(0, '#c88a52');
    hull.addColorStop(1, '#8a5a32');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(2, 42);
    ctx.lineTo(68, 42);
    ctx.lineTo(58, 60);
    ctx.lineTo(12, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5aa8ff';
    ctx.fillRect(6, 46, 58, 3);
  });
  canvasTex(scene, 'race_flag', 24, 40, (ctx) => {
    rrect(ctx, 3, 4, 2.5, 36, 1, '#5a3a24');
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#2b2135' : '#ffffff';
      ctx.fillRect(5.5 + x * 4.5, 4 + y * 4.5, 4.5, 4.5);
    }
  });
}

function makeIsle(scene: Phaser.Scene): void {
  const palm = (key: string, coconuts: boolean) =>
    canvasTex(scene, key, 48, 64, (ctx) => {
      ctx.strokeStyle = '#a5743f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(22, 64);
      ctx.quadraticCurveTo(18, 40, 26, 18);
      ctx.stroke();
      ctx.strokeStyle = '#8a5a32';
      ctx.lineWidth = 1;
      for (let y = 26; y < 62; y += 6) {
        ctx.beginPath();
        ctx.moveTo(18, y);
        ctx.lineTo(25, y - 1);
        ctx.stroke();
      }
      ctx.fillStyle = '#3f9a4e';
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI + (k / 5) * Math.PI;
        ctx.beginPath();
        ctx.ellipse(26 + Math.cos(a) * 11, 18 + Math.sin(a) * 6 + 4, 13, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      if (coconuts) [[22, 21], [28, 22], [25, 25]].forEach(([x, y]) => circle(ctx, x, y, 3.2, '#7a5230'));
    });
  palm('palm', true);
  palm('palm_empty', false);
  canvasTex(scene, 'coral_node', 30, 30, (ctx) => {
    const branch = (x: number, h: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, 29);
      ctx.lineTo(x, 29 - h);
      ctx.moveTo(x, 29 - h * 0.5);
      ctx.lineTo(x - 5, 29 - h * 0.8);
      ctx.moveTo(x, 29 - h * 0.4);
      ctx.lineTo(x + 5, 29 - h * 0.75);
      ctx.stroke();
    };
    branch(9, 18, '#ff7a8a');
    branch(20, 24, '#ff9a6a');
    branch(15, 14, '#ff6ab0');
  });
  canvasTex(scene, 'coral_empty', 22, 10, (ctx) => {
    ellipse(ctx, 11, 6, 9, 3.5, '#e8c890');
    circle(ctx, 8, 5, 1.5, '#ff9a8a');
  });
  canvasTex(scene, 'shell_node', 24, 16, (ctx) => {
    ellipse(ctx, 12, 12, 11, 3.5, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = '#ffd9e6';
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(10, 2);
    ctx.lineTo(16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8a0b8';
    ctx.lineWidth = 0.8;
    for (const x of [7, 10, 13]) {
      ctx.beginPath();
      ctx.moveTo(10, 3);
      ctx.lineTo(x, 12);
      ctx.stroke();
    }
    circle(ctx, 19, 11, 3, '#bfe4ff');
  });
  canvasTex(scene, 'shell_empty', 16, 8, (ctx) => ellipse(ctx, 8, 5, 6, 2, 'rgba(0,0,0,0.1)'));
  const reef = (key: string, alive: boolean) =>
    canvasTex(scene, key, 36, 24, (ctx) => {
      ellipse(ctx, 18, 18, 16, 5, alive ? 'rgba(60,180,200,0.6)' : 'rgba(150,160,170,0.5)');
      const cols = alive ? ['#ff6ab0', '#ffd84a', '#ff9a6a', '#7ad6ff'] : ['#e8e4dc', '#d6d1c4', '#ece8e0', '#cfc9bc'];
      [[8, 12], [15, 16], [22, 10], [29, 14]].forEach(([x, h], i) => {
        ctx.strokeStyle = cols[i];
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, 19);
        ctx.lineTo(x, 19 - h);
        ctx.moveTo(x, 19 - h * 0.5);
        ctx.lineTo(x + 3, 19 - h * 0.8);
        ctx.stroke();
      });
      if (alive) [[6, 6], [25, 4]].forEach(([x, y]) => ellipse(ctx, x, y, 3, 1.8, '#ffb84a'));
    });
  reef('reef_dead', false);
  reef('reef_alive', true);
  canvasTex(scene, 'pier', 40, 30, (ctx) => {
    rrect(ctx, 0, 6, 40, 14, 2, '#c88a52', '#8a5a32');
    for (let x = 8; x < 40; x += 8) {
      ctx.strokeStyle = '#8a5a32';
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, 20);
      ctx.stroke();
    }
    rrect(ctx, 3, 18, 3, 12, 1, '#5a3a24');
    rrect(ctx, 34, 18, 3, 12, 1, '#5a3a24');
  });
}

function makeWeather(scene: Phaser.Scene): void {
  canvasTex(scene, 'raindrop', 3, 14, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, 'rgba(200,230,255,0)');
    g.addColorStop(1, 'rgba(200,230,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0.5, 0, 2, 14);
  });
  canvasTex(scene, 'snowflake', 8, 8, (ctx) => {
    circle(ctx, 4, 4, 3, 'rgba(255,255,255,0.95)');
    circle(ctx, 4, 4, 1.5, '#ffffff');
  });
  canvasTex(scene, 'petal', 8, 6, (ctx) => ellipse(ctx, 4, 3, 3.5, 2, '#ffb7d5'));
  canvasTex(scene, 'leaf', 10, 8, (ctx) => {
    ctx.fillStyle = '#e8892f';
    ctx.beginPath();
    ctx.ellipse(5, 4, 4.5, 2.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a8541c';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(1.5, 2);
    ctx.lineTo(8.5, 6);
    ctx.stroke();
  });
  canvasTex(scene, 'fog', 128, 64, (ctx) => {
    const g = ctx.createRadialGradient(64, 32, 4, 64, 32, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.5);
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

/**
 * Season overlays for the island: snow on the land in winter, orange leaves over the forest in autumn.
 * Painted with the same soft blobs as the ground so the edges look natural.
 */
export function makeSeasonOverlays(scene: Phaser.Scene): void {
  const make = (key: string, color: string, include: (tx: number, ty: number) => boolean) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, WORLD_W, WORLD_H)!;
    const ctx = tex.getContext();
    ctx.fillStyle = color;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (!isLand(tx, ty) || isLakeWater(tx, ty) || !include(tx, ty)) continue;
        ctx.beginPath();
        ctx.arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, TILE * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    tex.refresh();
  };
  make('season_winter', '#f4f9ff', () => true);
  make('season_autumn', shade('#e8892f', 0), (tx, ty) => tx >= 30 && ty <= 21);
}

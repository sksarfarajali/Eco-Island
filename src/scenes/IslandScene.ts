import Phaser from 'phaser';
import { TILE, WORLD_H, WORLD_W } from '../core/config';
import { t } from '../core/i18n';
import { DOCK, LAKE, NODES, PLOTS, POI, STATIC_BLOCKERS, isWalkableGround, px, zoneAt } from '../core/layout';
import type { BuildingId, CreatureId, NpcId, ZoneId } from '../core/types';
import { RES } from './art';
import { decorFree, makeGround, seeded } from './ground';
import { PlayScene, img, type Blocker, type Interactable } from './PlayScene';

interface CreatureView {
  id: CreatureId;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  radius: number;
  target: { x: number; y: number };
  nextMove: number;
  water: boolean;
}

/** Creatures that live in the village sanctuary once bonded (or rescued to the village). */
const SANCTUARY_GUESTS: CreatureId[] = ['ripplet', 'mossprite', 'gleamwing', 'pebblepup', 'skyhare', 'thistlegoat', 'archowl', 'wispling'];

/** The hub island: Whisper Village, Emerald Forest and Moonlit Lake. */
export class IslandScene extends PlayScene {
  private nodeViews = new Map<string, Phaser.GameObjects.Image>();
  private plotViews = new Map<string, { base: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; produce: Phaser.GameObjects.Image[] }>();
  private npcViews = new Map<NpcId, { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; marker: Phaser.GameObjects.Image }>();
  private creatures = new Map<CreatureId, CreatureView>();
  private guests = new Map<CreatureId, Phaser.GameObjects.Image>();
  private decor: Record<string, Phaser.GameObjects.GameObject[]> = {};
  private staticBlockers: Blocker[] = [];
  private eggInLog!: Phaser.GameObjects.Image;
  private eggInNest!: Phaser.GameObjects.Image;
  private templeGate!: Phaser.GameObjects.Image;
  private templeRune!: Phaser.GameObjects.Image;
  private lakeBright!: Phaser.GameObjects.Image;
  private lakeTint!: Phaser.GameObjects.Ellipse;
  private corruptionTint!: Phaser.GameObjects.Rectangle;
  private buildGhost: Phaser.GameObjects.Image | null = null;
  private buildMode: BuildingId | null = null;
  private menuPan = 0;

  constructor() {
    super('island');
  }

  protected resetWorld(): void {
    this.nodeViews.clear();
    this.plotViews.clear();
    this.npcViews.clear();
    this.creatures.clear();
    this.guests.clear();
    this.decor = {};
    this.staticBlockers = [];
    this.buildMode = null;
    this.buildGhost = null;
  }

  protected worldSize() {
    return { w: WORLD_W, h: WORLD_H };
  }

  protected arrivalPoint(): { x: number; y: number } {
    const below = (p: { x: number; y: number }, dy = 46) => ({ x: p.x, y: p.y + dy });
    switch (this.arrive) {
      case 'caveEntrance':
        return below(POI.caveEntrance);
      case 'templeGate':
        return below(POI.templeGate, 56);
      case 'highlandsPath':
        return { x: POI.highlandsPath.x - 34, y: POI.highlandsPath.y + 8 };
      case 'village':
      case 'spawn':
        return POI.start;
      case 'forest':
        return POI.forestEntry;
      case 'lake':
        return POI.lakeShore;
      default: {
        const pos = this.game_.state.player.position;
        return pos.area === 'island' && isWalkableGround(pos.x, pos.y) ? pos : POI.start;
      }
    }
  }

  protected groundWalkable(x: number, y: number): boolean {
    return isWalkableGround(x, y);
  }

  protected baseDarkness(): number {
    return this.game_.darkness();
  }

  protected checkZone(): void {
    if (this.mode !== 'play') return;
    const zone = zoneAt(this.player.x, this.player.y);
    if (zone !== this.zone || this.game_.state.player.position.area !== 'island') {
      this.zone = zone;
      this.game_.state.player.position.area = 'island';
      this.game_.enterZone(zone);
      this.hooks.zoneChanged(zone);
    }
  }

  protected menuCamera(dt: number): void {
    this.menuPan += dt * 0.08;
    this.cameras.main.centerOn(POI.plaza.x + 900 + Math.cos(this.menuPan) * 700, POI.plaza.y - 200 + Math.sin(this.menuPan * 1.3) * 300);
  }

  // ------------------------------------------------------------------ creation

  protected buildWorld(): void {
    makeGround(this);
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-10000);
    this.add.image(px(LAKE.cx), px(LAKE.cy), 'lake_dim').setDepth(-9000);
    this.lakeBright = this.add.image(px(LAKE.cx), px(LAKE.cy), 'lake_bright').setDepth(-8999).setAlpha(0);
    this.lakeTint = this.add
      .ellipse(px(LAKE.cx), px(LAKE.cy), (LAKE.rx * 2 + 1) * TILE, (LAKE.ry * 2 + 1) * TILE, 0x40205a, 0)
      .setDepth(-8998);
    this.add.image(DOCK.x0 * TILE, DOCK.y0 * TILE, 'dock').setOrigin(0).setDepth(-8000);
    this.corruptionTint = this.add.rectangle(30 * TILE, 0, 34 * TILE, 22 * TILE, 0x40205a, 0).setOrigin(0).setDepth(-7000);
    this.createStatic();
    this.createNodes();
    this.createPlots();
    this.createNpcs();
    this.createCreatures();
    if (this.mode === 'menu') this.cameras.main.centerOn(POI.plaza.x, POI.plaza.y);
  }

  private place(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return img(this, x, y, key).setDepth(y);
  }

  private createStatic(): void {
    const place = (x: number, y: number, key: string) => this.place(x, y, key);
    place(POI.well.x, POI.well.y + 14, 'well');
    place(POI.shop.x, POI.shop.y + 16, 'shop');
    place(POI.workshop.x, POI.workshop.y + 22, 'workshop');
    this.templeGate = place(POI.templeGate.x, POI.templeGate.y + 18, 'temple_gate');
    this.templeRune = place(POI.templeGate.x, POI.templeGate.y + 18, 'temple_rune').setDepth(POI.templeGate.y + 19).setAlpha(0);
    place(POI.caveEntrance.x, POI.caveEntrance.y + 20, 'cave_entrance');
    place(POI.highlandsPath.x + 14, POI.highlandsPath.y + 12, 'mountain_path');
    const ripple = img(this, POI.dockEnd.x + 26, POI.dockEnd.y + 4, 'fishing_spot', 0.5).setDepth(-7900);
    if (!this.settings.reducedMotion) this.tweens.add({ targets: ripple, scale: (1.3 / RES), alpha: 0.4, duration: 1200, yoyo: true, repeat: -1 });
    place(POI.egg.x + 2, POI.egg.y + 12, 'log');
    this.eggInLog = place(POI.egg.x - 6, POI.egg.y + 6, 'egg').setDepth(POI.egg.y + 13);
    place(POI.nest.x, POI.nest.y + 8, 'nest');
    this.eggInNest = place(POI.nest.x, POI.nest.y + 2, 'egg').setDepth(POI.nest.y + 9);
    place(POI.den.x, POI.den.y + 12, 'den');

    this.decor.lunaTent = [place(POI.lunaTent.x, POI.lunaTent.y + 10, 'tent_luna')];
    this.decor.zedCamp = [place(POI.zedCamp.x + 40, POI.zedCamp.y + 6, 'tent_zed')];

    // dense border trees frame the forest (decorative, but solid)
    const rnd = seeded(11);
    for (let i = 0; i < 70; i++) {
      const tx = 30 + Math.floor(rnd() * 34);
      const ty = Math.floor(rnd() * 22);
      if (!decorFree(tx, ty) || !this.clearOf(tx, ty, 2.2)) continue;
      place(px(tx), px(ty) + 10, 'tree_border');
      this.staticBlockers.push({ kind: 'circle', x: px(tx), y: px(ty) + 4, r: 11 });
    }
    for (const b of STATIC_BLOCKERS) this.staticBlockers.push({ kind: 'rect', ...b });
    this.staticBlockers.push({ kind: 'rect', x: POI.lunaTent.x, y: POI.lunaTent.y, w: 60, h: 24 });

    // world-change layers (shown or hidden in sync)
    this.decor.forest_flowers = this.scatter(26, 21, (x, y, i) => place(x, y, `flower${i % 4}`));
    this.decor.forest_lush = this.scatter(18, 22, (x, y) => place(x, y + 8, 'bush_empty'));
    this.decor.forest_ancient = [place(px(59.5), px(21) + 8, 'ancient_tree')];
    this.decor.butterflies = Array.from({ length: 6 }, (_, i) => {
      const b = img(this, POI.plaza.x + Math.cos(i) * 140, POI.plaza.y + Math.sin(i * 2) * 90, 'butterfly', 0.5).setDepth(5000);
      if (!this.settings.reducedMotion) this.tweens.add({ targets: b, x: b.x + 40 - i * 12, y: b.y - 30, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return b;
    });
    this.decor.lilypads = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      return img(this, px(LAKE.cx) + Math.cos(a) * LAKE.rx * TILE * 0.65, px(LAKE.cy) + Math.sin(a) * LAKE.ry * TILE * 0.6, 'lilypad', 0.5).setDepth(-8500);
    });
    const bunting = this.add.graphics().setDepth(px(21));
    bunting.lineStyle(1.5, 0x8a5a32);
    const flags: Phaser.GameObjects.GameObject[] = [bunting];
    const colors = [0xff7aa8, 0xffd84a, 0x7ad66a, 0x5aa8ff];
    for (const [x0, y0, x1, y1] of [[px(12), px(21), px(21), px(21)], [px(12), px(28), px(21), px(28)]]) {
      bunting.lineBetween(x0, y0, x1, y1);
      for (let k = 0; k <= 8; k++) flags.push(img(this, x0 + ((x1 - x0) * k) / 8, y0 - 1, 'flag', 0).setTint(colors[k % 4]).setDepth(y0 + 1));
    }
    this.decor.bunting = flags;
    this.decor.lanterns = [[12, 22], [21, 22], [12, 27], [21, 27], [16, 20], [16, 29]].map(([x, y]) => place(px(x), px(y), 'lantern'));
    this.decor.wellFlowers = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return place(POI.well.x + Math.cos(a) * 34, POI.well.y + 10 + Math.sin(a) * 22, `flower${i % 4}`);
    });
    // after the healing ending, flowers bloom all over the village
    const rnd2 = seeded(5);
    this.decor.radiant = Array.from({ length: 40 }, (_, i) => {
      for (let k = 0; k < 20; k++) {
        const tx = 4 + Math.floor(rnd2() * 25);
        const ty = 12 + Math.floor(rnd2() * 26);
        if (decorFree(tx, ty) && this.clearOf(tx, ty, 1.3)) return place(px(tx), px(ty), `flower${i % 4}`);
      }
      return place(POI.plaza.x, POI.plaza.y, `flower${i % 4}`);
    });
    this.decor.corruption = this.scatter(24, 31, (x, y) => place(x, y, 'dark_plant'));
    this.decor.lakeCorruption = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      return place(px(LAKE.cx) + Math.cos(a) * (LAKE.rx + 1.1) * TILE, px(LAKE.cy) + Math.sin(a) * (LAKE.ry + 1) * TILE, 'dark_plant');
    });
    this.decor.wisps = Array.from({ length: 9 }, (_, i) => {
      const w = img(this, px(34 + i * 3), px(5 + (i % 4) * 4), 'wisp', 0.5).setDepth(6000);
      if (!this.settings.reducedMotion) this.tweens.add({ targets: w, y: w.y - 24, x: w.x + 18, duration: 2600 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return w;
    });
  }

  private clearOf(tx: number, ty: number, dist: number): boolean {
    const x = px(tx);
    const y = px(ty);
    const near = (ox: number, oy: number) => Math.hypot(ox - x, oy - y) < dist * TILE;
    if (NODES.some((n) => near(n.x, n.y))) return false;
    if (Object.values(POI).some((p) => near(p.x, p.y))) return false;
    if (PLOTS.some((p) => near(p.x, p.y))) return false;
    if (ty >= 11 && ty <= 14 && tx <= 46 && tx >= 30) return false;
    if (tx >= 44 && tx <= 48 && ty <= 8) return false;
    return true;
  }

  private scatter(count: number, seed: number, make: (x: number, y: number, i: number) => Phaser.GameObjects.Image): Phaser.GameObjects.Image[] {
    const rnd = seeded(seed);
    const out: Phaser.GameObjects.Image[] = [];
    for (let tries = 0; out.length < count && tries < count * 30; tries++) {
      const tx = 30 + Math.floor(rnd() * 33);
      const ty = 1 + Math.floor(rnd() * 21);
      if (!decorFree(tx, ty) || !this.clearOf(tx, ty, 1.2)) continue;
      out.push(make(px(tx) + (rnd() - 0.5) * 16, px(ty) + (rnd() - 0.5) * 16, out.length));
    }
    return out;
  }

  private createNodes(): void {
    for (const n of NODES) {
      const v = img(this, n.x, n.y + (n.kind === 'debris' ? 6 : 10), 'tree');
      v.setDepth(n.kind === 'debris' ? -8400 : n.y + 10);
      this.nodeViews.set(n.id, v);
      if (n.kind === 'debris' && !this.settings.reducedMotion) {
        this.tweens.add({ targets: v, y: v.y + 2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }
  }

  private createPlots(): void {
    for (const p of PLOTS) {
      const base = img(this, p.x, p.y + 28, 'plot').setDepth(p.y + 28);
      const label = this.add
        .text(p.x, p.y - 40, '', { fontFamily: 'Nunito, system-ui, sans-serif', fontSize: '13px', color: '#ffffff', backgroundColor: '#2b2135aa', padding: { x: 6, y: 3 } })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(9000)
        .setVisible(false);
      const produce = Array.from({ length: 6 }, (_, i) =>
        img(this, p.x - 26 + (i % 3) * 26, p.y + 8 + Math.floor(i / 3) * 13, 'veggie').setDepth(p.y + 40).setVisible(false),
      );
      this.plotViews.set(p.id, { base, label, produce });
    }
  }

  private createNpcs(): void {
    for (const id of ['rocco', 'luna', 'zed', 'tilly'] as NpcId[]) {
      const shadow = img(this, 0, 0, 'shadow', 0.5);
      const sprite = img(this, 0, 0, `npc_${id}`);
      const marker = img(this, 0, 0, 'marker_quest').setDepth(9500);
      if (!this.settings.reducedMotion) this.tweens.add({ targets: marker, y: '-=4', duration: 600, yoyo: true, repeat: -1 });
      this.npcViews.set(id, { sprite, shadow, marker });
    }
  }

  private createCreatures(): void {
    const defs: [CreatureId, { x: number; y: number }, number, boolean][] = [
      ['glowfox', POI.den, 70, false],
      ['ripplet', POI.ripplet, 90, true],
      ['mossprite', POI.mossprite, 50, false],
      ['sunchick', POI.nest, 40, false],
    ];
    for (const [id, home, radius, water] of defs) {
      const shadow = img(this, home.x, home.y, 'shadow', 0.5).setScale(0.7 / RES);
      const sprite = img(this, home.x, home.y, id);
      this.creatures.set(id, { id, sprite, shadow, home: { ...home }, radius, target: { ...home }, nextMove: 0, water });
    }
    for (const id of SANCTUARY_GUESTS) this.guests.set(id, img(this, 0, 0, id).setVisible(false));
  }

  // ------------------------------------------------------------------ building (used by the UI)

  startBuildMode(building: BuildingId): void {
    this.buildMode = building;
    this.dirty = true;
  }

  cancelBuildMode(): void {
    this.buildMode = null;
    this.clearGhost();
    this.dirty = true;
  }

  previewBuild(plotId: string, building: BuildingId): void {
    this.clearGhost();
    const p = PLOTS.find((pl) => pl.id === plotId)!;
    this.buildGhost = img(this, p.x, p.y + 30, `bld_${building}`).setAlpha(0.55).setDepth(p.y + 31);
  }

  clearGhost(): void {
    this.buildGhost?.destroy();
    this.buildGhost = null;
  }

  playConstruction(plotId: string): void {
    this.clearGhost();
    this.buildMode = null;
    this.syncAll();
    const view = this.plotViews.get(plotId);
    const p = PLOTS.find((pl) => pl.id === plotId)!;
    if (view && !this.settings.reducedMotion) {
      view.base.setScale(0.1 / RES, 0.1 / RES);
      this.tweens.add({ targets: view.base, scaleX: 1 / RES, scaleY: 1 / RES, duration: 650, ease: 'Back.out' });
    }
    this.burst(p.x, p.y, 0xd9b47c, 16);
  }

  travelTo(zone: ZoneId): void {
    const dest = zone === 'forest' ? POI.forestEntry : zone === 'lake' ? POI.lakeShore : POI.start;
    this.player.setPosition(dest.x, dest.y);
    this.pip.setPosition(dest.x - 26, dest.y - 30);
    this.follower?.setPosition(dest.x + 30, dest.y + 10);
    this.moveTarget = null;
    this.cameras.main.centerOn(dest.x, dest.y);
    if (!this.settings.reducedMotion) this.cameras.main.fadeIn(350, 255, 255, 255);
  }

  protected onWorldTap(wx: number, wy: number): boolean {
    if (!this.buildMode) return false;
    const plot = PLOTS.find((p) => Math.abs(p.x - wx) < 44 && Math.abs(p.y + 4 - wy) < 40);
    if (plot) this.hooks.choosePlot(plot.id, this.buildMode);
    return true;
  }

  // ------------------------------------------------------------------ per-frame world

  protected updateWorld(time: number, dt: number): void {
    const st = this.game_.state;
    for (const c of this.creatures.values()) {
      const visible = this.creatureVisible(c.id);
      c.sprite.setVisible(visible);
      c.shadow.setVisible(visible && !c.water);
      if (!visible) continue;
      const cs = st.creatures[c.id];
      if (c.id === 'ripplet' && cs.evolved) c.sprite.setTexture('moonshell');
      if (time > c.nextMove) {
        c.nextMove = time + 2000 + Math.random() * 2500;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * c.radius;
          const x = c.home.x + Math.cos(a) * r;
          const y = c.home.y + Math.sin(a) * r * (c.water ? 0.5 : 1);
          if (c.water ? !isWalkableGround(x, y) : isWalkableGround(x, y)) {
            c.target = { x, y };
            break;
          }
        }
      }
      // a cautious Glowfox keeps its distance until it is fed
      if (c.id === 'glowfox' && cs.state !== 'friendly' && this.mode === 'play') {
        const d = Math.hypot(this.player.x - c.sprite.x, this.player.y - c.sprite.y);
        if (d < 46) {
          const a = Math.atan2(c.sprite.y - this.player.y, c.sprite.x - this.player.x);
          const x = c.sprite.x + Math.cos(a) * 40;
          const y = c.sprite.y + Math.sin(a) * 40;
          if (isWalkableGround(x, y) && Math.hypot(x - c.home.x, y - c.home.y) < c.radius * 1.6) c.target = { x, y };
        }
      }
      const dx = c.target.x - c.sprite.x;
      const dy = c.target.y - c.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        c.sprite.x += (dx / d) * Math.min(d, 45 * dt);
        c.sprite.y += (dy / d) * Math.min(d, 45 * dt);
        if (Math.abs(dx) > 1) c.sprite.setFlipX(dx < 0);
      }
      c.sprite.setDepth(c.water ? -8300 : c.sprite.y);
      c.shadow.setPosition(c.sprite.x, c.sprite.y).setDepth(c.sprite.y - 1);
      if (this.mode === 'play' && cs.state === 'unknown' && Math.hypot(this.player.x - c.sprite.x, this.player.y - c.sprite.y) < 90) {
        this.game_.observe(c.id);
      }
    }
  }

  private creatureVisible(id: CreatureId): boolean {
    const st = this.game_.state;
    const cs = st.creatures[id];
    if (!cs.present) return false;
    if (id === 'glowfox' && cs.state === 'bonded') return false; // it travels with Nova
    if ((id === 'glowfox' || id === 'mossprite') && st.island.corruption.forest >= 2) return false;
    if (id === 'ripplet' && st.island.corruption.lake >= 2) return false;
    if (id !== 'glowfox' && this.isGuest(id)) return false;
    return true;
  }

  /** Bonded creatures move into the sanctuary; a rescued Skyhare lives in the village. */
  private isGuest(id: CreatureId): boolean {
    const st = this.game_.state;
    if (id === 'skyhare') return st.choices.some((c) => c.id === 'skyhare_choice' && c.value === 'village');
    return SANCTUARY_GUESTS.includes(id) && st.buildings.sanctuary > 0 && st.creatures[id].state === 'bonded';
  }

  private sanctuarySpot(): { x: number; y: number } {
    const plot = PLOTS.find((p) => this.game_.state.world.plots[p.id] === 'sanctuary');
    return plot ? { x: plot.x, y: plot.y } : { x: POI.nest.x + 40, y: POI.nest.y + 20 };
  }

  // ------------------------------------------------------------------ sync visuals from state

  protected syncWorld(): void {
    const st = this.game_.state;
    const g = this.game_;
    const blockers: Blocker[] = [...this.staticBlockers];

    for (const n of NODES) {
      const v = this.nodeViews.get(n.id)!;
      const ns = st.world.nodes[n.id];
      let key = '';
      if (n.kind === 'tree') key = ns.stage === 'full' ? 'tree' : ns.stage === 'sapling' ? 'sapling' : 'stump';
      if (n.kind === 'grove') key = ns.stage === 'soil' ? 'soil' : ns.stage === 'sapling' ? 'sapling' : 'memory_tree';
      if (n.kind === 'rock') key = ns.stage === 'full' ? 'rock' : 'rock_empty';
      if (n.kind === 'bush') key = ns.stage === 'full' ? 'bush_full' : 'bush_empty';
      if (n.kind === 'debris') key = 'debris';
      v.setTexture(key);
      v.setVisible(!(n.kind === 'debris' && st.world.debrisCleared.includes(n.id)));
      if ((n.kind === 'tree' && ns.stage === 'full') || (n.kind === 'grove' && ns.stage === 'tree')) blockers.push({ kind: 'circle', x: n.x, y: n.y + 4, r: 11 });
      if (n.kind === 'rock' && ns.stage === 'full') blockers.push({ kind: 'circle', x: n.x, y: n.y + 2, r: 13 });
      if (n.kind === 'bush') blockers.push({ kind: 'circle', x: n.x, y: n.y + 2, r: 10 });
    }

    for (const p of PLOTS) {
      const view = this.plotViews.get(p.id)!;
      const b = st.world.plots[p.id];
      const status = g.plotStatus(p.id);
      if (b) {
        view.base.setTexture(`bld_${b}`).setAlpha(1).setVisible(true);
        view.base.setY(p.y + (b === 'garden' ? 26 : b === 'sanctuary' ? 24 : 30));
        if (b !== 'sanctuary' && b !== 'arch') {
          blockers.push({ kind: 'rect', x: p.x, y: p.y - 2, w: b === 'garden' ? 74 : 64, h: b === 'garden' ? 30 : 40 });
        }
      } else {
        view.base.setTexture('plot').setY(p.y + 28);
        view.base.setVisible(status === 'free' || this.buildMode !== null);
        view.base.setAlpha(status === 'free' ? 1 : 0.45);
      }
      const produce = b === 'garden' ? st.world.gardenProduce[p.id] ?? 0 : 0;
      view.produce.forEach((pr, i) => pr.setVisible(b === 'garden').setTexture(i < produce ? 'veggie' : 'sprout'));
      if (this.buildMode) {
        const text = status === 'free' ? `✓ ${t('build.free')}` : status === 'locked' ? `🔒 ${t('build.locked', { level: p.islandLevel })}` : `✗ ${t('build.occupied')}`;
        view.label.setText(text).setVisible(true);
        view.label.setBackgroundColor(status === 'free' ? (this.settings.colorBlind ? '#1f5fbf' : '#2e8b57') : '#2b2135cc');
      } else {
        view.label.setVisible(false);
      }
    }

    const npcPos = this.npcPositions();
    for (const [id, v] of this.npcViews) {
      const present = st.npcs[id].present;
      const pos = npcPos[id];
      v.sprite.setPosition(pos.x, pos.y + 8).setDepth(pos.y + 8).setVisible(present);
      v.shadow.setPosition(pos.x, pos.y + 8).setDepth(pos.y + 7).setVisible(present);
      v.sprite.setFlipX(pos.x > this.player.x);
      v.marker.setPosition(pos.x, pos.y - 30).setVisible(present && g.questsOfferedBy(id).length > 0);
    }

    this.eggInLog.setVisible(st.world.egg === 'hidden');
    this.eggInNest.setVisible(st.world.egg === 'nest');

    const vis = (id: string) => st.island.visuals.includes(id);
    const show = (key: string, on: boolean) => this.decor[key]?.forEach((o) => (o as Phaser.GameObjects.Image).setVisible(on));
    show('forest_flowers', vis('forest_flowers'));
    show('forest_lush', vis('forest_lush'));
    show('forest_ancient', vis('forest_ancient'));
    show('butterflies', vis('butterflies') || vis('village_bloom'));
    show('lilypads', vis('lake_bright') && st.island.corruption.lake === 0);
    show('zedCamp', vis('zed_camp'));
    show('lunaTent', st.npcs.luna.present);
    show('bunting', st.island.level >= 2);
    show('lanterns', st.island.level >= 3);
    show('wellFlowers', st.island.level >= 4 || vis('village_bloom'));
    show('radiant', vis('island_radiant'));
    if (vis('forest_ancient')) blockers.push({ kind: 'circle', x: px(59.5), y: px(21), r: 26 });
    this.lakeBright.setAlpha(vis('lake_bright') ? 1 : 0);
    this.lakeTint.setFillStyle(0x40205a, st.island.corruption.lake * 0.14);
    this.templeGate.setTexture(st.world.templeOpen ? 'temple_gate_open' : 'temple_gate');
    this.templeRune.setAlpha(vis('temple_glow') && !st.world.templeOpen ? 1 : 0);

    const corruption = st.island.corruption.forest;
    (this.decor.corruption as Phaser.GameObjects.Image[]).forEach((o, i) => o.setVisible(i < corruption * 8));
    (this.decor.wisps as Phaser.GameObjects.Image[]).forEach((o, i) => o.setVisible(i < corruption * 3));
    (this.decor.lakeCorruption as Phaser.GameObjects.Image[]).forEach((o, i) => o.setVisible(i < st.island.corruption.lake * 6));
    this.corruptionTint.setFillStyle(0x40205a, corruption * 0.11);

    // sanctuary guests
    const spot = this.sanctuarySpot();
    let k = 0;
    for (const [id, sprite] of this.guests) {
      const here = this.isGuest(id) && st.creatures[id].present;
      sprite.setVisible(here);
      if (!here) continue;
      const a = (k++ / 8) * Math.PI * 2;
      const tex = id === 'ripplet' && st.creatures.ripplet.evolved ? 'moonshell' : id;
      sprite.setTexture(tex).setPosition(spot.x + Math.cos(a) * 30, spot.y + 14 + Math.sin(a) * 12).setDepth(spot.y + 40);
    }

    this.blockers = blockers;
  }

  private npcPositions(): Record<NpcId, { x: number; y: number }> {
    const egg = this.game_.state.world.egg;
    const zed = egg === 'hidden' ? POI.zedForest : egg === 'sold' ? POI.zedCamp : POI.zedEdge;
    return { rocco: POI.rocco, luna: POI.luna, zed, tilly: POI.tilly };
  }

  // ------------------------------------------------------------------ interactions

  protected collectInteractables(list: Interactable[]): void {
    const g = this.game_;
    const st = g.state;
    const seeds = st.inventory.seed;

    for (const n of NODES) {
      const ns = st.world.nodes[n.id];
      const base = { id: n.id, x: n.x, y: n.y };
      if (n.kind === 'debris') {
        if (!st.world.debrisCleared.includes(n.id)) list.push({ ...base, label: t('act.clear'), enabled: true, act: () => g.gather(n.id) });
        continue;
      }
      if (n.kind === 'tree' && ns.stage === 'full') list.push({ ...base, label: t('act.chop'), enabled: true, act: () => this.doGather(n.id) });
      else if (n.kind === 'rock' && ns.stage === 'full') list.push({ ...base, label: t('act.mine'), enabled: true, act: () => this.doGather(n.id) });
      else if (n.kind === 'bush' && ns.stage === 'full') list.push({ ...base, label: t('act.pick'), enabled: true, act: () => this.doGather(n.id) });
      else if ((n.kind === 'tree' && ns.stage === 'stump') || (n.kind === 'grove' && ns.stage === 'soil')) {
        list.push({ ...base, label: seeds > 0 ? t('act.plant', { n: seeds }) : t('act.need_seed'), enabled: seeds > 0, act: () => this.report(g.plant(n.id)) });
      } else if (ns.stage === 'sapling') {
        list.push({ ...base, label: t('act.growing', { min: Math.ceil(ns.timer) }), enabled: false, act: () => undefined });
      }
    }

    const npcPos = this.npcPositions();
    for (const id of ['rocco', 'luna', 'zed', 'tilly'] as NpcId[]) {
      if (!st.npcs[id].present) continue;
      list.push({ id: `npc_${id}`, ...npcPos[id], label: t('act.talk', { name: t(`npc.${id}`) }), enabled: true, act: () => this.hooks.dialog(g.talk(id)) });
    }

    for (const c of this.creatures.values()) {
      if (this.creatureVisible(c.id)) list.push(this.creatureInteractable(c.id, c.sprite));
    }
    for (const [id, sprite] of this.guests) if (sprite.visible) list.push(this.creatureInteractable(id, sprite));

    if (st.world.egg === 'hidden') {
      list.push({ id: 'egg', ...POI.egg, label: t('act.examine_egg'), enabled: true, act: () => {
        const d = g.examineEgg();
        if (d) this.hooks.dialog(d);
      } });
    }
    if (st.world.egg === 'nest') {
      list.push({ id: 'nest', ...POI.nest, label: t('act.egg_warm', { min: Math.ceil(st.world.eggHatchTimer) }), enabled: false, act: () => undefined });
    }
    list.push({ id: 'shop', x: POI.shop.x, y: POI.shop.y + 18, label: t('act.shop'), enabled: true, act: () => this.hooks.openShop() });
    list.push({
      id: 'temple',
      x: POI.templeGate.x,
      y: POI.templeGate.y + 20,
      label: st.world.templeOpen ? t('act.enter', { name: t('zone.temple') }) : t('act.examine'),
      enabled: true,
      act: () => {
        if (st.world.templeOpen) this.hooks.travel('temple', 'spawn');
        else this.hooks.info(st.island.visuals.includes('temple_glow') ? t('temple.glowing') : t('temple.sealed'));
      },
    });
    list.push({ id: 'caves', x: POI.caveEntrance.x, y: POI.caveEntrance.y + 22, label: t('act.enter', { name: t('zone.caves') }), enabled: true, act: () => this.hooks.travel('caves', 'spawn') });
    list.push({ id: 'highlands', x: POI.highlandsPath.x, y: POI.highlandsPath.y + 6, label: t('act.enter', { name: t('zone.highlands') }), enabled: true, act: () => this.hooks.travel('highlands', 'spawn') });
    list.push({ id: 'fish', x: POI.dockEnd.x, y: POI.dockEnd.y, label: t('act.fish'), enabled: true, act: () => this.hooks.startFishing() });

    for (const p of PLOTS) {
      const b = st.world.plots[p.id];
      if (this.buildMode) {
        const status = g.plotStatus(p.id);
        list.push({ id: p.id, x: p.x, y: p.y + 20, label: t('act.build_here'), enabled: status === 'free', act: () => this.hooks.choosePlot(p.id, this.buildMode!) });
      } else if (b === 'house') {
        list.push({ id: p.id, x: p.x, y: p.y + 24, label: t('act.sleep'), enabled: true, act: () => this.report(g.sleep()) });
      } else if (b === 'garden') {
        const produce = st.world.gardenProduce[p.id] ?? 0;
        list.push({
          id: p.id, x: p.x, y: p.y + 20,
          label: produce ? t('act.harvest', { n: produce }) : t('act.garden_growing'),
          enabled: produce > 0,
          act: () => this.report(g.harvestGarden(p.id, { x: p.x, y: p.y - 10 })),
        });
      } else if (b === 'workshop') {
        list.push({ id: p.id, x: p.x, y: p.y + 24, label: t('act.workshop'), enabled: true, act: () => this.hooks.openWorkshop() });
      } else if (b === 'sanctuary') {
        list.push({ id: p.id, x: p.x, y: p.y + 30, label: t('act.sanctuary'), enabled: false, act: () => undefined });
      } else if (b === 'arch') {
        list.push({ id: p.id, x: p.x, y: p.y + 30, label: t('act.arch'), enabled: false, act: () => undefined });
      }
    }
  }

  private doGather(id: string): void {
    const v = this.nodeViews.get(id);
    if (v && !this.settings.reducedMotion) {
      this.tweens.add({ targets: v, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 1, onComplete: () => v.setAngle(0) });
    }
    this.report(this.game_.gather(id));
  }

  protected senseCandidates(): { x: number; y: number }[] {
    const st = this.game_.state;
    const out: { x: number; y: number }[] = [];
    if (st.quests.q_egg.status === 'active' && st.world.egg === 'hidden') out.push(POI.egg);
    if (st.quests.q_lake.status === 'active') for (const n of NODES) if (n.kind === 'debris' && !st.world.debrisCleared.includes(n.id)) out.push(n);
    if (st.quests.q_caves.status === 'active' && !st.world.sunKeyFound) out.push(POI.caveEntrance);
    if (st.quests.q_temple.status === 'active' && st.world.templeOpen) out.push(POI.templeGate);
    if (st.quests.q_highlands.status === 'active' || st.quests.q_finale.status === 'active') out.push(POI.highlandsPath);
    for (const c of this.creatures.values()) {
      if (this.creatureVisible(c.id) && st.creatures[c.id].state === 'unknown') out.push({ x: c.sprite.x, y: c.sprite.y });
    }
    return out;
  }

  protected worldLights(light: (x: number, y: number, r: number) => void): void {
    const st = this.game_.state;
    if (st.island.level >= 3) for (const o of this.decor.lanterns) light((o as Phaser.GameObjects.Image).x, (o as Phaser.GameObjects.Image).y - 18, 70);
    for (const n of NODES) if (n.kind === 'grove' && st.world.nodes[n.id].stage === 'tree') light(n.x, n.y - 20, 50);
    if (st.island.visuals.includes('forest_ancient')) light(px(59.5), px(21) - 60, 160);
    if (st.island.visuals.includes('temple_glow') || st.world.templeOpen) light(POI.templeGate.x, POI.templeGate.y, 90);
    light(POI.caveEntrance.x, POI.caveEntrance.y, 40);
  }
}

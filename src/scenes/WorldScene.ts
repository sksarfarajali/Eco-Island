import Phaser from 'phaser';
import { INTERACT_RANGE, TILE, WORLD_H, WORLD_W } from '../core/config';
import { CREATURES, ITEMS } from '../core/content';
import type { Dialog, Game } from '../core/game';
import { t } from '../core/i18n';
import {
  DOCK,
  LAKE,
  NODES,
  PLOTS,
  POI,
  STATIC_BLOCKERS,
  ZONE_SPAWN,
  isWalkableGround,
  px,
  zoneAt,
} from '../core/layout';
import type { BuildingId, CreatureId, NpcId, Settings, ZoneId } from '../core/types';
import { RES, makeNovaTexture, makeTextures } from './art';
import { decorFree, makeGround, seeded } from './ground';

/** Callbacks from the world to the HTML UI. */
export interface SceneHooks {
  prompt(p: { label: string; enabled: boolean } | null): void;
  dialog(d: Dialog): void;
  openShop(): void;
  choosePlot(plotId: string, building: BuildingId): void;
  info(text: string): void;
  zoneChanged(zone: ZoneId): void;
}

export interface WorldData {
  game: Game;
  mode: 'menu' | 'play';
  hooks: SceneHooks;
  settings: Settings;
}

interface Interactable {
  id: string;
  x: number;
  y: number;
  label: string;
  enabled: boolean;
  act: () => void;
}

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

type Blocker = { kind: 'circle'; x: number; y: number; r: number } | { kind: 'rect'; x: number; y: number; w: number; h: number };

const SPEED = 150;
const NIGHT_MARGIN = 160;
const img = (scene: Phaser.Scene, x: number, y: number, key: string, originY = 1) =>
  scene.add.image(x, y, key).setOrigin(0.5, originY).setScale(1 / RES);

export class WorldScene extends Phaser.Scene {
  private game_!: Game;
  private hooks!: SceneHooks;
  private settings!: Settings;
  private mode: 'menu' | 'play' = 'menu';

  private player!: Phaser.GameObjects.Container;
  private novaSprite!: Phaser.GameObjects.Image;
  private pip!: Phaser.GameObjects.Container;
  private pipSprite!: Phaser.GameObjects.Image;
  private pipCrown!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private joystick = { x: 0, y: 0 };
  private moveTarget: { x: number; y: number } | null = null;
  private pendingInteract: string | null = null;
  private facing = 1;
  private walkTime = 0;

  private nodeViews = new Map<string, Phaser.GameObjects.Image>();
  private plotViews = new Map<string, { base: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; produce: Phaser.GameObjects.Image[] }>();
  private npcViews = new Map<NpcId, { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; marker: Phaser.GameObjects.Image }>();
  private creatures = new Map<CreatureId, CreatureView>();
  private decor: Record<string, Phaser.GameObjects.GameObject[]> = {};
  private blockers: Blocker[] = [];
  private interactables: Interactable[] = [];
  private current: Interactable | null = null;
  private lastPromptKey = '';

  private eggInLog!: Phaser.GameObjects.Image;
  private eggInNest!: Phaser.GameObjects.Image;
  private templeRune!: Phaser.GameObjects.Image;
  private lakeBright!: Phaser.GameObjects.Image;
  private corruptionTint!: Phaser.GameObjects.Rectangle;
  private night!: Phaser.GameObjects.RenderTexture;
  private lightBrush!: Phaser.GameObjects.Image;
  private senseArrow!: Phaser.GameObjects.Image;
  private buildGhost: Phaser.GameObjects.Image | null = null;

  private buildMode: BuildingId | null = null;
  private dirty = true;
  private tickAcc = 0;
  private chatterAt = 0;
  private zone: ZoneId = 'village';
  private paused = false;
  private unsubs: (() => void)[] = [];
  private menuPan = 0;

  constructor() {
    super('world');
  }

  init(data: WorldData): void {
    this.game_ = data.game;
    this.hooks = data.hooks;
    this.mode = data.mode;
    this.settings = data.settings;
    this.nodeViews.clear();
    this.plotViews.clear();
    this.npcViews.clear();
    this.creatures.clear();
    this.decor = {};
    this.staticBlockers = [];
    this.blockers = [];
    this.buildMode = null;
    this.buildGhost = null;
    this.moveTarget = null;
    this.pendingInteract = null;
    this.paused = false;
    this.dirty = true;
  }

  create(): void {
    makeTextures(this);
    makeGround(this);
    makeNovaTexture(this, this.game_.state.player.appearance);

    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-10000);
    this.add.image(px(LAKE.cx), px(LAKE.cy), 'lake_dim').setDepth(-9000);
    this.lakeBright = this.add.image(px(LAKE.cx), px(LAKE.cy), 'lake_bright').setDepth(-8999).setAlpha(0);
    this.add.image(DOCK.x0 * TILE, DOCK.y0 * TILE, 'dock').setOrigin(0).setDepth(-8000);
    this.corruptionTint = this.add
      .rectangle(30 * TILE, 0, 34 * TILE, 22 * TILE, 0x40205a, 0)
      .setOrigin(0)
      .setDepth(-7000);

    this.createStatic();
    this.createNodes();
    this.createPlots();
    this.createNpcs();
    this.createCreatures();
    this.createPlayer();
    this.createNight();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setBackgroundColor('#2b9fd0');
    this.applyZoom();
    this.scale.on('resize', this.onResize, this);

    if (this.mode === 'play') {
      cam.startFollow(this.player, true, 0.12, 0.12);
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard!.on('keydown-E', () => this.interact());
      this.input.keyboard!.on('keydown-SPACE', () => this.interact());
      this.input.keyboard!.on('keydown-ENTER', () => this.interact());
      this.input.on('pointerup', this.onTap, this);
      this.zone = zoneAt(this.player.x, this.player.y);
      this.game_.enterZone(this.zone);
      this.hooks.zoneChanged(this.zone);
      this.chatterAt = this.time.now + 25000;
    } else {
      cam.centerOn(POI.plaza.x, POI.plaza.y);
    }

    this.unsubs.push(
      this.game_.events.on('changed', () => (this.dirty = true)),
      this.game_.events.on('float', (f) => this.floatText(f.x, f.y, f.text)),
      this.game_.events.on('pipSay', (p) => this.pipSay(p.text)),
      this.game_.events.on('worldChange', () => this.celebrate()),
      this.game_.events.on('levelup', () => this.celebrate()),
    );
    this.events.once('shutdown', () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.scale.off('resize', this.onResize, this);
    });
    this.sync();
  }

  // ------------------------------------------------------------------ creation

  private createStatic(): void {
    const s = this;
    const place = (x: number, y: number, key: string) => {
      const o = img(s, x, y, key);
      o.setDepth(y);
      return o;
    };
    place(POI.well.x, POI.well.y + 14, 'well');
    place(POI.shop.x, POI.shop.y + 16, 'shop');
    place(POI.workshop.x, POI.workshop.y + 22, 'workshop');
    place(POI.templeGate.x, POI.templeGate.y + 18, 'temple_gate');
    this.templeRune = place(POI.templeGate.x, POI.templeGate.y + 18, 'temple_rune').setDepth(POI.templeGate.y + 19).setAlpha(0);
    place(POI.egg.x + 2, POI.egg.y + 12, 'log');
    this.eggInLog = place(POI.egg.x - 6, POI.egg.y + 6, 'egg').setDepth(POI.egg.y + 13);
    place(POI.nest.x, POI.nest.y + 8, 'nest');
    this.eggInNest = place(POI.nest.x, POI.nest.y + 2, 'egg').setDepth(POI.nest.y + 9);
    place(POI.den.x, POI.den.y + 12, 'den');

    this.decor.lunaTent = [place(POI.lunaTent.x, POI.lunaTent.y + 10, 'tent_luna')];
    this.decor.zedCamp = [place(POI.zedCamp.x + 40, POI.zedCamp.y + 6, 'tent_zed')];

    // dense border trees frame the forest and island edges (purely decorative, but solid)
    const rnd = seeded(11);
    for (let i = 0; i < 70; i++) {
      const tx = 30 + Math.floor(rnd() * 34);
      const ty = Math.floor(rnd() * 22);
      if (!decorFree(tx, ty) || !this.clearOf(tx, ty, 2.2)) continue;
      const x = px(tx);
      const y = px(ty);
      place(x, y + 10, 'tree_border');
      this.staticBlockers.push({ kind: 'circle', x, y: y + 4, r: 11 });
    }
    for (const b of STATIC_BLOCKERS) this.staticBlockers.push({ kind: 'rect', ...b });
    this.staticBlockers.push({ kind: 'rect', x: POI.lunaTent.x, y: POI.lunaTent.y, w: 60, h: 24 });

    // decorative world-change layers (shown or hidden in sync)
    this.decor.forest_flowers = this.scatter(26, 21, 'forest', (x, y, i) => place(x, y, `flower${i % 4}`));
    this.decor.forest_lush = this.scatter(18, 22, 'forest', (x, y) => place(x, y + 8, 'bush_empty'));
    this.decor.forest_ancient = [place(px(59.5), px(21) + 8, 'ancient_tree')];
    this.decor.butterflies = Array.from({ length: 6 }, (_, i) => {
      const b = img(s, POI.plaza.x + Math.cos(i) * 140, POI.plaza.y + Math.sin(i * 2) * 90, 'butterfly', 0.5).setDepth(5000);
      if (!this.settings.reducedMotion) {
        this.tweens.add({ targets: b, x: b.x + 40 - i * 12, y: b.y - 30, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      return b;
    });
    this.decor.lilypads = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      return img(s, px(LAKE.cx) + Math.cos(a) * LAKE.rx * TILE * 0.65, px(LAKE.cy) + Math.sin(a) * LAKE.ry * TILE * 0.6, 'lilypad', 0.5).setDepth(-8500);
    });
    const bunting = this.add.graphics().setDepth(px(21));
    bunting.lineStyle(1.5, 0x8a5a32);
    const flags: Phaser.GameObjects.GameObject[] = [bunting];
    const colors = [0xff7aa8, 0xffd84a, 0x7ad66a, 0x5aa8ff];
    for (const [x0, y0, x1, y1] of [[px(12), px(21), px(21), px(21)], [px(12), px(28), px(21), px(28)]]) {
      bunting.lineBetween(x0, y0, x1, y1);
      for (let k = 0; k <= 8; k++) {
        flags.push(img(s, x0 + ((x1 - x0) * k) / 8, y0 - 1, 'flag', 0).setTint(colors[k % 4]).setDepth(y0 + 1));
      }
    }
    this.decor.bunting = flags;
    this.decor.lanterns = [[12, 22], [21, 22], [12, 27], [21, 27], [16, 20], [16, 29]].map(([x, y]) => place(px(x), px(y), 'lantern'));
    this.decor.wellFlowers = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return place(POI.well.x + Math.cos(a) * 34, POI.well.y + 10 + Math.sin(a) * 22, `flower${i % 4}`);
    });
    this.decor.corruption = this.scatter(24, 31, 'forest', (x, y) => place(x, y, 'dark_plant'));
    this.decor.wisps = Array.from({ length: 9 }, (_, i) => {
      const w = img(s, px(34 + i * 3), px(5 + (i % 4) * 4), 'wisp', 0.5).setDepth(6000);
      if (!this.settings.reducedMotion) this.tweens.add({ targets: w, y: w.y - 24, x: w.x + 18, duration: 2600 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return w;
    });
  }

  private staticBlockers: Blocker[] = [];

  private clearOf(tx: number, ty: number, dist: number): boolean {
    const x = px(tx);
    const y = px(ty);
    const near = (ox: number, oy: number) => Math.hypot(ox - x, oy - y) < dist * TILE;
    if (NODES.some((n) => near(n.x, n.y))) return false;
    if (Object.values(POI).some((p) => near(p.x, p.y))) return false;
    if (PLOTS.some((p) => near(p.x, p.y))) return false;
    // keep the path to the grove and temple open
    if (ty >= 11 && ty <= 14 && tx <= 46) return false;
    if (tx >= 44 && tx <= 48 && ty <= 8) return false;
    return true;
  }

  private scatter(count: number, seed: number, zone: ZoneId, make: (x: number, y: number, i: number) => Phaser.GameObjects.Image): Phaser.GameObjects.Image[] {
    const rnd = seeded(seed);
    const out: Phaser.GameObjects.Image[] = [];
    for (let tries = 0; out.length < count && tries < count * 30; tries++) {
      const tx = 30 + Math.floor(rnd() * 33);
      const ty = 1 + Math.floor(rnd() * 21);
      if (zone !== 'forest' || !decorFree(tx, ty) || !this.clearOf(tx, ty, 1.2)) continue;
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
  }

  private createPlayer(): void {
    const pos = this.game_.state.player.position;
    const start = isWalkableGround(pos.x, pos.y) ? pos : POI.start;
    const shadow = this.add.image(0, 0, 'shadow').setScale(1 / RES);
    this.novaSprite = this.add.image(0, 2, 'nova').setOrigin(0.5, 1).setScale(1 / RES);
    this.player = this.add.container(start.x, start.y, [shadow, this.novaSprite]);
    this.player.setVisible(this.mode === 'play');

    const glow = this.add.image(0, 0, 'glow').setScale(0.9 / RES).setAlpha(0.6).setTint(0x9fefff);
    this.pipSprite = this.add.image(0, 0, 'pip_happy').setScale(1 / RES);
    this.pipCrown = this.add.image(0, -10, 'crown').setScale(1 / RES).setVisible(false);
    this.pip = this.add.container(start.x - 26, start.y - 30, [glow, this.pipSprite, this.pipCrown]);
    this.pip.setDepth(20000).setVisible(this.mode === 'play');

    this.senseArrow = this.add.image(0, 0, 'arrow').setScale(0.8 / RES).setDepth(20001).setVisible(false);
  }

  private createNight(): void {
    this.night = this.add.renderTexture(0, 0, 10, 10).setOrigin(0).setDepth(50000);
    this.lightBrush = this.make.image({ key: 'glow', add: false });
  }

  // ------------------------------------------------------------------ sizing

  private onResize(): void {
    this.applyZoom();
  }

  private applyZoom(): void {
    const cam = this.cameras.main;
    const short = Math.min(this.scale.width, this.scale.height);
    const zoom = Phaser.Math.Clamp(short / 600, 0.7, 1.6);
    cam.setZoom(zoom);
    // generous margin: the overlay is positioned from last frame's camera view while the camera moves
    const w = Math.ceil(this.scale.width / zoom) + NIGHT_MARGIN * 2;
    const h = Math.ceil(this.scale.height / zoom) + NIGHT_MARGIN * 2;
    this.night.resize(w, h);
  }

  // ------------------------------------------------------------------ public API (used by the UI)

  setJoystick(x: number, y: number): void {
    this.joystick = { x, y };
    if (x || y) this.moveTarget = null;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  applySettings(s: Settings): void {
    this.settings = s;
  }

  startBuildMode(building: BuildingId): void {
    this.buildMode = building;
    this.dirty = true;
  }

  cancelBuildMode(): void {
    this.buildMode = null;
    this.clearGhost();
    this.dirty = true;
  }

  get inBuildMode(): boolean {
    return this.buildMode !== null;
  }

  /** Show the selected building as a semi-transparent preview on the plot. */
  previewBuild(plotId: string, building: BuildingId): void {
    this.clearGhost();
    const p = PLOTS.find((pl) => pl.id === plotId)!;
    this.buildGhost = img(this, p.x, p.y + 30, building).setAlpha(0.55).setDepth(p.y + 31);
  }

  clearGhost(): void {
    this.buildGhost?.destroy();
    this.buildGhost = null;
  }

  playConstruction(plotId: string): void {
    this.clearGhost();
    this.buildMode = null;
    this.sync();
    const view = this.plotViews.get(plotId);
    const p = PLOTS.find((pl) => pl.id === plotId)!;
    if (view && !this.settings.reducedMotion) {
      view.base.setScale(0.1 / RES, 0.1 / RES);
      this.tweens.add({ targets: view.base, scaleX: 1 / RES, scaleY: 1 / RES, duration: 650, ease: 'Back.out' });
    }
    this.burst(p.x, p.y, 0xd9b47c, 16);
  }

  travelTo(zone: ZoneId): void {
    const dest = ZONE_SPAWN[zone];
    this.player.setPosition(dest.x, dest.y);
    this.pip.setPosition(dest.x - 26, dest.y - 30);
    this.moveTarget = null;
    this.cameras.main.centerOn(dest.x, dest.y);
    if (!this.settings.reducedMotion) this.cameras.main.fadeIn(350, 255, 255, 255);
  }

  /** Use whatever Nova is standing next to. */
  interact(): void {
    if (this.paused || this.mode !== 'play') return;
    if (this.current?.enabled) this.current.act();
    else if (this.current) this.hooks.info(this.current.label);
  }

  // ------------------------------------------------------------------ input

  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.paused || pointer.getDistance() > 12 || pointer.getDuration() > 600) return;
    const wx = pointer.worldX;
    const wy = pointer.worldY;
    if (this.buildMode) {
      const plot = PLOTS.find((p) => Math.abs(p.x - wx) < 44 && Math.abs(p.y + 4 - wy) < 40);
      if (plot) this.hooks.choosePlot(plot.id, this.buildMode);
      return;
    }
    const hit = this.interactables
      .filter((i) => Math.hypot(i.x - wx, i.y - 10 - wy) < 30)
      .sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0];
    if (hit) {
      if (Math.hypot(hit.x - this.player.x, hit.y - this.player.y) <= INTERACT_RANGE + 6) {
        this.current = hit;
        this.interact();
      } else {
        this.moveTarget = { x: hit.x, y: hit.y + 18 };
        this.pendingInteract = hit.id;
      }
      return;
    }
    this.moveTarget = { x: wx, y: wy };
    this.pendingInteract = null;
  }

  // ------------------------------------------------------------------ main loop

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    if (this.mode === 'menu') {
      this.menuPan += dt * 0.08;
      this.cameras.main.centerOn(POI.plaza.x + 900 + Math.cos(this.menuPan) * 700, POI.plaza.y - 200 + Math.sin(this.menuPan * 1.3) * 300);
      this.updateCreatures(time, dt);
      this.updateNight();
      if (this.dirty) this.sync();
      return;
    }
    if (!this.paused) {
      this.tickAcc += dt;
      if (this.tickAcc >= 1) {
        this.game_.tick(Math.floor(this.tickAcc));
        this.tickAcc -= Math.floor(this.tickAcc);
      }
      this.movePlayer(dt);
    }
    this.updatePip(time, dt);
    this.updateCreatures(time, dt);
    if (this.dirty) this.sync();
    this.updateInteractables();
    this.updateSense();
    this.updateNight();
    if (!this.paused && time > this.chatterAt) {
      this.chatterAt = time + 70000 + Math.random() * 40000;
      this.pipSay(this.game_.pipChatter());
    }
  }

  private movePlayer(dt: number): void {
    let vx = 0;
    let vy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    if (vx || vy) this.moveTarget = null;
    if (!vx && !vy && (this.joystick.x || this.joystick.y)) {
      vx = this.joystick.x;
      vy = this.joystick.y;
    }
    if (!vx && !vy && this.moveTarget) {
      const dx = this.moveTarget.x - this.player.x;
      const dy = this.moveTarget.y - this.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 || (this.pendingInteract && d < INTERACT_RANGE - 8)) {
        this.moveTarget = null;
        if (this.pendingInteract) {
          const it = this.interactables.find((i) => i.id === this.pendingInteract);
          this.pendingInteract = null;
          this.updateInteractables();
          if (it) {
            this.current = it;
            this.interact();
          }
        }
      } else {
        vx = dx / d;
        vy = dy / d;
      }
    }
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    const moving = len > 0.05;
    if (moving) {
      const nx = this.player.x + vx * SPEED * dt;
      const ny = this.player.y + vy * SPEED * dt;
      const before = { x: this.player.x, y: this.player.y };
      if (this.canStand(nx, this.player.y)) this.player.x = nx;
      if (this.canStand(this.player.x, ny)) this.player.y = ny;
      if (this.moveTarget && before.x === this.player.x && before.y === this.player.y) this.moveTarget = null;
      if (vx) this.facing = vx > 0 ? 1 : -1;
      this.walkTime += dt;
    } else {
      this.walkTime = 0;
    }
    this.novaSprite.setFlipX(this.facing < 0);
    this.novaSprite.y = moving && !this.settings.reducedMotion ? 2 - Math.abs(Math.sin(this.walkTime * 12)) * 3 : 2;
    this.player.setDepth(this.player.y);
    const pos = this.game_.state.player.position;
    pos.x = Math.round(this.player.x);
    pos.y = Math.round(this.player.y);

    const zone = zoneAt(this.player.x, this.player.y);
    if (zone !== this.zone) {
      this.zone = zone;
      this.game_.enterZone(zone);
      this.hooks.zoneChanged(zone);
    }
  }

  private canStand(x: number, y: number): boolean {
    if (!isWalkableGround(x, y)) return false;
    const r = 8;
    for (const b of this.blockers) {
      if (b.kind === 'circle') {
        if (Math.hypot(b.x - x, b.y - y) < b.r + r) return false;
      } else if (Math.abs(b.x - x) < b.w / 2 + r && Math.abs(b.y - y) < b.h / 2 + r / 2) {
        return false;
      }
    }
    return true;
  }

  private updatePip(time: number, dt: number): void {
    const bob = this.settings.reducedMotion ? 0 : Math.sin(time / 380) * 4;
    const tx = this.player.x - 24 * this.facing;
    const ty = this.player.y - 34 + bob;
    const f = 1 - Math.pow(0.02, dt);
    this.pip.x += (tx - this.pip.x) * f;
    this.pip.y += (ty - this.pip.y) * f;
    const s = this.game_.state.pip;
    this.pipSprite.setTexture(`pip_${s.mood}`);
    this.pipCrown.setVisible(s.cosmetic === 'flower_crown');
  }

  private updateCreatures(time: number, dt: number): void {
    const st = this.game_.state;
    for (const c of this.creatures.values()) {
      const cs = st.creatures[c.id];
      const visible = this.creatureVisible(c.id);
      c.sprite.setVisible(visible);
      c.shadow.setVisible(visible && !c.water);
      if (!visible) continue;
      // bonded Glowfox follows Nova around
      if (c.id === 'glowfox' && cs.state === 'bonded' && this.mode === 'play') {
        c.target = { x: this.player.x + 40 * this.facing * -1, y: this.player.y + 14 };
      } else if (time > c.nextMove) {
        c.nextMove = time + 2000 + Math.random() * 2500;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * c.radius;
          const x = c.home.x + Math.cos(a) * r;
          const y = c.home.y + Math.sin(a) * r * (c.water ? 0.5 : 1);
          const ok = c.water ? !isWalkableGround(x, y) : isWalkableGround(x, y);
          if (ok) {
            c.target = { x, y };
            break;
          }
        }
      }
      // a cautious, unbefriended Glowfox keeps its distance
      if (c.id === 'glowfox' && cs.state !== 'bonded' && cs.state !== 'friendly' && this.mode === 'play') {
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
      const speed = c.id === 'glowfox' && cs.state === 'bonded' ? (d > 120 ? 220 : 120) : 45;
      if (d > 3) {
        c.sprite.x += (dx / d) * Math.min(d, speed * dt);
        c.sprite.y += (dy / d) * Math.min(d, speed * dt);
        if (Math.abs(dx) > 1) c.sprite.setFlipX(dx < 0);
      }
      const hop = c.id === 'mossprite' ? Math.sin(time / 300) * 3 : 0;
      c.sprite.setDepth(c.water ? -8300 : c.sprite.y);
      c.shadow.setPosition(c.sprite.x, c.sprite.y);
      c.shadow.setDepth(c.sprite.y - 1);
      if (hop) c.sprite.y += hop * dt;
      // seeing a creature up close records it
      if (this.mode === 'play' && cs.state === 'unknown' && Math.hypot(this.player.x - c.sprite.x, this.player.y - c.sprite.y) < 90) {
        this.game_.observe(c.id);
      }
    }
  }

  private creatureVisible(id: CreatureId): boolean {
    const st = this.game_.state;
    const cs = st.creatures[id];
    if (!cs.present) return false;
    if (id === 'glowfox' && st.island.corruption.forest >= 2 && cs.state !== 'bonded') return false;
    if (id === 'mossprite' && st.island.corruption.forest >= 2) return false;
    return true;
  }

  // ------------------------------------------------------------------ sync world visuals from state

  private sync(): void {
    this.dirty = false;
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
      if ((n.kind === 'tree' && ns.stage === 'full') || (n.kind === 'grove' && ns.stage === 'tree')) {
        blockers.push({ kind: 'circle', x: n.x, y: n.y + 4, r: 11 });
      }
      if (n.kind === 'rock' && ns.stage === 'full') blockers.push({ kind: 'circle', x: n.x, y: n.y + 2, r: 13 });
      if (n.kind === 'bush') blockers.push({ kind: 'circle', x: n.x, y: n.y + 2, r: 10 });
    }

    for (const p of PLOTS) {
      const view = this.plotViews.get(p.id)!;
      const b = st.world.plots[p.id];
      const status = g.plotStatus(p.id);
      if (b) {
        view.base.setTexture(b).setAlpha(1).setVisible(true);
        view.base.setY(p.y + (b === 'house' ? 30 : 26));
        blockers.push({ kind: 'rect', x: p.x, y: p.y - (b === 'house' ? 0 : 2), w: b === 'house' ? 64 : 74, h: b === 'house' ? 40 : 30 });
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

    // NPCs
    const zedPos = st.world.egg === 'hidden' ? POI.zedForest : st.world.egg === 'sold' ? POI.zedCamp : POI.zedEdge;
    const npcPos: Record<NpcId, { x: number; y: number }> = { rocco: POI.rocco, luna: POI.luna, zed: zedPos, tilly: POI.tilly };
    for (const [id, v] of this.npcViews) {
      const present = st.npcs[id].present;
      const pos = npcPos[id];
      v.sprite.setPosition(pos.x, pos.y + 8).setDepth(pos.y + 8).setVisible(present);
      v.shadow.setPosition(pos.x, pos.y + 8).setDepth(pos.y + 7).setVisible(present);
      v.sprite.setFlipX(pos.x > this.player.x);
      v.marker.setPosition(pos.x, pos.y - 30).setVisible(present && g.questsOfferedBy(id).length > 0);
    }

    // egg
    this.eggInLog.setVisible(st.world.egg === 'hidden');
    this.eggInNest.setVisible(st.world.egg === 'nest');

    // world-state visuals
    const vis = (id: string) => st.island.visuals.includes(id);
    const show = (key: string, on: boolean) => this.decor[key]?.forEach((o) => (o as Phaser.GameObjects.Image).setVisible(on));
    show('forest_flowers', vis('forest_flowers'));
    show('forest_lush', vis('forest_lush'));
    show('forest_ancient', vis('forest_ancient'));
    show('butterflies', vis('butterflies'));
    show('lilypads', vis('lake_bright'));
    show('zedCamp', vis('zed_camp'));
    show('lunaTent', st.npcs.luna.present);
    show('bunting', st.island.level >= 2);
    show('lanterns', st.island.level >= 3);
    show('wellFlowers', st.island.level >= 4);
    if (vis('forest_ancient')) blockers.push({ kind: 'circle', x: px(59.5), y: px(21), r: 26 });
    this.lakeBright.setAlpha(vis('lake_bright') ? 1 : 0);
    this.templeRune.setAlpha(vis('temple_glow') ? 1 : 0);
    if (vis('temple_glow') && !this.settings.reducedMotion && !this.tweens.isTweening(this.templeRune)) {
      this.tweens.add({ targets: this.templeRune, alpha: 0.45, duration: 1600, yoyo: true, repeat: -1 });
    }

    const corruption = st.island.corruption.forest;
    (this.decor.corruption as Phaser.GameObjects.Image[]).forEach((o, i) => o.setVisible(i < corruption * 8));
    (this.decor.wisps as Phaser.GameObjects.Image[]).forEach((o, i) => o.setVisible(i < corruption * 3));
    this.corruptionTint.setFillStyle(0x40205a, corruption * 0.11);

    this.blockers = blockers;
  }

  // ------------------------------------------------------------------ interactions

  private updateInteractables(): void {
    const list: Interactable[] = [];
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
        list.push({
          ...base,
          label: seeds > 0 ? t('act.plant', { n: seeds }) : t('act.need_seed'),
          enabled: seeds > 0,
          act: () => this.report(g.plant(n.id)),
        });
      } else if (ns.stage === 'sapling') {
        list.push({ ...base, label: t('act.growing', { min: Math.ceil(ns.timer) }), enabled: false, act: () => undefined });
      }
    }

    const zedPos = st.world.egg === 'hidden' ? POI.zedForest : st.world.egg === 'sold' ? POI.zedCamp : POI.zedEdge;
    const npcPos: Record<NpcId, { x: number; y: number }> = { rocco: POI.rocco, luna: POI.luna, zed: zedPos, tilly: POI.tilly };
    for (const id of ['rocco', 'luna', 'zed', 'tilly'] as NpcId[]) {
      if (!st.npcs[id].present) continue;
      list.push({ id: `npc_${id}`, ...npcPos[id], label: t('act.talk', { name: t(`npc.${id}`) }), enabled: true, act: () => this.hooks.dialog(g.talk(id)) });
    }

    for (const c of this.creatures.values()) {
      if (!this.creatureVisible(c.id)) continue;
      const cs = st.creatures[c.id];
      const likes = CREATURES[c.id].likes;
      const label =
        cs.state === 'bonded'
          ? t('act.pet', { name: t(`disc.${c.id}`) })
          : likes
            ? t('act.feed', { name: t(`disc.${c.id}`), icon: ITEMS[likes].icon })
            : t('act.observe');
      list.push({
        id: `creature_${c.id}`,
        x: c.sprite.x,
        y: c.sprite.y,
        label,
        enabled: true,
        act: () => this.report(g.interactCreature(c.id, { x: c.sprite.x, y: c.sprite.y })),
      });
    }

    if (st.world.egg === 'hidden') {
      list.push({
        id: 'egg',
        ...POI.egg,
        label: t('act.examine_egg'),
        enabled: true,
        act: () => {
          const d = g.examineEgg();
          if (d) this.hooks.dialog(d);
        },
      });
    }
    if (st.world.egg === 'nest') {
      list.push({ id: 'nest', ...POI.nest, label: t('act.egg_warm', { min: Math.ceil(st.world.eggHatchTimer) }), enabled: false, act: () => undefined });
    }
    list.push({ id: 'shop', x: POI.shop.x, y: POI.shop.y + 18, label: t('act.shop'), enabled: true, act: () => this.hooks.openShop() });
    list.push({
      id: 'temple',
      x: POI.templeGate.x,
      y: POI.templeGate.y + 20,
      label: t('act.examine'),
      enabled: true,
      act: () => this.hooks.info(st.island.visuals.includes('temple_glow') ? t('temple.glowing') : t('temple.sealed')),
    });

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
          id: p.id,
          x: p.x,
          y: p.y + 20,
          label: produce ? t('act.harvest', { n: produce }) : t('act.garden_growing'),
          enabled: produce > 0,
          act: () => this.report(g.harvestGarden(p.id, { x: p.x, y: p.y - 10 })),
        });
      }
    }
    this.interactables = list;

    // nearest interactable within reach
    let best: Interactable | null = null;
    let bestD = INTERACT_RANGE;
    for (const i of list) {
      const d = Math.hypot(i.x - this.player.x, i.y - this.player.y);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    }
    this.current = best;
    const key = best ? `${best.id}|${best.label}|${best.enabled}` : '';
    if (key !== this.lastPromptKey) {
      this.lastPromptKey = key;
      this.hooks.prompt(best ? { label: best.label, enabled: best.enabled } : null);
    }
  }

  private doGather(id: string): void {
    const v = this.nodeViews.get(id);
    if (v && !this.settings.reducedMotion) {
      this.tweens.add({ targets: v, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 1, onComplete: () => v.setAngle(0) });
    }
    this.report(this.game_.gather(id));
  }

  private report(r: { ok: boolean; message?: string }): void {
    if (r.message) this.hooks.info(r.message);
  }

  // ------------------------------------------------------------------ effects

  private updateSense(): void {
    const st = this.game_.state;
    const on = this.mode === 'play' && st.pip.abilities.includes('sense') && st.pip.enabled.sense;
    let target: { x: number; y: number } | null = null;
    if (on) {
      const candidates: { x: number; y: number }[] = [];
      if (st.quests.q_egg.status === 'active' && st.world.egg === 'hidden') candidates.push(POI.egg);
      if (st.quests.q_lake.status === 'active') {
        for (const n of NODES) if (n.kind === 'debris' && !st.world.debrisCleared.includes(n.id)) candidates.push(n);
      }
      for (const c of this.creatures.values()) {
        if (this.creatureVisible(c.id) && st.creatures[c.id].state === 'unknown') candidates.push({ x: c.sprite.x, y: c.sprite.y });
      }
      let best = Infinity;
      for (const c of candidates) {
        const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
        if (d > 90 && d < best) {
          best = d;
          target = c;
        }
      }
    }
    this.senseArrow.setVisible(!!target);
    if (target) {
      const a = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      this.senseArrow.setPosition(this.player.x + Math.cos(a) * 34, this.player.y - 14 + Math.sin(a) * 34).setRotation(a);
    }
  }

  private updateNight(): void {
    const st = this.game_.state;
    const dark = this.game_.darkness();
    const glow = st.pip.abilities.includes('glow') && st.pip.enabled.glow;
    const maxAlpha = glow ? 0.62 : 0.42;
    const alpha = this.settings.graphics === 'low' ? dark * maxAlpha * 0.7 : dark * maxAlpha;
    const rt = this.night;
    if (alpha <= 0.01) {
      rt.setVisible(false);
      return;
    }
    const v = this.cameras.main.worldView;
    rt.setVisible(true).setPosition(v.x - NIGHT_MARGIN, v.y - NIGHT_MARGIN);
    rt.clear();
    rt.fill(0x0b1236, alpha);
    const light = (x: number, y: number, r: number) => {
      if (x < v.x - r || x > v.right + r || y < v.y - r || y > v.bottom + r) return;
      this.lightBrush.setScale((r * 2) / (64 * RES)).setPosition(x - rt.x, y - rt.y);
      rt.erase(this.lightBrush);
    };
    if (this.mode === 'play' && glow) light(this.pip.x, this.pip.y + 10, 150);
    if (st.island.level >= 3) for (const o of this.decor.lanterns) light((o as Phaser.GameObjects.Image).x, (o as Phaser.GameObjects.Image).y - 18, 70);
    for (const n of NODES) if (n.kind === 'grove' && st.world.nodes[n.id].stage === 'tree') light(n.x, n.y - 20, 50);
    if (st.island.visuals.includes('forest_ancient')) light(px(59.5), px(21) - 60, 160);
    if (st.island.visuals.includes('temple_glow')) light(POI.templeGate.x, POI.templeGate.y, 90);
    const fox = this.creatures.get('glowfox');
    if (fox?.sprite.visible) light(fox.sprite.x, fox.sprite.y - 8, 50);
  }

  private floatText(x: number, y: number, text: string): void {
    const tx = this.add
      .text(x, y, text, { fontFamily: 'Nunito, system-ui, sans-serif', fontSize: '15px', color: '#ffffff', stroke: '#2b2135', strokeThickness: 4 })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(30000);
    this.tweens.add({ targets: tx, y: y - 30, alpha: 0, duration: 1100, ease: 'Cubic.out', onComplete: () => tx.destroy() });
  }

  private pipSay(text: string): void {
    if (this.mode !== 'play') return;
    const bubble = this.add
      .text(0, 0, text, {
        fontFamily: 'Nunito, system-ui, sans-serif',
        fontSize: '12px',
        color: '#2b2135',
        backgroundColor: '#ffffffee',
        padding: { x: 8, y: 6 },
        wordWrap: { width: 190 },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setResolution(2)
      .setDepth(40000);
    const follow = () => bubble.setPosition(this.pip.x, this.pip.y - 16);
    follow();
    this.events.on('postupdate', follow);
    this.time.delayedCall(5200, () => {
      this.events.off('postupdate', follow);
      this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.destroy() });
    });
  }

  private celebrate(): void {
    if (this.mode !== 'play') return;
    this.burst(this.player.x, this.player.y - 20, 0xfff6b0, this.settings.graphics === 'low' ? 6 : 14);
    if (!this.settings.reducedMotion) this.cameras.main.flash(250, 255, 255, 220);
  }

  private burst(x: number, y: number, tint: number, count: number): void {
    if (this.settings.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const s = this.add.image(x, y, 'spark').setScale(1 / RES).setTint(tint).setDepth(30000);
      const a = (i / count) * Math.PI * 2;
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * (30 + Math.random() * 30),
        y: y + Math.sin(a) * (20 + Math.random() * 30),
        alpha: 0,
        angle: 180,
        duration: 700,
        ease: 'Cubic.out',
        onComplete: () => s.destroy(),
      });
    }
  }
}

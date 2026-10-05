import Phaser from 'phaser';
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_REACH,
  DODGE_COOLDOWN_MS,
  DODGE_MS,
  ENEMIES,
  INVULN_MS,
  PIP_BURST_COOLDOWN_MS,
  PIP_BURST_RADIUS,
  PIP_BURST_STUN_MS,
  damageTaken,
  type EnemyKind,
} from '../core/combat';
import { INTERACT_RANGE } from '../core/config';
import { CREATURES, ITEMS } from '../core/content';
import type { Dialog, Game } from '../core/game';
import { t } from '../core/i18n';
import type { AreaId, BuildingId, CreatureId, MinigameKind, Settings, ZoneId } from '../core/types';
import { OUTLINED, RES, makeNovaTexture, makeTextures, outlineTexture } from './art';
import { makeMvpTextures } from './art2';
import { makeExtraTextures } from './art3';

/** Callbacks from the world to the HTML UI. */
export interface SceneHooks {
  prompt(p: { label: string; enabled: boolean; combat: boolean } | null): void;
  dialog(d: Dialog): void;
  openShop(): void;
  openWorkshop(): void;
  startFishing(): void;
  choosePlot(plotId: string, building: BuildingId): void;
  info(text: string): void;
  zoneChanged(zone: ZoneId): void;
  /** Ask the app to move Nova to another area. */
  travel(area: AreaId, arrive: string): void;
  combat(active: boolean): void;
  bossBar(hp: number, max: number): void;
  openKitchen(): void;
  /** Mini-game status line (null hides it). */
  minigame(text: string | null): void;
}

export interface WorldData {
  game: Game;
  mode: 'menu' | 'play';
  hooks: SceneHooks;
  settings: Settings;
  area: AreaId;
  /** Where to place Nova: 'saved' (last position), 'spawn' or a named arrival point. */
  arrive: string;
}

export interface Interactable {
  id: string;
  x: number;
  y: number;
  label: string;
  enabled: boolean;
  act: () => void;
}

export type Blocker = { kind: 'circle'; x: number; y: number; r: number } | { kind: 'rect'; x: number; y: number; w: number; h: number };

export interface Enemy {
  kind: EnemyKind;
  sprite: Phaser.GameObjects.Image;
  warn: Phaser.GameObjects.Image;
  hp: number;
  max: number;
  state: 'idle' | 'chase' | 'windup' | 'lunge' | 'recover';
  timer: number;
  stunUntil: number;
  home: { x: number; y: number };
  lunge: { x: number; y: number };
  hitThisLunge: boolean;
  tag?: string;
  /** Boss-only data. */
  boss?: { phase: 'chase' | 'slam' | 'charge' | 'exposed'; ring: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; target: { x: number; y: number }; summoned: number };
}

interface Particle {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
  phase: number;
}

type ParticleKind = 'raindrop' | 'snowflake' | 'petal' | 'leaf' | 'firefly' | null;

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  damage: number;
}

const SPEED = 150;
const NIGHT_MARGIN = 160;

export const img = (scene: Phaser.Scene, x: number, y: number, key: string, originY = 1) =>
  scene.add.image(x, y, key).setOrigin(0.5, originY).setScale(1 / RES);

/** Font stack for text drawn in the world: system fonts are measured correctly on every phone. */
export const WORLD_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * A character's name tag. Roomy padding (and a sharper resolution) so that bold names are never
 * clipped on phones whose fonts measure narrower than they draw.
 */
export const nameTag = (scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Text =>
  scene.add
    .text(x, y, text, {
      fontFamily: WORLD_FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#2b2135d9',
      padding: { left: 7, right: 9, top: 4, bottom: 4 },
      testString: '|MÉqgyÅ',
    })
    .setOrigin(0.5, 1)
    .setResolution(3)
    .setDepth(9400)
    .setVisible(false);

/**
 * Shared play logic for every map: Nova and Pip, movement and collision, interaction prompts,
 * day/night lighting, Pip's chatter and the real-time combat system (App Flow 19).
 */
export abstract class PlayScene extends Phaser.Scene {
  protected game_!: Game;
  protected hooks!: SceneHooks;
  protected settings!: Settings;
  protected mode: 'menu' | 'play' = 'menu';
  protected area: AreaId = 'island';
  protected arrive = 'saved';

  protected player!: Phaser.GameObjects.Container;
  protected novaSprite!: Phaser.GameObjects.Image;
  protected shieldIcon!: Phaser.GameObjects.Image;
  protected pip!: Phaser.GameObjects.Container;
  private pipSprite!: Phaser.GameObjects.Image;
  private pipCrown!: Phaser.GameObjects.Image;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private joystick = { x: 0, y: 0 };
  protected moveTarget: { x: number; y: number } | null = null;
  private pendingInteract: string | null = null;
  protected facing = 1;
  protected aim = { x: 1, y: 0 };
  private walkTime = 0;

  protected blockers: Blocker[] = [];
  protected interactables: Interactable[] = [];
  private current: Interactable | null = null;
  private lastPromptKey = '';

  private night!: Phaser.GameObjects.RenderTexture;
  private lightBrush!: Phaser.GameObjects.Image;
  private senseArrow!: Phaser.GameObjects.Image;

  protected dirty = true;
  private tickAcc = 0;
  private chatterAt = 0;
  protected paused = false;
  private unsubs: (() => void)[] = [];
  /** Null until the first zone check, so every scene start reports its zone to the HUD. */
  protected zone: ZoneId | null = null;

  // combat
  protected enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private dodgeUntil = 0;
  private dodgeReadyAt = 0;
  private invulnUntil = 0;
  private attackReadyAt = 0;
  private burstReadyAt = 0;
  private companionReadyAt = 0;
  private blocking = false;
  private inCombat = false;
  protected follower: Phaser.GameObjects.Image | null = null;

  init(data: WorldData): void {
    this.game_ = data.game;
    this.hooks = data.hooks;
    this.mode = data.mode;
    this.settings = data.settings;
    this.area = data.area;
    this.arrive = data.arrive;
    this.moveTarget = null;
    this.pendingInteract = null;
    this.paused = false;
    this.dirty = true;
    this.blockers = [];
    this.interactables = [];
    this.enemies = [];
    this.projectiles = [];
    this.blocking = false;
    this.inCombat = false;
    this.follower = null;
    this.keys = {};
    this.lastPromptKey = '';
    this.zone = null;
    this.resetWorld();
  }

  // ---------------------------------------------------------------- hooks for subclasses

  protected abstract resetWorld(): void;
  protected abstract buildWorld(): void;
  protected abstract worldSize(): { w: number; h: number };
  protected abstract arrivalPoint(): { x: number; y: number };
  protected abstract groundWalkable(x: number, y: number): boolean;
  /** Refresh visuals from game state and rebuild `this.blockers`. */
  protected abstract syncWorld(): void;
  protected abstract collectInteractables(list: Interactable[]): void;
  protected abstract senseCandidates(): { x: number; y: number }[];
  protected abstract worldLights(light: (x: number, y: number, r: number) => void): void;
  protected abstract baseDarkness(): number;
  protected updateWorld(_time: number, _dt: number): void {}
  protected menuCamera(_dt: number): void {}
  protected checkZone(): void {}
  protected backgroundColor(): string {
    return '#2b9fd0';
  }

  /** Is this map under the open sky (weather and season particles)? */
  protected outdoor(): boolean {
    return true;
  }

  create(): void {
    makeTextures(this);
    makeMvpTextures(this);
    makeExtraTextures(this);
    OUTLINED.forEach((k) => outlineTexture(this, k));
    this.particles = [];
    this.particleKind = null;
    this.fogs = [];
    this.photoMode = false;
    this.buildWorld();
    this.createPlayer();
    this.createNight();

    const cam = this.cameras.main;
    cam.setBackgroundColor(this.backgroundColor());
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);

    if (this.mode === 'play') {
      cam.startFollow(this.player, true, 0.12, 0.12);
      this.bindKeys();
      this.input.on('pointerup', this.onTap, this);
      this.chatterAt = this.time.now + 25000;
      this.checkZone();
    }

    const ev = this.game_.events;
    this.unsubs.push(
      ev.on('changed', () => (this.dirty = true)),
      ev.on('float', (f) => this.floatText(f.x, f.y, f.text)),
      ev.on('pipSay', (p) => this.pipSay(p.text)),
      ev.on('worldChange', () => this.celebrate()),
      ev.on('levelup', () => this.celebrate()),
    );
    this.events.once('shutdown', () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.scale.off('resize', this.applyZoom, this);
      this.input.keyboard?.removeAllListeners();
      this.hooks.combat(false);
      this.hooks.bossBar(0, 0);
      this.hooks.minigame(null);
    });
    this.hooks.prompt(null);
    this.syncAll();
  }

  private bindKeys(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    const k = this.settings.keys;
    const on = (key: string, fn: () => void) => kb.on(`keydown-${key}`, fn);
    on(k.interact, () => this.interact());
    on('SPACE', () => this.interact());
    on('ENTER', () => this.interact());
    on(k.dodge, () => this.dodge());
    on(k.ability, () => this.pipBurst());
    on(k.block, () => this.setBlocking(true));
    kb.on(`keyup-${k.block}`, () => this.setBlocking(false));
    on('ONE', () => this.report(this.game_.eatBest()));
    on('TWO', () => this.report(this.game_.eat('tonic')));
    on('THREE', () => this.report(this.game_.usePurifier()));
  }

  private createPlayer(): void {
    const start = this.arrivalPoint();
    const shadow = this.add.image(0, 0, 'shadow').setScale(1 / RES);
    const p = this.game_.state.player;
    this.novaKey = makeNovaTexture(this, p.appearance, p.cosmetics);
    this.novaSprite = this.add.image(0, 2, this.novaKey).setOrigin(0.5, 1).setScale(1 / RES);
    this.shieldIcon = this.add.image(12, -10, 'shield').setScale(0.8 / RES).setVisible(false);
    this.player = this.add.container(start.x, start.y, [shadow, this.novaSprite, this.shieldIcon]);
    this.player.setVisible(this.mode === 'play');

    const glow = this.add.image(0, 0, 'glow').setScale(0.9 / RES).setAlpha(0.6).setTint(0x9fefff);
    this.pipSprite = this.add.image(0, 0, 'pip_happy').setScale(1 / RES);
    this.pipCrown = this.add.image(0, -10, 'crown').setScale(1 / RES).setVisible(false);
    this.pip = this.add.container(start.x - 26, start.y - 30, [glow, this.pipSprite, this.pipCrown]);
    this.pip.setDepth(20000).setVisible(this.mode === 'play');
    this.senseArrow = this.add.image(0, 0, 'arrow').setScale(0.8 / RES).setDepth(20001).setVisible(false);

    // A bonded Glowfox travels with Nova everywhere.
    const fox = this.game_.state.creatures.glowfox;
    if (this.mode === 'play' && fox.state === 'bonded') {
      this.follower = img(this, start.x + 30, start.y + 10, fox.evolved ? 'lumifox' : 'glowfox');
      this.breathe(this.follower);
    }
  }

  private createNight(): void {
    this.night = this.add.renderTexture(0, 0, 10, 10).setOrigin(0).setDepth(50000);
    this.lightBrush = this.make.image({ key: 'glow', add: false });
  }

  protected applyZoom(): void {
    const cam = this.cameras.main;
    const short = Math.min(this.scale.width, this.scale.height);
    // small maps zoom in a little on tall screens; any remaining margin shows the zone's rock colour
    const { w, h } = this.worldSize();
    const base = Phaser.Math.Clamp(short / 600, 0.7, 1.6);
    const fill = Math.max(this.scale.width / w, this.scale.height / h);
    const zoom = Math.max(base, Math.min(fill, base * 1.35));
    cam.setZoom(zoom);
    // Let the camera scroll a little past the map edges so things at the edge (like the temple gate)
    // can always be moved out from under the HUD (status box on top, joystick and buttons below).
    const padTop = 290 / zoom;
    const padBottom = 240 / zoom;
    const padX = 100 / zoom;
    cam.setBounds(-padX, -padTop, w + padX * 2, h + padTop + padBottom);
    this.night.resize(Math.ceil(this.scale.width / zoom) + NIGHT_MARGIN * 2, Math.ceil(this.scale.height / zoom) + NIGHT_MARGIN * 2);
  }

  // ---------------------------------------------------------------- public API (used by the UI)

  setJoystick(x: number, y: number): void {
    this.joystick = { x, y };
    if (x || y) this.moveTarget = null;
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.setBlocking(false);
  }

  applySettings(s: Settings): void {
    this.settings = s;
  }

  playerPosition(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  /** Attack if an enemy is in reach, otherwise use whatever Nova is standing next to. */
  interact(): void {
    if (this.paused || this.mode !== 'play') return;
    if (this.enemyInReach()) {
      this.attack();
      return;
    }
    if (this.current?.enabled) this.current.act();
    else if (this.current) this.hooks.info(this.current.label);
  }

  dodge(): void {
    if (this.paused || this.mode !== 'play' || this.time.now < this.dodgeReadyAt) return;
    this.dodgeUntil = this.time.now + DODGE_MS;
    this.dodgeReadyAt = this.time.now + DODGE_COOLDOWN_MS;
    this.game_.events.emit('sfx', 'dodge');
    // a quick dash with dust behind Nova (no fading in and out)
    this.burst(this.player.x, this.player.y, 0xd9c9a8, 5);
  }

  setBlocking(on: boolean): void {
    this.blocking = on && !this.paused && this.mode === 'play';
    this.shieldIcon?.setVisible(this.blocking);
  }

  /** Pip's Glow burst: stuns nearby enemies (App Flow 19: ability). */
  pipBurst(): void {
    if (this.paused || this.mode !== 'play') return;
    if (!this.game_.state.pip.abilities.includes('glow')) return;
    if (this.time.now < this.burstReadyAt) {
      this.hooks.info(t('combat.burst_wait', { s: Math.ceil((this.burstReadyAt - this.time.now) / 1000) }));
      return;
    }
    this.burstReadyAt = this.time.now + PIP_BURST_COOLDOWN_MS;
    this.game_.events.emit('sfx', 'magic');
    const ring = img(this, this.pip.x, this.pip.y, 'pulse', 0.5).setDepth(30000);
    this.tweens.add({ targets: ring, scale: (PIP_BURST_RADIUS * 2) / (64 * RES) * 1, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) > PIP_BURST_RADIUS + (e.boss ? 40 : 0)) continue;
      e.stunUntil = this.time.now + PIP_BURST_STUN_MS * (e.boss ? 0.5 : 1);
      e.state = 'recover';
      e.timer = 300;
      e.warn.setVisible(false);
      this.damageEnemy(e, 1);
    }
  }

  // ---------------------------------------------------------------- input

  private onTap(pointer: Phaser.Input.Pointer): void {
    if (this.paused || pointer.getDistance() > 12 || pointer.getDuration() > 600) return;
    if (this.onWorldTap(pointer.worldX, pointer.worldY)) return;
    const wx = pointer.worldX;
    const wy = pointer.worldY;
    const enemy = this.enemies.find((e) => Math.hypot(e.sprite.x - wx, e.sprite.y - 12 - wy) < (e.boss ? 50 : 24));
    if (enemy) {
      this.aim = this.unit(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      if (this.enemyInReach()) this.attack();
      else this.moveTarget = { x: enemy.sprite.x, y: enemy.sprite.y };
      return;
    }
    const hit = this.interactables
      .filter((i) => Math.hypot(i.x - wx, i.y - 10 - wy) < 30)
      .sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0];
    if (hit) {
      if (Math.hypot(hit.x - this.player.x, hit.y - this.player.y) <= INTERACT_RANGE + 6) {
        this.current = hit;
        if (hit.enabled) hit.act();
        else this.hooks.info(hit.label);
      } else {
        this.moveTarget = { x: hit.x, y: hit.y + 18 };
        this.pendingInteract = hit.id;
      }
      return;
    }
    this.moveTarget = { x: wx, y: wy };
    this.pendingInteract = null;
  }

  /** Subclasses can claim taps first (e.g. build-plot selection). */
  protected onWorldTap(_x: number, _y: number): boolean {
    return false;
  }

  // ---------------------------------------------------------------- main loop

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    if (this.mode === 'menu') {
      this.menuCamera(dt);
      this.updateWorld(time, dt);
      this.updateNight();
      if (this.dirty) this.syncAll();
      return;
    }
    // a new day, season or weather changes how the world looks
    const sky = `${this.game_.day}|${this.game_.weather()}`;
    if (sky !== this.lastSky) {
      this.lastSky = sky;
      this.dirty = true;
    }
    if (!this.paused) {
      this.tickAcc += dt;
      if (this.tickAcc >= 1) {
        this.game_.tick(Math.floor(this.tickAcc));
        this.tickAcc -= Math.floor(this.tickAcc);
      }
      this.movePlayer(dt);
      this.updateCombat(time, dt);
    }
    this.updatePip(time, dt);
    this.updateFollower(dt);
    this.updateWorld(time, dt);
    if (this.dirty) this.syncAll();
    this.updateInteractables();
    this.updateSense();
    this.updateNight();
    this.updateSky(time, dt);
    if (!this.paused && time > this.chatterAt) {
      this.chatterAt = time + 70000 + Math.random() * 40000;
      this.pipSay(this.game_.pipChatter());
    }
  }

  protected syncAll(): void {
    this.dirty = false;
    const st = this.game_.state;
    this.pipCrown?.setVisible(st.pip.cosmetic === 'flower_crown');
    this.syncWorld();
    this.unstick();
  }

  /**
   * If something now stands where Nova is (a new building or decoration, or an old saved spot),
   * move Nova to the nearest free place so they can never be trapped.
   */
  protected unstick(): void {
    if (this.mode !== 'play' || !this.player || this.canStand(this.player.x, this.player.y)) return;
    const { x, y } = this.player;
    for (let r = 12; r <= 320; r += 12) {
      // prefer the spot in front of (below) the obstacle, then try all around
      for (let k = 0; k < 16; k++) {
        const a = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const nx = x + Math.cos(a) * r;
        const ny = y + Math.sin(a) * r;
        if (this.canStand(nx, ny)) {
          this.player.setPosition(nx, ny);
          this.moveTarget = null;
          const pos = this.game_.state.player.position;
          pos.x = Math.round(nx);
          pos.y = Math.round(ny);
          return;
        }
      }
    }
  }

  private unit(x: number, y: number): { x: number; y: number } {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  }

  private movePlayer(dt: number): void {
    let vx = 0;
    let vy = 0;
    const k = this.keys;
    if (k.A?.isDown || k.LEFT?.isDown) vx -= 1;
    if (k.D?.isDown || k.RIGHT?.isDown) vx += 1;
    if (k.W?.isDown || k.UP?.isDown) vy -= 1;
    if (k.S?.isDown || k.DOWN?.isDown) vy += 1;
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
          const id = this.pendingInteract;
          this.pendingInteract = null;
          this.updateInteractables();
          const it = this.interactables.find((i) => i.id === id);
          if (it) {
            this.current = it;
            if (it.enabled) it.act();
            else this.hooks.info(it.label);
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
    const dodging = this.time.now < this.dodgeUntil;
    let speed = SPEED * this.game_.speedMultiplier() * (this.blocking ? 0.45 : 1);
    if (dodging) {
      speed = SPEED * 3.2;
      if (len < 0.05) {
        vx = this.aim.x;
        vy = this.aim.y;
      }
    }
    const moving = Math.hypot(vx, vy) > 0.05;
    if (moving) {
      if (!dodging) this.aim = this.unit(vx, vy);
      const nx = this.player.x + vx * speed * dt;
      const ny = this.player.y + vy * speed * dt;
      const before = { x: this.player.x, y: this.player.y };
      if (this.canStand(nx, this.player.y)) this.player.x = nx;
      if (this.canStand(this.player.x, ny)) this.player.y = ny;
      if (this.moveTarget && before.x === this.player.x && before.y === this.player.y) this.moveTarget = null;
      if (Math.abs(vx) > 0.1) this.facing = vx > 0 ? 1 : -1;
      this.walkTime += dt;
      this.stepAcc += dt * (speed / SPEED);
      if (this.stepAcc > 0.3) {
        this.stepAcc = 0;
        this.game_.events.emit('sfx', this.footstepSound());
      }
    } else {
      this.walkTime = 0;
    }
    this.novaSprite.setFlipX(this.facing < 0);
    // walk cycle: stand, left step, stand, right step
    const frame = moving ? [0, 1, 0, 2][Math.floor(this.walkTime * 9) % 4] : 0;
    const key = frame ? `${this.novaKey}_${frame}` : this.novaKey;
    if (this.novaSprite.texture.key !== key) this.novaSprite.setTexture(key);
    this.novaSprite.y = moving && !this.settings.reducedMotion ? 2 - Math.abs(Math.sin(this.walkTime * 14)) * 2 : 2;
    this.player.setDepth(this.player.y);
    const pos = this.game_.state.player.position;
    pos.x = Math.round(this.player.x);
    pos.y = Math.round(this.player.y);
    this.checkZone();
  }

  private stepAcc = 0;
  private lastSky = '';
  private novaKey = '';
  private trailAcc = 0;

  /** Footsteps sound different on grass, sand, stone and fallen leaves. */
  protected footstepSound(): 'step_grass' | 'step_sand' | 'step_stone' | 'step_leaves' {
    switch (this.zone) {
      case 'caves':
      case 'temple':
        return 'step_stone';
      case 'lake':
      case 'isle':
        return 'step_sand';
      case 'grove':
        return 'step_leaves';
      default:
        return 'step_grass';
    }
  }

  /** Gentle idle "breathing" so villagers and creatures feel alive (a slow squash, never a flash). */
  protected breathe(sprite: Phaser.GameObjects.Image, delay = 0): void {
    if (this.settings.reducedMotion) return;
    const base = sprite.scaleY;
    this.tweens.add({ targets: sprite, scaleY: base * 1.045, scaleX: sprite.scaleX * 0.985, duration: 1100 + Math.random() * 400, delay, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  protected canStand(x: number, y: number, r = 8): boolean {
    if (!this.groundWalkable(x, y)) return false;
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
    this.pipSprite.setTexture(`pip_${this.game_.state.pip.mood}`);
    // a soft sparkle trail behind Pip while it flies
    this.trailAcc += dt;
    const flying = Math.hypot(tx - this.pip.x, ty - this.pip.y) > 6;
    if (flying && this.trailAcc > 0.09 && !this.settings.reducedMotion && this.settings.graphics !== 'low') {
      this.trailAcc = 0;
      const sp = this.add
        .image(this.pip.x + (Math.random() - 0.5) * 8, this.pip.y + 6, 'spark')
        .setScale(0.7 / RES)
        .setTint([0xbff3ff, 0xfff6b0, 0xffc8e6][Math.floor(Math.random() * 3)])
        .setDepth(19999);
      this.tweens.add({ targets: sp, y: sp.y + 10, alpha: 0, scale: 0.2 / RES, duration: 600, onComplete: () => sp.destroy() });
    }
  }

  private updateFollower(dt: number): void {
    const f = this.follower;
    if (!f) return;
    const tx = this.player.x - 40 * this.facing;
    const ty = this.player.y + 14;
    const d = Math.hypot(tx - f.x, ty - f.y);
    if (d > 400) f.setPosition(tx, ty);
    else if (d > 4) {
      const sp = d > 120 ? 230 : 130;
      f.x += ((tx - f.x) / d) * Math.min(d, sp * dt);
      f.y += ((ty - f.y) / d) * Math.min(d, sp * dt);
      f.setFlipX(tx < f.x);
    }
    f.setDepth(f.y);
  }

  // ---------------------------------------------------------------- interactions

  private updateInteractables(): void {
    const list: Interactable[] = [];
    this.collectInteractables(list);
    let best: Interactable | null = null;
    let bestD = INTERACT_RANGE;
    for (const i of list) {
      const d = Math.hypot(i.x - this.player.x, i.y - this.player.y);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    }
    // The companion always walks right next to Nova, so it is only offered when nothing else is in reach;
    // otherwise it would hide doors and entrances (e.g. "Pet Lumifox" instead of "Enter Ancient Temple").
    if (this.follower) {
      const pet = this.creatureInteractable('glowfox', this.follower);
      list.push(pet);
      if (!best && Math.hypot(pet.x - this.player.x, pet.y - this.player.y) < INTERACT_RANGE) best = pet;
    }
    this.interactables = list;
    this.current = best;
    const fight = this.enemyInReach();
    // hysteresis: show combat controls under 260px, hide only beyond 320px, so they never flicker
    const limit = this.inCombat ? 320 : 260;
    const near = this.enemies.some((e) => Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) < limit);
    if (near !== this.inCombat) {
      this.inCombat = near;
      this.hooks.combat(near);
    }
    const label = fight ? t('combat.attack') : best?.label;
    const key = fight ? 'attack' : best ? `${best.id}|${best.label}|${best.enabled}` : '';
    if (key !== this.lastPromptKey) {
      this.lastPromptKey = key;
      this.hooks.prompt(label ? { label, enabled: fight || !!best?.enabled, combat: fight } : null);
    }
  }

  protected report(r: { ok: boolean; message?: string }): void {
    if (r.message) this.hooks.info(r.message);
  }

  /** Feed, pet or evolve a creature (shared by every map). */
  protected creatureInteractable(id: CreatureId, sprite: Phaser.GameObjects.Image): Interactable {
    const g = this.game_;
    const cs = g.state.creatures[id];
    const likes = CREATURES[id].likes;
    const name = g.creatureName(id);
    const label =
      cs.state === 'bonded'
        ? g.canEvolve(id)
          ? t('act.evolve', { name })
          : g.wantsTreat(id)
            ? t('act.treat', { name, icon: ITEMS[likes].icon })
            : t('act.pet', { name })
        : t('act.feed', { name, icon: ITEMS[likes].icon });
    return {
      id: `creature_${id}`,
      x: sprite.x,
      y: sprite.y,
      label,
      enabled: true,
      act: () => {
        const play = cs.state === 'bonded' && !g.canEvolve(id) && !g.wantsTreat(id) ? this.playOffer(id) : null;
        if (play) {
          g.interactCreature(id, { x: sprite.x, y: sprite.y });
          this.hooks.dialog({
            npc: 'pip',
            speaker: 'Pip',
            lines: [t(`play.offer_${play}`, { name })],
            options: [
              { id: `play:${play}`, label: t(`play.start_${play}`) },
              { id: 'later', label: t('dialog.later') },
            ],
          });
          return;
        }
        if (g.canEvolve(id)) {
          const evo = CREATURES[id].evolution!;
          const cost = Object.entries(evo.cost).map(([i, n]) => `${n} ${ITEMS[i as keyof typeof ITEMS].icon}`).join(' ');
          this.hooks.dialog({
            npc: 'pip',
            speaker: 'Pip',
            lines: [t('evolve.offer', { name, into: t(`evo.${evo.into}`), cost })],
            options: [
              { id: `evolve:${id}`, label: t('evolve.yes') },
              { id: 'later', label: t('dialog.later') },
            ],
          });
          return;
        }
        this.report(g.interactCreature(id, { x: sprite.x, y: sprite.y }));
      },
    };
  }

  /** Which mini-game a bonded creature offers here (none by default). */
  protected playOffer(_id: CreatureId): MinigameKind | null {
    return null;
  }

  // ---------------------------------------------------------------- photo mode

  protected photoMode = false;

  setPhotoMode(on: boolean): void {
    this.photoMode = on;
    this.setPaused(on);
    this.senseArrow?.setVisible(false);
    if (on) {
      this.game_.state.pip.mood = 'excited';
      this.moveTarget = null;
      this.joystick = { x: 0, y: 0 };
      this.hooks.prompt(null);
      this.lastPromptKey = '';
    } else {
      this.applyZoom();
    }
  }

  /** Zoom the camera for a closer photo (1 = normal). */
  setPhotoZoom(f: number): void {
    this.applyZoom();
    const cam = this.cameras.main;
    cam.setZoom(cam.zoom * f);
  }

  // ---------------------------------------------------------------- weather & seasons

  private particles: Particle[] = [];
  private particleKind: ParticleKind = null;
  private fogs: Phaser.GameObjects.Image[] = [];

  /** Fog is thicker in the highlands, and there is always morning mist up there. */
  protected fogLevel(): number {
    return this.game_.weather() === 'fog' ? 0.55 : 0;
  }

  private wantedParticles(): { kind: ParticleKind; count: number } {
    const g = this.game_;
    if (!this.outdoor() || this.settings.reducedMotion) return { kind: null, count: 0 };
    const scale = this.settings.graphics === 'low' ? 0.4 : this.settings.graphics === 'medium' ? 0.7 : 1;
    const w = g.weather();
    const season = g.season();
    let kind: ParticleKind = null;
    let count = 0;
    if (w === 'rain') [kind, count] = ['raindrop', 140];
    else if (w === 'snow') [kind, count] = ['snowflake', 90];
    else if (season === 'spring') [kind, count] = ['petal', 22];
    else if (season === 'autumn') [kind, count] = ['leaf', 22];
    else if (season === 'winter') [kind, count] = ['snowflake', 20];
    else if (season === 'summer' && g.darkness() > 0.5) [kind, count] = ['firefly', 26];
    return { kind, count: Math.round(count * scale) };
  }

  private spawnParticle(kind: Exclude<ParticleKind, null>, v: Phaser.Geom.Rectangle, anywhere: boolean): Particle {
    const x = v.x + Math.random() * v.width;
    const y = anywhere ? v.y + Math.random() * v.height : v.y - 20;
    const tex = kind === 'firefly' ? 'spark' : kind;
    const sprite = this.add.image(x, y, tex).setScale(1 / RES).setDepth(45000);
    let vx = 0;
    let vy = 0;
    if (kind === 'raindrop') {
      vx = -40;
      vy = 520 + Math.random() * 120;
      sprite.setRotation(0.08).setAlpha(0.7);
    } else if (kind === 'snowflake') {
      vy = 30 + Math.random() * 30;
      sprite.setScale((0.5 + Math.random() * 0.6) / RES);
    } else if (kind === 'firefly') {
      sprite.setTint(0xd8ff7a).setScale(0.8 / RES);
    } else {
      vx = 12 + Math.random() * 18;
      vy = 22 + Math.random() * 20;
    }
    return { sprite, vx, vy, spin: (Math.random() - 0.5) * 3, phase: Math.random() * Math.PI * 2 };
  }

  private updateSky(time: number, dt: number): void {
    const v = this.cameras.main.worldView;
    const want = this.wantedParticles();
    if (want.kind !== this.particleKind) {
      this.particles.forEach((p) => p.sprite.destroy());
      this.particles = [];
      this.particleKind = want.kind;
    }
    const kind = this.particleKind;
    while (kind && this.particles.length < want.count) this.particles.push(this.spawnParticle(kind, v, true));
    while (this.particles.length > want.count) this.particles.pop()!.sprite.destroy();
    for (const p of this.particles) {
      const s = p.sprite;
      if (kind === 'firefly') {
        p.phase += dt;
        s.x += Math.cos(p.phase * 0.7) * 12 * dt;
        s.y += Math.sin(p.phase * 1.1) * 10 * dt;
        s.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(p.phase * 1.6)));
      } else {
        p.phase += dt;
        s.x += (p.vx + (kind === 'raindrop' ? 0 : Math.sin(p.phase * 1.5) * 18)) * dt;
        s.y += p.vy * dt;
        if (kind !== 'raindrop') s.rotation += p.spin * dt;
      }
      // recycle anything that leaves the view
      if (s.y > v.bottom + 20 || s.x < v.x - 40 || s.x > v.right + 40 || s.y < v.y - 60) {
        s.setPosition(v.x + Math.random() * v.width, kind === 'firefly' ? v.y + Math.random() * v.height : v.y - 10 - Math.random() * 30);
      }
    }
    // drifting fog banks
    const fog = this.outdoor() ? this.fogLevel() : 0;
    const banks = fog > 0 ? (this.settings.graphics === 'low' ? 5 : 9) : 0;
    while (this.fogs.length < banks) {
      const f = this.add
        .image(v.x + Math.random() * v.width, v.y + Math.random() * v.height, 'fog')
        .setScale((2.5 + Math.random() * 2) / RES)
        .setDepth(46000);
      this.fogs.push(f);
    }
    while (this.fogs.length > banks) this.fogs.pop()!.destroy();
    for (const f of this.fogs) {
      f.setAlpha(fog * 0.6);
      if (!this.settings.reducedMotion) f.x += 10 * dt;
      if (f.x - f.displayWidth / 2 > v.right) f.setPosition(v.x - f.displayWidth / 2, v.y + Math.random() * v.height);
      if (f.y < v.y - 100 || f.y > v.bottom + 100) f.y = v.y + Math.random() * v.height;
    }
    void time;
  }

  // ---------------------------------------------------------------- combat

  protected spawnEnemy(kind: EnemyKind, x: number, y: number, tag?: string): Enemy {
    const key = kind === 'gloomling' ? 'gloomling' : kind === 'wisp' ? 'shade_wisp' : 'hollow';
    const sprite = img(this, x, y, key, kind === 'hollow' ? 0.5 : 1);
    const warn = img(this, x, y - 30, 'warn').setDepth(40000).setVisible(false);
    const max = kind === 'hollow' ? this.game_.bossHealth() : ENEMIES[kind].hp;
    const e: Enemy = { kind, sprite, warn, hp: max, max, state: 'idle', timer: 0, stunUntil: 0, home: { x, y }, lunge: { x: 0, y: 0 }, hitThisLunge: false, tag };
    if (kind === 'hollow') {
      e.boss = {
        phase: 'chase',
        ring: img(this, x, y, 'ring', 0.5).setDepth(-5000).setVisible(false),
        core: img(this, x, y + 10, 'hollow_core', 0.5).setDepth(40000).setVisible(false),
        target: { x, y },
        summoned: 0,
      };
      e.timer = 2500;
      this.hooks.bossBar(e.hp, e.max);
    } else if (!this.settings.reducedMotion) {
      this.tweens.add({ targets: sprite, scaleY: (1 / RES) * 0.92, duration: 500 + Math.random() * 200, yoyo: true, repeat: -1 });
    }
    this.enemies.push(e);
    return e;
  }

  private enemyInReach(): boolean {
    return this.enemies.some((e) => Math.hypot(e.sprite.x - this.player.x, e.sprite.y - this.player.y) < ATTACK_REACH + (e.boss ? 45 : 10));
  }

  private attack(): void {
    if (this.time.now < this.attackReadyAt) return;
    this.attackReadyAt = this.time.now + ATTACK_COOLDOWN_MS;
    // aim at the nearest enemy in reach
    const target = [...this.enemies].sort(
      (a, b) => Math.hypot(a.sprite.x - this.player.x, a.sprite.y - this.player.y) - Math.hypot(b.sprite.x - this.player.x, b.sprite.y - this.player.y),
    )[0];
    if (target) this.aim = this.unit(target.sprite.x - this.player.x, target.sprite.y - (target.boss ? 0 : 10) - this.player.y);
    if (Math.abs(this.aim.x) > 0.1) this.facing = this.aim.x > 0 ? 1 : -1;
    this.game_.events.emit('sfx', 'swing');
    const slash = img(this, this.player.x + this.aim.x * 22, this.player.y - 14 + this.aim.y * 22, 'slash', 0.5)
      .setRotation(Math.atan2(this.aim.y, this.aim.x))
      .setDepth(30000);
    this.tweens.add({ targets: slash, alpha: 0, duration: 180, onComplete: () => slash.destroy() });
    const dmg = this.game_.attackDamage();
    for (const e of [...this.enemies]) {
      const dx = e.sprite.x - this.player.x;
      const dy = e.sprite.y - (e.boss ? 0 : 10) - (this.player.y - 10);
      const d = Math.hypot(dx, dy);
      if (d > ATTACK_REACH + (e.boss ? 45 : 8)) continue;
      if (d > 20 && (dx * this.aim.x + dy * this.aim.y) / d < 0.1) continue;
      const exposed = e.boss?.phase === 'exposed';
      this.damageEnemy(e, exposed ? dmg * 2 : dmg);
      if (!e.boss && e.hp > 0) {
        e.sprite.x += (dx / (d || 1)) * 18;
        e.sprite.y += (dy / (d || 1)) * 18;
      }
    }
  }

  private damageEnemy(e: Enemy, n: number): void {
    e.hp -= n;
    this.floatText(e.sprite.x, e.sprite.y - (e.boss ? 60 : 30), `-${n}`);
    // a short, steady red tint marks the hit (no white flash)
    e.sprite.setTint(0xff9a9a);
    this.time.delayedCall(160, () => e.sprite.active && e.sprite.clearTint());
    this.game_.events.emit('sfx', 'hit');
    if (e.boss) this.hooks.bossBar(Math.max(0, e.hp), e.max);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    this.enemies = this.enemies.filter((x) => x !== e);
    this.burst(e.sprite.x, e.sprite.y - 12, 0xc86bff, e.boss ? 30 : 10);
    e.warn.destroy();
    e.boss?.ring.destroy();
    e.boss?.core.destroy();
    this.tweens.add({ targets: e.sprite, alpha: 0, scale: 0, duration: e.boss ? 1200 : 250, onComplete: () => e.sprite.destroy() });
    if (e.boss) {
      this.hooks.bossBar(0, 0);
      this.time.delayedCall(1300, () => this.hooks.dialog(this.game_.bossDefeated()));
    } else {
      this.game_.enemyDefeated(e.kind, { x: e.sprite.x, y: e.sprite.y - 20 });
    }
    this.onEnemyKilled(e);
  }

  protected onEnemyKilled(_e: Enemy): void {}

  private hitPlayer(raw: number, from: { x: number; y: number }): void {
    const now = this.time.now;
    if (now < this.dodgeUntil || now < this.invulnUntil || this.paused) return;
    const n = damageTaken(raw, this.blocking);
    this.invulnUntil = now + (n > 0 ? INVULN_MS : 300);
    if (n <= 0) {
      this.game_.events.emit('sfx', 'block');
      this.floatText(this.player.x, this.player.y - 40, t('combat.blocked'));
      return;
    }
    const d = Math.hypot(this.player.x - from.x, this.player.y - from.y) || 1;
    const kx = this.player.x + ((this.player.x - from.x) / d) * 20;
    const ky = this.player.y + ((this.player.y - from.y) / d) * 20;
    if (this.canStand(kx, ky)) this.player.setPosition(kx, ky);
    if (!this.settings.reducedMotion) {
      this.cameras.main.shake(120, 0.006);
      this.novaSprite.setTint(0xff9a9a);
      this.time.delayedCall(INVULN_MS / 2, () => this.novaSprite.clearTint());
    }
    this.game_.hurt(n); // a defeat is handled by the app (game 'defeated' event)
  }

  private moveEnemy(e: Enemy, tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - e.sprite.x;
    const dy = ty - e.sprite.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return;
    const step = Math.min(d, speed * dt);
    const nx = e.sprite.x + (dx / d) * step;
    const ny = e.sprite.y + (dy / d) * step;
    const r = e.boss ? 30 : 8;
    if (e.kind === 'wisp' || this.groundWalkable(nx, ny)) {
      if (e.kind === 'wisp' || this.canStand(nx, e.sprite.y, r)) e.sprite.x = nx;
      if (e.kind === 'wisp' || this.canStand(e.sprite.x, ny, r)) e.sprite.y = ny;
    }
    if (Math.abs(dx) > 1) e.sprite.setFlipX(dx < 0);
  }

  private updateCombat(time: number, dt: number): void {
    const ms = dt * 1000;
    const px = this.player.x;
    const py = this.player.y;
    for (const e of [...this.enemies]) {
      e.sprite.setDepth(e.boss ? e.sprite.y + 40 : e.sprite.y);
      e.warn.setPosition(e.sprite.x, e.sprite.y - (e.boss ? 70 : 32));
      if (time < e.stunUntil) {
        e.sprite.setAlpha(0.6);
        continue;
      }
      e.sprite.setAlpha(1);
      if (e.boss) {
        this.updateBoss(e, time, dt);
        continue;
      }
      const def = ENEMIES[e.kind];
      const d = Math.hypot(px - e.sprite.x, py - e.sprite.y);
      switch (e.state) {
        case 'idle':
          if (d < def.sight) e.state = 'chase';
          else if (Math.random() < 0.01) e.lunge = { x: e.home.x + (Math.random() - 0.5) * 60, y: e.home.y + (Math.random() - 0.5) * 60 };
          if (e.lunge.x) this.moveEnemy(e, e.lunge.x, e.lunge.y, def.speed * 0.4, dt);
          break;
        case 'chase':
          if (d > def.sight * 1.6) {
            e.state = 'idle';
            break;
          }
          if (d < def.reach) {
            e.state = 'windup';
            e.timer = def.windupMs;
            e.warn.setVisible(true);
            e.sprite.setTint(0xff8080);
          } else {
            this.moveEnemy(e, px, py, def.speed, dt);
          }
          break;
        case 'windup':
          e.timer -= ms;
          if (!this.settings.reducedMotion) e.sprite.x += Math.sin(time / 30) * 0.6;
          if (e.timer <= 0) {
            e.warn.setVisible(false);
            e.sprite.clearTint();
            if (def.ranged) {
              this.fireOrb(e.sprite.x, e.sprite.y - 12, px, py - 10, def.damage);
              e.state = 'recover';
              e.timer = def.recoverMs;
            } else {
              const u = this.unit(px - e.sprite.x, py - e.sprite.y);
              e.lunge = u;
              e.state = 'lunge';
              e.timer = 240;
              e.hitThisLunge = false;
            }
          }
          break;
        case 'lunge':
          e.timer -= ms;
          this.moveEnemy(e, e.sprite.x + e.lunge.x * 40, e.sprite.y + e.lunge.y * 40, 300, dt);
          if (!e.hitThisLunge && Math.hypot(px - e.sprite.x, py - e.sprite.y) < 24) {
            e.hitThisLunge = true;
            this.hitPlayer(def.damage, e.sprite);
          }
          if (e.timer <= 0) {
            e.state = 'recover';
            e.timer = def.recoverMs;
          }
          break;
        case 'recover':
          e.timer -= ms;
          if (e.timer <= 0) e.state = 'chase';
          break;
      }
    }
    // projectiles
    for (const p of [...this.projectiles]) {
      p.life -= dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.setDepth(p.sprite.y + 20);
      const hit = Math.hypot(p.sprite.x - px, p.sprite.y - (py - 10)) < 16;
      if (hit) this.hitPlayer(p.damage, p.sprite);
      if (hit || p.life <= 0 || !this.groundWalkable(p.sprite.x, p.sprite.y + 10)) {
        p.sprite.destroy();
        this.projectiles = this.projectiles.filter((q) => q !== p);
      }
    }
    // a bonded companion joins the fight
    const f = this.follower;
    if (f && time > this.companionReadyAt) {
      const target = this.enemies.find((e) => Math.hypot(e.sprite.x - f.x, e.sprite.y - f.y) < 150);
      if (target) {
        this.companionReadyAt = time + 2500;
        const evolved = this.game_.state.creatures.glowfox.evolved;
        const spark = img(this, f.x, f.y - 10, 'spark', 0.5).setDepth(30000).setTint(evolved ? 0x9fefff : 0xffd84a);
        this.tweens.add({
          targets: spark,
          x: target.sprite.x,
          y: target.sprite.y - 14,
          duration: 220,
          onComplete: () => {
            spark.destroy();
            if (this.enemies.includes(target)) this.damageEnemy(target, evolved ? 2 : 1);
          },
        });
      }
    }
  }

  private fireOrb(x: number, y: number, tx: number, ty: number, damage: number): void {
    const u = this.unit(tx - x, ty - y);
    const sprite = img(this, x, y, 'orb', 0.5).setDepth(30000);
    this.projectiles.push({ sprite, vx: u.x * 160, vy: u.y * 160, life: 2.2, damage });
  }

  /** The Hollow: telegraphed slams, charges and summons, then an exposed core (PRD Act 3). */
  private updateBoss(e: Enemy, _time: number, dt: number): void {
    const b = e.boss!;
    const ms = dt * 1000;
    const px = this.player.x;
    const py = this.player.y;
    e.timer -= ms;
    b.core.setPosition(e.sprite.x, e.sprite.y + 10);
    const frac = e.hp / e.max;
    // summon helpers at 66% and 33%
    if ((frac < 0.66 && b.summoned === 0) || (frac < 0.33 && b.summoned === 1)) {
      b.summoned++;
      for (const dx of [-90, 90]) this.spawnEnemy('wisp', e.sprite.x + dx, e.sprite.y + 40);
      this.pipSay(t('combat.boss_summon'));
    }
    switch (b.phase) {
      case 'chase':
        this.moveEnemy(e, px, py - 20, ENEMIES.hollow.speed * (frac < 0.5 ? 1.3 : 1), dt);
        if (e.timer <= 0) {
          if (Math.random() < 0.55) {
            b.phase = 'slam';
            b.target = { x: px, y: py };
            b.ring.setPosition(px, py).setVisible(true).setScale((140 / 64) / RES);
            e.warn.setVisible(true);
            e.timer = ENEMIES.hollow.windupMs;
          } else {
            b.phase = 'charge';
            b.target = this.unit(px - e.sprite.x, py - e.sprite.y);
            e.warn.setVisible(true);
            e.sprite.setTint(0xff8080);
            e.timer = ENEMIES.hollow.windupMs + 400;
          }
        }
        break;
      case 'slam':
        if (e.timer <= 0) {
          b.ring.setVisible(false);
          e.warn.setVisible(false);
          this.burst(b.target.x, b.target.y, 0x6a3a9a, 14);
          if (!this.settings.reducedMotion) this.cameras.main.shake(200, 0.01);
          if (Math.hypot(px - b.target.x, py - b.target.y) < 70) this.hitPlayer(ENEMIES.hollow.damage, b.target);
          this.exposeBoss(e);
        }
        break;
      case 'charge':
        if (e.timer > 400) break; // telegraph
        e.sprite.clearTint();
        e.warn.setVisible(false);
        this.moveEnemy(e, e.sprite.x + b.target.x * 60, e.sprite.y + b.target.y * 60, 360, dt);
        if (Math.hypot(px - e.sprite.x, py - e.sprite.y) < 50) this.hitPlayer(ENEMIES.hollow.damage, e.sprite);
        if (e.timer <= 0) this.exposeBoss(e);
        break;
      case 'exposed':
        if (e.timer <= 0) {
          b.phase = 'chase';
          b.core.setVisible(false);
          e.timer = 2200 + Math.random() * 1200;
        }
        break;
    }
  }

  private exposeBoss(e: Enemy): void {
    const b = e.boss!;
    b.phase = 'exposed';
    b.core.setVisible(true);
    e.timer = ENEMIES.hollow.recoverMs + (this.game_.canHealHollow() ? 600 : 0);
  }

  // ---------------------------------------------------------------- effects

  private updateSense(): void {
    const st = this.game_.state;
    const on = this.mode === 'play' && st.pip.abilities.includes('sense') && st.pip.enabled.sense;
    let target: { x: number; y: number } | null = null;
    if (on) {
      let best = Infinity;
      // hysteresis: the arrow appears beyond 100px and hides only within 80px, so it never flickers
      const minDist = this.senseArrow.visible ? 80 : 100;
      for (const c of this.senseCandidates()) {
        const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
        if (d > minDist && d < best) {
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
    // grey skies dim the world a little
    const w = this.outdoor() ? this.game_.weather() : 'clear';
    const dark = Math.min(1, this.baseDarkness() + (w === 'rain' ? 0.25 : w === 'snow' ? 0.1 : 0));
    const glow = st.pip.abilities.includes('glow') && st.pip.enabled.glow;
    const maxAlpha = glow ? 0.66 : 0.45;
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
    if (this.follower) light(this.follower.x, this.follower.y - 8, 60);
    this.worldLights(light);
  }

  protected floatText(x: number, y: number, text: string): void {
    const tx = this.add
      .text(x, y, text, { fontFamily: WORLD_FONT, fontSize: '15px', color: '#ffffff', stroke: '#2b2135', strokeThickness: 4 })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(30000);
    this.tweens.add({ targets: tx, y: y - 30, alpha: 0, duration: 1100, ease: 'Cubic.out', onComplete: () => tx.destroy() });
  }

  protected pipSay(text: string): void {
    if (this.mode !== 'play') return;
    const bubble = this.add
      .text(0, 0, text, {
        fontFamily: WORLD_FONT,
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

  protected celebrate(): void {
    if (this.mode !== 'play') return;
    this.burst(this.player.x, this.player.y - 20, 0xfff6b0, this.settings.graphics === 'low' ? 6 : 14);
    // cosmetics may have changed
    const p = this.game_.state.player;
    this.novaKey = makeNovaTexture(this, p.appearance, p.cosmetics);
    this.novaSprite.setTexture(this.novaKey);
  }

  protected burst(x: number, y: number, tint: number, count: number): void {
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

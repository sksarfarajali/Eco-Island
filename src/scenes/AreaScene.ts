import Phaser from 'phaser';
import {
  AREAS,
  RUNE_ORDER,
  TEMPLE_MIRRORS,
  creatureForHome,
  objectsOf,
  terrainSolid,
  traceBeam,
  type AreaDef,
  type AreaObject,
} from '../core/areas';
import { TILE } from '../core/config';
import { t } from '../core/i18n';
import type { CreatureId } from '../core/types';
import { REEF_COST } from '../core/config';
import { MEMORY_SHARDS } from '../core/layout';
import { makeAreaGround } from './art2';
import { PlayScene, img, nameTag, type Blocker, type Enemy, type Interactable } from './PlayScene';

interface ObjView {
  obj: AreaObject;
  sprite: Phaser.GameObjects.Image;
}

/** Crystal Caves, Ancient Temple, Highlands and Shadow Grove (PRD 10). */
export class AreaScene extends PlayScene {
  private def!: AreaDef;
  private views: ObjView[] = [];
  private creatureViews = new Map<CreatureId, { sprite: Phaser.GameObjects.Image; home: { x: number; y: number }; target: { x: number; y: number }; next: number }>();
  private blockViews: Phaser.GameObjects.Image[] = [];
  private beam!: Phaser.GameObjects.Graphics;
  private cageGuards = 0;
  private bloom: Phaser.GameObjects.Image[] = [];
  private echoPlaying = false;
  private marina: { sprite: Phaser.GameObjects.Image; marker: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text; obj: AreaObject } | null = null;

  constructor() {
    super('area');
  }

  protected resetWorld(): void {
    this.def = AREAS[this.area as keyof typeof AREAS];
    this.views = [];
    this.creatureViews.clear();
    this.blockViews = [];
    this.bloom = [];
    this.cageGuards = 0;
    this.echoPlaying = false;
    this.marina = null;
    this.shards = [];
  }

  private shards: { id: string; sprite: Phaser.GameObjects.Image }[] = [];

  protected outdoor(): boolean {
    return this.area === 'highlands' || this.area === 'isle';
  }

  protected fogLevel(): number {
    const base = super.fogLevel();
    if (this.area !== 'highlands') return base;
    // morning mist always hangs over the highlands, and fog days are thicker up here
    const h = this.game_.hour;
    const mist = h >= 5 && h < 9 ? 0.35 : 0;
    return Math.max(mist, base ? 0.75 : 0);
  }

  protected worldSize() {
    return { w: this.def.w * TILE, h: this.def.h * TILE };
  }

  protected backgroundColor(): string {
    // matches each theme's wall colour so margins around small maps read as rock
    return { caves: '#221c33', temple: '#6d6858', highlands: '#8a8f98', grove: '#221a30', isle: '#2b9fd0' }[this.def.theme];
  }

  protected arrivalPoint(): { x: number; y: number } {
    if (this.arrive === 'groveGate') {
      const gate = objectsOf(this.def, 'G')[0];
      return { x: gate.x, y: gate.y + 40 };
    }
    if (this.arrive === 'saved') {
      const pos = this.game_.state.player.position;
      if (pos.area === this.area && this.groundWalkable(pos.x, pos.y)) return pos;
    }
    return this.def.spawn;
  }

  protected groundWalkable(x: number, y: number): boolean {
    return !terrainSolid(this.def, Math.floor(x / TILE), Math.floor(y / TILE));
  }

  protected baseDarkness(): number {
    const st = this.game_.state;
    let base = this.def.baseDark;
    if (this.area === 'grove' && st.world.ending === 'heal') base = 0.1;
    return Math.max(base, this.outdoor() ? this.game_.darkness() : this.game_.darkness() * 0.5);
  }

  protected checkZone(): void {
    if (this.mode !== 'play' || this.zone === this.def.zone) return;
    this.zone = this.def.zone;
    const story = this.game_.enterArea(this.area);
    this.hooks.zoneChanged(this.zone);
    if (story) this.time.delayedCall(400, () => this.hooks.dialog(story));
  }

  // ------------------------------------------------------------------ creation

  protected buildWorld(): void {
    const st = this.game_.state;
    this.add.image(0, 0, makeAreaGround(this, this.def, st.world.ending === 'heal')).setOrigin(0).setDepth(-10000);
    this.beam = this.add.graphics().setDepth(-5000);

    for (const o of this.def.objects) {
      const home = creatureForHome(o.ch);
      if (home) {
        if (!this.creatureViews.has(home)) {
          const sprite = img(this, o.x, o.y + 10, home);
          this.breathe(sprite, Math.random() * 800);
          this.creatureViews.set(home, { sprite, home: { x: o.x, y: o.y }, target: { x: o.x, y: o.y }, next: 0 });
        }
        continue;
      }
      if (o.ch === 'N') {
        this.createMarina(o);
        continue;
      }
      const key = this.textureFor(o);
      if (key) this.views.push({ obj: o, sprite: img(this, o.x, o.y + 14, key).setDepth(o.ch === 'z' || o.ch === 'Y' ? -4000 : o.y + 14) });
      if (o.ch === 'g' || o.ch === 'w') this.maybeSpawn(o);
      if (o.ch === 'B' && !st.world.bossDefeated && st.quests.q_finale.status === 'active') this.spawnEnemy('hollow', o.x, o.y + 40);
    }
    // memory shards hidden in this area
    for (const m of MEMORY_SHARDS.filter((x) => x.area === this.area)) {
      const x = m.tx * TILE + TILE / 2;
      const y = m.ty * TILE + TILE / 2;
      const sprite = img(this, x, y + 12, 'memory_shard').setDepth(y + 12).setVisible(!st.discoveries.memories.includes(m.id));
      if (!this.settings.reducedMotion) this.tweens.add({ targets: sprite, y: sprite.y - 5, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.shards.push({ id: m.id, sprite });
    }
    // stone blocks (positions live in the save)
    st.world.temple.blocks.forEach(() => this.blockViews.push(img(this, 0, 0, 'stone_block')));
    // a meadow of skyblooms if the Skyhare was set free
    if (this.area === 'highlands') {
      for (const o of objectsOf(this.def, 'h')) {
        for (let i = 0; i < 6; i++) this.bloom.push(img(this, o.x + (i - 2.5) * 22, o.y + 26 + (i % 2) * 14, 'skybloom'));
      }
    }
  }

  private createMarina(o: AreaObject): void {
    img(this, o.x, o.y + 8, 'shadow', 0.5).setDepth(o.y + 7);
    const sprite = img(this, o.x, o.y + 8, 'npc_marina').setDepth(o.y + 8);
    this.breathe(sprite, 300);
    const marker = img(this, o.x, o.y - 30, 'marker_quest').setDepth(9500).setVisible(false);
    if (!this.settings.reducedMotion) this.tweens.add({ targets: marker, y: '-=4', duration: 600, yoyo: true, repeat: -1 });
    const tag = nameTag(this, o.x, o.y - 30, t('npc.marina'));
    this.marina = { sprite, marker, tag, obj: o };
  }

  private maybeSpawn(o: AreaObject): void {
    const st = this.game_.state;
    if (this.area === 'grove' && st.world.ending) return; // the grove is at peace after the finale
    const cage = objectsOf(this.def, 'C')[0];
    const guard = cage && Math.abs(cage.tx - o.tx) <= 2 && Math.abs(cage.ty - o.ty) <= 2;
    if (guard && st.world.skyhareFreed) return;
    this.spawnEnemy(o.ch === 'g' ? 'gloomling' : 'wisp', o.x, o.y + 10, guard ? 'guard' : undefined);
    if (guard) this.cageGuards++;
  }

  protected onEnemyKilled(e: Enemy): void {
    if (e.tag === 'guard') {
      this.cageGuards--;
      if (this.cageGuards === 0) this.hooks.info(t('highlands.cage_free'));
    }
  }

  private textureFor(o: AreaObject): string | null {
    switch (o.ch) {
      case 'c': return 'crystal';
      case 'r': return 'rock';
      case 'f': return this.area === 'grove' ? 'shadowcap' : 'skybloom';
      case 'K': return 'pedestal';
      case 'H': return 'pedestal';
      case 'M': return 'mural';
      case '1': case '2': case '3': case '4': return `rune${o.ch}`;
      case '/': return 'mirror_a';
      case 'L': return 'emitter';
      case 'T': return 'lock';
      case 'P': return 'plate';
      case 'R': return 'lever';
      case 'D': case 'E': case 'F': return 'door';
      case 'V': return 'viewpoint';
      case 'C': return 'cage';
      case 'G': return 'grove_gate';
      case 'X': return this.area === 'isle' ? 'boat' : 'exit';
      case 'k': return 'coral_node';
      case 'q': return 'shell_node';
      case 'j': return 'palm';
      case 'z': return 'reef_dead';
      case 'Y': return 'pier';
      default: return null;
    }
  }

  // ------------------------------------------------------------------ sync

  private trialFor(ch: string): number {
    return 'DEF'.indexOf(ch);
  }

  protected syncWorld(): void {
    const st = this.game_.state;
    const tp = st.world.temple;
    const blockers: Blocker[] = [];
    const solidTile = (o: AreaObject, w = TILE, h = TILE) => blockers.push({ kind: 'rect', x: o.x, y: o.y, w, h });

    for (const v of this.views) {
      const o = v.obj;
      const s = v.sprite;
      switch (o.ch) {
        case 'c':
        case 'r':
        case 'f':
        case 'k':
        case 'q': {
          const full = st.world.nodes[o.id]?.stage === 'full';
          const empty: Record<string, string> = { c: 'crystal_empty', r: 'rock_empty', f: 'flower_empty', k: 'coral_empty', q: 'shell_empty' };
          s.setTexture(full ? this.textureFor(o)! : empty[o.ch]);
          if (full && (o.ch === 'c' || o.ch === 'r' || o.ch === 'k')) blockers.push({ kind: 'circle', x: o.x, y: o.y + 4, r: 12 });
          break;
        }
        case 'j':
          s.setTexture(st.world.nodes[o.id]?.stage === 'full' ? 'palm' : 'palm_empty');
          blockers.push({ kind: 'circle', x: o.x, y: o.y + 8, r: 9 });
          break;
        case 'z':
          s.setTexture(st.world.reefHealed.includes(o.id) ? 'reef_alive' : 'reef_dead');
          break;
        case 'K':
        case 'H':
          solidTile(o, 24, 20);
          this.pedestalItem(v, o.ch === 'K' ? (st.world.sunKeyFound ? null : 'sun_key') : 'echo_heart');
          break;
        case 'M':
        case 'L':
        case 'R':
          solidTile(o, 26, 22);
          break;
        case '1': case '2': case '3': case '4': {
          const n = Number(o.ch);
          const lit = tp.solved[0] || tp.runeProgress.includes(n);
          s.setTexture(`rune${n}${lit ? '_lit' : ''}`);
          solidTile(o, 24, 22);
          break;
        }
        case '/': {
          const i = TEMPLE_MIRRORS.findIndex((m) => m.id === o.id);
          s.setTexture(tp.mirrors[i] ? 'mirror_b' : 'mirror_a').setY(o.y + 16);
          solidTile(o, 28, 24);
          break;
        }
        case 'T':
          s.setTexture(tp.solved[1] ? 'lock_lit' : 'lock');
          solidTile(o, 24, 20);
          break;
        case 'D': case 'E': case 'F': {
          const open = tp.solved[this.trialFor(o.ch)];
          s.setVisible(!open).setY(o.y + 20);
          if (!open) solidTile(o, TILE, TILE);
          break;
        }
        case 'C':
          s.setVisible(!st.world.skyhareFreed);
          if (!st.world.skyhareFreed) solidTile(o, 34, 24);
          break;
        case 'G': {
          const open = st.island.visuals.includes('grove_gate_open');
          s.setTexture(open ? 'grove_gate_open' : 'grove_gate').setY(o.y + 24);
          solidTile(o, 56, 26);
          break;
        }
      }
    }

    // push blocks
    tp.blocks.forEach(([bx, by], i) => {
      const v = this.blockViews[i];
      if (!v) return;
      const x = bx * TILE + TILE / 2;
      const y = by * TILE + TILE / 2;
      v.setPosition(x, y + 16).setDepth(y + 16).setVisible(this.area === 'temple');
      if (this.area === 'temple') blockers.push({ kind: 'rect', x, y, w: TILE, h: TILE });
    });

    // light beam
    this.beam.clear();
    if (this.area === 'temple') {
      const res = traceBeam(tp.mirrors);
      const emitter = objectsOf(this.def, 'L')[0];
      this.beam.lineStyle(5, 0xfff2a0, 0.85);
      this.beam.beginPath();
      this.beam.moveTo(emitter.x + 8, emitter.y);
      for (const [x, y] of res.path) this.beam.lineTo(x * TILE + TILE / 2, y * TILE + TILE / 2);
      this.beam.strokePath();
    }

    // creatures
    for (const [id, c] of this.creatureViews) {
      const cs = st.creatures[id];
      let visible = cs.present;
      if (id === 'skyhare') visible = st.choices.some((ch) => ch.id === 'skyhare_choice' && ch.value === 'wild');
      // bonded creatures move into the village sanctuary once it exists
      else if (cs.state === 'bonded' && st.buildings.sanctuary > 0) visible = false;
      c.sprite.setVisible(visible);
    }
    this.bloom.forEach((b) => b.setVisible(st.island.visuals.includes('highlands_bloom')));
    if (this.marina) {
      blockers.push({ kind: 'circle', x: this.marina.obj.x, y: this.marina.obj.y + 6, r: 9 });
      const offers = this.game_.questsOfferedBy('marina').length > 0;
      this.marina.marker.setVisible(offers);
      this.marina.tag.setY(this.marina.obj.y - (offers ? 44 : 30));
      this.marina.sprite.setFlipX(this.player && this.marina.obj.x > this.player.x);
    }
    this.blockers = blockers;
  }

  private pedestalItem(v: ObjView, key: string | null): void {
    const extra = (v as ObjView & { item?: Phaser.GameObjects.Image }).item;
    if (!key) {
      extra?.setVisible(false);
      return;
    }
    if (!extra) {
      const item = img(this, v.obj.x, v.obj.y - 4, key).setDepth(v.obj.y + 20);
      if (!this.settings.reducedMotion) this.tweens.add({ targets: item, y: item.y - 4, duration: 900, yoyo: true, repeat: -1 });
      (v as ObjView & { item?: Phaser.GameObjects.Image }).item = item;
    }
  }

  // ------------------------------------------------------------------ per frame

  protected updateWorld(time: number, dt: number): void {
    const st = this.game_.state;
    if (this.marina && this.mode === 'play') {
      const near = Math.hypot(this.marina.obj.x - this.player.x, this.marina.obj.y - this.player.y) < 130;
      if (this.marina.tag.visible !== near) this.marina.tag.setVisible(near);
    }
    for (const [id, c] of this.creatureViews) {
      if (!c.sprite.visible) continue;
      if (time > c.next) {
        c.next = time + 2200 + Math.random() * 2000;
        for (let i = 0; i < 6; i++) {
          const x = c.home.x + (Math.random() - 0.5) * 90;
          const y = c.home.y + (Math.random() - 0.5) * 60;
          if (this.groundWalkable(x, y)) {
            c.target = { x, y };
            break;
          }
        }
      }
      const dx = c.target.x - c.sprite.x;
      const dy = c.target.y - c.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        c.sprite.x += (dx / d) * Math.min(d, 40 * dt);
        c.sprite.y += (dy / d) * Math.min(d, 40 * dt);
        if (Math.abs(dx) > 1) c.sprite.setFlipX(dx < 0);
      }
      c.sprite.setDepth(c.sprite.y);
      if (this.mode === 'play' && st.creatures[id].state === 'unknown' && Math.hypot(this.player.x - c.sprite.x, this.player.y - c.sprite.y) < 90) {
        this.game_.observe(id);
      }
    }
  }

  // ------------------------------------------------------------------ interactions

  protected collectInteractables(list: Interactable[]): void {
    const g = this.game_;
    const st = g.state;
    const tp = st.world.temple;
    const add = (o: AreaObject, label: string, act: () => void, enabled = true) =>
      list.push({ id: o.id, x: o.x, y: o.y + 4, label, enabled, act });

    for (const v of this.views) {
      const o = v.obj;
      switch (o.ch) {
        case 'c':
        case 'r':
        case 'f':
        case 'k':
        case 'q':
        case 'j':
          if (st.world.nodes[o.id]?.stage === 'full') {
            const label: Record<string, string> = { c: 'act.mine_crystal', r: 'act.mine', f: 'act.pick_flower', k: 'act.coral', q: 'act.shells', j: 'act.coconut' };
            add(o, t(label[o.ch]), () => this.report(g.gather(o.id, o)));
          }
          break;
        case 'z':
          if (!st.world.reefHealed.includes(o.id)) {
            add(o, t('act.heal_reef', { n: REEF_COST.essence }), () => {
              const r = g.healReef(o.id);
              if (r.ok) this.burst(o.x, o.y, 0xff9ad6, 14);
              this.report(r);
            });
          }
          break;
        case 'Y':
          add(o, t('act.fish'), () => this.hooks.startFishing());
          break;
        case 'K':
          if (!st.world.sunKeyFound) add(o, t('act.take_key'), () => {
            g.findSunKey();
            this.hooks.dialog({ npc: 'pip', speaker: 'Pip', lines: [t('caves.key_1'), t('caves.key_2')] });
          });
          break;
        case 'H':
          add(o, tp.solved.every(Boolean) ? t('act.touch_heart') : t('act.heart_sealed'), () => {
            const d = g.touchEchoHeart();
            if (d) this.hooks.dialog(d);
          }, tp.solved.every(Boolean));
          break;
        case 'M':
          add(o, t('act.mural'), () => this.playEcho());
          break;
        case '1': case '2': case '3': case '4':
          if (!tp.solved[0]) add(o, t('act.rune'), () => this.report(g.activateRune(Number(o.ch))));
          break;
        case '/': {
          const i = TEMPLE_MIRRORS.findIndex((m) => m.id === o.id);
          if (!tp.solved[1]) add(o, t('act.mirror'), () => this.report(g.toggleMirror(i)));
          break;
        }
        case 'R':
          if (!tp.solved[2]) add(o, t('act.lever'), () => {
            g.resetBlocks();
            this.hooks.info(t('temple.blocks_reset'));
          });
          break;
        case 'D': case 'E': case 'F':
          if (!tp.solved[this.trialFor(o.ch)]) add(o, t(`temple.door_${this.trialFor(o.ch) + 1}`), () => undefined, false);
          break;
        case 'V':
          add(o, t('act.viewpoint'), () => this.report(g.viewpoint()));
          break;
        case 'C':
          if (!st.world.skyhareFreed) {
            const free = this.cageGuards <= 0;
            add(o, free ? t('act.free_skyhare') : t('act.cage_guarded'), () => {
              if (st.quests.q_highlands.status !== 'active') {
                this.hooks.info(t('highlands.need_quest'));
                return;
              }
              this.hooks.dialog({
                npc: 'pip',
                speaker: 'Pip',
                lines: [t('highlands.rescue_1'), t('highlands.rescue_2')],
                options: [
                  { id: 'skyhare:village', label: t('highlands.choice_village') },
                  { id: 'skyhare:wild', label: t('highlands.choice_wild') },
                ],
              });
            }, free);
          }
          break;
        case 'G': {
          const open = st.island.visuals.includes('grove_gate_open');
          add(o, open ? t('act.enter', { name: t('zone.grove') }) : t('act.gate_sealed'), () => this.hooks.travel('grove', 'spawn'), open);
          break;
        }
        case 'B':
          break;
      }
    }
    // The final choice waits at the Hollow's arena if the player left before choosing.
    const boss = objectsOf(this.def, 'B')[0];
    if (boss && st.world.bossDefeated && !st.world.ending) {
      list.push({ id: 'finale', x: boss.x, y: boss.y + 40, label: t('act.finale'), enabled: true, act: () => this.hooks.dialog(g.bossDefeated()) });
    }
    // exit
    for (const o of objectsOf(this.def, 'X')) {
      const dest = this.def.exitTo;
      list.push({ id: o.id, x: o.x, y: o.y, label: t('act.leave', { name: t(dest.area === 'island' ? 'zone.island' : `zone.${dest.area}`) }), enabled: true, act: () => this.hooks.travel(dest.area, dest.poi) });
    }
    // stone blocks can be pushed away from Nova
    if (this.area === 'temple' && !tp.solved[2]) {
      tp.blocks.forEach(([bx, by], i) => {
        const x = bx * TILE + TILE / 2;
        const y = by * TILE + TILE / 2;
        list.push({
          id: `block${i}`, x, y, label: t('act.push'), enabled: true,
          act: () => {
            const dx = x - this.player.x;
            const dy = y - this.player.y;
            const dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
            this.report(g.pushBlock(i, dir[0], dir[1]));
          },
        });
      });
    }
    for (const [id, c] of this.creatureViews) if (c.sprite.visible) list.push(this.creatureInteractable(id, c.sprite));
    for (const sh of this.shards) {
      if (!st.discoveries.memories.includes(sh.id)) {
        list.push({ id: sh.id, x: sh.sprite.x, y: sh.sprite.y - 8, label: t('act.memory'), enabled: true, act: () => {
          const d = g.collectMemory(sh.id);
          if (!d) return;
          sh.sprite.setVisible(false);
          this.burst(sh.sprite.x, sh.sprite.y - 16, 0xc9b3ff, 16);
          this.hooks.dialog(d);
        } });
      }
    }
    if (this.marina) {
      const o = this.marina.obj;
      list.push({ id: 'npc_marina', x: o.x, y: o.y, label: t('act.talk', { name: t('npc.marina') }), enabled: true, act: () => this.hooks.dialog(g.talk('marina')) });
    }
  }

  /** Pip's Echo replays the rune order at the mural (and says it in words, for accessibility). */
  private playEcho(): void {
    if (this.echoPlaying) return;
    const echo = this.game_.viewEcho();
    this.hooks.info(echo.text);
    this.echoPlaying = true;
    const runes = this.views.filter((v) => '1234'.includes(v.obj.ch));
    RUNE_ORDER.forEach((n, k) => {
      this.time.delayedCall(500 + k * 800, () => {
        const v = runes.find((r) => r.obj.ch === String(n));
        if (!v) return;
        const ghost = img(this, v.obj.x, v.obj.y + 14, `rune${n}_lit`).setDepth(v.obj.y + 15).setAlpha(0.9);
        this.burst(v.obj.x, v.obj.y - 10, 0x9ff3ff, 8);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 700, delay: 300, onComplete: () => ghost.destroy() });
        this.game_.events.emit('sfx', 'magic');
      });
    });
    this.time.delayedCall(500 + RUNE_ORDER.length * 800, () => (this.echoPlaying = false));
  }

  protected senseCandidates(): { x: number; y: number }[] {
    const st = this.game_.state;
    const out: { x: number; y: number }[] = [];
    const tp = st.world.temple;
    for (const o of this.def.objects) {
      if (o.ch === 'K' && !st.world.sunKeyFound) out.push(o);
      if (o.ch === 'M' && !tp.solved[0]) out.push(o);
      if (o.ch === 'T' && !tp.solved[1]) out.push(o);
      if (o.ch === 'P' && !tp.solved[2] && tp.solved[1]) out.push(o);
      if (o.ch === 'H' && tp.solved.every(Boolean)) out.push(o);
      if (o.ch === 'C' && !st.world.skyhareFreed) out.push(o);
      if (o.ch === 'G' && st.island.visuals.includes('grove_gate_open') && !st.world.ending) out.push(o);
      if (o.ch === 'V' && !st.discoveries.places.includes('highland_view')) out.push(o);
      if (o.ch === 'z' && st.quests.q_reef.status === 'active' && !st.world.reefHealed.includes(o.id)) out.push(o);
      if (o.ch === 'N' && st.quests.q_reef.status === 'available') out.push(o);
    }
    for (const [id, c] of this.creatureViews) if (c.sprite.visible && st.creatures[id].state === 'unknown') out.push({ x: c.sprite.x, y: c.sprite.y });
    return out;
  }

  protected worldLights(light: (x: number, y: number, r: number) => void): void {
    const st = this.game_.state;
    for (const sh of this.shards) if (sh.sprite.visible) light(sh.sprite.x, sh.sprite.y - 14, 50);
    for (const v of this.views) {
      const o = v.obj;
      if (o.ch === 'c' && st.world.nodes[o.id]?.stage === 'full') light(o.x, o.y, 56);
      if (o.ch === 'K' || o.ch === 'H' || o.ch === 'T' || o.ch === 'L') light(o.x, o.y, 70);
      if (o.ch === 'X') light(o.x, o.y, 60);
      if (o.ch === 'z' && st.world.reefHealed.includes(o.id)) light(o.x, o.y, 50);
    }
    if (this.marina) light(this.marina.obj.x, this.marina.obj.y - 10, 70);
    for (const c of this.creatureViews.values()) if (c.sprite.visible) light(c.sprite.x, c.sprite.y - 8, 40);
    for (const e of this.enemies) light(e.sprite.x, e.sprite.y - 10, e.boss ? 90 : 30);
  }
}

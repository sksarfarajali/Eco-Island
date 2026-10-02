import { ISLAND_HARMONY_LEVELS, PLAYER_XP_LEVELS } from '../core/config';
import {
  BUILDING_ORDER,
  RECIPES,
  BUILDINGS,
  CREATURES,
  DISCOVERY_CATALOG,
  DISCOVERY_MILESTONES,
  ITEMS,
  ITEM_ORDER,
  QUESTS,
  QUEST_ORDER,
} from '../core/content';
import { levelProgress, type Dialog, type Game, type ToastEvent } from '../core/game';
import type { AwaySummary } from '../core/growth';
import { t } from '../core/i18n';
import { LAKE, PLOTS, isLand } from '../core/layout';
import type {
  ActionKey,
  AreaId,
  Appearance,
  Ending,
  BuildingId,
  DiscoveryCategory,
  ItemId,
  NpcId,
  PipAbility,
  Settings,
  ZoneId,
} from '../core/types';
import type { BackupInfo } from '../platform/saves';
import { HAIR, OUTFIT, SKIN, drawPerson, novaLook } from '../scenes/art';
import { bar, clear, h } from './dom';

export interface UIActions {
  newGame(a: Appearance): void;
  continueGame(): void;
  respond(optionId: string): void;
  interact(): void;
  dodge(): void;
  block(on: boolean): void;
  burst(): void;
  eat(): void;
  craft(recipe: string): void;
  catchFish(): ItemId;
  setJoystick(x: number, y: number): void;
  setPaused(p: boolean): void;
  startBuild(b: BuildingId): void;
  cancelBuild(): void;
  previewBuild(plotId: string, b: BuildingId): void;
  confirmBuild(plotId: string, b: BuildingId): void;
  clearPreview(): void;
  travel(zone: ZoneId | AreaId): void;
  usePurifier(): void;
  buy(item: ItemId, qty: number): void;
  sell(item: ItemId, qty: number): void;
  settingsChanged(s: Settings): void;
  exportSave(): void;
  importSave(file: File): void;
  listBackups(): Promise<BackupInfo[]>;
  restoreBackup(key: string): void;
  resetAll(): void;
  quitToMenu(): void;
  install(): void;
  canInstall(): boolean;
}

type PanelId = 'journal' | 'book' | 'bag' | 'build' | 'shop' | 'map' | 'companion' | 'settings' | 'workshop';

const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export class UI {
  private root: HTMLElement;
  private hud!: HTMLElement;
  private hudStatus!: HTMLElement;
  private promptEl!: HTMLButtonElement;
  private actionBtn!: HTMLButtonElement;
  private toasts!: HTMLElement;
  private buildBar!: HTMLElement;
  private dialogEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private panelId: PanelId | null = null;
  private screenEl: HTMLElement | null = null;
  private modalEl: HTMLElement | null = null;
  private game: Game | null = null;
  private zone: ZoneId = 'village';
  private hudQueued = false;
  private shopTab: 'buy' | 'sell' = 'buy';
  private bookTab: DiscoveryCategory = 'creatures';
  private dialogKey: ((e: KeyboardEvent) => void) | null = null;
  private combatBar!: HTMLElement;
  private bossBarEl!: HTMLElement;
  private inCombat = false;
  private fishingOpen = false;

  constructor(
    private actions: UIActions,
    private settings: Settings,
  ) {
    this.root = document.getElementById('ui')!;
    this.buildHud();
    document.addEventListener('keydown', (e) => this.onKey(e));
  }

  setGame(game: Game): void {
    this.game = game;
    this.refreshHud();
  }

  setSettings(s: Settings): void {
    this.settings = s;
  }

  // ------------------------------------------------------------------ screens

  private showScreen(el: HTMLElement): void {
    this.screenEl?.remove();
    this.screenEl = el;
    this.root.append(el);
    this.hud.hidden = true;
    (el.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus();
  }

  private closeScreen(): void {
    this.screenEl?.remove();
    this.screenEl = null;
  }

  showMenu(opts: { save: { day: number; islandLevel: number } | null; notice: string | null; onRestore: () => void }): void {
    this.closePanel();
    this.closeDialog();
    const buttons: HTMLElement[] = [];
    if (opts.save) {
      buttons.push(
        h('button', { class: 'btn primary big', onclick: () => this.actions.continueGame() },
          t('menu.continue'), h('small', {}, t('menu.continue_detail', { day: opts.save.day, level: opts.save.islandLevel }))),
      );
    }
    buttons.push(
      h('button', {
        class: `btn big ${opts.save ? '' : 'primary'}`,
        onclick: async () => {
          if (opts.save && !(await this.confirm(t('menu.new_confirm'), t('menu.new_game')))) return;
          this.showCharacter();
        },
      }, t('menu.new_game')),
      h('button', { class: 'btn', onclick: () => opts.onRestore() }, t('menu.load_restore')),
      h('button', { class: 'btn', onclick: () => this.openPanel('settings') }, t('menu.settings')),
      h('button', { class: 'btn', onclick: () => this.showCredits() }, t('menu.credits')),
    );
    if (this.actions.canInstall()) buttons.push(h('button', { class: 'btn ghost', onclick: () => this.actions.install() }, `⬇ ${t('menu.install')}`));
    this.showScreen(
      h('div', { class: 'screen menu' },
        h('div', { class: 'menu-card' },
          h('h1', { class: 'logo' }, 'Echo Island'),
          h('p', { class: 'tagline' }, t('menu.tagline')),
          opts.notice ? h('p', { class: 'notice' }, opts.notice) : null,
          h('div', { class: 'menu-buttons' }, buttons),
          h('p', { class: 'fineprint' }, t('menu.offline_note')),
        ),
      ),
    );
  }

  showCharacter(): void {
    const a: Appearance = { skin: 0, hair: 0, outfit: 0 };
    const canvas = h('canvas', { width: 112, height: 160, class: 'preview', 'aria-label': t('char.preview') });
    const draw = () => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 112, 160);
      ctx.save();
      ctx.scale(4, 4);
      drawPerson(ctx, novaLook(a));
      ctx.restore();
    };
    const row = (label: string, key: keyof Appearance, colors: string[]) => {
      const swatches = colors.map((c, i) => {
        const b = h('button', {
          class: `swatch ${a[key] === i ? 'on' : ''}`,
          style: `background:${c}`,
          'aria-label': `${label} ${i + 1}`,
          onclick: () => {
            a[key] = i;
            swatches.forEach((s, j) => s.classList.toggle('on', j === i));
            draw();
          },
        });
        return b;
      });
      return h('div', { class: 'swatch-row' }, h('span', {}, label), h('div', { class: 'swatches' }, swatches));
    };
    this.showScreen(
      h('div', { class: 'screen menu' },
        h('div', { class: 'menu-card' },
          h('h2', {}, t('char.title')),
          h('p', {}, t('char.subtitle')),
          canvas,
          row(t('char.skin'), 'skin', SKIN),
          row(t('char.hair'), 'hair', HAIR),
          row(t('char.outfit'), 'outfit', OUTFIT),
          h('div', { class: 'menu-buttons' },
            h('button', { class: 'btn primary big', onclick: () => this.actions.newGame({ ...a }) }, t('char.begin')),
            h('button', { class: 'btn ghost', onclick: () => this.actions.quitToMenu() }, t('common.back')),
          ),
        ),
      ),
    );
    draw();
  }

  showAway(s: AwaySummary, onClose: () => void): void {
    const items: string[] = [];
    if (s.clockWentBack) items.push(t('away.clock'));
    if (s.saplingsGrown) items.push(`🌳 ${t('away.saplings', { n: s.saplingsGrown })}`);
    if (s.treesRegrown) items.push(`🌲 ${t('away.regrown', { n: s.treesRegrown })}`);
    if (s.bushesRefilled) items.push(`🫐 ${t('away.bushes', { n: s.bushesRefilled })}`);
    if (s.rocksRestored) items.push(`🪨 ${t('away.rocks', { n: s.rocksRestored })}`);
    if (s.produce) items.push(`🥕 ${t('away.produce', { n: s.produce })}`);
    if (s.eggHatched) items.push(`🐥 ${t('away.egg')}`);
    if (s.gift) items.push(`🦊 ${t('away.gift', { n: s.gift })}`);
    if (!items.length) items.push(t('away.quiet'));
    const hours = Math.floor(s.seconds / 3600);
    const mins = Math.floor((s.seconds % 3600) / 60);
    this.showScreen(
      h('div', { class: 'screen dim' },
        h('div', { class: 'menu-card' },
          h('h2', {}, t('away.title')),
          s.clockWentBack ? null : h('p', {}, t('away.time', { h: hours, m: mins }) + (s.capped ? ` ${t('away.capped')}` : '')),
          h('ul', { class: 'away-list' }, items.map((i) => h('li', {}, i))),
          s.exportReminder ? h('p', { class: 'notice' }, t('away.export_reminder')) : null,
          h('div', { class: 'menu-buttons' },
            s.exportReminder ? h('button', { class: 'btn', onclick: () => this.actions.exportSave() }, t('settings.export')) : null,
            h('button', { class: 'btn primary big', onclick: () => { this.closeScreen(); this.hud.hidden = false; onClose(); } }, t('common.continue')),
          ),
        ),
      ),
    );
  }

  showTabBlocked(onTakeOver: () => void): void {
    this.showScreen(
      h('div', { class: 'screen menu' },
        h('div', { class: 'menu-card' },
          h('h2', {}, t('tab.title')),
          h('p', {}, t('tab.body')),
          h('div', { class: 'menu-buttons' }, h('button', { class: 'btn primary big', onclick: () => { this.closeScreen(); onTakeOver(); } }, t('tab.play_here'))),
        ),
      ),
    );
  }

  showTabLost(): void {
    this.closePanel();
    this.closeDialog();
    this.showScreen(
      h('div', { class: 'screen menu' },
        h('div', { class: 'menu-card' },
          h('h2', {}, t('tab.lost_title')),
          h('p', {}, t('tab.lost_body')),
          h('div', { class: 'menu-buttons' }, h('button', { class: 'btn primary', onclick: () => location.reload() }, t('tab.reload'))),
        ),
      ),
    );
  }

  showCredits(): void {
    this.openModal(t('credits.title'),
      h('div', { class: 'credits' },
        h('p', {}, t('credits.team')),
        h('p', {}, t('credits.tech')),
        h('p', {}, t('credits.art')),
        h('p', {}, t('credits.privacy')),
      ));
  }

  async showRestore(onImported: () => void): Promise<void> {
    const backups = await this.actions.listBackups().catch(() => [] as BackupInfo[]);
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'import-file' }) as HTMLInputElement;
    file.addEventListener('change', () => {
      if (file.files?.[0]) {
        this.actions.importSave(file.files[0]);
        this.closeModal();
        onImported();
      }
    });
    this.openModal(t('restore.title'),
      h('div', {},
        h('p', {}, t('restore.body')),
        h('h3', {}, t('restore.backups')),
        backups.length
          ? h('ul', { class: 'list' }, backups.map((b) =>
              h('li', { class: 'row' },
                h('span', {}, t('restore.backup_row', { date: new Date(b.savedAt).toLocaleString(), day: b.day, level: b.islandLevel })),
                h('button', { class: 'btn small', onclick: async () => {
                  if (await this.confirm(t('restore.confirm'), t('restore.restore'))) {
                    this.closeModal();
                    this.actions.restoreBackup(b.key);
                  }
                } }, t('restore.restore')))))
          : h('p', { class: 'muted' }, t('restore.none')),
        h('div', { class: 'menu-buttons' },
          file,
          h('label', { class: 'btn', for: 'import-file', tabindex: 0 }, t('settings.import')),
          this.game ? h('button', { class: 'btn', onclick: () => this.actions.exportSave() }, t('settings.export')) : null,
        ),
      ));
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(): void {
    // Tap the status box to fold it down to one line (so it never hides the world on small screens).
    this.hudStatus = h('div', {
      class: 'hud-status',
      role: 'button',
      tabindex: 0,
      'aria-expanded': 'true',
      title: t('hud.collapse_hint'),
      onclick: () => this.toggleHudStatus(),
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') this.toggleHudStatus();
      },
    });
    try {
      if (localStorage.getItem('echo-island-hud-collapsed') === '1') this.hudStatus.classList.add('collapsed');
    } catch {
      // storage unavailable: start expanded
    }
    const btn = (id: PanelId, icon: string, key: string) =>
      h('button', { class: 'hud-btn', 'aria-label': t(key), title: t(key), onclick: () => this.togglePanel(id) }, h('span', { 'aria-hidden': 'true' }, icon), h('em', {}, t(key)));
    this.promptEl = h('button', { class: 'prompt', hidden: true, onclick: () => this.actions.interact() });
    this.actionBtn = h('button', { class: 'action-btn', hidden: true, onclick: () => this.actions.interact() });
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.buildBar = h('div', { class: 'build-bar', hidden: true });
    const joystick = this.makeJoystick();
    const cbtn = (cls: string, label: string, icon: string, handlers: Record<string, (e: Event) => void>) =>
      h('button', { class: `combat-btn ${cls}`, 'aria-label': label, title: label, ...handlers }, h('span', { 'aria-hidden': 'true' }, icon), h('small', {}, label));
    this.combatBar = h('div', { class: 'combat-bar', hidden: true },
      cbtn('dodge', t('combat.dodge'), '💨', { onclick: () => this.actions.dodge() }),
      cbtn('block', t('combat.block'), '🛡️', {
        onpointerdown: (e) => { e.preventDefault(); this.actions.block(true); },
        onpointerup: () => this.actions.block(false),
        onpointerleave: () => this.actions.block(false),
        onpointercancel: () => this.actions.block(false),
      }),
      cbtn('burst', t('combat.pip'), '✨', { onclick: () => this.actions.burst() }),
      cbtn('eat', t('combat.eat'), '🫐', { onclick: () => this.actions.eat() }),
    );
    this.bossBarEl = h('div', { class: 'boss-bar', hidden: true });
    this.hud = h('div', { class: 'hud', hidden: true },
      this.hudStatus,
      h('nav', { class: 'hud-buttons', 'aria-label': t('hud.menu') },
        btn('journal', '📜', 'hud.journal'),
        btn('book', '📖', 'hud.book'),
        btn('bag', '🎒', 'hud.bag'),
        btn('build', '🔨', 'hud.build'),
        btn('map', '🗺️', 'hud.map'),
        btn('companion', '💫', 'hud.companion'),
        btn('settings', '⚙️', 'hud.settings'),
      ),
      this.buildBar,
      this.bossBarEl,
      this.combatBar,
      this.promptEl,
      this.actionBtn,
      joystick,
    );
    this.root.append(this.hud, this.toasts);
  }

  private toggleHudStatus(): void {
    const collapsed = this.hudStatus.classList.toggle('collapsed');
    this.hudStatus.setAttribute('aria-expanded', String(!collapsed));
    try {
      localStorage.setItem('echo-island-hud-collapsed', collapsed ? '1' : '0');
    } catch {
      // per-device convenience only
    }
  }

  showHud(): void {
    this.closeScreen();
    this.hud.hidden = false;
    this.refreshHud();
  }

  hideHud(): void {
    this.hud.hidden = true;
  }

  /**
   * Refresh at most once per frame. Open panels are only refreshed when game state changed,
   * not on the once-a-second clock tick.
   */
  refreshHud(panels = true): void {
    this.panelsQueued ||= panels;
    if (this.hudQueued) return;
    this.hudQueued = true;
    requestAnimationFrame(() => {
      this.hudQueued = false;
      this.renderHud();
      if (this.panelsQueued && this.panelId && this.panelId !== 'settings') this.renderPanel();
      this.panelsQueued = false;
    });
  }

  private panelsQueued = false;

  private renderHud(): void {
    const g = this.game;
    if (!g) return;
    const s = g.state;
    const xp = levelProgress(s.player.xp, PLAYER_XP_LEVELS);
    const hm = levelProgress(s.island.harmony, ISLAND_HARMONY_LEVELS);
    const corruption = s.island.corruption.forest;
    // The header (zone + clock) is persistent; only its text changes, so the clock never redraws the box.
    if (!this.hudZone) {
      this.hudZone = h('strong', {});
      this.hudClock = h('span', { class: 'muted' });
      this.hudBody = h('div', {});
      this.hudStatus.append(h('div', { class: 'hud-line' }, this.hudZone, this.hudClock), this.hudBody);
    }
    const zone = t(`zone.${this.zone}`);
    const clock = `${t('hud.day', { day: g.day })} · ${g.timeLabel()}`;
    if (this.hudZone.textContent !== zone) this.hudZone.textContent = zone;
    if (this.hudClock!.textContent !== clock) this.hudClock!.textContent = clock;
    const body = h('div', {},
      h('div', { class: 'hearts', role: 'img', 'aria-label': t('hud.health', { hp: s.player.health, max: g.maxHealth() }), title: t('hud.health', { hp: s.player.health, max: g.maxHealth() }) },
        Array.from({ length: g.maxHealth() }, (_, i) => h('span', { class: i < s.player.health ? 'heart' : 'heart empty' }, i < s.player.health ? '❤️' : '🤍'))),
      h('div', { class: 'hud-line' },
        h('span', { class: 'coins', title: t('hud.coins') }, `🪙 ${s.player.coins}`),
        corruption ? h('span', { class: 'corrupt', title: t('hud.corruption') }, `🌲🌑 ${corruption}/3`) : null,
        s.island.corruption.lake ? h('span', { class: 'corrupt', title: t('hud.lake_corruption') }, `💧🌑 ${s.island.corruption.lake}/3`) : null),
      h('div', { class: 'hud-meter', title: t('hud.player_level_hint') },
        h('span', {}, `⭐ ${t('hud.player_level', { level: s.player.level })}`), bar(xp.pct, 'xp')),
      h('div', { class: 'hud-meter', title: t('hud.island_level_hint') },
        h('span', {}, `🌿 ${t('hud.island_level', { level: s.island.level })}`), bar(hm.pct, 'harmony')),
    );
    // Only touch the DOM when something visible actually changed.
    if (body.innerHTML !== this.hudBody!.innerHTML) this.hudBody!.replaceChildren(...body.childNodes);
  }

  private hudZone: HTMLElement | null = null;
  private hudClock: HTMLElement | null = null;
  private hudBody: HTMLElement | null = null;

  setZone(zone: ZoneId): void {
    this.zone = zone;
    this.refreshHud();
  }

  setPrompt(p: { label: string; enabled: boolean; combat: boolean } | null): void {
    const touch = coarse();
    this.promptEl.hidden = !p || touch;
    this.actionBtn.hidden = (!p && !this.inCombat) || !touch;
    if (!p) {
      if (this.inCombat) {
        this.actionBtn.className = 'action-btn combat';
        this.actionBtn.textContent = t('combat.attack');
      }
      return;
    }
    const key = this.keyLabel(this.settings.keys.interact);
    this.promptEl.className = `prompt ${p.enabled ? '' : 'disabled'} ${p.combat ? 'combat' : ''}`;
    this.promptEl.textContent = p.enabled ? `${key} — ${p.label}` : p.label;
    this.actionBtn.className = `action-btn ${p.enabled ? '' : 'disabled'} ${p.combat ? 'combat' : ''}`;
    this.actionBtn.textContent = p.label;
  }

  private keyLabel(k: string): string {
    return k === 'SHIFT' ? 'Shift' : k.length === 1 ? k : k.charAt(0) + k.slice(1).toLowerCase();
  }

  /** Combat controls appear when enemies are near (App Flow 19). */
  setCombat(on: boolean): void {
    this.inCombat = on;
    this.combatBar.hidden = !on;
    this.combatBar.classList.toggle('desktop', !coarse());
    if (!coarse()) {
      const k = this.settings.keys;
      const labels = this.combatBar.querySelectorAll('small');
      labels[0].textContent = `${t('combat.dodge')} (${this.keyLabel(k.dodge)})`;
      labels[1].textContent = `${t('combat.block')} (${this.keyLabel(k.block)})`;
      labels[2].textContent = `${t('combat.pip')} (${this.keyLabel(k.ability)})`;
      labels[3].textContent = `${t('combat.eat')} (1)`;
    }
    if (!on && coarse() && this.actionBtn.classList.contains('combat')) this.actionBtn.hidden = true;
  }

  setBossBar(hp: number, max: number): void {
    this.bossBarEl.hidden = max <= 0;
    if (max <= 0) return;
    clear(this.bossBarEl);
    this.bossBarEl.append(h('strong', {}, t('combat.boss_name')), bar(hp / max, 'boss'));
  }

  private makeJoystick(): HTMLElement {
    const knob = h('div', { class: 'knob' });
    const pad = h('div', { class: 'joystick', 'aria-hidden': 'true' }, knob);
    let active: number | null = null;
    const R = 46;
    const move = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, d / R);
      this.actions.setJoystick(mag > 0.2 ? dx / R : 0, mag > 0.2 ? dy / R : 0);
    };
    pad.addEventListener('pointerdown', (e) => {
      active = e.pointerId;
      try {
        pad.setPointerCapture(e.pointerId);
      } catch {
        // capture is best-effort (e.g. synthetic events)
      }
      move(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === active) move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = null;
      knob.style.transform = '';
      this.actions.setJoystick(0, 0);
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    return pad;
  }

  // ------------------------------------------------------------------ toasts

  toast(e: ToastEvent): void {
    const el = h('div', { class: `toast ${e.kind}` }, e.icon ? h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, e.icon) : null, h('span', {}, e.text));
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, e.kind === 'world' || e.kind === 'quest' ? 4200 : 3000);
  }

  info(text: string): void {
    this.toast({ text, kind: 'info' });
  }

  // ------------------------------------------------------------------ dialogue

  get dialogOpen(): boolean {
    return this.dialogEl !== null;
  }

  showDialog(d: Dialog, onDone?: () => void): void {
    this.closeDialog();
    this.actions.setPaused(true);
    let i = 0;
    const text = h('p', { class: 'dialog-text' });
    const footer = h('div', { class: 'dialog-options' });
    const finish = () => {
      this.closeDialog();
      this.actions.setPaused(this.panelEl !== null);
      onDone?.();
    };
    const speakerEl = h('div', { class: `dialog-speaker npc-${d.npc}` }, d.speaker);
    const render = () => {
      text.textContent = d.lines[i];
      const who = d.speakers?.[i];
      if (who) {
        speakerEl.className = `dialog-speaker npc-${who}`;
        speakerEl.textContent = t(`npc.${who}`);
      }
      clear(footer);
      const last = i >= d.lines.length - 1;
      if (last && d.options?.length) {
        d.options.forEach((o) =>
          footer.append(h('button', { class: 'btn', onclick: () => { finish(); this.actions.respond(o.id); } }, o.label)),
        );
      } else {
        footer.append(h('button', { class: 'btn primary', onclick: next }, last ? t('dialog.close') : t('dialog.next')));
      }
      (footer.querySelector('button') as HTMLButtonElement | null)?.focus();
    };
    const next = () => {
      if (i < d.lines.length - 1) {
        i++;
        render();
      } else if (!d.options?.length) {
        finish();
      }
    };
    this.dialogEl = h('div', { class: 'dialog', role: 'dialog', 'aria-label': d.speaker },
      speakerEl,
      text,
      footer,
    );
    text.addEventListener('click', next);
    this.dialogKey = (e: KeyboardEvent) => {
      if (['e', 'E', ' ', 'Enter'].includes(e.key) && !(d.options?.length && i >= d.lines.length - 1)) {
        if (document.activeElement?.tagName === 'BUTTON' && e.key !== 'e' && e.key !== 'E') return;
        e.preventDefault();
        next();
      }
    };
    document.addEventListener('keydown', this.dialogKey);
    this.root.append(this.dialogEl);
    render();
  }

  closeDialog(): void {
    if (this.dialogKey) document.removeEventListener('keydown', this.dialogKey);
    this.dialogKey = null;
    this.dialogEl?.remove();
    this.dialogEl = null;
  }

  // ------------------------------------------------------------------ modal helpers

  private openModal(title: string, body: HTMLElement, onClose?: () => void): void {
    this.closeModal();
    const close = () => {
      this.closeModal();
      onClose?.();
    };
    this.modalEl = h('div', { class: 'modal-wrap', onclick: (e: Event) => { if (e.target === this.modalEl) close(); } },
      h('div', { class: 'panel modal', role: 'dialog', 'aria-label': title },
        h('header', {}, h('h2', {}, title), h('button', { class: 'close', 'aria-label': t('common.close'), onclick: close }, '✕')),
        h('div', { class: 'panel-body' }, body),
      ));
    this.root.append(this.modalEl);
    (this.modalEl.querySelector('.close') as HTMLButtonElement).focus();
  }

  private closeModal(): void {
    this.modalEl?.remove();
    this.modalEl = null;
  }

  confirm(text: string, okLabel: string): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        this.closeModal();
        resolve(v);
      };
      this.openModal(t('common.confirm'),
        h('div', {},
          h('p', {}, text),
          h('div', { class: 'menu-buttons row-buttons' },
            h('button', { class: 'btn primary', onclick: () => finish(true) }, okLabel),
            h('button', { class: 'btn ghost', onclick: () => finish(false) }, t('common.cancel')))),
        () => finish(false));
    });
  }

  // ------------------------------------------------------------------ panels

  togglePanel(id: PanelId): void {
    if (this.panelId === id) this.closePanel();
    else this.openPanel(id);
  }

  openPanel(id: PanelId): void {
    this.panelId = id;
    if (this.game) this.actions.setPaused(true);
    this.renderPanel();
  }

  closePanel(): void {
    this.panelEl?.remove();
    this.panelEl = null;
    this.panelId = null;
    if (this.game && !this.dialogOpen) this.actions.setPaused(false);
  }

  private renderPanel(): void {
    const id = this.panelId;
    if (!id) return;
    const body = this.panelBody(id);
    // Already open: update the contents in place (no re-animation), and only if something changed.
    const open = this.panelEl?.querySelector(`.panel-${id} .panel-body`);
    if (open) {
      if (open.firstElementChild?.outerHTML !== body.outerHTML) open.replaceChildren(body);
      return;
    }
    this.panelEl?.remove();
    this.panelEl = h('div', { class: 'modal-wrap', onclick: (e: Event) => { if (e.target === this.panelEl) this.closePanel(); } },
      h('div', { class: `panel panel-${id}`, role: 'dialog', 'aria-label': t(`panel.${id}`) },
        h('header', {}, h('h2', {}, t(`panel.${id}`)), h('button', { class: 'close', 'aria-label': t('common.close'), onclick: () => this.closePanel() }, '✕')),
        h('div', { class: 'panel-body' }, body),
      ));
    this.root.append(this.panelEl);
  }

  private panelBody(id: PanelId): HTMLElement {
    switch (id) {
      case 'journal': return this.journal();
      case 'book': return this.book();
      case 'bag': return this.bag();
      case 'build': return this.buildPanel();
      case 'shop': return this.shop();
      case 'map': return this.map();
      case 'companion': return this.companion();
      case 'settings': return this.settingsPanel();
      case 'workshop': return this.workshop();
    }
  }

  private journal(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const section = (title: string, ids: typeof QUEST_ORDER) =>
      ids.length ? h('section', {}, h('h3', {}, title), ids.map((id) => {
        const q = s.quests[id];
        const o = QUESTS[id].objective;
        const giver = QUESTS[id].giver;
        return h('div', { class: `quest ${q.status}` },
          h('div', { class: 'quest-title' }, q.status === 'done' ? '✅ ' : q.status === 'available' ? '❗ ' : '📜 ', t(`quest.${id}.title`)),
          q.status === 'done' ? null : h('p', {}, t(`quest.${id}.desc`)),
          q.status === 'active' ? h('div', { class: 'quest-progress' }, h('span', {}, `${q.progress}/${o.count}`), bar(q.progress / o.count)) : null,
          q.status === 'available' ? h('p', { class: 'muted' }, t('journal.talk_to', { name: t(`npc.${giver}`) })) : null,
        );
      })) : null;
    const choices = s.choices.map((c) => h('li', {}, t('journal.choice_row', { day: c.day, text: t(`choice.${c.id}.${c.value}`) })));
    return h('div', {},
      section(t('journal.active'), QUEST_ORDER.filter((id) => s.quests[id].status === 'active')),
      section(t('journal.available'), QUEST_ORDER.filter((id) => s.quests[id].status === 'available')),
      section(t('journal.done'), QUEST_ORDER.filter((id) => s.quests[id].status === 'done')),
      h('section', {}, h('h3', {}, t('journal.memory')),
        choices.length ? h('ul', { class: 'memory' }, choices) : h('p', { class: 'muted' }, t('journal.no_memory')),
        h('p', { class: 'muted' }, t('journal.world_changes', { n: s.stats.worldChanges }))),
    );
  }

  private book(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const total = Object.values(DISCOVERY_CATALOG).reduce((n, l) => n + l.length, 0);
    const found = g.discoveryCount();
    const next = DISCOVERY_MILESTONES.find((m) => m > found);
    const tabs = (Object.keys(DISCOVERY_CATALOG) as DiscoveryCategory[]).map((cat) =>
      h('button', { class: `tab ${this.bookTab === cat ? 'on' : ''}`, onclick: () => { this.bookTab = cat; this.renderPanel(); } },
        `${t(`book.${cat}`)} (${s.discoveries[cat].length}/${DISCOVERY_CATALOG[cat].length})`));
    const cards = DISCOVERY_CATALOG[this.bookTab].map((id) => {
      const known = s.discoveries[this.bookTab].includes(id);
      return h('div', { class: `card ${known ? '' : 'unknown'}` },
        h('div', { class: 'card-icon', 'aria-hidden': 'true' }, known ? t(`icon.${id}`) : '❔'),
        h('strong', {}, known ? t(`disc.${id}`) : '???'),
        h('p', {}, known ? t(`disc.${id}.desc`) : t('book.unknown_hint')),
        known && this.bookTab === 'creatures' ? this.creatureBond(id) : null,
      );
    });
    return h('div', {},
      h('div', { class: 'milestone' },
        h('span', {}, t('book.progress', { found, total })), bar(found / total),
        h('p', { class: 'muted' }, next ? t('book.next_milestone', { n: next, reward: t(`book.milestone_${next}`) }) : t('book.all_milestones'))),
      h('div', { class: 'tabs' }, tabs),
      h('div', { class: 'cards' }, cards),
    );
  }

  private creatureBond(id: string): HTMLElement | null {
    const c = this.game!.state.creatures[id as keyof typeof CREATURES];
    if (!c) return null;
    const evo = CREATURES[id as keyof typeof CREATURES].evolution;
    const extra = c.evolved && evo ? ` · ✨ ${t(`evo.${evo.into}`)}` : evo && c.state === 'bonded' ? ` · ${t('book.can_evolve')}` : '';
    return h('div', { class: 'bond' }, h('span', {}, `${t(`cstate.${c.state}`)} · ${t('book.bond')} ${c.bond}%${extra}`), bar(c.bond / 100, 'bond'));
  }

  private bag(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const groups: [string, ItemId[]][] = [
      ['bag.resources', ['wood', 'stone', 'crystal', 'essence']],
      ['bag.food', ['glow_berry', 'veggie', 'minnow', 'moonfish', 'echo_koi', 'tonic']],
      ['bag.special', ['seed', 'purifier']],
    ];
    const itemRow = (item: ItemId) =>
      h('div', { class: `item ${s.inventory[item] ? '' : 'empty'}` },
        h('span', { class: 'item-icon', 'aria-hidden': 'true' }, ITEMS[item].icon),
        h('div', {}, h('strong', {}, `${g.itemName(item)} × ${s.inventory[item]}`), h('p', { class: 'muted' }, t(`item.${item}.desc`))),
        item === 'purifier' && s.inventory.purifier > 0
          ? h('button', { class: 'btn small', onclick: () => this.actions.usePurifier() }, t('bag.use'))
          : ITEMS[item].heal && s.inventory[item] > 0
            ? h('button', { class: 'btn small', disabled: s.player.health >= g.maxHealth(), onclick: () => this.info(g.eat(item).message ?? '') }, t('bag.eat', { n: ITEMS[item].heal! > 10 ? '♥♥' : ITEMS[item].heal! }))
            : null,
      );
    return h('div', {},
      h('p', { class: 'coins-line' }, `🪙 ${t('bag.coins', { n: s.player.coins })}`),
      s.player.attackBonus ? h('p', { class: 'muted' }, `🔷 ${t('bag.charm')}`) : null,
      groups.map(([key, items]) => h('section', {}, h('h3', {}, t(key)), items.map(itemRow))),
      h('section', {}, h('h3', {}, t('bag.cosmetics')),
        s.player.cosmetics.length
          ? s.player.cosmetics.map((c) => h('div', { class: 'item' }, h('span', { class: 'item-icon' }, '🌸'), h('strong', {}, t(`cosmetic.${c}`))))
          : h('p', { class: 'muted' }, t('bag.no_cosmetics'))),
      h('p', { class: 'muted' }, t('bag.sell_hint')),
    );
  }

  private costChips(cost: Partial<Record<ItemId, number>>): HTMLElement {
    const g = this.game!;
    return h('div', { class: 'chips' }, (Object.entries(cost) as [ItemId, number][]).map(([item, n]) => {
      const ok = g.state.inventory[item] >= n;
      return h('span', { class: `chip ${ok ? 'ok' : 'missing'}` }, `${ok ? '✓' : '✗'} ${ITEMS[item].icon} ${g.state.inventory[item]}/${n}`);
    }));
  }

  private buildPanel(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const free = PLOTS.filter((p) => g.plotStatus(p.id) === 'free').length;
    const nextLocked = PLOTS.find((p) => g.plotStatus(p.id) === 'locked');
    const cards = BUILDING_ORDER.map((b) => {
      const def = BUILDINGS[b];
      const missing = g.missingFor(def.cost);
      const ok = !Object.keys(missing).length && free > 0;
      return h('div', { class: 'card build-card' },
        h('div', { class: 'card-icon', 'aria-hidden': 'true' }, def.icon),
        h('strong', {}, t(`building.${b}`)),
        h('p', {}, t(`building.${b}.desc`)),
        this.costChips(def.cost),
        h('p', { class: 'muted' }, t('build.reward', { harmony: def.harmony })),
        Object.keys(missing).length
          ? h('p', { class: 'warn' }, t('build.missing', { list: (Object.entries(missing) as [ItemId, number][]).map(([i, n]) => `${n} ${g.itemName(i)}`).join(', ') }))
          : null,
        h('button', { class: 'btn primary', disabled: !ok, onclick: () => { this.closePanel(); this.actions.startBuild(b); } }, t('build.choose_plot')),
      );
    });
    return h('div', {},
      h('p', {}, t('build.slots', { free, total: PLOTS.length })),
      nextLocked ? h('p', { class: 'muted' }, t('build.next_slot', { level: nextLocked.islandLevel })) : null,
      h('div', { class: 'cards' }, cards),
      h('p', { class: 'muted' }, t('build.buildings_owned', { list: BUILDING_ORDER.filter((b) => s.buildings[b]).map((b) => `${s.buildings[b]} × ${t(`building.${b}`)}`).join(', ') || '—' })),
    );
  }

  showBuildBar(building: BuildingId | null): void {
    clear(this.buildBar);
    this.buildBar.hidden = !building;
    if (!building) return;
    this.buildBar.append(
      h('span', {}, t('build.mode', { name: t(`building.${building}`) })),
      h('button', { class: 'btn small ghost', onclick: () => this.actions.cancelBuild() }, t('common.cancel')),
    );
  }

  async askBuild(plotId: string, building: BuildingId): Promise<void> {
    const g = this.game!;
    const status = g.plotStatus(plotId);
    if (status !== 'free') {
      const plot = PLOTS.find((p) => p.id === plotId)!;
      this.info(status === 'locked' ? t('msg.plot_locked', { level: plot.islandLevel }) : t('msg.plot_occupied'));
      return;
    }
    this.actions.previewBuild(plotId, building);
    const cost = (Object.entries(BUILDINGS[building].cost) as [ItemId, number][]).map(([i, n]) => `${n} ${ITEMS[i].icon}`).join('  ');
    const ok = await this.confirm(t('build.confirm', { name: t(`building.${building}`), cost }), t('build.build'));
    if (ok) this.actions.confirmBuild(plotId, building);
    else this.actions.clearPreview();
  }

  private shop(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const tabs = h('div', { class: 'tabs' },
      h('button', { class: `tab ${this.shopTab === 'buy' ? 'on' : ''}`, onclick: () => { this.shopTab = 'buy'; this.renderPanel(); } }, t('shop.buy')),
      h('button', { class: `tab ${this.shopTab === 'sell' ? 'on' : ''}`, onclick: () => { this.shopTab = 'sell'; this.renderPanel(); } }, t('shop.sell')));
    const rows = ITEM_ORDER.filter((i) => (this.shopTab === 'buy' ? ITEMS[i].buy : ITEMS[i].sell) !== undefined).map((item) => {
      const price = (this.shopTab === 'buy' ? ITEMS[item].buy : ITEMS[item].sell)!;
      const have = s.inventory[item];
      const actions =
        this.shopTab === 'buy'
          ? [1, 5].map((q) => h('button', { class: 'btn small', disabled: s.player.coins < price * q, onclick: () => this.actions.buy(item, q) }, t('shop.buy_n', { n: q, price: price * q })))
          : [
              h('button', { class: 'btn small', disabled: have < 1, onclick: () => this.actions.sell(item, 1) }, t('shop.sell_n', { n: 1, price })),
              h('button', { class: 'btn small', disabled: have < 1, onclick: () => this.actions.sell(item, have) }, t('shop.sell_all', { price: price * have })),
            ];
      return h('div', { class: 'item' },
        h('span', { class: 'item-icon', 'aria-hidden': 'true' }, ITEMS[item].icon),
        h('div', {}, h('strong', {}, g.itemName(item)), h('p', { class: 'muted' }, t('shop.have', { n: have }))),
        h('div', { class: 'item-actions' }, actions));
    });
    return h('div', {},
      h('p', { class: 'coins-line' }, `🪙 ${t('bag.coins', { n: s.player.coins })}`),
      h('p', { class: 'muted' }, t('shop.intro')),
      tabs,
      rows,
    );
  }

  private map(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const W = 320;
    const H = 220;
    const canvas = h('canvas', { width: W * 2, height: H * 2, class: 'map-canvas', 'aria-label': t('panel.map') });
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    const sx = W / 64;
    const sy = H / 44;
    ctx.fillStyle = '#4cc3e6';
    ctx.fillRect(0, 0, W, H);
    const PLACE: Record<string, string> = {
      village: 'whisper_village', forest: 'emerald_forest', lake: 'moonlit_lake',
      caves: 'crystal_caves', temple: 'ancient_temple', highlands: 'highlands', grove: 'shadow_grove',
    };
    const known = (z: string) => s.discoveries.places.includes(PLACE[z]);
    // You can travel to any place you have found, and to any area whose entrance is open.
    const reachable = (z: string) =>
      known(z) ||
      z === 'caves' ||
      z === 'highlands' ||
      (z === 'temple' && s.world.templeOpen) ||
      (z === 'grove' && s.island.visuals.includes('grove_gate_open'));
    for (let ty = 0; ty < 44; ty++) {
      for (let tx = 0; tx < 64; tx++) {
        if (!isLand(tx, ty)) continue;
        const zone: ZoneId = tx < 30 ? 'village' : ty <= 21 ? 'forest' : 'lake';
        ctx.fillStyle = !known(zone) ? '#b8c4cc' : zone === 'forest' ? '#3f9a4e' : zone === 'lake' ? '#8fd17a' : '#9ad67a';
        ctx.fillRect(tx * sx, ty * sy, sx + 0.5, sy + 0.5);
      }
    }
    if (known('lake')) {
      ctx.fillStyle = s.island.lakeRestored ? '#3bb5e3' : '#6f8c93';
      ctx.beginPath();
      ctx.ellipse((LAKE.cx + 0.5) * sx, (LAKE.cy + 0.5) * sy, LAKE.rx * sx, LAKE.ry * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.island.corruption.forest && known('forest')) {
      ctx.fillStyle = 'rgba(64,32,90,0.35)';
      ctx.fillRect(30 * sx, 0, 34 * sx, 22 * sy);
      // pattern so corruption is not shown by colour alone
      ctx.strokeStyle = 'rgba(40,10,60,0.5)';
      for (let x = 30 * sx; x < W + 100; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 60, 22 * sy);
        ctx.stroke();
      }
    }
    const p = s.player.position;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2b2135';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc((p.x / 32) * sx, (p.y / 32) * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2b2135';
    const labels: [ZoneId, number, number][] = [['village', 15, 31], ['forest', 46, 10], ['lake', 47, 41]];
    for (const [z, x, y] of labels) ctx.fillText(known(z) ? t(`zone.${z}`) : '???', x * sx, y * sy);
    // markers for the entrances to the other areas
    const marks: [string, number, number, string][] = [['caves', 6, 9, '⛰️'], ['temple', 46, 3, '🏛️'], ['highlands', 60, 29, '🏔️']];
    ctx.font = '12px system-ui, sans-serif';
    for (const [z, x, y, icon] of marks) ctx.fillText(known(z) ? icon : '❔', (x + 0.5) * sx, (y + 1) * sy);
    const travelBtn = (z: ZoneId) =>
      h('button', { class: 'btn', disabled: !reachable(z) || z === this.zone, onclick: () => { this.closePanel(); this.actions.travel(z); } },
        reachable(z) ? t('map.travel', { name: t(`zone.${z}`) }) : t('map.unknown'));
    return h('div', {},
      canvas,
      h('p', { class: 'muted' }, t('map.hint')),
      h('h3', {}, t('map.island')),
      h('div', { class: 'menu-buttons' }, (['village', 'forest', 'lake'] as ZoneId[]).map(travelBtn)),
      h('h3', {}, t('map.beyond')),
      h('div', { class: 'menu-buttons' }, (['caves', 'temple', 'highlands', 'grove'] as ZoneId[]).map(travelBtn)),
    );
  }

  private companion(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const abilities = (['glow', 'sense', 'echo'] as PipAbility[]).map((a) => {
      const has = s.pip.abilities.includes(a);
      return h('div', { class: `item ${has ? '' : 'empty'}` },
        h('span', { class: 'item-icon', 'aria-hidden': 'true' }, a === 'glow' ? '💡' : a === 'sense' ? '🧭' : '🔮'),
        h('div', {}, h('strong', {}, t(`ability.${a}`)), h('p', { class: 'muted' }, has ? t(`ability.${a}.desc`) : t(`ability.${a}.locked`))),
        has && a !== 'echo'
          ? h('label', { class: 'switch' },
              h('input', { type: 'checkbox', checked: s.pip.enabled[a], onchange: (e: Event) => { s.pip.enabled[a] = (e.target as HTMLInputElement).checked; this.refreshHud(); } }),
              h('span', {}, s.pip.enabled[a] ? t('common.on') : t('common.off')))
          : null);
    });
    const met = (['rocco', 'luna', 'zed', 'tilly'] as NpcId[]).filter((n) => s.npcs[n].met);
    return h('div', {},
      h('p', {}, t('pip.panel_intro', { mood: t(`mood.${s.pip.mood}`) })),
      h('section', {}, h('h3', {}, t('companion.abilities')), abilities),
      h('section', {}, h('h3', {}, t('companion.creatures')),
        (Object.keys(CREATURES) as (keyof typeof CREATURES)[]).filter((c) => s.creatures[c].state !== 'unknown').map((c) =>
          h('div', { class: 'item' }, h('span', { class: 'item-icon' }, CREATURES[c].icon),
            h('div', {}, h('strong', {}, g.creatureName(c)), this.creatureBond(c)))),
        Object.values(s.creatures).every((c) => c.state === 'unknown') ? h('p', { class: 'muted' }, t('companion.no_creatures')) : null),
      h('section', {}, h('h3', {}, t('companion.friends')),
        met.length
          ? met.map((n) => h('div', { class: 'item' }, h('strong', {}, t(`npc.${n}`)), h('div', { class: 'grow' }, h('span', { class: 'muted' }, t('companion.trust')), bar(s.npcs[n].trust / 100, 'trust'))))
          : h('p', { class: 'muted' }, t('companion.no_friends'))),
    );
  }

  private workshop(): HTMLElement {
    const g = this.game!;
    const s = g.state;
    const rows = Object.entries(RECIPES).map(([id, r]) => {
      const missing = Object.keys(g.missingFor(r.cost)).length > 0;
      const done = r.makes === 'charm' && s.player.attackBonus > 0;
      return h('div', { class: 'card' },
        h('div', { class: 'card-icon', 'aria-hidden': 'true' }, r.makes === 'charm' ? '🔷' : ITEMS[r.makes].icon),
        h('strong', {}, t(`recipe.${id}`)),
        h('p', {}, t(`recipe.${id}.desc`)),
        this.costChips(r.cost),
        h('button', { class: 'btn primary', disabled: missing || done, onclick: () => this.actions.craft(id) }, done ? t('workshop.owned') : t('workshop.craft')),
      );
    });
    return h('div', {}, h('p', { class: 'muted' }, t('workshop.intro')), h('div', { class: 'cards' }, rows));
  }

  /** Fishing mini-game at the Moonlit Lake dock (App Flow 18): cast, wait, react, reel. */
  showFishing(): void {
    if (!this.game) return;
    this.actions.setPaused(true);
    const first = this.game.state.world.fishCaught === 0;
    const status = h('p', { class: 'fish-status', 'aria-live': 'assertive' }, first ? t('fish.tutorial') : t('fish.ready'));
    const bobber = h('div', { class: 'bobber', 'aria-hidden': 'true' }, '🎣');
    const btn = h('button', { class: 'btn primary big' }, t('fish.cast'));
    let phase: 'ready' | 'waiting' | 'bite' | 'done' = 'ready';
    let timer = 0;
    const window_ = this.settings.reducedMotion ? 1500 : 1100;
    this.fishingOpen = true;
    const close = () => {
      clearTimeout(timer);
      this.fishingOpen = false;
      wrap.remove();
      document.removeEventListener('keydown', key);
      this.actions.setPaused(this.panelEl !== null || this.dialogOpen);
    };
    const press = () => {
      if (phase === 'ready' || phase === 'done') {
        phase = 'waiting';
        status.textContent = t('fish.waiting');
        btn.textContent = t('fish.reel');
        bobber.className = 'bobber cast';
        timer = window.setTimeout(() => {
          phase = 'bite';
          status.textContent = t('fish.bite');
          bobber.className = 'bobber bite';
          if ('vibrate' in navigator && this.settings.haptics) navigator.vibrate(60);
          timer = window.setTimeout(() => {
            if (phase !== 'bite') return;
            phase = 'done';
            status.textContent = t('fish.escaped');
            btn.textContent = t('fish.again');
            bobber.className = 'bobber';
          }, window_);
        }, 1500 + Math.random() * 2500);
      } else if (phase === 'waiting') {
        clearTimeout(timer);
        phase = 'done';
        status.textContent = t('fish.too_early');
        btn.textContent = t('fish.again');
        bobber.className = 'bobber';
      } else if (phase === 'bite') {
        clearTimeout(timer);
        phase = 'done';
        const fish = this.actions.catchFish();
        status.textContent = t('fish.caught', { name: this.game!.itemName(fish), icon: ITEMS[fish].icon });
        btn.textContent = t('fish.again');
        bobber.className = 'bobber';
      }
    };
    const key = (e: KeyboardEvent) => {
      if ([' ', 'Enter', 'e', 'E'].includes(e.key)) {
        e.preventDefault();
        press();
      }
      if (e.key === 'Escape') close();
    };
    btn.addEventListener('click', press);
    document.addEventListener('keydown', key);
    const wrap = h('div', { class: 'modal-wrap' },
      h('div', { class: 'panel modal fishing', role: 'dialog', 'aria-label': t('fish.title') },
        h('header', {}, h('h2', {}, t('fish.title')), h('button', { class: 'close', 'aria-label': t('common.close'), onclick: close }, '✕')),
        h('div', { class: 'panel-body' }, h('div', { class: 'pond' }, bobber), status, h('div', { class: 'menu-buttons' }, btn))));
    this.root.append(wrap);
    btn.focus();
  }

  /** Ending montage: everything the island remembers (PRD 3 ending). */
  showEnding(ending: Ending, summary: { label: string; value: string }[]): void {
    this.closePanel();
    this.closeDialog();
    this.showScreen(
      h('div', { class: 'screen ending' },
        h('div', { class: 'menu-card wide' },
          h('h1', { class: 'logo' }, t(`ending.title_${ending}`)),
          h('p', {}, t(`ending.body_${ending}`)),
          h('h3', {}, t('ending.remembers')),
          h('ul', { class: 'montage' }, summary.map((r) => h('li', {}, h('span', {}, r.label), h('strong', {}, r.value)))),
          h('p', { class: 'muted' }, t('ending.thanks')),
          h('div', { class: 'menu-buttons' },
            h('button', { class: 'btn primary big', onclick: () => { this.closeScreen(); this.hud.hidden = false; this.actions.setPaused(false); } }, t('ending.keep_playing')),
            h('button', { class: 'btn', onclick: () => this.showCredits() }, t('menu.credits'))),
        ),
      ),
    );
    this.actions.setPaused(true);
  }

  private keyRemap(s: Settings, update: (patch: Partial<Settings>) => void): HTMLElement {
    const row = (action: ActionKey) => {
      const btn = h('button', { class: 'btn small' }, this.keyLabel(s.keys[action]));
      btn.addEventListener('click', () => {
        btn.textContent = t('settings.press_key');
        const listen = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          document.removeEventListener('keydown', listen, true);
          if (e.key === 'Escape') {
            btn.textContent = this.keyLabel(s.keys[action]);
            return;
          }
          const name = e.key === ' ' ? 'SPACE' : e.key === 'Shift' ? 'SHIFT' : e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase();
          if (/^[A-Z]$/.test(name) && 'WASD'.includes(name)) {
            btn.textContent = this.keyLabel(s.keys[action]);
            this.info(t('settings.key_taken'));
            return;
          }
          update({ keys: { ...s.keys, [action]: name } });
          s.keys = { ...s.keys, [action]: name };
          btn.textContent = this.keyLabel(name);
        };
        document.addEventListener('keydown', listen, true);
      });
      return h('div', { class: 'setting' }, h('span', {}, t(`settings.key_${action}`)), btn);
    };
    return h('div', {}, (['interact', 'dodge', 'block', 'ability'] as ActionKey[]).map(row));
  }

  private settingsPanel(): HTMLElement {
    const s = { ...this.settings };
    const update = (patch: Partial<Settings>) => {
      Object.assign(s, patch);
      this.settings = { ...s };
      this.actions.settingsChanged({ ...s });
    };
    const toggle = (label: string, key: 'music' | 'sfx' | 'haptics' | 'reducedMotion' | 'colorBlind') =>
      h('label', { class: 'setting' }, h('span', {}, label),
        h('input', { type: 'checkbox', role: 'switch', checked: s[key], onchange: (e: Event) => update({ [key]: (e.target as HTMLInputElement).checked }) }));
    const slider = (label: string, key: 'musicVolume' | 'sfxVolume') =>
      h('label', { class: 'setting' }, h('span', {}, label),
        h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], oninput: (e: Event) => update({ [key]: Number((e.target as HTMLInputElement).value) }) }));
    const select = <K extends 'graphics' | 'textSize' | 'language'>(label: string, key: K, options: [Settings[K], string][]) => {
      const sel = h('select', { onchange: (e: Event) => update({ [key]: (e.target as HTMLSelectElement).value } as Partial<Settings>) },
        options.map(([v, l]) => h('option', { value: v, selected: s[key] === v }, l)));
      return h('label', { class: 'setting' }, h('span', {}, label), sel);
    };
    const inGame = this.game !== null && this.screenEl === null;
    return h('div', {},
      inGame ? h('div', { class: 'menu-buttons row-buttons' },
        h('button', { class: 'btn primary', onclick: () => this.closePanel() }, t('settings.resume')),
        h('button', { class: 'btn', onclick: () => { this.closePanel(); this.actions.quitToMenu(); } }, t('settings.quit'))) : null,
      h('section', {}, h('h3', {}, t('settings.audio')),
        toggle(t('settings.music'), 'music'), slider(t('settings.music_volume'), 'musicVolume'),
        toggle(t('settings.sfx'), 'sfx'), slider(t('settings.sfx_volume'), 'sfxVolume'),
        toggle(t('settings.haptics'), 'haptics')),
      h('section', {}, h('h3', {}, t('settings.display')),
        select(t('settings.graphics'), 'graphics', [['low', t('settings.low')], ['medium', t('settings.medium')], ['high', t('settings.high')]]),
        select(t('settings.text_size'), 'textSize', [['small', t('settings.small')], ['medium', t('settings.medium')], ['large', t('settings.large')]]),
        toggle(t('settings.reduced_motion'), 'reducedMotion'),
        toggle(t('settings.color_blind'), 'colorBlind'),
        select(t('settings.language'), 'language', [['en', 'English']])),
      h('section', {}, h('h3', {}, t('settings.controls')),
        h('p', { class: 'muted' }, t('settings.controls_desktop')),
        this.keyRemap(s, update),
        h('p', { class: 'muted' }, t('settings.controls_touch'))),
      h('section', {}, h('h3', {}, t('settings.saves')),
        h('p', { class: 'muted' }, t('settings.saves_hint')),
        h('div', { class: 'menu-buttons row-buttons' },
          this.game ? h('button', { class: 'btn', onclick: () => this.actions.exportSave() }, t('settings.export')) : null,
          h('button', { class: 'btn', onclick: () => { this.closePanel(); void this.showRestore(() => undefined); } }, t('settings.import_restore')),
          h('button', { class: 'btn danger', onclick: async () => {
            if (await this.confirm(t('settings.reset_confirm'), t('settings.reset'))) this.actions.resetAll();
          } }, t('settings.reset'))),
        this.actions.canInstall() ? h('button', { class: 'btn ghost', onclick: () => this.actions.install() }, `⬇ ${t('menu.install')}`) : null),
    );
  }

  // ------------------------------------------------------------------ keyboard

  private onKey(e: KeyboardEvent): void {
    if (this.fishingOpen) return;
    if (e.key === 'Escape') {
      if (this.modalEl) this.closeModal();
      else if (this.panelEl) this.closePanel();
      else if (this.game && !this.screenEl && !this.dialogOpen) this.openPanel('settings');
      return;
    }
    if (!this.game || this.screenEl || this.dialogOpen || this.modalEl) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
    const map: Record<string, PanelId> = { j: 'journal', i: 'bag', m: 'map', k: 'book', b: 'build', p: 'companion' };
    const id = map[e.key.toLowerCase()];
    if (id) this.togglePanel(id);
  }
}

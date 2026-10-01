import Phaser from 'phaser';
import { Game } from './core/game';
import { applyTimeAway } from './core/growth';
import { setLanguage, t } from './core/i18n';
import { newGameState } from './core/state';
import type { AreaId, Appearance, BuildingId, EggChoice, GameState, ItemId, Settings, ZoneId } from './core/types';
import { Audio } from './platform/audio';
import { SaveStore, requestPersistentStorage } from './platform/saves';
import { applySettingsToDocument, loadSettings, saveSettings } from './platform/settings';
import { TabLock } from './platform/tablock';
import { AreaScene } from './scenes/AreaScene';
import { IslandScene } from './scenes/IslandScene';
import type { PlayScene, SceneHooks, WorldData } from './scenes/PlayScene';
import { UI, type UIActions } from './ui/ui';

const SAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_MS = 20_000;
const BACKUP_MS = 5 * 60_000;

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Wires the game core, persistence, the Phaser world and the HTML UI together. */
export class App {
  private settings: Settings = loadSettings();
  private audio = new Audio(this.settings);
  private saves = new SaveStore();
  private tabLock = new TabLock();
  private ui: UI;
  private phaser: Phaser.Game | null = null;
  private game: Game | null = null;
  private saved: GameState | null = null;
  private playing = false;
  private saveTimer: number | null = null;
  private lastBackup = 0;
  private installPrompt: InstallPromptEvent | null = null;
  private unsubs: (() => void)[] = [];
  private stopped = false;
  private activeKey: 'island' | 'area' = 'island';

  constructor() {
    applySettingsToDocument(this.settings);
    setLanguage(this.settings.language);
    this.ui = new UI(this.uiActions(), this.settings);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as InstallPromptEvent;
    });
    // Browsers block audio until a user gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.saveNow();
    });
    window.addEventListener('pagehide', () => void this.saveNow());
    setInterval(() => void this.saveNow(), AUTOSAVE_MS);
    setInterval(() => this.playing && this.ui.refreshHud(), 1000);
  }

  async start(): Promise<void> {
    if (await this.tabLock.otherTabOpen()) {
      this.ui.showTabBlocked(() => void this.boot(true));
      return;
    }
    await this.boot(false);
  }

  private async boot(takeover: boolean): Promise<void> {
    this.tabLock.acquire(() => this.onTabLost(), takeover);
    let notice: string | null = null;
    const { state, error } = await this.saves.loadCurrent();
    this.saved = state;
    if (error) {
      // PRD 22: offer the latest valid backup when the save fails validation.
      const backup = await this.saves.latestValidBackup().catch(() => null);
      this.saved = backup;
      notice = backup ? t('menu.notice_restored') : t('menu.notice_failed');
    }
    this.showMenu(notice);
  }

  private showMenu(notice: string | null = null): void {
    this.playing = false;
    const backdrop = this.saved ? (JSON.parse(JSON.stringify(this.saved)) as GameState) : newGameState();
    this.setGame(new Game(backdrop));
    this.startWorld('menu', 'island', 'spawn');
    this.ui.hideHud();
    this.ui.showMenu({
      save: this.saved ? { day: Math.floor(this.saved.world.minutes / 1440) + 1, islandLevel: this.saved.island.level } : null,
      notice,
      onRestore: () => void this.ui.showRestore(() => undefined),
    });
  }

  // ------------------------------------------------------------------ game lifecycle

  private setGame(game: Game): void {
    this.unsubs.forEach((u) => u());
    this.game = game;
    this.ui.setGame(game);
    const ev = game.events;
    this.unsubs = [
      ev.on('changed', () => {
        this.ui.refreshHud();
        this.scheduleSave();
      }),
      ev.on('toast', (e) => this.playing && this.ui.toast(e)),
      ev.on('sfx', (s) => this.playing && this.audio.sfx(s)),
      ev.on('levelup', (l) => {
        if (!this.playing) return;
        this.ui.toast({ kind: 'world', icon: l.kind === 'player' ? '⭐' : '🌿', text: t(`levelup.${l.kind}`, { level: l.level }) });
        this.audio.haptic(40);
      }),
      ev.on('worldChange', () => this.playing && this.audio.haptic(25)),
      ev.on('float', () => this.playing && this.audio.haptic(8)),
      ev.on('defeated', ({ lost }) => this.onDefeated(lost)),
    ];
  }

  private startWorld(mode: 'menu' | 'play', area: AreaId, arrive: string): void {
    const key = area === 'island' ? 'island' : 'area';
    const data: WorldData = { game: this.game!, mode, hooks: this.sceneHooks(), settings: this.settings, area, arrive };
    if (!this.phaser) {
      this.phaser = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        backgroundColor: '#2b9fd0',
        banner: false,
        scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
        render: { antialias: true, powerPreference: 'default' },
        input: { activePointers: 3 },
        fps: { target: 60 },
      });
      this.phaser.scene.add('island', IslandScene, false);
      this.phaser.scene.add('area', AreaScene, false);
    }
    const mgr = this.phaser.scene;
    const other = key === 'island' ? 'area' : 'island';
    if (mgr.isActive(other) || mgr.isPaused(other)) mgr.stop(other);
    if (mgr.isActive(key)) mgr.getScene(key).scene.restart(data);
    else mgr.start(key, data);
    this.activeKey = key;
    this.ui.setCombat(false);
    this.ui.setBossBar(0, 0);
  }

  private scene(): PlayScene | null {
    const s = this.phaser?.scene.getScene(this.activeKey) as PlayScene | undefined;
    return s && s.sys.isActive() ? s : null;
  }

  private island(): IslandScene | null {
    const s = this.scene();
    return s instanceof IslandScene ? s : null;
  }

  private newGame(appearance: Appearance): void {
    this.audio.unlock();
    const state = newGameState(appearance);
    state.stats.sessions = 1;
    this.saved = state;
    this.setGame(new Game(state));
    this.enterPlay();
    void requestPersistentStorage();
    void this.saveNow(true);
    this.ui.showDialog({ npc: 'pip', speaker: 'Pip', lines: [t('intro.1'), t('intro.2'), t('intro.3'), t('intro.4')] });
  }

  private continueGame(): void {
    if (!this.saved) return;
    this.audio.unlock();
    const state = this.saved;
    const away = applyTimeAway(state, new Date());
    state.stats.sessions++;
    this.setGame(new Game(state));
    this.enterPlay();
    void requestPersistentStorage();
    void this.saveNow(true);
    if (away) {
      this.scene()?.setPaused(true);
      this.ui.showAway(away, () => this.scene()?.setPaused(false));
    } else if (state.world.ending) {
      // finished games continue as a post-game sandbox
      this.ui.info(t('ending.postgame'));
    }
  }

  private enterPlay(): void {
    this.playing = true;
    const area = this.game!.state.player.position.area ?? 'island';
    this.startWorld('play', area, 'saved');
    this.ui.showHud();
    this.ui.showBuildBar(null);
  }

  /** Move Nova between the island and the other areas. */
  private travel(area: AreaId, arrive: string): void {
    if (!this.game) return;
    this.game.state.player.position.area = area;
    if (area === 'island') this.game.state.player.position.zone = arrive === 'highlandsPath' ? 'lake' : arrive === 'templeGate' ? 'forest' : 'village';
    void this.saveNow();
    this.startWorld('play', area, arrive);
    this.ui.showBuildBar(null);
  }

  private onDefeated(lost: Partial<Record<ItemId, number>>): void {
    if (!this.playing) return;
    this.audio.haptic(80);
    this.travel('island', 'village');
    const list = (Object.entries(lost) as [ItemId, number][]).map(([i, n]) => `${n} ${this.game!.itemName(i)}`).join(', ');
    this.ui.showDialog({
      npc: 'pip',
      speaker: 'Pip',
      lines: [t('defeat.1'), list ? t('defeat.lost', { list }) : t('defeat.nothing_lost'), t('defeat.2')],
    });
  }

  private quitToMenu(): void {
    void this.saveNow();
    this.showMenu();
  }

  private onTabLost(): void {
    this.stopped = true;
    this.playing = false;
    this.scene()?.setPaused(true);
    this.ui.showTabLost();
  }

  // ------------------------------------------------------------------ saving

  private scheduleSave(): void {
    if (!this.playing) return;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.saveNow(), SAVE_DEBOUNCE_MS);
  }

  private async saveNow(forceBackup = false): Promise<void> {
    if (!this.playing || !this.game || this.stopped || !this.tabLock.isActive) return;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const state = this.game.state;
    state.lastPlayedAt = new Date().toISOString();
    try {
      await this.saves.save(state);
      this.saved = state;
      if (forceBackup || Date.now() - this.lastBackup > BACKUP_MS) {
        this.lastBackup = Date.now();
        await this.saves.backup(state);
      }
    } catch (e) {
      state.stats.errors++;
      console.error('Save failed', e);
      this.ui.toast({ kind: 'warn', icon: '⚠️', text: t('msg.save_failed') });
    }
  }

  // ------------------------------------------------------------------ bridges

  private sceneHooks(): SceneHooks {
    return {
      prompt: (p) => this.ui.setPrompt(p),
      dialog: (d) => this.ui.showDialog(d),
      openShop: () => this.ui.openPanel('shop'),
      openWorkshop: () => this.ui.openPanel('workshop'),
      startFishing: () => this.ui.showFishing(),
      choosePlot: (plotId, b) => void this.ui.askBuild(plotId, b),
      info: (text) => this.ui.info(text),
      zoneChanged: (z: ZoneId) => this.ui.setZone(z),
      travel: (area, arrive) => this.travel(area, arrive),
      combat: (on) => this.ui.setCombat(on),
      bossBar: (hp, max) => this.ui.setBossBar(hp, max),
    };
  }

  private uiActions(): UIActions {
    const report = (r: { ok: boolean; message?: string }) => r.message && this.ui.info(r.message);
    return {
      newGame: (a) => this.newGame(a),
      continueGame: () => this.continueGame(),
      respond: (id) => {
        const game = this.game!;
        report(game.respond(id));
        if (id.startsWith('egg:')) {
          const choice = id.slice(4) as EggChoice;
          this.ui.showDialog({ npc: 'pip', speaker: 'Pip', lines: [t(`egg.after_${choice}`), t('egg.luna_arrives')] });
        } else if (id.startsWith('skyhare:')) {
          this.ui.showDialog({ npc: 'pip', speaker: 'Pip', lines: [t(`highlands.after_${id.slice(8)}`)] });
        } else if (id.startsWith('final:') && game.state.world.ending) {
          const e = game.state.world.ending;
          this.ui.showDialog({ npc: 'pip', speaker: 'Pip', lines: [t(`finale.after_${e}_1`), t(`finale.after_${e}_2`), t('finale.heart')] }, () =>
            this.ui.showEnding(e, game.endingSummary()),
          );
        }
      },
      interact: () => this.scene()?.interact(),
      dodge: () => this.scene()?.dodge(),
      block: (on) => this.scene()?.setBlocking(on),
      burst: () => this.scene()?.pipBurst(),
      eat: () => report(this.game!.eatBest()),
      setJoystick: (x, y) => this.scene()?.setJoystick(x, y),
      setPaused: (p) => this.scene()?.setPaused(p),
      startBuild: (b: BuildingId) => {
        const isl = this.island();
        if (!isl) {
          this.ui.info(t('build.only_village'));
          return;
        }
        isl.startBuildMode(b);
        this.ui.showBuildBar(b);
      },
      cancelBuild: () => {
        this.island()?.cancelBuildMode();
        this.ui.showBuildBar(null);
      },
      previewBuild: (plotId, b) => this.island()?.previewBuild(plotId, b),
      clearPreview: () => this.island()?.clearGhost(),
      confirmBuild: (plotId, b) => {
        const r = this.game!.build(b, plotId);
        if (r.ok) {
          this.island()?.playConstruction(plotId);
          this.ui.showBuildBar(null);
        } else {
          this.island()?.clearGhost();
          report(r);
        }
      },
      travel: (zone) => {
        if (zone === 'village' || zone === 'forest' || zone === 'lake') {
          const isl = this.island();
          if (isl) isl.travelTo(zone);
          else this.travel('island', zone);
        } else {
          this.travel(zone as AreaId, 'spawn');
        }
      },
      usePurifier: () => report(this.game!.usePurifier()),
      craft: (recipe) => report(this.game!.craft(recipe)),
      catchFish: () => this.game!.catchFish(),
      buy: (item, qty) => report(this.game!.buy(item, qty)),
      sell: (item, qty) => report(this.game!.sell(item, qty)),
      settingsChanged: (s) => {
        const keysChanged = JSON.stringify(s.keys) !== JSON.stringify(this.settings.keys);
        this.settings = s;
        saveSettings(s);
        applySettingsToDocument(s);
        setLanguage(s.language);
        this.audio.applySettings(s);
        this.ui.setSettings(s);
        this.scene()?.applySettings(s);
        // key bindings are attached when a scene starts
        if (keysChanged && this.playing) this.startWorld('play', this.game!.state.player.position.area, 'saved');
      },
      exportSave: () => {
        const state = this.game?.state ?? this.saved;
        if (!state) return;
        state.lastExportAt = new Date().toISOString();
        this.saves.exportFile(state);
        void this.saveNow();
      },
      importSave: async (file) => {
        try {
          const state = await this.saves.importFile(file);
          await this.saves.save(state);
          this.saved = state;
          this.ui.info(t('msg.import_ok'));
          this.showMenu();
        } catch (e) {
          this.ui.toast({ kind: 'warn', icon: '⚠️', text: t('msg.import_failed', { reason: e instanceof Error ? e.message : String(e) }) });
        }
      },
      listBackups: () => this.saves.listBackups(),
      restoreBackup: async (key) => {
        try {
          const state = await this.saves.loadBackup(key);
          await this.saves.save(state);
          this.saved = state;
          this.ui.info(t('msg.restore_ok'));
          this.showMenu();
        } catch (e) {
          this.ui.toast({ kind: 'warn', icon: '⚠️', text: t('msg.import_failed', { reason: e instanceof Error ? e.message : String(e) }) });
        }
      },
      resetAll: async () => {
        this.playing = false;
        await this.saves.clearAll();
        this.saved = null;
        this.showMenu(t('menu.notice_reset'));
      },
      quitToMenu: () => this.quitToMenu(),
      install: async () => {
        if (!this.installPrompt) return;
        await this.installPrompt.prompt();
        this.installPrompt = null;
      },
      canInstall: () => this.installPrompt !== null,
    };
  }
}

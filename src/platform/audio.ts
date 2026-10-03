import type { SfxName } from '../core/game';
import type { Settings } from '../core/types';

/** Where the player is, so music and ambience can match it. */
export type Mood = 'menu' | 'village' | 'forest' | 'lake' | 'caves' | 'temple' | 'highlands' | 'grove' | 'night' | 'boss';

interface MoodDef {
  /** Scale for the melody (Hz). */
  scale: number[];
  /** Drone roots, alternating. */
  roots: [number, number];
  /** Milliseconds per music step. */
  tempo: number;
  /** Chance a melody note plays on a step. */
  density: number;
  wave: OscillatorType;
  /** Ambient bed: filtered noise (wind / waves / hum). */
  bed: { type: BiquadFilterType; freq: number; q: number; level: number; wobble: number };
  /** Occasional ambient details. */
  detail: 'birds' | 'drips' | 'waves' | 'chimes' | 'wind' | 'whispers' | 'crickets' | 'none';
}

const C = 261.63;
const pent = (root: number, ratios = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4]) => ratios.map((r) => root * r);
const minorPent = (root: number) => [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5, 2, 12 / 5].map((r) => root * r);

const MOODS: Record<Mood, MoodDef> = {
  menu: { scale: pent(C), roots: [130.8, 98], tempo: 520, density: 0.55, wave: 'triangle', bed: { type: 'lowpass', freq: 500, q: 0.5, level: 0.02, wobble: 0.3 }, detail: 'birds' },
  village: { scale: pent(C), roots: [130.8, 110], tempo: 430, density: 0.6, wave: 'triangle', bed: { type: 'lowpass', freq: 700, q: 0.4, level: 0.025, wobble: 0.3 }, detail: 'birds' },
  forest: { scale: pent(196), roots: [98, 87.3], tempo: 480, density: 0.5, wave: 'sine', bed: { type: 'bandpass', freq: 900, q: 0.6, level: 0.04, wobble: 0.6 }, detail: 'birds' },
  lake: { scale: pent(220), roots: [110, 98], tempo: 560, density: 0.45, wave: 'sine', bed: { type: 'lowpass', freq: 420, q: 0.8, level: 0.07, wobble: 1 }, detail: 'waves' },
  caves: { scale: minorPent(146.8), roots: [73.4, 65.4], tempo: 720, density: 0.32, wave: 'sine', bed: { type: 'lowpass', freq: 160, q: 2, level: 0.06, wobble: 0.2 }, detail: 'drips' },
  temple: { scale: minorPent(174.6), roots: [87.3, 77.8], tempo: 640, density: 0.4, wave: 'triangle', bed: { type: 'bandpass', freq: 300, q: 3, level: 0.03, wobble: 0.2 }, detail: 'chimes' },
  highlands: { scale: pent(246.9), roots: [123.5, 110], tempo: 400, density: 0.55, wave: 'triangle', bed: { type: 'highpass', freq: 600, q: 0.3, level: 0.05, wobble: 1.2 }, detail: 'wind' },
  grove: { scale: minorPent(155.6), roots: [77.8, 73.4], tempo: 680, density: 0.35, wave: 'sine', bed: { type: 'bandpass', freq: 240, q: 4, level: 0.05, wobble: 0.5 }, detail: 'whispers' },
  night: { scale: pent(196, [1, 5 / 4, 3 / 2, 2, 5 / 2]), roots: [98, 82.4], tempo: 760, density: 0.35, wave: 'sine', bed: { type: 'lowpass', freq: 350, q: 0.5, level: 0.03, wobble: 0.2 }, detail: 'crickets' },
  boss: { scale: minorPent(110), roots: [55, 51.9], tempo: 230, density: 0.75, wave: 'sawtooth', bed: { type: 'lowpass', freq: 200, q: 6, level: 0.05, wobble: 2 }, detail: 'none' },
};

/**
 * Synthesized audio (no audio files): layered sound effects with noise for impacts,
 * footsteps per surface, UI clicks, and music + ambience that follow the zone, night and boss fights.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private detailTimer: number | null = null;
  private step = 0;
  private mood: Mood = 'menu';
  private bed: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private lastStep = 0;

  constructor(private settings: Settings) {}

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const master = this.ctx.createDynamicsCompressor();
      master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.ambGain = this.ctx.createGain();
      this.sfxGain.connect(master);
      this.musicGain.connect(master);
      this.ambGain.connect(master);
      // one second of white noise, reused for every noisy sound
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
    this.applySettings(this.settings);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx || !this.sfxGain || !this.musicGain || !this.ambGain) return;
    this.sfxGain.gain.value = s.sfx ? s.sfxVolume * 0.4 : 0;
    this.musicGain.gain.value = s.music ? s.musicVolume * 0.14 : 0;
    this.ambGain.gain.value = s.music ? s.musicVolume * 0.9 : 0;
    if (s.music && this.musicTimer === null) this.startMusic();
    if (!s.music && this.musicTimer !== null) this.stopMusic();
  }

  /** Switch music and ambience to match where the player is. */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.step = 0;
    if (this.musicTimer !== null) {
      this.stopMusic();
      this.startMusic();
    }
  }

  // ---------------------------------------------------------------- building blocks

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, out: AudioNode, slideTo?: number, attack = 0.01): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** A burst of filtered noise: thuds, crunches, splashes, whooshes. */
  private hiss(start: number, dur: number, filter: BiquadFilterType, freq: number, gain: number, out: AudioNode, sweepTo?: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, start);
    f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(out);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.05);
  }

  // ---------------------------------------------------------------- sound effects

  sfx(name: SfxName): void {
    if (!this.ctx || !this.sfxGain || !this.settings.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const o = this.sfxGain;
    const seq = (notes: number[], dur: number, type: OscillatorType = 'triangle', gain = 0.5, gap = 0.8) =>
      notes.forEach((f, i) => this.tone(f, t + i * dur * gap, dur, type, gain, o));
    switch (name) {
      case 'collect': seq([784, 1175], 0.1, 'triangle', 0.45); this.tone(2349, t + 0.12, 0.15, 'sine', 0.12, o); break;
      case 'chop':
        this.hiss(t, 0.09, 'bandpass', 1400, 0.7, o, 600, 2);
        this.tone(150, t, 0.12, 'sine', 0.6, o, 70);
        break;
      case 'mine':
        this.hiss(t, 0.06, 'highpass', 2500, 0.5, o);
        this.tone(1800, t, 0.08, 'square', 0.12, o, 1200);
        this.tone(220, t, 0.1, 'triangle', 0.4, o, 140);
        break;
      case 'splash':
        this.hiss(t, 0.35, 'lowpass', 2500, 0.55, o, 300);
        this.tone(600, t + 0.02, 0.2, 'sine', 0.25, o, 180);
        break;
      case 'plant': this.hiss(t, 0.12, 'lowpass', 700, 0.4, o); seq([392, 523, 659], 0.12, 'sine', 0.35); break;
      case 'coin': seq([1319, 1976], 0.08, 'square', 0.16, 0.7); this.tone(3951, t + 0.1, 0.18, 'sine', 0.06, o); break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          this.hiss(t + i * 0.13, 0.07, 'bandpass', 900, 0.5, o, 400, 3);
          this.tone(180, t + i * 0.13, 0.09, 'sine', 0.5, o, 90);
        }
        seq([523, 659, 784], 0.14, 'triangle', 0.35, 1.3);
        break;
      case 'success': seq([523, 659, 784, 1047], 0.14, 'triangle', 0.45); this.tone(1568, t + 0.42, 0.4, 'sine', 0.15, o); break;
      case 'levelup': seq([523, 659, 784, 1047, 1319, 1568], 0.12, 'sine', 0.5); this.hiss(t + 0.5, 0.6, 'highpass', 6000, 0.08, o); break;
      case 'magic':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, t + i * 0.05, 0.35, 'sine', 0.18, o));
        this.hiss(t, 0.4, 'highpass', 7000, 0.06, o);
        break;
      case 'error': this.tone(220, t, 0.12, 'square', 0.18, o, 180); this.tone(196, t + 0.1, 0.16, 'square', 0.18, o, 150); break;
      case 'swing': this.hiss(t, 0.14, 'bandpass', 1800, 0.45, o, 500, 1.5); break;
      case 'hit': this.hiss(t, 0.08, 'lowpass', 1600, 0.6, o); this.tone(260, t, 0.1, 'square', 0.25, o, 110); break;
      case 'hurt': this.tone(392, t, 0.25, 'sawtooth', 0.22, o, 160); this.hiss(t, 0.15, 'lowpass', 900, 0.35, o); break;
      case 'dodge': this.hiss(t, 0.2, 'bandpass', 800, 0.4, o, 2600, 1); break;
      case 'block': this.tone(1400, t, 0.12, 'square', 0.15, o, 900); this.hiss(t, 0.06, 'highpass', 3000, 0.3, o); break;
      case 'bite': seq([880, 1175], 0.07, 'square', 0.2); this.hiss(t, 0.12, 'lowpass', 1800, 0.35, o); break;
      case 'door':
        this.hiss(t, 0.8, 'lowpass', 300, 0.5, o, 120, 2);
        seq([196, 247, 294, 392], 0.22, 'triangle', 0.35, 0.9);
        break;
      case 'click': this.tone(1200, t, 0.035, 'triangle', 0.18, o, 900); break;
      case 'step_grass': this.footstep(1400, 0.18); break;
      case 'step_sand': this.footstep(2600, 0.14); break;
      case 'step_stone': this.footstep(900, 0.22, true); break;
      case 'step_leaves': this.footstep(3200, 0.12); break;
    }
  }

  private footstep(freq: number, gain: number, hard = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = performance.now();
    if (now - this.lastStep < 200) return;
    this.lastStep = now;
    const t = this.ctx.currentTime;
    this.hiss(t, 0.06, 'bandpass', freq * (0.9 + Math.random() * 0.2), gain, this.sfxGain, undefined, 1.2);
    if (hard) this.tone(140, t, 0.05, 'sine', 0.15, this.sfxGain, 90);
  }

  // ---------------------------------------------------------------- music & ambience

  private startMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const def = MOODS[this.mood];
    this.startBed(def);
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const m = MOODS[this.mood];
      if (this.step % 8 === 0) {
        const root = m.roots[Math.floor(this.step / 8) % 2];
        this.tone(root, t, (m.tempo / 1000) * 8, 'sine', 0.45, this.musicGain, undefined, 0.3);
        this.tone(root * 1.5, t, (m.tempo / 1000) * 8, 'sine', 0.18, this.musicGain, undefined, 0.4);
      }
      if (this.mood === 'boss' && this.step % 2 === 0) this.hiss(t, 0.1, 'lowpass', 180, 0.5, this.musicGain);
      if (Math.random() < m.density) {
        const f = m.scale[Math.floor(Math.random() * m.scale.length)];
        this.tone(f, t, (m.tempo / 1000) * 2, m.wave, m.wave === 'sawtooth' ? 0.12 : 0.3, this.musicGain);
      }
      this.step++;
    }, def.tempo);
    this.detailTimer = window.setInterval(() => this.ambientDetail(), 900);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    if (this.detailTimer !== null) window.clearInterval(this.detailTimer);
    this.musicTimer = null;
    this.detailTimer = null;
    this.stopBed();
  }

  /** Continuous ambience: noise through a slowly wobbling filter (wind, water, cave hum). */
  private startBed(def: MoodDef): void {
    if (!this.ctx || !this.ambGain || !this.noise) return;
    this.stopBed();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = def.bed.type;
    filter.frequency.value = def.bed.freq;
    filter.Q.value = def.bed.q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(def.bed.level, ctx.currentTime + 1.5);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08 + def.bed.wobble * 0.05;
    lfoGain.gain.value = def.bed.freq * 0.35 * def.bed.wobble;
    lfo.connect(lfoGain).connect(filter.frequency);
    src.connect(filter).connect(gain).connect(this.ambGain);
    src.start();
    lfo.start();
    this.bed = { src, filter, gain, lfo };
  }

  private stopBed(): void {
    if (!this.bed || !this.ctx) return;
    const { src, gain, lfo } = this.bed;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    src.stop(t + 0.7);
    lfo.stop(t + 0.7);
    this.bed = null;
  }

  /** Small sounds that make each place feel alive. */
  private ambientDetail(): void {
    if (!this.ctx || !this.ambGain || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const o = this.ambGain;
    const r = Math.random();
    switch (MOODS[this.mood].detail) {
      case 'birds':
        if (r < 0.3) {
          const base = 2200 + Math.random() * 1500;
          for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(base, t + i * 0.11, 0.08, 'sine', 0.02, o, base * 1.35);
        }
        break;
      case 'crickets':
        if (r < 0.5) for (let i = 0; i < 4; i++) this.tone(4200, t + i * 0.06, 0.03, 'square', 0.004, o);
        break;
      case 'drips':
        if (r < 0.35) this.tone(1400 + Math.random() * 900, t, 0.12, 'sine', 0.03, o, 700);
        break;
      case 'waves':
        if (r < 0.2) this.hiss(t, 2.2, 'lowpass', 900, 0.02, o, 250);
        break;
      case 'chimes':
        if (r < 0.15) this.tone([1047, 1319, 1568][Math.floor(Math.random() * 3)], t, 2.5, 'sine', 0.015, o, undefined, 0.02);
        break;
      case 'wind':
        if (r < 0.2) this.hiss(t, 2.5, 'bandpass', 500, 0.025, o, 1400, 0.7);
        break;
      case 'whispers':
        if (r < 0.15) this.hiss(t, 1.4, 'bandpass', 1800, 0.012, o, 900, 8);
        break;
    }
  }

  haptic(ms = 12): void {
    if (this.settings.haptics && 'vibrate' in navigator) navigator.vibrate(ms);
  }
}

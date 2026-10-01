import type { SfxName } from '../core/game';
import type { Settings } from '../core/types';

/**
 * Tiny synthesized audio (no audio files needed for Phase 0).
 * Sound effects are short oscillator blips; music is a gentle generative pentatonic melody.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;

  constructor(private settings: Settings) {}

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.applySettings(this.settings);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx || !this.sfxGain || !this.musicGain) return;
    this.sfxGain.gain.value = s.sfx ? s.sfxVolume * 0.35 : 0;
    this.musicGain.gain.value = s.music ? s.musicVolume * 0.12 : 0;
    if (s.music && this.musicTimer === null) this.startMusic();
    if (!s.music && this.musicTimer !== null) this.stopMusic();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, out: GainNode, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  sfx(name: SfxName): void {
    if (!this.ctx || !this.sfxGain || !this.settings.sfx) return;
    const t = this.ctx.currentTime;
    const o = this.sfxGain;
    const seq = (notes: number[], dur: number, type: OscillatorType = 'triangle', gain = 0.6) =>
      notes.forEach((f, i) => this.tone(f, t + i * dur * 0.8, dur, type, gain, o));
    switch (name) {
      case 'collect': seq([660, 990], 0.09); break;
      case 'chop': this.tone(180, t, 0.08, 'square', 0.4, o, 90); break;
      case 'mine': this.tone(320, t, 0.06, 'square', 0.35, o, 200); break;
      case 'splash': this.tone(500, t, 0.18, 'sine', 0.5, o, 120); break;
      case 'plant': seq([392, 523], 0.1, 'sine'); break;
      case 'coin': seq([988, 1319], 0.07, 'square', 0.25); break;
      case 'build': seq([196, 262, 330], 0.12, 'triangle', 0.6); break;
      case 'success': seq([523, 659, 784, 1047], 0.11); break;
      case 'levelup': seq([523, 659, 784, 1047, 1319], 0.1, 'sine', 0.7); break;
      case 'magic': seq([880, 1175, 1568], 0.08, 'sine', 0.4); break;
      case 'error': this.tone(200, t, 0.15, 'sawtooth', 0.25, o, 150); break;
    }
  }

  private startMusic(): void {
    // A-minor pentatonic over a slow two-chord drone.
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      if (this.step % 16 === 0) {
        const root = this.step % 32 === 0 ? 110 : 98;
        this.tone(root, t, 3.6, 'sine', 0.5, this.musicGain);
      }
      if (Math.random() < 0.6) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        this.tone(f, t, 0.9, 'triangle', 0.35, this.musicGain);
      }
      this.step++;
    }, 450);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  haptic(ms = 12): void {
    if (this.settings.haptics && 'vibrate' in navigator) navigator.vibrate(ms);
  }
}

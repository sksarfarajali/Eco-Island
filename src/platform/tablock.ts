/**
 * Single-tab lock (PRD 19.1): two open tabs must not overwrite each other's save.
 * The newest tab asks whether another tab is alive; the user can take over,
 * which tells the old tab to stop playing and saving.
 */
const CHANNEL = 'echo-island-tab';

export class TabLock {
  private channel: BroadcastChannel | null = null;
  private onLost: (() => void) | null = null;
  private active = false;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<string>) => {
        if (e.data === 'ping' && this.active) this.channel?.postMessage('pong');
        if (e.data === 'takeover' && this.active) {
          this.active = false;
          this.onLost?.();
        }
      };
    }
  }

  /** Resolves true if another tab currently holds the game. */
  otherTabOpen(): Promise<boolean> {
    const ch = this.channel;
    if (!ch) return Promise.resolve(false);
    return new Promise((resolve) => {
      let seen = false;
      const listener = (e: MessageEvent<string>) => {
        if (e.data === 'pong') seen = true;
      };
      ch.addEventListener('message', listener);
      ch.postMessage('ping');
      setTimeout(() => {
        ch.removeEventListener('message', listener);
        resolve(seen);
      }, 350);
    });
  }

  acquire(onLost: () => void, takeover = false): void {
    this.onLost = onLost;
    if (takeover) this.channel?.postMessage('takeover');
    this.active = true;
  }

  get isActive(): boolean {
    return this.active;
  }
}

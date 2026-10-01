type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter used between the game core, the Phaser scene and the HTML UI. */
export class Emitter<Events extends object> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    (this.handlers[event] ??= []).push(handler);
    return () => {
      this.handlers[event] = this.handlers[event]?.filter((h) => h !== handler);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const h of this.handlers[event] ?? []) h(payload);
  }

  clear(): void {
    this.handlers = {};
  }
}

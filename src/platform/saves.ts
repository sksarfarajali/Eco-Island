import { migrateSave, validateSave } from '../core/state';
import type { GameState } from '../core/types';

/**
 * Local save storage in IndexedDB (PRD 19.1).
 * - `current` holds the live save.
 * - three rolling backup slots are written periodically.
 * Everything is versioned and migrated on load.
 */
const DB_NAME = 'echo-island';
const STORE = 'saves';
const BACKUP_SLOTS = 3;

export interface BackupInfo {
  key: string;
  savedAt: string;
  day: number;
  islandLevel: number;
}

interface Record_ {
  key: string;
  savedAt: string;
  data: GameState;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

export class SaveStore {
  private nextBackup = 0;

  async loadCurrent(): Promise<{ state: GameState | null; error: string | null }> {
    try {
      const rec = await tx<Record_ | undefined>('readonly', (s) => s.get('current'));
      if (!rec) return { state: null, error: null };
      return { state: this.parse(rec.data), error: null };
    } catch (e) {
      return { state: null, error: String(e instanceof Error ? e.message : e) };
    }
  }

  async save(state: GameState): Promise<void> {
    const data = JSON.parse(JSON.stringify(state)) as GameState;
    await tx('readwrite', (s) => s.put({ key: 'current', savedAt: new Date().toISOString(), data }));
  }

  /** Write a rotating backup slot (oldest is overwritten). */
  async backup(state: GameState): Promise<void> {
    const list = await this.listBackups();
    if (list.length >= BACKUP_SLOTS) {
      const oldest = [...list].sort((a, b) => a.savedAt.localeCompare(b.savedAt))[0];
      this.nextBackup = Number(oldest.key.split('-')[1]);
    } else {
      this.nextBackup = list.length;
    }
    const data = JSON.parse(JSON.stringify(state)) as GameState;
    await tx('readwrite', (s) => s.put({ key: `backup-${this.nextBackup}`, savedAt: new Date().toISOString(), data }));
  }

  async listBackups(): Promise<BackupInfo[]> {
    const all = await tx<Record_[]>('readonly', (s) => s.getAll());
    return all
      .filter((r) => r.key.startsWith('backup-'))
      .map((r) => ({
        key: r.key,
        savedAt: r.savedAt,
        day: Math.floor((r.data.world?.minutes ?? 0) / 1440) + 1,
        islandLevel: r.data.island?.level ?? 1,
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async loadBackup(key: string): Promise<GameState> {
    const rec = await tx<Record_ | undefined>('readonly', (s) => s.get(key));
    if (!rec) throw new Error('Backup not found');
    return this.parse(rec.data);
  }

  /** Newest backup that passes validation, if any. */
  async latestValidBackup(): Promise<GameState | null> {
    for (const b of await this.listBackups()) {
      try {
        return await this.loadBackup(b.key);
      } catch {
        // try the next one
      }
    }
    return null;
  }

  async clearAll(): Promise<void> {
    await tx('readwrite', (s) => s.clear());
  }

  parse(raw: unknown): GameState {
    const state = migrateSave(raw);
    const problem = validateSave(state);
    if (problem) throw new Error(`Save failed validation (${problem})`);
    return state;
  }

  exportFile(state: GameState): void {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `echo-island-save-day${Math.floor(state.world.minutes / 1440) + 1}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async importFile(file: File): Promise<GameState> {
    const text = await file.text();
    return this.parse(JSON.parse(text));
  }
}

/** Ask the browser not to evict our storage (Safari otherwise may clear it after ~7 days). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

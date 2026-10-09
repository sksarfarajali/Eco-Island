import type { DecorId, EventKind, ItemId } from './types';

/**
 * Surprise events: something new pops up around the island every few minutes of play,
 * so no two play sessions feel the same.
 */
export const EVENT_SECONDS: Record<EventKind, number> = {
  treasure: 240,
  star: 180,
  lost: 360,
  golden: 150,
  gloom: 300,
  merchant: 300,
};

export const EVENT_ICONS: Record<EventKind, string> = {
  treasure: '💰',
  star: '🌠',
  lost: '🎒',
  golden: '🦋',
  gloom: '🌑',
  merchant: '🛒',
};

/** Seconds of island play between one event ending and the next one starting. */
export const EVENT_GAP: readonly [number, number] = [150, 270];

/** Gloomlings in an outbreak. */
export const OUTBREAK_SIZE = 3;

export interface MerchantOffer {
  give?: Partial<Record<ItemId, number>>;
  decor?: DecorId;
  price: number;
}

/** Everything the wandering merchant might bring; each visit shows three of them. */
export const MERCHANT_POOL: readonly MerchantOffer[] = [
  { give: { seed: 5 }, price: 18 },
  { give: { crystal: 3 }, price: 22 },
  { give: { essence: 3 }, price: 20 },
  { give: { tonic: 1 }, price: 25 },
  { give: { purifier: 1 }, price: 22 },
  { give: { echo_koi: 1 }, price: 30 },
  { give: { coconut: 3, shell: 3 }, price: 15 },
  { decor: 'blossom_tree', price: 90 },
  { decor: 'paper_lantern', price: 90 },
  { decor: 'pumpkin', price: 90 },
  { decor: 'snowman', price: 90 },
];

/** The three offers of a merchant visit (always the same for the same visit). */
export function merchantOffers(eventId: number): MerchantOffer[] {
  const pool = [...MERCHANT_POOL];
  const out: MerchantOffer[] = [];
  let h = (eventId * 2654435761) >>> 0;
  while (out.length < 3) {
    out.push(pool.splice(h % pool.length, 1)[0]);
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
  }
  return out;
}

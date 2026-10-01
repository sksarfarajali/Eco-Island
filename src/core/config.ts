/** Tile size in world pixels. */
export const TILE = 32;
export const MAP_W = 64;
export const MAP_H = 44;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** In-game minutes that pass per real second (a full day lasts 12 real minutes). */
export const MINUTES_PER_SECOND = 2;
export const MINUTES_PER_DAY = 24 * 60;
/** The game starts at 08:00 on day 1. */
export const START_MINUTES = 8 * 60;

/** Real time away is capped at 24 hours (PRD 13.5). */
export const AWAY_CAP_SECONDS = 24 * 60 * 60;
/** Shorter absences do not show the "Since You Were Away" panel. */
export const AWAY_MIN_SECONDS = 60;

/** Growth durations in game minutes. */
export const GROW = {
  sapling: 120,
  stumpRegrow: 720,
  bushRegrow: 240,
  rockRegrow: 480,
  eggHatch: 60,
  garden: 240,
} as const;

export const GARDEN_MAX_PRODUCE = 6;

/** Forest corruption (PRD 13.4). */
export const CORRUPTION_MAX = 3;
export const HARVEST_PRESSURE_LIMIT = 6;
export const HARVEST_PRESSURE_WARN = 4;
export const CLEANSE_PLANTS_NEEDED = 3;

/** Cumulative XP needed for each player level (index 0 = level 1). */
export const PLAYER_XP_LEVELS = [0, 50, 120, 220, 350, 500, 700];
/** Cumulative Harmony needed for each island level (index 0 = level 1). */
export const ISLAND_HARMONY_LEVELS = [0, 40, 100, 180, 300, 450];

export const EGG_SALE_PRICE = 40;
export const STARTING_COINS = 20;

/** Interaction reach in world pixels. */
export const INTERACT_RANGE = 52;

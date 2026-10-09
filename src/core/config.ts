/** Tile size in world pixels. */
export const TILE = 32;
export const MAP_W = 64;
export const MAP_H = 44;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/**
 * The island's day and clock follow the real calendar and the player's local time.
 * Plants, gardens and weather run on a faster "growth clock": this many growth minutes pass per real second.
 */
export const MINUTES_PER_SECOND = 2;
export const MINUTES_PER_DAY = 24 * 60;
/** The game starts at 08:00 on day 1. */
export const START_MINUTES = 8 * 60;

/** Napping at home: growth minutes that pass, and real minutes between growth naps. */
export const NAP_GROWTH_MINUTES = 240;
export const NAP_COOLDOWN_MINUTES = 30;

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
  crystalRegrow: 600,
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
export const PLAYER_XP_LEVELS = [0, 50, 120, 220, 350, 500, 700, 950, 1250, 1600, 2000, 2500, 3100, 3800, 4600];
/** Cumulative Harmony needed for each island level (index 0 = level 1). */
export const ISLAND_HARMONY_LEVELS = [0, 40, 100, 180, 300, 450, 650, 900, 1200, 1600];

export const EGG_SALE_PRICE = 40;

/** Fishing (App Flow 18): catching too many fish in a short time raises lake corruption. */
export const FISH_PRESSURE_WARN = 6;
export const FISH_PRESSURE_LIMIT = 9;
/** Fish pressure fades by one every this many game minutes. */
export const FISH_PRESSURE_DECAY = 90;
export const STARTING_COINS = 20;

/** Interaction reach in world pixels. */
export const INTERACT_RANGE = 52;

/** Gathering yield never grows past this, however high Nova's level. */
export const MAX_GATHER_YIELD = 4;

/** Seasons: each lasts this many game days; the last day of each season is a festival. */
export const SEASON_DAYS = 7;

/** A new weather roll every six game hours. */
export const WEATHER_MINUTES = 360;

/** Rain waters saplings and gardens, so they grow this much faster. */
export const RAIN_GROWTH = 2;

/** Mini-games (App Flow: creature play). */
export const SEEK_SECONDS = 60;
export const RACE_SECONDS = 30;

/** Daily login rewards by streak day (repeats after day 7). */
export const LOGIN_REWARDS = [10, 15, 20, 25, 30, 40, 60];

/** Boat repair at the Moonlit Lake dock (opens Coral Isle). */
export const BOAT_COST = { wood: 12, stone: 6, essence: 2 } as const;
/** Healing one reef spot on Coral Isle. */
export const REEF_COST = { essence: 1 } as const;

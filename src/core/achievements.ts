import { CREATURE_ORDER } from './content';
import type { GameState } from './types';

/** Badges (achievements). Each is checked whenever the game state changes and awarded once. */
export interface AchievementDef {
  id: string;
  icon: string;
  check: (s: GameState) => boolean;
}

const discoveries = (s: GameState) => Object.values(s.discoveries).reduce((n, l) => n + l.length, 0);
const decorPlaced = (s: GameState) => Object.values(s.world.decor).filter(Boolean).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'green_thumb', icon: '🌱', check: (s) => s.island.treesPlanted >= 10 },
  { id: 'forest_keeper', icon: '🌳', check: (s) => s.island.treesPlanted >= 30 },
  { id: 'first_friend', icon: '💛', check: (s) => Object.values(s.creatures).some((c) => c.state === 'bonded') },
  { id: 'friend_to_all', icon: '🐾', check: (s) => CREATURE_ORDER.every((id) => s.creatures[id].state === 'bonded') },
  { id: 'flawless', icon: '🛡️', check: (s) => s.world.bossDefeated && s.stats.defeats === 0 },
  { id: 'hero', icon: '⚔️', check: (s) => s.world.enemiesDefeated >= 25 },
  { id: 'angler', icon: '🎣', check: (s) => s.world.fishCaught >= 20 },
  { id: 'master_chef', icon: '👩‍🍳', check: (s) => s.stats.mealsCooked >= 10 },
  { id: 'photographer', icon: '📸', check: (s) => s.stats.photos >= 5 },
  { id: 'decorator', icon: '🪴', check: (s) => decorPlaced(s) >= 6 },
  { id: 'sailor', icon: '⛵', check: (s) => s.discoveries.places.includes('coral_isle') },
  { id: 'reef_healer', icon: '🪸', check: (s) => s.quests.q_reef.status === 'done' },
  { id: 'daily_devotee', icon: '📅', check: (s) => s.daily.completed >= 10 },
  { id: 'loyal', icon: '🔥', check: (s) => s.daily.streak >= 7 },
  { id: 'seeker', icon: '🦊', check: (s) => s.world.minigames.seekWins >= 3 },
  { id: 'racer', icon: '🐢', check: (s) => s.world.minigames.raceWins >= 3 },
  { id: 'festive', icon: '🏮', check: (s) => s.world.festivals.length >= 1 },
  { id: 'all_seasons', icon: '🗓️', check: (s) => ['spring', 'summer', 'autumn', 'winter'].every((k) => s.world.festivals.some((f) => f.startsWith(k))) },
  { id: 'storm_chaser', icon: '🌦️', check: (s) => ['rain', 'fog', 'snow'].every((w) => s.stats.weatherSeen.includes(w as never)) },
  { id: 'scholar', icon: '📖', check: (s) => discoveries(s) >= 35 },
  { id: 'legend', icon: '⭐', check: (s) => s.player.level >= 15 },
  { id: 'event_hunter', icon: '✨', check: (s) => s.stats.eventsDone >= 10 },
  { id: 'memory_keeper', icon: '🔮', check: (s) => s.discoveries.memories.length >= 12 },
  { id: 'master_angler', icon: '🐟', check: (s) => s.discoveries.fish.length >= 10 },
  { id: 'paradise', icon: '🌴', check: (s) => s.island.level >= 10 },
];

/** Coins given for every badge. */
export const ACHIEVEMENT_COINS = 20;

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**ECHO ISLAND — The World That Remembers**

*Product specification • Mobile + Desktop • Offline-first • Zero infrastructure cost target • Version 2.0 (2026-10-01)*

## 1. Executive Summary

Echo Island is a colorful, top-down 2D exploration, discovery, building and creature-companion game in which the world remembers the player's actions. The core product promise is: “Every choice you make changes the island.” The first release is designed to run primarily on the client, minimizing or eliminating recurring infrastructure costs.

## 2. Product Vision

Create a highly visual, approachable game that combines cozy exploration, light adventure, collection, puzzles, building and world evolution. Players should feel that the island is a living place rather than a sequence of static levels.

Tagline: The World That Remembers.

## 3. Story Outline — The Island's Lost Memory

Echo Island once remembered everyone who lived on it: every tree planted, every creature helped and every promise kept was stored in the island's heart, the Echo Heart, hidden in the Ancient Temple. A creeping darkness from Shadow Grove — the Forgetting — has made the island lose its memory. Forests have thinned, the lake has dimmed, and the villagers of Whisper Village have half-forgotten their own history.

| Act | Story Beat | Gameplay |
|---|---|---|
| Act 1 — Arrival | Nova arrives at Whisper Village. Pip, a small spirit of the island, awakens and attaches itself to Nova. Nova finds a mysterious egg. | Tutorial, first resources, first choice (egg), first world change. |
| Act 2 — Restoring Echoes | Every act of care restores an Echo (a memory fragment) to the island. Rocco, Luna and Zed each help Nova in their own way. The Ancient Temple puzzle chain reveals that the Forgetting comes from Shadow Grove. | Exploration of all zones, creatures, building, quests, temple puzzle chain, mini-game. |
| Act 3 — The Shadow Grove | Nova enters Shadow Grove and confronts the heart of the Forgetting. | Boss encounter. How well the player cared for the island (Harmony, corruption cleared) changes the boss fight and the ending scene. |
| Ending | The Echo Heart awakens. The island remembers — and shows the player a final montage of the changes they personally made. | Post-game: the player keeps playing; new daily/long-term activities remain. |

Design rule: the story should reinforce the core promise. Wherever possible, story moments should reference what the player actually did (for example, Pip mentioning the egg choice, or the ending montage showing the player's own buildings and restored areas).

## 4. Goals and Non-Goals

| Goals | Non-Goals for MVP |
|---|---|
| Strong visual identity and memorable characters | Real-time multiplayer |
| Exploration and curiosity-driven gameplay | Cloud accounts and server-side profiles |
| Persistent local world changes | Global economy or player marketplace |
| Short and long play sessions | Large open-world streaming |
| Offline-first operation | AI-generated content as a runtime dependency |
| Near-zero infrastructure cost | Paid backend services |
| Cross-platform browser-first delivery | Competitive PvP |
| Translation-ready text from day one | Shipping languages other than English in MVP |

## 5. Target Audience

Primary: casual and family-friendly players who enjoy exploration, collection, customization and light adventure.

Secondary: players who enjoy sandbox experimentation, creature collecting and puzzle discovery.

Age rating target: suitable for ages 7+ (aim for PEGI 7 / ESRB Everyone). Combat is cartoon-style with no blood; defeat is gentle; no real-money purchases in MVP; no chat or personal data.

Design principle: accessible controls, readable UI, low frustration, and satisfying visual feedback.

## 6. Core Game Pillars

| Pillar | Experience |
|---|---|
| Explore | Discover locations, secrets, resources, creatures and story fragments. |
| Interact | Almost every important object should react visually or mechanically. |
| Choose | Player decisions influence relationships, quests and island state. |
| Build | Use resources to create useful and decorative structures. |
| Collect | Fill the Discovery Book with creatures, plants, relics and materials. |
| Evolve | The island visibly changes based on player history. |
| Return | Daily/long-term progression creates reasons to revisit earlier areas. |

## 7. Unique Selling Proposition

Unlike a conventional level-based adventure, Echo Island stores a lightweight history of meaningful player actions and maps those actions to visible world-state changes. A forest can grow, a village can appear, creatures can become friendly, and story events can unlock because of what the player previously did. Characters also remember and mention the player's past choices.

## 8. Development Scope

Development is split into two milestones. Phase 0 (Vertical Slice) proves the core promise cheaply; the full MVP is built only after the slice has been playtested successfully (see Section 29).

### 8.1 Phase 0 — Vertical Slice

| Area | Vertical Slice Requirement |
|---|---|
| World | 3 zones: Whisper Village, Emerald Forest, Moonlit Lake |
| Player | Nova with basic appearance selection |
| Companion | Pip with basic reactions + Glow and Sense abilities |
| Creatures | 3 creatures (including Glowfox); 1 can be bonded |
| Buildings | 2 structures (e.g. House, Garden) |
| Quests | Egg quest + 2–3 short quests; at least one branching choice |
| World state | At least 5 visible, persistent world changes driven by player actions |
| Economy | Coins + a basic village shop (buy seeds/food, sell items) |
| Save | Offline auto-save and load using IndexedDB, including the “Since You Were Away” panel |
| Art/audio | Free CC0 asset packs (see Section 22) |
| Length | 15–20 minutes of play (see the App Flow first-session timeline) |

### 8.2 Full MVP

| Area | MVP Requirement |
|---|---|
| World | 1 main island with 7 distinct zones (see Section 10) |
| Player | 1 customizable protagonist (Nova) |
| Companion | Pip, a floating companion with reactions and 3 abilities (see Section 11.1) |
| Creatures | 10 collectible creatures; 2 evolution paths |
| Resources | Wood, stone, crystal, food, essence |
| Currency | Coins (earned from quests and selling items; spent in the village shop) |
| Buildings | 5 functional/decorative structures |
| Quests | 8–12 quests including branching choices |
| Puzzle | 1 ancient temple puzzle chain |
| Mini-game | 1 fishing mini-game at Moonlit Lake |
| Combat | Simple dodge/block/attack encounters with 1 boss; gentle defeat (see Section 14) |
| Progression | Player level, island level, Discovery Book, unlockable zones |
| World state | Day/night plus at least 5 persistent environmental changes; reversible corruption |
| Save | Local save using IndexedDB with rolling backups; optional LocalStorage for small settings |
| Languages | English, with all text in translation files |
| Platforms | Responsive web/PWA first; package later for Android/Windows |

## 9. Gameplay Loop

Primary loop:

Explore → Discover → Interact → Choose → Collect/Build → Change World → Unlock → Explore Again

Example:

1. Player finds a mysterious egg.
2. Player chooses to hatch it, sell it to Zed the treasure hunter for coins, or take it to the Ancient Temple.
3. The choice is recorded in the island's choice history and changes a quest flag and a future encounter. (Selling the egg raises corruption slightly — see Section 13.3.)
4. Player completes a related activity and receives a visual world-state change.
5. New creature, location, reward or story clue becomes available, and Pip or an NPC later refers back to the choice.

## 10. World Design

| Zone | Purpose | Example Content |
|---|---|---|
| Whisper Village | Safe hub (starting area) | NPCs, village shop, building, quests |
| Emerald Forest | Exploration | Plants, animals, hidden paths |
| Crystal Caves | Resource + puzzle | Crystals, mining, ancient symbols (dark areas need Pip's Glow) |
| Ancient Temple | Story + puzzle | Relics, doors, branching choices, the Echo Heart |
| Moonlit Lake | Mini-game | Fishing, water spirit |
| Highlands | Traversal + combat | Monster encounters, viewpoints |
| Shadow Grove | Late-MVP challenge | Boss route, corrupted ecosystem, source of the Forgetting |

View: top-down 2D. The camera follows Nova automatically; there is no manual camera rotation.

## 11. Character System

| Character | Role | Personality / Function | First Met |
|---|---|---|---|
| Nova | Player avatar | Explorer; customizable appearance | Character setup |
| Pip | Companion | Cute floating island spirit; reacts to world events; remembers player choices | Opening scene |
| Rocco | Builder | Unlocks and upgrades structures | Whisper Village, first building quest |
| Luna | Scientist | Explains relics and creature evolution | After the egg choice / first creature discovery |
| Zed | Treasure hunter | Introduces optional risk/reward quests; buys rare items such as the egg | Egg quest (offers to buy the egg) |

### 11.1 Pip's Abilities

| Ability | Effect | Unlocked |
|---|---|---|
| Glow | Lights up dark areas such as Crystal Caves and Shadow Grove | Early story (Phase 0) |
| Sense | Optional hint: points toward hidden objects, creatures and secrets nearby | First Discovery Book milestone (Phase 0) |
| Echo | Replays a short “ghost” memory of how an area once looked or what happened there; reveals clues and lore | Ancient Temple puzzle chain |

## 12. Creature System

Creatures have a simple state model: Unknown → Observed → Friendly/Neutral → Bonded → Evolved. Each creature can have preferred food, habitat, reaction, rarity and one or more unlock conditions.

| Creature Attribute | Example |
|---|---|
| Name | Glowfox |
| Habitat | Forest |
| Temperament | Cautious |
| Preferred item | Glow Berry |
| Bond action | Feed/protect |
| Evolution trigger | High bond + crystal |
| Collection status | 12/100 |

Creatures avoid corrupted areas; when a zone's corruption is cleared, its creatures return.

## 13. Island Memory System

### 13.1 Counters and Flags

The game should store a compact set of flags/counters rather than recording every frame or action. Examples include trees planted, animals rescued, village level, temple choices, corrupted areas restored and key discoveries.

| Player Action | Stored State | Visible Result |
|---|---|---|
| Plant trees | trees_planted += 1 | Forest density increases at 3, 10 and 25 trees |
| Rescue creature | creature_rescued[id] = true | Creature appears at habitat |
| Build house | buildings.house += 1 | House appears in village; at 3 houses a new NPC arrives |
| Restore lake | lake_restored = true | Lake becomes brighter; new fish + water-spirit quest |
| Over-harvest / careless choice | corruption[zone] += 1 | Dark plants and weak monsters appear in that zone |
| Cleanse corruption | corruption[zone] -= 1 | Dark plants fade; creatures return |

### 13.2 Data-Driven World Rules

World changes must be defined as data (JSON rule files), not hard-coded logic, so that new world changes can be added as content. Each rule has a condition and one or more effects, for example:

```
{ "id": "forest_density_2",
  "when": "trees_planted >= 10",
  "then": ["set_visual:forest_density_2", "unlock_discovery:moss_sprite"] }
```

Rules are evaluated after every important state change (see the App Flow, Island Evolution Flow).

### 13.3 Choice History

In addition to counters, the game keeps a short history of key decisions (for example, `{ id: "egg_choice", value: "temple", day: 3 }`). Pip, NPCs and the ending scene use this history to refer back to what the player did. This is what makes the world feel like it remembers.

Rule: every branching choice must produce at least one visible consequence in the world (an object, character, creature, area or dialogue change) — not only a text message.

### 13.4 Corruption (Reversible)

- Corruption is caused by careless choices, for example cutting many trees in a zone without replanting, over-fishing, or selling the egg to Zed.
- Each zone has a corruption level from 0 (clean) to 3 (heavily corrupted). Higher levels add dark plants, dim lighting and weak monsters, and make creatures leave.
- Corruption is always reversible: replanting, cleansing quests, Luna's purifying crystals and restoring nearby areas reduce it.
- Corruption never removes levels, items or buildings the player already owns. It changes the world, not the player's progress.
- Cleansing a corrupted area is designed as a satisfying “redemption” moment with a clear visual transformation.

### 13.5 Time Away (“Since You Were Away”)

- The game saves `lastPlayedAt`. On return, real time passed is converted into island progress: trees and crops grow, creatures visit, and timed local activities complete.
- Progress is capped at 24 hours of real time so nothing is lost by taking a break, and changing the device clock gains little.
- If the device clock appears to have moved backwards, no away-progress is applied and nothing is removed.
- A short “Since You Were Away” panel summarizes the changes (see App Flow).

## 14. Progression

Progression should be layered rather than purely level-based. There are two separate levels:

| Level | What Raises It | What It Unlocks |
|---|---|---|
| Player level (Nova) | Player XP from exploring, quests, puzzles and combat | Health and stamina, gathering speed, backpack size, combat abilities |
| Island level | Harmony points from caring for the island: planting, building, rescuing creatures, restoring areas, cleansing corruption | Build slots, new structures, visual island upgrades, new zones |

Other progression layers:

- Discovery progression: new creatures, plants, relics and locations.
- Relationship progression: companion and NPC trust unlocks dialogue and quests.
- Collection progression: Discovery Book milestones grant cosmetics or utility rewards.
- Story progression: choices unlock different quest branches and world states.

Defeat in combat: when Nova's health reaches zero, Pip rescues Nova and Nova wakes up safely in Whisper Village. The player may lose a small part (up to 20%) of the common resources gathered on that trip. Quest items, relics, coins, creatures, levels and buildings are never lost.

## 15. Economy and Rewards

Coins are the single currency. Coins are earned from quests and from selling items; they are spent at the village shop in Whisper Village (seeds, food, building materials, cosmetics). No real-money purchases exist in MVP.

| Reward Type | Examples |
|---|---|
| Cosmetic | Outfits, hats, companion accessories |
| Collection | Creature cards, relic entries |
| World | New buildable structures, decorations |
| Utility | Faster gathering, larger backpack |
| Story | New areas, NPC scenes, secrets |
| Currency | Coins |

## 16. UI/UX Requirements

- Bright, colorful, high-contrast visual language; avoid dark UI as the default.
- Mobile-first touch controls with desktop mouse/keyboard equivalents.
- Core actions should require no more than one or two taps/clicks.
- Use contextual interaction prompts instead of permanent button clutter.
- Menus should feel integrated into the game world.
- Use animated feedback for discoveries, collection progress and world changes.
- Maintain readable typography and large touch targets.
- Support pause, settings, sound/music controls and save-state feedback.

## 17. Main Screens

| Screen | Primary Purpose |
|---|---|
| Splash / Loading | Show logo and load assets; show progress and retry on failure |
| Home / Continue | Continue, start a new game, manage saves, open settings; island shown as backdrop |
| World / Island | Main gameplay: explore, interact, gather, talk and see world changes |
| Map | View discovered zones and fast travel where unlocked |
| Quest Journal | Track active and completed quests and the next objective |
| Discovery Book | Browse discovered creatures, plants, relics and places; see collection milestones |
| Inventory | View, use, equip, build with or give items; see coins |
| Village Shop | Buy seeds, food, materials and cosmetics; sell items for coins |
| Building / Island Customization | Choose, place and confirm structures and decorations |
| Creature Bond Screen | View a creature's details, feed or interact, and track bond and evolution progress |
| Puzzle / Mini-game | Focused play for the temple puzzles and the fishing mini-game |
| Combat | Encounter view with attack, dodge, block, ability and companion actions |
| Rewards / Discovery | Short reward animation and summary after actions |
| Since You Were Away | Summary of island changes on return |
| Settings | Audio, graphics, controls, accessibility, language and save management |
| Save / Restore | Export, import and restore backups of local saves |

## 18. Controls

| Platform | Movement | Interaction | Secondary |
|---|---|---|---|
| Mobile | Virtual joystick / tap movement | Context button | Swipe/dodge; quick slots |
| Desktop | WASD / arrows | E / mouse click | Space to dodge; number keys for quick slots; Esc for menu |

The camera follows Nova automatically on all platforms (top-down 2D view).

## 19. Technical Architecture — Zero Infrastructure Target

The MVP should be client-side and offline-first. The preferred implementation is TypeScript + Phaser (2D, top-down) for the game layer, with HTML/CSS for shell UI and IndexedDB for persistent save data.

| Component | Recommended Choice | Cost Target |
|---|---|---|
| Game engine | Phaser + TypeScript (2D top-down) | Free/open source |
| UI shell | HTML/CSS/TypeScript | Free |
| Local persistence | IndexedDB | Free/browser-native |
| Offline support | Service worker (PWA) caching all game assets | Free/browser-native |
| Text / localization | JSON language files (English for MVP) | Free |
| Static hosting | GitHub Pages or Cloudflare Pages | Free tier |
| Source control | GitHub | Free tier |
| Build | Vite | Free/open source |
| Desktop packaging | Tauri or Electron later | Free/open source |
| Android packaging | Capacitor later | Free/open source |

Important: free-tier hosting terms can change. The architecture is designed so the game remains playable locally even if hosting is unavailable.

### 19.1 Save Safety

Browsers can delete website data (for example, Safari can clear storage after about 7 days without a visit unless the site is installed). To protect saves without a server:

- Request persistent storage with `navigator.storage.persist()`.
- Encourage players to install the game as a PWA (installed apps keep their data).
- Keep 3 rolling automatic backup slots in IndexedDB.
- Offer manual export/import of the save as a file, and remind the player occasionally to export.
- Prevent two open tabs from overwriting each other (single-tab lock with a clear message).

## 20. Data Model

Example local save object:

```
{
  saveVersion: 2,
  lastPlayedAt: "2026-10-01T10:00:00Z",
  player: { name, appearance, level, xp, health, coins, position: { zone, x, y }, cosmetics },
  island: { level, harmony, treesPlanted, lakeRestored, corruption: { forest: 0, lake: 0 },
            zonesUnlocked: ["village", "forest"], timeOfDay },
  inventory: { wood: 12, stone: 4, crystal: 1, food: 6, essence: 0, items: [] },
  buildings: { house: 1, workshop: 0 },
  creatures: { glowfox: { state: "bonded", bond: 62 } },
  pip: { abilities: ["glow", "sense"], mood: "happy" },
  npcs: { rocco: { trust: 20 }, luna: { trust: 5 }, zed: { trust: 10 } },
  quests: { eggQuest: "hatched" },
  choices: [ { id: "egg_choice", value: "hatched", day: 1 } ],
  discoveries: { plants: [], relics: [], creatures: [], places: [] },
  settings: { music: true, sfx: true, language: "en", textSize: "medium" }
}
```

Use versioned save schemas (`saveVersion`) so future game updates can migrate older local saves safely.

## 21. Performance Requirements

| Target | Value |
|---|---|
| First download (initial load) | Under 20 MB |
| Time to playable | About 5 seconds on a 4G connection; faster on repeat visits (cached) |
| Frame rate — desktop | 60 fps |
| Frame rate — mid-range Android | 30 fps minimum, 60 fps target |

- Fast initial load with compressed assets and lazy loading for later zones.
- Keep individual scene memory predictable.
- Use sprite atlases, texture compression where supported, object pooling and culling.
- Provide a low-effects mode for weaker devices.

## 22. Art and Audio Production

- Phase 0 uses free CC0 asset packs (for example Kenney or OpenGameArt) so that the core loop can be tested quickly and at no cost.
- Before release, assets are replaced with a consistent custom art style (characters, tiles, UI, music and sound effects).
- Keep a credits/licenses list for every third-party asset used, even CC0 assets.
- AI tools may be used for concept exploration during production only; no AI service is a runtime dependency.

## 23. Localization

- MVP ships in English.
- All player-visible text (dialogue, UI, item and creature names, quest text) lives in JSON language files, never hard-coded.
- UI layouts must allow longer text so that other languages can be added later without redesign.

## 24. Accessibility

- Adjustable text size.
- Color-blind friendly palette option; color is never the only signal for quest or state changes.
- Optional vibration/haptic feedback on mobile.
- Reduced motion option.
- Volume sliders and mute controls.
- Simple control remapping on desktop.

## 25. Analytics Without Infrastructure

For MVP, avoid remote analytics. Track only local debug metrics such as session duration, quest completion and error counts when useful for development and playtests. A future opt-in analytics layer can be added without changing the core game-state model.

## 26. Monetization — Future, Not MVP

Do not add monetization to the first prototype. Potential future options include cosmetic packs, optional expansion islands or a one-time premium edition. Avoid pay-to-win mechanics. In-game coins can never be bought with real money in MVP.

## 27. Security / Privacy

- No personal account is required for MVP.
- No player data needs to leave the device.
- Do not collect personal information unless a later feature explicitly requires it. This also keeps the game suitable for a young audience.
- If cloud sync is added later, obtain appropriate consent and document data handling.

## 28. Success Metrics for Prototype

| Metric | Prototype Signal |
|---|---|
| First-session completion | Player reaches first meaningful island change |
| Discovery engagement | Player opens Discovery Book and finds multiple items |
| World interaction | Player performs several environment interactions |
| Core promise understood | Player can describe at least one change they personally made to the island |
| Return motivation | Player has at least one visible unresolved objective |
| Performance | Meets Section 21 targets on target mobile and desktop devices |
| Save reliability | Progress survives reload/offline restart |

## 29. Playtest Plan

- After Phase 0, and again before MVP release, run playtests with 5–10 players from the target audience (including families/children 7+).
- Observe players without giving instructions; note where they get stuck.
- Record local debug metrics (session length, quests completed, Discovery Book opens, world changes triggered, errors).
- Ask every player: “What did you change on the island?” If most players can describe their own changes, the core promise works.
- Go/no-go: the full MVP starts only when the Phase 0 slice meets the first-session, core-promise and save-reliability signals in Section 28.

## 30. MVP Acceptance Criteria

- Player can start a new game and reach the island without an account.
- Player can move, interact, collect and complete quests.
- At least five player actions visibly modify the island.
- Every branching choice has at least one visible consequence.
- At least ten creatures can be discovered and tracked.
- At least one creature can bond/evolve.
- Player can build at least five structures.
- Corruption can be caused by choices and fully cleansed.
- Player can buy and sell items in the village shop.
- A complete save/load cycle works offline, including backup restore.
- The game can be hosted as static files.
- No mandatory backend/API/database is required.
- The interface is usable on both touch and desktop input.
- All player-visible text comes from language files.

## 31. Development Phases

| Phase | Deliverable |
|---|---|
| Phase 0 | Vertical Slice (Section 8.1) + first playtest (Section 29) |
| Phase 1 | Core movement, camera, interaction framework (production quality) |
| Phase 2 | Island environment + resource system + coins/shop |
| Phase 3 | Quest system + island memory (rules, choice history, corruption, time away) |
| Phase 4 | Creatures + companion abilities |
| Phase 5 | Building + inventory + Discovery Book |
| Phase 6 | Puzzle + mini-game + combat + boss |
| Phase 7 | Custom art, UI polish, animation, audio, accessibility |
| Phase 8 | Performance, offline save safety, PWA packaging, MVP playtest |
| Phase 9 | Android/desktop packaging and release testing |

## 32. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Scope becomes too large | Phase 0 vertical slice first; one-island MVP; modularize expansion content |
| Core promise not noticed by players | Data-driven world rules, choice history, playtest question “What did you change?” |
| Graphics production becomes expensive | CC0 assets for Phase 0; coherent stylized custom asset system later |
| Low-end device performance | Quality presets, culling, asset compression, performance targets |
| Save corruption or browser data deletion | Versioned saves, persistent storage, rolling backups, export/import, tab lock |
| Game feels repetitive | Mix exploration, puzzles, creatures, building and changing world states |
| Corruption feels punishing | Corruption is always reversible and never removes player progress |
| Zero-cost hosting limits | Keep hosting static and make the game independently playable offline |

## 33. Product Summary

Echo Island should feel like a living toybox: easy to enter, beautiful to explore, full of small surprises, and meaningful enough that players remember what they personally changed. The Phase 0 vertical slice should prove this emotional loop before the full MVP adds more content, and the MVP should prove it before adding online systems or monetization.

## 34. Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | — | Initial PRD |
| 2.0 | 2026-10-01 | Confirmed names (Echo Island, Whisper Village); top-down 2D view; added story outline; added Phase 0 vertical slice; coins and village shop; separate player and island levels; reversible corruption; capped time-away progress; gentle defeat; Pip abilities; data-driven world rules and choice history; expanded save model and save safety; real screen purposes; performance numbers; art/audio plan; localization; age rating; playtest plan |

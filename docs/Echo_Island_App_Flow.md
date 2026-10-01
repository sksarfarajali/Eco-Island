# APP FLOW & USER JOURNEY DOCUMENT

**ECHO ISLAND — The World That Remembers**

*Product specification • Mobile + Desktop • Offline-first • Zero infrastructure cost target • Version 2.0 (2026-10-01)*

## 1. Flow Overview

The app flow is designed around a single principle: the player should reach meaningful interaction quickly, while every major system remains accessible from the living island. The game uses a top-down 2D view; the camera follows Nova automatically.

## 2. Master Navigation

```
START
  ↓
Splash / Load
  ↓
Main Menu / Continue
  ↓
(Since You Were Away — returning players)
  ↓
Island
  ├── Explore
  ├── Map
  ├── Quest Journal
  ├── Discovery Book
  ├── Inventory
  ├── Village Shop (in Whisper Village)
  ├── Build
  ├── Companion
  └── Settings
        ↓
     Save / Exit
```

## 3. First-Time User Flow

1. Launch game.
2. Show logo animation and short loading screen.
3. Offer New Game / Continue.
4. New Game opens character introduction.
5. Player selects a basic avatar appearance for Nova.
6. Pip, a small spirit of the island, awakens and explains the first interaction.
7. Player arrives in Whisper Village.
8. Movement tutorial begins naturally through a short guided task.
9. Player discovers the first resource.
10. Player discovers the mysterious egg. Zed appears and offers to buy it.
11. Player makes the first meaningful choice: hatch the egg, sell it to Zed for coins, or take it to the Ancient Temple.
12. Island state changes visibly and the player receives the first discovery reward. The choice is stored in the choice history.
13. Quest Journal and Discovery Book become available.

## 4. Returning Player Flow

Splash → Continue → Load local save → Validate and restore island state → Calculate time away (capped at 24 hours) → Show a brief “Since You Were Away” panel → Island.

The away panel may show:

- Newly grown trees and crops
- Available creature activity and visiting creatures
- Completed timed local activities
- New quest availability
- Recent discoveries
- A reminder to export a backup if none has been made recently

Time-away rules: progress is based on `lastPlayedAt` and capped at 24 hours. If the device clock has moved backwards, no away-progress is applied and nothing is removed.

## 5. Home / Main Menu Flow

| Action | Destination |
|---|---|
| Continue | Current island (via Since You Were Away if applicable) |
| New Game | Character setup |
| Load / Restore | Local save management (backups, export, import) |
| Settings | Audio, graphics, controls, accessibility, language |
| Credits | Team, technology and asset license credits |

The home screen should use the island as a visual backdrop rather than a plain menu.

## 6. Core Exploration Flow

Island → Move → Approach object → Context prompt → Interact → Animation/feedback → Reward or state change → Continue exploration.

Example:

1. Player sees a glowing plant.
2. Tap/click the plant.
3. Pip reacts.
4. Player collects Glow Berry.
5. Discovery Book updates.
6. Glowfox nearby becomes interested.
7. A creature-bond opportunity appears.

## 7. Interaction Decision Flow

```
Object / NPC
     ↓
Can interact?
 ┌───┴────┐
No       Yes
│         ↓
Continue  Context prompt
          ↓
      Interaction
          ↓
     Is there a choice?
       ┌───┴───┐
      No      Yes
      │        ↓
   Reward   Choice A/B/C
               ↓
        Record in choice history
               ↓
        Update world state
               ↓
        Show visible consequence
               ↓
             Save
```

Rule: every branching choice must produce at least one visible consequence in the world, not only a text message.

## 8. Quest Flow

| Stage | Player Experience |
|---|---|
| Available | NPC/object displays quest signal |
| Accept | Quest enters Journal |
| Objective | Player receives clear next action |
| Progress | Objective counter updates |
| Decision | Optional branch changes outcome |
| Complete | Reward + story/world reaction |
| Follow-up | New quest or discovery unlocks; NPCs may later mention the player's choice |

## 9. NPC Introduction Flow

| Character | Where / When Met | What They Unlock |
|---|---|---|
| Pip | Opening scene | Companion reactions, hints, abilities |
| Zed | Egg discovery (offers to buy the egg) | Selling rare items, optional risk/reward quests |
| Rocco | Whisper Village, first building quest | Build menu, structure upgrades |
| Luna | After the egg choice / first creature discovery | Creature evolution, relic explanations, purifying crystals |

## 10. Creature Discovery Flow

```
Explore habitat
      ↓
Creature appears
      ↓
Observe / interact
      ↓
Discovery unlocked
      ↓
Creature behavior revealed
      ↓
Bond opportunity
      ↓
Feed / protect / help
      ↓
Bond level increases
      ↓
Evolution condition?
   ┌──────┴──────┐
  No            Yes
  │              ↓
Continue      Evolution
                 ↓
          New appearance/ability
                 ↓
           Discovery Book update
```

Creatures leave zones with high corruption and return when the zone is cleansed.

## 11. Companion Flow — Pip

- Pip follows the player.
- Pip reacts to important discoveries.
- Pip changes expression based on player decisions and remembers them (for example, mentioning the egg choice later).
- Pip unlocks abilities through story progression:

| Ability | Use | Unlocked |
|---|---|---|
| Glow | Light dark areas (Crystal Caves, Shadow Grove) | Early story |
| Sense | Optional hint: points toward hidden objects, creatures and secrets | First Discovery Book milestone |
| Echo | Replays a short “ghost” memory of how an area once looked; reveals clues and lore | Ancient Temple puzzle chain |

## 12. Building Flow

Island → Build button → Select building → Check resources and build slots → Placement preview → Confirm → Construction animation → Building becomes functional → Harmony points awarded → Island state saved.

| Condition | Result |
|---|---|
| Enough resources | Placement enabled |
| Insufficient resources | Show missing resources (and where to buy them in the shop) |
| No free build slot | Show island level needed for the next slot |
| Invalid location | Show placement warning |
| Valid location | Allow confirmation |
| Construction complete | Unlock associated feature |

## 13. Inventory Flow

Island → Inventory → Categories → Item details → Use / Equip / Build / Give / Sell (at shop) → Result → Return to previous screen.

Categories: Resources, Food, Quest Items, Relics, Cosmetics, Special. Coins are shown at the top of the inventory.

## 14. Village Shop Flow

Whisper Village → Talk to shopkeeper → Buy / Sell tab → Select item → Confirm price → Coins updated → Inventory updated → Return to village.

- Buy: seeds, food, building materials, cosmetics.
- Sell: common resources and selected rare items. Quest items cannot be sold.
- Selling certain items (for example, the egg) may affect the island (see Section 20).

## 15. Discovery Book Flow

Menu/Island → Discovery Book → Creatures / Plants / Relics / Places → Select entry → Details → Progress toward collection milestone.

Collection milestones can unlock cosmetics, decorations, lore entries or Pip's Sense ability.

## 16. Map Flow

Island → Map → Select discovered zone → Fast travel where unlocked OR return to island → Destination.

Undiscovered areas appear visually mysterious rather than simply being hidden from the map. Corrupted zones are marked with a visible pattern (not only color).

## 17. Puzzle Flow

Find puzzle → Enter puzzle mode → Observe clues (Pip's Echo can replay a clue) → Interact → Attempt solution → Success/Retry → Reward or story unlock.

Avoid hard failure loops. Players should be able to retry without losing major resources.

## 18. Mini-Game Flow

Trigger mini-game → Short tutorial → Play → Score/result → Reward → Return to island.

Example: Fishing at Moonlit Lake — cast → wait → reaction cue → tap/click timing → catch → collection/reward. Over-fishing raises corruption at the lake.

## 19. Combat Flow

```
Encounter
   ↓
Enemy signals attack
   ↓
Player chooses:
Attack / Dodge / Block / Ability / Companion
   ↓
Resolve action
   ↓
Enemy state changes
   ↓
Defeated?
 ┌────┴────┐
No        Yes
│          ↓
Continue   Reward + Player XP + Discovery + Quest progress
```

### 19.1 Defeat Flow (Nova's health reaches zero)

Health reaches zero → Screen fades → Pip rescues Nova → Nova wakes up safely in Whisper Village → Short message showing what was lost (if anything) → Continue.

- The player may lose up to 20% of the common resources gathered on that trip.
- Quest items, relics, coins, creatures, levels and buildings are never lost.

## 20. Island Evolution Flow

```
Player action
   ↓
Local state updated (counters, flags, choice history)
   ↓
World-state rules evaluated (data-driven rules)
   ↓
Visual change triggered
   ↓
NPC/creature behavior may change
   ↓
New quest/discovery may unlock
   ↓
Harmony / island level updated
   ↓
Save state
```

| Trigger | Possible Change |
|---|---|
| Trees planted ≥ 3 / 10 / 25 | Forest density increases in three visible steps |
| Lake restored | New fish + water-spirit quest |
| Village houses ≥ 3 | New NPC arrives |
| Relic discovered | Temple door opens |
| Creature rescued | Creature appears in habitat |
| Careless choice (over-harvesting, over-fishing, selling the egg) | Corruption +1 in that zone: dark plants, dim light, weak monsters |
| Corruption cleansed | Dark plants fade, creatures return, Harmony awarded |

### 20.1 Corruption and Cleansing Flow

Careless action → Corruption +1 in zone (0–3) → Visible darkening + Pip reacts → Cleansing quest becomes available (Luna) → Player replants / uses purifying crystal / completes quest → Corruption −1 → Visual restoration animation → Creatures return → Save.

Corruption never removes the player's levels, items or buildings, and it can always be fully cleansed.

## 21. Reward and Level-Up Flow

Action complete → Reward animation → Reward summary (items, coins, Player XP, Harmony) → Collection/progression update → Level-up if reached → Optional next objective → Return to gameplay.

- Player level up: show the improved stat or ability (health, stamina, gathering speed, backpack size, combat ability).
- Island level up: show the island's visual upgrade and any new build slot or zone.

Reward presentation should be visual and brief; avoid blocking the player with long modal dialogs.

## 22. Save / Load Flow

```
Important state change
       ↓
Auto-save (in the background, no pause)
       ↓
IndexedDB (rotate 3 backup slots)
       ↓
Save version recorded

On startup:
Check single-tab lock
       ↓
IndexedDB → Validate version → Migrate if needed
       ↓
Valid? ── No → Offer latest valid backup / import / new save
       ↓ Yes
Restore state → Apply time away → Load island
```

- On first launch, request persistent storage (`navigator.storage.persist()`) and suggest installing the game as an app.
- If the game is already open in another tab, show a message instead of loading a second copy.
- Provide manual export/import of saves in Settings, with an occasional reminder to export.

## 23. Settings Flow

| Setting | Options |
|---|---|
| Music | On / Off / Volume |
| Sound effects | On / Off / Volume |
| Haptics | On / Off |
| Graphics | Low / Medium / High |
| Reduced motion | On / Off |
| Text size | Small / Medium / Large |
| Color-blind mode | Off / On (alternative palette + patterns) |
| Language | English (more languages later) |
| Controls | Mobile / Desktop / Remap where supported |
| Save management | Export / Import / Restore backup / Reset |

## 24. Error and Recovery Flow

| Situation | User Experience |
|---|---|
| Asset loading failure | Retry + low-resource fallback |
| Save validation failure | Offer latest valid backup, import or new save |
| Browser storage cleared | Offer import from an exported save file; explain how to install the game to prevent this |
| Game open in another tab | Explain and offer to continue in this tab |
| Insufficient resources | Explain exact missing items |
| Insufficient coins | Show the price difference and ways to earn coins |
| Invalid placement | Show allowed area |
| Unsupported device feature | Disable feature gracefully |
| Game crash/reload | Recover from last valid auto-save |

## 25. Mobile UX Flow

Left thumb: movement. Right side: contextual action/dodge. Top: minimal health/progress/status and coins. Menus open as lightweight panels. Important actions use large touch targets.

Avoid permanently displaying a large virtual button grid; contextual controls keep the screen visually clean.

## 26. Desktop UX Flow

WASD/arrow movement → mouse click or E for contextual interaction → Space to dodge → number keys for quick slots → Esc for pause/menu. The camera follows Nova automatically. Keyboard and mouse hints can be shown during onboarding.

## 27. Suggested Screen Hierarchy

```
App
├── Splash
├── Main Menu
│   ├── Continue
│   ├── New Game
│   ├── Load/Restore
│   ├── Settings
│   └── Credits
└── Game
    ├── Since You Were Away
    ├── Island
    │   ├── Exploration
    │   ├── Interaction / Dialogue
    │   ├── Combat
    │   ├── Building
    │   └── Mini-games / Puzzles
    ├── Map
    ├── Quest Journal
    ├── Discovery Book
    ├── Inventory
    ├── Village Shop
    ├── Companion
    └── Pause / Settings
```

## 28. Example 15–20 Minute First Session (Phase 0 Vertical Slice)

| Time | Experience |
|---|---|
| 0–2 min | Intro + character selection + Pip awakens |
| 2–5 min | Movement + first resource + Whisper Village discovery |
| 5–8 min | Mysterious egg + Zed's offer + first choice |
| 8–11 min | Explore Emerald Forest + discover Glowfox + Pip's Glow |
| 11–14 min | Meet Rocco + build first structure + visit the shop |
| 14–17 min | Moonlit Lake + first visible world change (e.g. trees planted or lake brightened) |
| 17–20 min | Island visibly changes + Discovery Book unlock + next objective; a character mentions the egg choice |

## 29. Core State Machine

The application can be modeled with these major states. Auto-save runs in the background and is not a blocking state.

| State | Exit Condition |
|---|---|
| BOOT | Assets initialized |
| MENU | Continue/New Game selected |
| CHARACTER_CREATE | Appearance confirmed |
| LOAD | Save restored and time away applied |
| AWAY_SUMMARY | Panel closed |
| EXPLORE | Interaction/combat/menu triggered |
| INTERACT | Interaction resolved |
| DIALOGUE / CUTSCENE | Conversation or scene finished |
| CHOICE | Player selects branch |
| COMBAT | Encounter ends (victory or defeat) |
| DEFEAT | Nova wakes in Whisper Village |
| PUZZLE | Puzzle solved/closed |
| MINIGAME | Mini-game finished/closed |
| BUILD | Build placement confirmed/cancelled |
| SHOP | Shop closed |
| REWARD | Reward summary closed |
| MENU_OVERLAY | Overlay closed |
| PAUSE | Game resumed or exited |

## 30. Navigation Principles

- Never make the player search multiple menus for a core action.
- Always provide a clear way back to gameplay.
- Keep modal interruptions short.
- Use the environment to communicate objectives whenever possible.
- Make important state changes visible rather than only reporting them in text.
- Use consistent icons and interaction language across mobile and desktop.
- Never use color as the only signal; pair it with icons, shapes or patterns.

## 31. MVP Flow Acceptance Criteria

- A first-time player reaches the playable island within a few minutes.
- The player can complete the first quest without external instructions.
- At least one meaningful choice changes the world state, and every branching choice has a visible consequence.
- A creature can be discovered and added to the Discovery Book.
- A building can be constructed and visibly changes the island.
- The player can buy and sell items in the village shop.
- Corruption can be caused and cleansed, with a visible change both ways.
- Defeat in combat returns Nova safely to Whisper Village without losing important progress.
- The player can leave and return while retaining progress, and sees the “Since You Were Away” panel.
- A save can be exported, imported and restored from backup.
- All core flows work without a network connection after the initial game load.
- Touch and desktop navigation both support the same gameplay systems.
- In playtests, most players can answer “What did you change on the island?”

## 32. End-to-End Experience

The ideal experience is: Start → quickly reach a beautiful island → discover something unexpected → make a choice → see a consequence → receive a reward → unlock a new possibility → decide what to do next → save → return later to discover that the island has become different because of the player's own history — and that its characters remember it too.

## 33. Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | — | Initial App Flow |
| 2.0 | 2026-10-01 | Whisper Village naming; top-down 2D (removed mouse camera); egg choice with Zed; NPC introduction flow; village shop flow; Pip abilities; capped time-away rules; corruption and cleansing flow; defeat flow; player/island level-up; save safety (persistent storage, backups, tab lock); expanded settings (text size, color-blind, language); expanded error handling and state machine; 15–20 minute Phase 0 first session |

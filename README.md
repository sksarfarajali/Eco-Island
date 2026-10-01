# Echo Island — The World That Remembers

Echo Island is a colorful exploration, discovery, building and creature-companion game in which the world remembers the player's actions. The core product promise is: “Every choice you make changes the island.” It runs entirely on the client: offline-first, no accounts, no servers, near-zero infrastructure cost.

Product documents: [`docs/Echo_Island_PRD.md`](docs/Echo_Island_PRD.md) and [`docs/Echo_Island_App_Flow.md`](docs/Echo_Island_App_Flow.md) (Word versions alongside). Packaging: [`docs/PACKAGING.md`](docs/PACKAGING.md).

## What's in the game (PRD §8.2 MVP)

**7 zones**
- On the island hub: Whisper Village, Emerald Forest and Moonlit Lake.
- Reached from the island: Crystal Caves (dark; Pip's Glow lights the way), Ancient Temple, Highlands and Shadow Grove.

**Story in 3 acts** (the island's lost memory): arrival and the egg, restoring Echoes and the temple trials, then the Hollow in the Shadow Grove. The ending is either **heal** or **seal**, followed by a montage of everything the island remembers.

**12 quests**, with three branching choices that each change the world in a visible way:
- the egg: hatch / sell / temple
- the rescued Skyhare: bring it to the village / let it stay free
- the Hollow: heal / seal

**10 creatures**:
- Glowfox, Ripplet, Mossprite, Sunchick, Gleamwing, Pebblepup, Skyhare, Thistlegoat, Archowl and Wispling.
- Feed them to bond. **2 evolution paths**: Glowfox → Lumifox and Ripplet → Moonshell.
- A bonded Glowfox follows you and fights alongside you. Other bonded creatures move into the Sanctuary.

**5 buildings**:
- House (sleep, full heal)
- Garden (vegetables)
- Workshop (craft Purifiers, Berry Tonic, Crystal Charm)
- Creature Sanctuary
- Flower Arch

They go on 8 village plots that unlock with island level.

**Combat** (App Flow §19):
- Enemies telegraph their attacks with a red ❗.
- You can attack, dodge, block, use Pip's Glow burst (stuns enemies) or rely on companion help, and eat food to heal.
- The Hollow boss has slam, charge, summon and exposed-core phases. It is weaker if you cared for the island.
- Defeat is gentle: Pip takes you home, and you lose at most 20% of the common resources gathered on that trip.

**Ancient Temple puzzle chain**: three trials (rune order revealed by Pip's Echo, a light beam with mirrors, stone blocks on pressure plates). A reset lever and unlimited retries mean you can't get stuck.

**Fishing mini-game** at the lake dock: cast, wait, react to the bite. Over-fishing darkens the lake.

**World memory**:
- Data-driven rules in [`src/data/rules.json`](src/data/rules.json) cover forest growth, lake restoration, villagers arriving, the temple opening, the grove gate, highland flowers and the healed grove.
- Pip and the villagers remember your choices.
- Corruption is reversible.

**Progression**:
- Nova's level (hearts, damage, gathering) and the island's level (Harmony: plots, decorations).
- Discovery Book with 33 entries and milestone rewards: Pip's Sense, Pip's flower crown, Nova's explorer hat and star cape.

**Coins and the village shop**, **day/night**, and **time away** that keeps the island growing while you're gone (capped at 24 hours).

**Saving**: automatic IndexedDB saves, 3 rolling backups, versioned and migrated saves, export/import, a persistent-storage request and a single-tab lock.

**Accessibility**: text size, colour-blind mode (✓/✗, icons and patterns as well as colour), reduced motion, volume controls, haptics and **desktop key remapping**. Touch (joystick, tap-to-move, action and combat buttons) and keyboard/mouse both work.

**English text** in [`src/i18n/en.json`](src/i18n/en.json), ready for translation. **PWA**: installable and offline after the first visit.

Placeholder art and sound are generated in code (`src/scenes/art.ts`, `src/scenes/art2.ts`, `src/platform/audio.ts`). The PRD plans to replace them with a custom art style before release.

## Controls

| | Desktop (remappable) | Touch |
|---|---|---|
| Move | WASD / arrow keys, or click the ground | Joystick (bottom-left), or tap the ground |
| Interact / attack | E / Space / click | Round action button, or tap |
| Dodge · Block · Pip Glow | Shift · hold F · Q | Combat buttons (shown near enemies) |
| Eat · Tonic · Purifier | 1 · 2 · 3 | Eat button / Inventory |
| Panels | J Journal · K Book · I Inventory · B Build · M Map · P Pip · Esc Settings | Buttons on the right |

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (rules, quests, puzzles, combat, saves, maps, translations)
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

Add `?debug` to the URL to expose the app as `window.echo` for playtesting.

### Project layout

```
src/core/       game rules with no rendering (state, quests, world rules, combat, puzzles, areas, saves migration)
src/data/       data-driven world rules (rules.json)
src/i18n/       language files
src/platform/   IndexedDB saves, settings, audio, tab lock
src/scenes/     Phaser scenes: PlayScene (shared), IslandScene, AreaScene; procedural art
src/ui/         HTML/CSS interface (menus, HUD, panels, dialogue, fishing, ending)
public/         PWA manifest, service worker, icons
```

## Deployment

`.github/workflows/deploy.yml` runs the tests and the build on every push and pull request. Pushes to `main` are deployed to GitHub Pages. To turn this on, go to **Settings → Pages → Source** and select **GitHub Actions**. Android and desktop packaging are covered in [`docs/PACKAGING.md`](docs/PACKAGING.md).

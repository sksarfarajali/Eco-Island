# Echo Island — The World That Remembers

Echo Island is a colorful exploration, discovery, building and creature-companion game in which the world remembers the player's actions. The core product promise is: “Every choice you make changes the island.” The first release runs entirely on the client: offline-first, no accounts, no servers, near-zero infrastructure cost.

Product documents: [`docs/Echo_Island_PRD.md`](docs/Echo_Island_PRD.md) and [`docs/Echo_Island_App_Flow.md`](docs/Echo_Island_App_Flow.md) (Word versions alongside).

## Current build: Phase 0 vertical slice (PRD §8.1)

- **3 zones:** Whisper Village, Emerald Forest, Moonlit Lake (top-down 2D)
- **Characters:** Nova (choose your look), Pip the island spirit, Rocco, Luna, Zed, and Tilly (arrives after three houses)
- **The egg choice:** hatch it, sell it to Zed, or take it to the Ancient Temple. Each choice changes the world differently and is remembered by Pip and the villagers.
- **Island memory:** world changes are defined as data in [`src/data/rules.json`](src/data/rules.json). Planting trees makes the forest bloom, then grow lush (Mossprite appears), then an ancient tree awakens. Clearing debris makes the lake shine (Ripplet appears). A garden brings butterflies. Island levels add bunting, lanterns and flowers.
- **Reversible corruption:** over-harvesting the forest or selling the egg darkens it. Replanting or a Purifier crystal heals it.
- **Economy and building:** coins, a village shop (buy and sell), houses (you can sleep in them) and gardens (they grow vegetables), on build plots that unlock with island level
- **Two levels:** Nova's level (XP) and the island's level (Harmony)
- **Creatures:** Glowfox (shy; feed it berries until it bonds and follows you), Ripplet, Mossprite, Sunchick
- **Pip's abilities:** Glow (lights the night) and Sense (points to hidden things). Echo is planned for the temple update.
- **Day/night**, the Quest Journal (including "What the island remembers"), the Discovery Book with milestones, an inventory, a map with fast travel, and a Pip & Friends panel
- **Saving:** automatic IndexedDB saves, 3 rolling backups, versioned and migrated saves, export/import, persistent-storage request, single-tab lock, and a "Since You Were Away" panel (capped at 24 hours, safe if the device clock is changed)
- **Accessibility:** text size, colour-blind mode (✓/✗ and patterns as well as colour), reduced motion, volume controls and haptics. Touch (joystick, tap-to-move, action button) and keyboard/mouse both work.
- **Translation-ready:** all text is in [`src/i18n/en.json`](src/i18n/en.json)
- **PWA:** installable, and playable offline after the first visit

Placeholder art and sound are generated in code (`src/scenes/art.ts`, `src/platform/audio.ts`). The PRD plans to replace them with a custom art style before release.

## Controls

| | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys, or click the ground | Joystick (bottom-left), or tap the ground |
| Interact | E / Space / click the object | Round action button, or tap the object |
| Panels | J Journal · K Book · I Inventory · B Build · M Map · P Pip · Esc Settings | Buttons on the right |

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (game logic, rules, saves, time away, translations)
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

Add `?debug` to the URL to expose the app as `window.echo` for playtesting.

### Project layout

```
src/core/       game rules with no rendering (state, quests, world rules, growth, saves migration)
src/data/       data-driven world rules (rules.json)
src/i18n/       language files
src/platform/   IndexedDB saves, settings, audio, tab lock
src/scenes/     Phaser world scene and procedural art
src/ui/         HTML/CSS interface (menus, HUD, panels, dialogue)
public/         PWA manifest, service worker, icons
```

## Deployment

`.github/workflows/deploy.yml` runs the tests and the build on every push and pull request. Pushes to `main` are deployed to GitHub Pages. To turn this on, go to **Settings → Pages → Source** and select **GitHub Actions**.

# Packaging Echo Island (PRD Phase 9)

The game is a static web app (PWA). The same `dist/` build is packaged for each platform, so no backend is needed anywhere.

## Web / PWA (primary)

```bash
npm run build      # outputs dist/
```

Host `dist/` on any static host. The included GitHub Actions workflow deploys to GitHub Pages on every push to `main`. Players can install it from the browser ("Install as an app" in the menu), and it then works offline.

## Android (Capacitor)

Requires Android Studio and the Android SDK on your machine.

```bash
npm install @capacitor/core@7     # runtime used by the native shell
npm run android:init              # build + create the android/ project (first time only)
npm run android:sync              # after every web change
npm run android:open              # open in Android Studio, then Run or Build > Generate Signed Bundle
```

App id and name are set in `capacitor.config.json`. Saves use the WebView's IndexedDB, which Android keeps until the app is uninstalled. Export/import in Settings still works as a backup.

## Windows / macOS / Linux desktop (Tauri)

Requires Rust and the Tauri prerequisites for your OS (see tauri.app).

```bash
npm install -D @tauri-apps/cli@2
npx tauri init        # frontend dist: ../dist, dev URL: http://localhost:5173, build command: npm run build
npx tauri build       # produces an installer in src-tauri/target/release/bundle/
```

Electron is an alternative if you prefer it. Point it at `dist/index.html`.

## Before a store release

- Replace the placeholder art and sound (PRD 22) and update the credits/licenses list.
- Age rating: target PEGI 7 / ESRB Everyone. There are no ads, no purchases, no chat and no data collection.
- Test on real mid-range Android phones against the performance targets in PRD 21.

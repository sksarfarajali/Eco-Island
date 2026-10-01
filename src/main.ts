import './ui/style.css';
import { App } from './app';

const app = new App();
void app.start();

// `?debug` exposes the app for manual and automated playtesting.
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { echo: App }).echo = app;

// Offline support (PRD 19): cache the game after the first load. Production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker registration failed', e));
  });
}

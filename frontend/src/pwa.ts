import { registerSW } from 'virtual:pwa-register';

// Registers the service worker in production builds only (never in dev/test).
// autoUpdate: a new worker activates immediately and the page reloads once.
export function registerPwa(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    registerSW({ immediate: true });
  } catch {
    // The app must keep working without a service worker.
  }
}

import { App } from '@/app';

const container = document.getElementById('app');
if (!container) throw new Error('main: #app container missing');

try {
  const app = new App(container);
  app.start();
} catch (err) {
  // Surface init errors so a black screen isn't silent.
  // eslint-disable-next-line no-console
  console.error('App init failed:', err);
  const hud = document.getElementById('hud');
  if (hud) {
    hud.style.color = '#ff8080';
    hud.style.background = 'rgba(0, 0, 0, 0.85)';
    hud.style.maxWidth = '720px';
    hud.style.whiteSpace = 'pre-wrap';
    hud.textContent = `App init failed:\n${err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)}`;
  }
}

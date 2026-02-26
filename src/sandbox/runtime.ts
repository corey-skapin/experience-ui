// Minimal sandbox runtime — mounts compiled React code into #root
// The actual bundled code is injected by the host via the INIT message

import { createBridge } from './bridge';

const bridge = createBridge({
  postMessage: (message) => {
    window.parent.postMessage(message, '*');
  },
});

window.addEventListener('message', (event: MessageEvent) => {
  bridge.handleMessage(event);
});

bridge.on('RENDER_DATA', (data) => {
  // Pass render data to the mounted component if registered
  const handler = (window as Window & { __onRenderData__?: (d: unknown) => void }).__onRenderData__;
  if (handler) handler(data);
});

bridge.on('THEME_CHANGE', (data) => {
  const theme = (data['payload'] as { theme?: string })?.theme ?? 'light';
  document.documentElement.setAttribute('data-theme', theme);
});

bridge.on('RESIZE', (data) => {
  const payload = data['payload'] as { width?: number; height?: number } | undefined;
  if (payload?.width) document.body.style.width = `${payload.width}px`;
  if (payload?.height) document.body.style.height = `${payload.height}px`;
});

bridge.on('DESTROY', () => {
  const root = document.getElementById('root');
  if (root) root.innerHTML = '';
});

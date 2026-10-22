import { render } from 'preact';
import { App } from './app';
import { registerServiceWorker } from './lib/pwa/register';
import { toasts } from './lib/toast/toastStore';
import './styles/tokens.css';
import './styles/global.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

if (import.meta.env.PROD) {
  registerServiceWorker((apply) =>
    toasts.show({
      emoji: '✨',
      title: 'New version available',
      message: 'Refresh to get the latest version of the site.',
      durationMs: null,
      action: { label: 'Refresh', onSelect: apply },
    }),
  );
}

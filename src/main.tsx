import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { unlockAudioOnUserGesture } from './utils/tamilVoice';

// Prime audio context on user interaction
unlockAudioOnUserGesture();

// Register offline Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('SafeCircle ServiceWorker registered:', reg.scope))
      .catch((err) => console.warn('ServiceWorker registration skipped:', err));
  });
}

createRoot(document.getElementById('root')!).render(<App />);

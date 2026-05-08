import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import './index.css';
import App from './App.tsx';
import { ServerWakeGate } from './components/ServerWakeGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServerWakeGate>
      <App />
    </ServerWakeGate>
    <Toaster position="bottom-right" richColors closeButton duration={4000} />
  </StrictMode>,
);

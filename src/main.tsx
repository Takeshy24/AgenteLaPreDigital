import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LiveApp from './LiveApp';
import { PublicPlans } from './pages/PublicPlans';
import { PublicOffer } from './pages/PublicOffer';
import { PublicTrial } from './pages/PublicTrial';
import { PublicGuardian } from './pages/PublicGuardian';
import './styles.css';
const Root =
  window.location.pathname === '/planes'
    ? PublicPlans
    : window.location.pathname.startsWith('/invitacion/')
      ? PublicGuardian
      : window.location.pathname.startsWith('/prueba/')
        ? PublicTrial
        : window.location.pathname.startsWith('/oferta/')
          ? PublicOffer
          : import.meta.env.VITE_DATA_MODE === 'demo'
            ? App
            : LiveApp;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

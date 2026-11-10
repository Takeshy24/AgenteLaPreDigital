import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LiveApp from './LiveApp';
import { Landing } from './pages/Landing';
import { PublicPlans } from './pages/PublicPlans';
import { PublicOffer } from './pages/PublicOffer';
import { PublicTrial } from './pages/PublicTrial';
import { PublicGuardian } from './pages/PublicGuardian';
import './styles.css';
const isLandingSite = import.meta.env.VITE_SITE === 'landing';
// Sin barras finales: /landing/ y /landing son la misma página.
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Root =
  path === '/planes'
    ? PublicPlans
    : path.startsWith('/invitacion/')
      ? PublicGuardian
      : path.startsWith('/prueba/')
        ? PublicTrial
        : path.startsWith('/oferta/')
          ? PublicOffer
          : path === '/landing' || isLandingSite
            ? Landing
            : import.meta.env.VITE_DATA_MODE === 'demo'
              ? App
              : LiveApp;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

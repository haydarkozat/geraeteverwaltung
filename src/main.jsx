import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

/*
 * Die App wurde ursprünglich für die Claude-Artifact-Umgebung gebaut und
 * persistiert über `window.storage`. Im echten Browser stellen wir hier eine
 * kompatible Implementierung auf Basis von localStorage bereit, damit das
 * Inventar einen Reload übersteht. Alle Daten bleiben rein lokal.
 */
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

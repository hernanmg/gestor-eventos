import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installSpanishFormValidationMessages } from './lib/formValidationEs';
import { applyTheme, getStoredTheme } from './lib/theme';
import './index.css';

installSpanishFormValidationMessages();
// Antes del primer render, para que no parpadee en claro al refrescar en oscuro.
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

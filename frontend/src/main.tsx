import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installSpanishFormValidationMessages } from './lib/formValidationEs';
import './index.css';

installSpanishFormValidationMessages();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

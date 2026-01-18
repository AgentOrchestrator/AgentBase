import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@xterm/xterm/css/xterm.css';

// Load debug utilities for ActionPill testing (attaches to window.debugActions)
import './debug/actionPillDebug';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

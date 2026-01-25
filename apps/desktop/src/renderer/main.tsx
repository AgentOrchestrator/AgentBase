import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@xterm/xterm/css/xterm.css';

// Load debug utilities for ActionPill testing (attaches to window.debugActions)
import './debug/actionPillDebug';

// Initialize test bridge for MCP instrumentation
import { initTestBridge } from './test-bridge';

initTestBridge();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

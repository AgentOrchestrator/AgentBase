import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@xterm/xterm/css/xterm.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


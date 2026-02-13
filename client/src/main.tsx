import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initGame } from './game';

ReactDOM.createRoot(document.getElementById('react-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initGame().catch(console.error);

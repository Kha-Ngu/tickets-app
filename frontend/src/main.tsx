import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
const UseHash = ((import.meta as any).env?.VITE_USE_HASH_ROUTER === 'true');
const Router = UseHash ? HashRouter : BrowserRouter;
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
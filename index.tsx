import React from 'react';
import ReactDOM from 'react-dom/client';
import Game from './components/Game';

const rootElement = document.getElementById('react-hud-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Game />
    </React.StrictMode>
  );
} else {
  console.error('Could not find element with ID "react-hud-root"');
}

import React from 'react';
import ReactDOM from 'react-dom/client';

// Import styles in order: variables first, then global, then component styles
import './styles/variables.css';
import './styles/global.css';
import './styles/graph.css';
import './styles/components.css';

import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found - check index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

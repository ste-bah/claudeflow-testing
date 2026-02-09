/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0a0a',
          panel: '#111111',
          card: '#1a1a1a',
          border: '#2a2a2a',
        },
        text: {
          primary: '#e0e0e0',
          secondary: '#888888',
          muted: '#555555',
        },
        accent: {
          green: '#00c853',
          red: '#ff1744',
          amber: '#ffab00',
          blue: '#2979ff',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

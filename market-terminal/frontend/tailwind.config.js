/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0e17',
          panel: '#111827',
          card: '#1a1a1a',
          border: '#1f2937',
        },
        text: {
          primary: '#e5e7eb',
          secondary: '#888888',
          muted: '#555555',
        },
        accent: {
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#2979ff',
        },
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      keyframes: {
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-down': 'slide-down 150ms ease-out',
      },
    },
  },
  plugins: [],
};

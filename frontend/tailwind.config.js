/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          darkest: '#070a13',
          dark: '#0c1222',
          surface: '#111827',
          card: '#1e293b',
          border: '#334155',
          cyan: '#06b6d4',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          green: '#10b981',
          critical: '#ef4444',
          warning: '#f59e0b'
        }
      }
    }
  },
  plugins: []
};

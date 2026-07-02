/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0A0A0B', card: '#111114', border: '#222228', hover: '#1A1A1F' },
        accent: { DEFAULT: '#7C3AED', light: '#8B5CF6', dim: '#7C3AED20' },
        cyan: { DEFAULT: '#06B6D4', dim: '#06B6D415' },
        risk: { low: '#22C55E', medium: '#EAB308', high: '#F97316', critical: '#EF4444' },
        ink: { DEFAULT: '#FAFAFA', muted: '#A1A1AA', faint: '#52525B' },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

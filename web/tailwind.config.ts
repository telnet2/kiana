import type { Config } from 'tailwindcss';

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b1020',
          subtle: '#10162b',
          panel: '#131a33'
        },
        text: {
          DEFAULT: '#e5e7eb',
          muted: '#9ca3af'
        },
        accent: {
          DEFAULT: '#6366f1',
          soft: '#4f46e5'
        }
      }
    }
  },
  plugins: [],
} satisfies Config;


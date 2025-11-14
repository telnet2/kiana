import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-panel': '#0d0d0d',
        'bg-subtle': '#1a1a1a',
        'text': '#e8e8e8',
        'text-muted': '#a0a0a0',
        'accent': '#6366f1',
      },
    },
  },
  plugins: [],
}
export default config

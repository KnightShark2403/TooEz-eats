import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090c', 900: '#0c0e13', 850: '#11141b',
          800: '#161a23', 700: '#1e232e', 600: '#2a3040',
          500: '#3a4256', 400: '#5b6479', 300: '#8b93a7',
          200: '#b9c0cf', 100: '#e2e6ee',
        },
        accent: { DEFAULT: '#5b8def', dim: '#3f6fd0', soft: '#1a2740' },
        good: { DEFAULT: '#2fbf71', soft: '#0f2b1e' },
        bad: { DEFAULT: '#f0576a', soft: '#301218' },
        warn: { DEFAULT: '#e5a83c', soft: '#2c220e' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from 'tailwindcss';

/**
 * Colours are CSS custom properties defined in globals.css, so a single set of
 * class names renders correctly in both the light (indigo + beige) and dark
 * (midnight) themes. No component hard-codes a hex value.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-sunk': 'var(--surface-sunk)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        ink: 'var(--text)',
        'ink-2': 'var(--text-2)',
        'ink-3': 'var(--text-3)',
        'ink-4': 'var(--text-4)',
        brand: { DEFAULT: 'var(--brand)', alt: 'var(--brand-2)', soft: 'var(--brand-soft)', border: 'var(--brand-border)' },
        sand: { DEFAULT: 'var(--sand)', soft: 'var(--sand-soft)', border: 'var(--sand-border)' },
        good: { DEFAULT: 'var(--good)', soft: 'var(--good-soft)', border: 'var(--good-border)' },
        bad: { DEFAULT: 'var(--bad)', soft: 'var(--bad-soft)', border: 'var(--bad-border)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)', border: 'var(--warn-border)' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
      maxWidth: { app: '1560px' },
    },
  },
  plugins: [],
};
export default config;

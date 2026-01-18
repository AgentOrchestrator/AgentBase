import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: '#0a0a0a',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f4f3f0',
          foreground: '#302e26',
        },
        accent: {
          yellow: '#f5c348',
          green: '#0ecf85',
        },
        muted: {
          DEFAULT: '#f9fbfc',
          foreground: '#888888',
        },
        border: '#d1d5db',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          root: '#060810',
          surface: '#0c1021',
          hover: '#111827',
        },
        border: {
          base: '#1a2035',
          hover: '#263050',
        },
        ink: {
          primary: '#e2e8f0',
          secondary: '#64748b',
          muted: '#334155',
        },
        cyan: {
          accent: '#06b6d4',
          dim: 'rgba(6,182,212,0.12)',
        },
        success: {
          DEFAULT: '#10b981',
          dim: 'rgba(16,185,129,0.12)',
        },
        danger: {
          DEFAULT: '#f43f5e',
          dim: 'rgba(244,63,94,0.12)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dim: 'rgba(245,158,11,0.12)',
        },
        neutral: {
          dim: 'rgba(100,116,139,0.12)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        surface: '0 0 0 1px #1a2035',
        glow: '0 0 8px 0',
      },
    },
  },
  plugins: [],
};

export default config;

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
          root: '#131210',
          surface: '#1a1815',
          elevated: '#221f1a',
          hover: '#201d18',
        },
        border: {
          base: '#2a2520',
          hover: '#3a3028',
          subtle: '#1f1c18',
        },
        ink: {
          primary: '#f2ede6',
          secondary: '#8a7e71',
          muted: '#4a4035',
          faint: '#2e2a24',
        },
        amber: {
          accent: '#c9924a',
          dim: 'rgba(201,146,74,0.10)',
          glow: 'rgba(201,146,74,0.05)',
        },
        success: {
          DEFAULT: '#5a9e6f',
          dim: 'rgba(90,158,111,0.12)',
        },
        danger: {
          DEFAULT: '#d45848',
          dim: 'rgba(212,88,72,0.12)',
        },
        warning: {
          DEFAULT: '#e6a020',
          dim: 'rgba(230,160,32,0.12)',
        },
        neutral: {
          dim: 'rgba(138,126,113,0.10)',
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
        surface: '0 0 0 1px #2a2520',
        float: '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px #2a2520',
      },
    },
  },
  plugins: [],
};

export default config;

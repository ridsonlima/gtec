import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // Status crítico
        critical: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
          dark: '#991B1B',
        },
        // Status atenção
        attention: {
          DEFAULT: '#D97706',
          light: '#FEF3C7',
          dark: '#92400E',
        },
        // Status OK
        success: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
          dark: '#14532D',
        },
        // Status bloqueado
        blocked: {
          DEFAULT: '#374151',
          light: '#F3F4F6',
        },
        // Brand
        brand: {
          DEFAULT: '#1D4ED8',
          light: '#DBEAFE',
          dark: '#1E3A8A',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

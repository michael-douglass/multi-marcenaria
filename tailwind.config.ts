import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        gold: {
          DEFAULT: '#f2d892',
          hover: '#f5e0a8',
          soft: '#e8c878',
          muted: '#e8c878',
          dim: 'rgba(240,210,140,0.35)',
          border: 'rgba(240,210,140,0.42)',
          'border-subtle': 'rgba(240,210,140,0.28)',
          glow: 'rgba(240,210,140,0.35)',
          on: '#2a1812',
        },
        cream: {
          DEFAULT: '#fffaf4',
          secondary: '#faf2ea',
          muted: '#edd9c4',
          faint: '#d4bc9f',
        },
        mahogany: {
          DEFAULT: '#2a1812',
          base: '#2a1812',
          elevated: 'rgba(52, 34, 26, 0.97)',
          card: 'rgba(78,52,40,0.97)',
          deep: 'rgba(68,46,34,0.88)',
          muted: 'rgba(72, 48, 36, 0.78)',
          panel: 'rgba(62, 42, 32, 0.98)',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
      },
      fontFamily: {
        sans: ['Raleway', 'system-ui', 'sans-serif'],
        raleway: ['Raleway', 'sans-serif'],
        bebas: ['"Bebas Neue"', 'cursive'],
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['Raleway', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'serif'],
        dm: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'radial-mahogany':
          'radial-gradient(ellipse at 15% 15%,rgba(120,72,40,.35) 0,transparent 55%),radial-gradient(ellipse at 85% 85%,rgba(90,50,28,.28) 0,transparent 55%)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config

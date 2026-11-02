/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--c-${v}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: c('primary'),
        secondary: c('secondary'),
        accent: c('accent'),
        bg: c('bg'),
        surface: c('surface'),
        muted: c('muted'),
        border: c('border'),
        fg: c('fg'),
        subtle: c('subtle'),
        success: c('success'),
        danger: c('danger'),
        warning: c('warning'),
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'], brand: ['Fraunces', 'Georgia', 'serif'] },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(var(--c-shadow) / 0.18)',
        glow: '0 10px 30px -10px rgb(var(--c-primary) / 0.55)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in .25s ease-out both',
      },
    },
  },
  plugins: [],
};

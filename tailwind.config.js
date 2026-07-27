/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          'primary-contrast': 'var(--brand-primary-contrast)',
          secondary: 'var(--brand-secondary)',
          'secondary-contrast': 'var(--brand-secondary-contrast)',
        },
      },
      borderRadius: {
        // Match the React design system --radius value
        DEFAULT: '0.5rem',
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
        xl: 'calc(0.5rem + 4px)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts,md,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background-rgb) / <alpha-value>)', foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)', border: 'rgb(var(--border-rgb) / <alpha-value>)', nav: 'rgb(var(--primary-rgb) / <alpha-value>)',
        muted: { DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)', foreground: 'rgb(var(--muted-rgb) / <alpha-value>)' }
      }
    }
  },
  plugins: []
};

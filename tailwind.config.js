/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Teal of the paper-plane logo (500). 600+ pass WCAG AA with white text.
        primary: {
          50: '#effcfa',
          100: '#d2f7f1',
          200: '#a6efe4',
          300: '#6de0d3',
          400: '#35cbbd',
          500: '#06c4b4',
          600: '#09827a',
          700: '#0b6b65',
          800: '#0f5552',
          900: '#114744',
        },
      },
      fontFamily: {
        // UI font — driven by the --font-ui CSS variable; changes per locale (see utils/locale-font.ts)
        sans: ['var(--font-ui)'],
        // Fixed monospace for room IDs / code
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        // Content font for user posts in RoomCard — the --font-content variable (see utils/locale-font.ts)
        content: ['var(--font-content)'],
      },
    },
  },
  plugins: [],
}

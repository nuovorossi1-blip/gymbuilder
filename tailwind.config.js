/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#0A0C0E',
        steel:  '#131719',
        edge:   '#232A2E',
        chalk:  '#F2EEE6',
        slate2: '#8A959D',
        amber2: '#FFB627',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        data:    ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

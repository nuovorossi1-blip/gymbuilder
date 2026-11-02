/** @type {import('tailwindcss').Config} */
// Grafica standard AI-OS (ai-os/STILE_GRAFICO.md): grafite, oro e vetro,
// Manrope per i testi e Barlow Condensed per titoli e numeri grandi.
// I nomi delle classi restano quelli di prima: cambiano solo i valori.
const oro = {
  50: '#FFF7E8', 100: '#FFEFD1', 200: '#FFD99A', 300: '#FFC15E', 400: '#F5A623',
  500: '#F5A623', 600: '#D98E12', 700: '#A86A00', 800: '#6B4600', 900: '#3D2A08', 950: '#2A1D06',
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#1A1A1A',
        steel:  '#242424',
        edge:   '#333333',
        chalk:  '#FFFFFF',
        slate2: '#A1A1AA',
        amber2: '#F5A623',
        gold:   '#F5A623',
        coral:  '#FF6B6B',
        // L'accento azzurro decorativo diventa oro; il blu dei gradienti diventa corallo.
        cyan: oro,
        blue: { 500: '#FF8A5C', 600: '#FF6B6B', 700: '#E85555' },
        // Grigi freddi -> grigi grafite neutri.
        slate: {
          100: '#F4F4F5', 200: '#E4E4E7', 300: '#D4D4D8', 400: '#A1A1AA', 500: '#71717A',
          600: '#52525B', 700: '#3A3A3A', 800: '#2D2D2D', 900: '#242424', 950: '#1A1A1A',
        },
        zinc: { 800: '#2D2D2D', 900: '#242424', 950: '#1A1A1A' },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Manrope', 'system-ui', 'sans-serif'],
        body:    ['Manrope', 'system-ui', 'sans-serif'],
        data:    ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

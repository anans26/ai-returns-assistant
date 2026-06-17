/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7f4',
          100: '#d7ece3',
          200: '#b0d8c8',
          300: '#7ebdaa',
          400: '#509f88',
          500: '#2e5d4b',
          600: '#264f40',
          700: '#1e3f31',
          800: '#183326',
          900: '#132a1f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

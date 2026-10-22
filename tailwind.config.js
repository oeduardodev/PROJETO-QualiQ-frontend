/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: {
          50: '#f6f9fc',
          100: '#edf4f8',
          200: '#d9e5ee',
          300: '#b9ccda',
          400: '#8199aa',
          500: '#62798c',
          600: '#475e71',
          700: '#30485b',
          800: '#1c3145',
          900: '#0a1128',
          950: '#020914',
        },
        blue: {
          50: '#eef8ff',
          100: '#d6f0ff',
          200: '#a8e0fa',
          300: '#75cdf2',
          400: '#39b2ea',
          500: '#148fdb',
          600: '#006acc',
          700: '#0758a7',
          800: '#074d8e',
          900: '#083b6d',
          950: '#052748',
        },
        emerald: {
          50: '#effdf2',
          100: '#d8f9df',
          200: '#b7f2c4',
          300: '#8aeba0',
          400: '#71ed8d',
          500: '#5fd37a',
          600: '#379951',
          700: '#287f42',
          800: '#216538',
          900: '#1c5231',
          950: '#0d311b',
        },
      },
    },
  },
  plugins: [],
};

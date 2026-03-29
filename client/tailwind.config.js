/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        exclusive: {
          red: '#DC143C',
          'red-dark': '#A50E2D',
          'red-light': '#FF1A4D',
          black: '#000000',
          'black-soft': '#111111',
          'black-card': '#1a1a1a',
          'black-border': '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#101010',      // Sidebar/Header Hintergrund
          primary: '#ff0000',   // Primäres Rot
          surface: '#ffffff',   // Main Content Hintergrund
        },
      },
      fontFamily: {
        sans: ['Barlow', 'sans-serif'], // Body Font
        heading: ['Arial', 'sans-serif'], // Headings
      },
    },
  },
  plugins: [],
};

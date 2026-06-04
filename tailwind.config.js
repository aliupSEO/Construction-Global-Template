/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',      // Premium slate-900
          primary: '#2563eb',   // Premium blue-600
          surface: '#f8fafc',   // Crisp slate-50
          accent: '#f59e0b',    // Construction amber
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

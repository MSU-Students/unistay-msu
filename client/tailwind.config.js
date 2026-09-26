/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        msu: {
          maroon: '#800000',
          gold: '#FFD700',
          darkmaroon: '#5B0000',
          emerald: '#047857',
        }
      }
    },
  },
  plugins: [],
}

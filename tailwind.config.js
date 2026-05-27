/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-navy': '#001C30',
        'brand-yellow': '#FFCC00',
        'brand-red': '#FFCC00', // Set to yellow as in original app
        'brand-grey': '#E0E0E0',
        'brand-dark-grey': '#1F2937',
        'brand-dark-blue': '#0A192F',
      },
      fontFamily: {
        'brand-heading': ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
        'brand-body': ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        'none': '0px',
        DEFAULT: '0px',
      },
      boxShadow: {
        'hard': '4px 4px 0px 0px #000000',
        'hard-yellow': '4px 4px 0px 0px #FFCC00',
      }
    },
  },
  plugins: [],
}

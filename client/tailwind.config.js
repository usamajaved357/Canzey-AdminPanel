/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shell: '#FBF5F3',
        blush: '#F5D6D1',
        rose: '#EA948A',
        ink: '#191919',
        primary: {
          50: '#FBF5F3',
          100: '#F5D6D1',
          200: '#f0c4bc',
          300: '#ebb2a8',
          400: '#EA948A',
          500: '#EA948A',
          600: '#d87f75',
          700: '#b86860',
          800: '#191919',
          900: '#141210',
        },
        surface: {
          DEFAULT: '#1c1816',
          elevated: '#26201e',
          hover: '#2f2826',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Manrope', 'sans-serif'],
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
}

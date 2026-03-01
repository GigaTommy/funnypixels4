/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Noto Sans SC', '思源黑体', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        'noto': ['Noto Sans SC', '思源黑体', 'sans-serif'],
        'chinese': ['Noto Sans SC', '思源黑体', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

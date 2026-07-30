/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12284C',
        navy3: '#22406e',
        gold: '#a4906f',
        goldD: '#8c7857',
        gold2: '#c8b591',
        goldSoft: '#f1ece2',
        canvas: '#f5f3ee',
        surface2: '#faf8f3',
        line: '#ece8df',
        line2: '#ddd8cc',
        ink3: '#a4a6ad',
        ink2: '#73767f',
        body: '#3a3f4d',
        rowHover: '#faf6ee',
        danger: '#d9694f',
      },
      fontFamily: {
        sans: ['Tajawal', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,40,76,.04),0 12px 30px -18px rgba(18,40,76,.18)',
      },
    },
  },
  plugins: [],
};

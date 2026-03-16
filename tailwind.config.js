/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'avenir': ['Avenir Next', 'Avenir', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        'lora': ['Lora', 'Georgia', 'Times New Roman', 'serif'],
      },
      letterSpacing: {
        'heading': '0.025em',
        'dedication': '0.15em',
        'quote': '0.01em',
      },
      lineHeight: {
        'body': '1.6',
        'body-relaxed': '1.7',
      },
    },
  },
  plugins: [],
};

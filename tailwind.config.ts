import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#FAF6EE',
          card: '#FFFDF9',
          border: '#2C2724',
          subtle: '#F0EAD8',
          hover: '#F5EFE0',
        },
        tvb: {
          orange: '#FF6B35',
          'orange-hover': '#F05820',
          peach: '#FFE7DC',
          'peach-light': '#FFF3ED',
          ink: '#1E1B18',
          'ink-light': '#5A544E',
          'ink-muted': '#8C847A',
          green: '#1E7E34',
          'green-bg': '#EAF6EC',
          amber: '#B27B00',
          'amber-bg': '#FEF3D6',
        }
      },
      fontFamily: {
        hand: ['Patrick Hand', 'Caveat', 'Kalam', 'cursive', 'sans-serif'],
        display: ['Caveat', 'Patrick Hand', 'cursive', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'sketch': '2px 3px 0px #2C2724',
        'sketch-lg': '4px 5px 0px #2C2724',
        'sketch-hover': '3px 4px 0px #2C2724',
        'sketch-orange': '3px 4px 0px #FF6B35',
        'sketch-inner': 'inset 1px 2px 0px rgba(44, 39, 36, 0.1)',
      }
    },
  },
  plugins: [],
};
export default config;
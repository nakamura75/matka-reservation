import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: '#E8552B',
          light: '#FDF0EB',
          dark: '#D04420',
        },
        'brand-green': {
          DEFAULT: '#4CBF68',
          light: '#EBF7ED',
          dark: '#3DA855',
        },
        cream: {
          DEFAULT: '#FAF3E8',
          dark: '#F0E6D0',
        },
      },
      backgroundImage: {
        'diagonal-grid': `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 24px,
          rgba(232,67,26,0.06) 24px,
          rgba(232,67,26,0.06) 25px
        )`,
        'check-grid': `linear-gradient(#ebebeb 12px, transparent 12px), linear-gradient(90deg, #ebebeb 12px, transparent 12px)`,
      },
      backgroundSize: {
        'check-grid': '60px 60px',
      },
    },
  },
  plugins: [],
};
export default config;

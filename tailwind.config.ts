import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: '#E8431A',
          light: '#FDF0EB',
          dark: '#C93515',
        },
        'brand-green': {
          DEFAULT: '#3DB54A',
          light: '#EBF7ED',
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
      },
    },
  },
  plugins: [],
};
export default config;

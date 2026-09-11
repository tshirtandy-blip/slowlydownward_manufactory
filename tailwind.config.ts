import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f6f4ef",
        ink: "#1a1a18",
        stone: "#8c887e",
        line: "#dedad0",
        accent: "#7a2e2e",
      },
      fontFamily: {
        display: ["'Times New Roman'", "Georgia", "serif"],
        sans: ["Helvetica Neue", "Arial", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};

export default config;

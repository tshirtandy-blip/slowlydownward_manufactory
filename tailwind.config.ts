import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff",
        ink: "#1a1a18",
        stone: "#8c887e",
        line: "#dedad0",
        accent: "#7a2e2e",
      },
      fontFamily: {
        // These resolve via CSS custom properties set in the root layout
        // from Admin > Settings > Typography (src/lib/fonts.ts), with the
        // original hardcoded stacks kept as a fallback for the moment
        // before that CSS variable is set.
        display: ["var(--font-heading)", "'Times New Roman'", "Georgia", "serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};

export default config;

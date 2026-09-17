import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand tokens (unchanged — used throughout the storefront + admin)
        paper: "#ffffff",
        ink: "#1a1a18",
        stone: "#8c887e",
        line: "#dedad0",

        // shadcn/ui semantic tokens, mapped onto the same brand palette
        // (cssVariables: false in components.json — these resolve directly,
        // no CSS custom properties / dark-mode indirection needed)
        background: "#ffffff",
        foreground: "#1a1a18",
        border: "#dedad0",
        input: "#dedad0",
        ring: "#7a2e2e",
        primary: {
          DEFAULT: "#1a1a18",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f5f4f0",
          foreground: "#1a1a18",
        },
        muted: {
          DEFAULT: "#f5f4f0",
          foreground: "#8c887e",
        },
        accent: {
          DEFAULT: "#7a2e2e",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#b3261e",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1a1a18",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#1a1a18",
        },
      },
      // Sharp corners throughout, matching the existing hairline/editorial look —
      // shadcn components use rounded-lg/md/sm classes, all pinned to 0 here.
      borderRadius: {
        lg: "0px",
        md: "0px",
        sm: "0px",
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
  plugins: [require("tailwindcss-animate")],
};

export default config;

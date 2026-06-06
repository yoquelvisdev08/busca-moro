/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Direct design token colors
        surface: {
          DEFAULT: "var(--sx-surface)",
          high: "var(--sx-surface-high)",
          highest: "var(--sx-surface-highest)",
        },
        bg: {
          DEFAULT: "var(--sx-bg)",
          lower: "var(--sx-bg-lower)",
        },
        primary: {
          DEFAULT: "var(--sx-primary)",
          container: "var(--sx-primary-container)",
          soft: "var(--sx-primary-soft)",
          glow: "var(--sx-primary-glow)",
        },
        secondary: {
          DEFAULT: "var(--sx-secondary)",
          container: "var(--sx-secondary-container)",
        },
        tertiary: {
          DEFAULT: "var(--sx-tertiary)",
          container: "var(--sx-tertiary-container)",
        },
        text: {
          DEFAULT: "var(--sx-text)",
          secondary: "var(--sx-text-secondary)",
          muted: "var(--sx-text-muted)",
          dim: "var(--sx-text-dim)",
        },
        border: {
          DEFAULT: "var(--sx-border)",
          subtle: "var(--sx-border-subtle)",
          strong: "var(--sx-border-strong)",
        },
        success: "var(--sx-success)",
        warning: "var(--sx-warning)",
        danger: "var(--sx-danger)",
        info: "var(--sx-info)",

        // shadcn/ui mapped colors
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        headline: ['"Geist"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--sx-radius-sm)",
        md: "var(--sx-radius-md)",
        lg: "var(--sx-radius-lg)",
        full: "var(--sx-radius-full)",
      },
      boxShadow: {
        "glow-primary": "var(--sx-glow-primary)",
        "glow-success": "var(--sx-glow-success)",
        "glow-danger": "var(--sx-glow-danger)",
        sm: "0 1px 2px rgba(0,0,0,0.3)",
        md: "0 4px 12px rgba(0,0,0,0.4)",
        lg: "0 8px 24px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

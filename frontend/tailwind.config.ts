import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Zenmux-inspired light palette
        brand: {
          50:  "#f1f7fe",
          100: "#d0e7fd",
          200: "#a1d4fa",
          300: "#69bff8",
          400: "#30a5f2",
          500: "#0699ff",
          600: "#0077cc",
          700: "#005fa3",
          800: "#004d86",
          900: "#0b1d32",
          950: "#14345a",
        },
        surface: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#f0f0f0",
          300: "#e8e8e8",
          400: "#e6e6e6",
          500: "#999999",
          600: "#777777",
          700: "#666666",
          800: "#555555",
          900: "#333333",
          950: "#000000",
        },
      },
      fontFamily: {
        sans: ["PT Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["DIN Condensed", "Impact", "sans-serif"],
      },
      fontSize: {
        "hero": ["50px", { lineHeight: "60px", fontWeight: "700" }],
        "hero-sm": ["32px", { lineHeight: "40px", fontWeight: "700" }],
        "section": ["40px", { lineHeight: "52px", fontWeight: "700" }],
        "section-sm": ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "display": ["80px", { lineHeight: "100%", fontWeight: "700" }],
      },
      animation: {
        "fade-in":    "fadeIn 0.6s ease-out",
        "slide-up":   "slideUp 0.6s ease-out",
        "float":      "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
}
export default config

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          charcoal: "#32302F",
          gold: "#E5A93D",
          emerald: "#059669"
        },
        dune: {
          50: "#f7f6f5",
          100: "#efecea",
          200: "#dfd9d6",
          300: "#c8bfb9",
          400: "#aa9e96",
          500: "#8d8077",
          600: "#736860",
          700: "#5d554f",
          800: "#4c4540",
          900: "#3d3835",
          950: "#1a1918"
        },
        gold: {
          50: "#fff9e8",
          100: "#fdefc5",
          200: "#fce39d",
          300: "#f8cf63",
          400: "#efbb44",
          500: "#e5a93d",
          600: "#c47f20",
          700: "#9c5a1a",
          800: "#81491d",
          900: "#6d3e1c"
        }
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.1)",
        "card-hover": "0 10px 24px -12px rgb(17 24 39 / 0.35)",
        glow: "0 0 40px -8px rgb(229 169 61 / 0.25)"
      },
      animation: {
        fadeIn: "fadeIn 220ms ease-out",
        slideUp: "slideUp 280ms ease-out"
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  }
};

export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3F4F1",
        surface: "#FFFFFF",
        ink: "#14171A",
        "ink-soft": "#5B6169",
        border: "#E1DFD8",
        accent: {
          DEFAULT: "#2F5D50",
          soft: "#E4ECE9",
        },
        status: {
          todo: "#9AA0A6",
          progress: "#C98A2B",
          done: "#2F5D50",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        blueprint: {
          DEFAULT: "#14304D",
          light: "#1E4468",
          dark: "#0D2138",
        },
        paper: {
          DEFAULT: "#EDEBE2",
          light: "#F5F3EC",
        },
        ink: "#1B2430",
        amber: {
          DEFAULT: "#E8A33D",
          dark: "#C9861F",
        },
        site: {
          green: "#4C7A5E",
          rust: "#C1502E",
        },
        line: "#3D5A80",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      backgroundImage: {
        "blueprint-grid":
          "linear-gradient(rgba(61,90,128,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(61,90,128,0.15) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
};

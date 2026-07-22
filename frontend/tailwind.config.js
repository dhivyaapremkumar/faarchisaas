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
          light: "#F4C98A",
        },
        site: {
          green: "#4C7A5E",
          rust: "#C1502E",
        },
        line: "#3D5A80",
        violet: {
          DEFAULT: "#7B61FF",
          light: "#B4A5FF",
        },
        // Category colors - each team/file category gets its own hue so
        // the Team and CAD Files pages are scannable at a glance
        cat: {
          architect: { bg: "#EEEDFE", text: "#534AB7" },
          client: { bg: "#FBEAF0", text: "#993556" },
          structural: { bg: "#E6F1FB", text: "#185FA5" },
          electrical: { bg: "#FAEEDA", text: "#854F0B" },
          plumbing: { bg: "#E1F5EE", text: "#0F6E56" },
          ac: { bg: "#FAECE7", text: "#993C1D" },
          others: { bg: "#F1EFE8", text: "#5F5E5A" },
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      backgroundImage: {
        "blueprint-grid":
          "linear-gradient(rgba(61,90,128,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(61,90,128,0.15) 1px, transparent 1px)",
        "amber-gradient": "linear-gradient(90deg, #E8A33D, #D88B1F)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
      keyframes: {
        gridDrift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "48px 48px" },
        },
        floatGlow: {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translateY(-20px) scale(1.08)", opacity: "0.8" },
        },
        pulseDot: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232,163,61,0.6)" },
          "50%": { boxShadow: "0 0 0 8px rgba(232,163,61,0)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "grid-drift": "gridDrift 8s linear infinite",
        "float-glow": "floatGlow 6s ease-in-out infinite",
        "float-glow-delayed": "floatGlow 7s ease-in-out infinite 1s",
        "pulse-dot": "pulseDot 2s infinite",
        "fade-up": "fadeUp 0.5s ease-out backwards",
      },
    },
  },
  plugins: [],
};

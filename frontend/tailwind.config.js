/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Familjen Grotesk"', "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        canvas: {
          DEFAULT: "#07090f",
          50: "#0d1117",
          100: "#111827",
          200: "#151b27",
          300: "#1a2233",
          400: "#1e2736",
        },
        accent: {
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444",
          blue: "#3b82f6",
          teal: "#06d6a0",
        },
        surface: {
          DEFAULT: "#0d1117",
          raised: "#151b27",
          border: "#1e2736",
          hover: "#1a2233",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.35s ease-out forwards",
        pulse: "pulse 2.5s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px 0 rgba(6, 214, 160, 0.3)" },
          "50%": { boxShadow: "0 0 16px 2px rgba(6, 214, 160, 0.5)" },
        },
      },
    },
  },
  plugins: [],
};

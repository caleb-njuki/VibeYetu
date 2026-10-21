/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ivory: { DEFAULT: "#FAF7EE", dark: "#F0EBDC" },
        ink: { DEFAULT: "#0B0B0F", soft: "#3A3A44", mute: "#6B6B76" },
        vibe: {
          DEFAULT: "#1F4FD8",
          dark: "#1639A3",
          light: "#E6ECFC",
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,11,15,0.06), 0 4px 16px rgba(11,11,15,0.06)",
      },
    },
  },
  plugins: [],
};

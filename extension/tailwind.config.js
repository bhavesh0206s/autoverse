/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0d0d0d",
        parchment: "#faf9f6",
        "ash-gray": "#afaeac",
        "stone-gray": "#868584",
        "earth-gray": "#353534",
        mist: "rgba(226, 226, 226, 0.35)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
      borderRadius: {
        pill: "50px",
        comfortable: "12px",
        standard: "8px",
        tight: "6px",
      },
      letterSpacing: {
        editorial: "2.4px",
      },
    },
  },
  plugins: [],
};

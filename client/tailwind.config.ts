import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4A5C4D",
        secondary: "#C9A66B",
        accent: "#D97757",
        neutral: "#1C1917",
        surface: "#FCFAF7",
      },
      fontFamily: {
        heading: ['"Playfair Display"', "Georgia", '"Times New Roman"', "serif"],
        body: ['"Inter"', '"Segoe UI"', "Tahoma", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        title: ["1.75rem", { lineHeight: "1.2" }],
        body: ["1rem", { lineHeight: "1.6" }],
        small: ["0.875rem", { lineHeight: "1.5" }],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;

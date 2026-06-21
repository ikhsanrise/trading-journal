import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors - trading journal palette
        profit: {
          50: "#EAF3DE",
          100: "#C0DD97",
          600: "#3B6D11",
          800: "#27500A",
        },
        loss: {
          50: "#FCEBEB",
          100: "#F7C1C1",
          600: "#A32D2D",
          800: "#791F1F",
        },
        neutral: {
          50: "#FAEEDA",
          600: "#854F0B",
          800: "#633806",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

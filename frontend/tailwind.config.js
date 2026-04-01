/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a0f1a",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
        primary: {
          600: "#2563eb",
          500: "#3b82f6",
          400: "#60a5fa",
        },
      },
    },
  },
  plugins: [],
};

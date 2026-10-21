/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#0875a8",
        navy: "#102d4f",
        mint: "#c9f8e8",
        canvas: "#f5f8ff",
      },
      boxShadow: { soft: "0 8px 28px rgba(29, 58, 94, .08)" },
    },
  },
  plugins: [],
};

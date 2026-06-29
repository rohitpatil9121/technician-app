/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Technician app brand = blue (matches the prototype).
        brand: {
          DEFAULT: "#0E6FC4",
          dark: "#0B5699",
          light: "#1A8FE0",
          50: "#EEF4FB",
          100: "#D8E8F8",
        },
        ok: { DEFAULT: "#1E9E5A", light: "#E5F5EC" },
        warn: { DEFAULT: "#C77700", light: "#FBF1E0" },
        danger: { DEFAULT: "#D23B3B", light: "#FBE9E9" },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        pop: "0 10px 30px -10px rgb(15 23 42 / 0.25)",
      },
    },
  },
  plugins: [],
};

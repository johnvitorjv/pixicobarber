/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#f2b90d",
                "background-dark": "#050505",
                "accent-red": "#ff3b3b",
            },
            fontFamily: {
                display: ["Syncopate", "sans-serif"],
                modern: ["Space Grotesk", "sans-serif"],
                sans: ["Inter", "sans-serif"],
            },
            letterSpacing: {
                "ultra-wide": "0.8em",
                tightest: "-0.08em",
            },
        },
    },
    plugins: [],
};

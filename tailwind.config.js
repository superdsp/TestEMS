/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pv-green': '#22c55e',
        'battery-orange': '#f97316',
        'pcs-blue': '#3b82f6',
        'grid-yellow': '#eab308',
        'load-red': '#ef4444',
        'alarm-warning': '#f59e0b',
        'alarm-critical': '#dc2626',
      },
    },
  },
  plugins: [],
}

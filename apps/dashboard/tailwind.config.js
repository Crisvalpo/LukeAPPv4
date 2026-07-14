/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#080b14',
        panel: '#0d1220',
        card: '#111625',
        border: '#1e293b',
        borderStrong: '#2e3d56',
        foreground: '#e8ecf5',
        muted: '#8b94a8',
        faint: '#5b6478',
        accent: '#38bdf8',
        status: {
          pending: '#5b6478',
          prefab: '#f59e0b',
          transit: '#38bdf8',
          installed: '#34d399'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // port: 3000,          // optional: to make frontend run on port 3000
    host: true,          // allows LAN access if needed
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // backend server
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

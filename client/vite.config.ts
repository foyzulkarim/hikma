import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Client app will run on port 3001
  },
  define: {
    // Expose environment variables to the client
    // VITE_API_BASE_URL will be used for backend API calls
    'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'http://localhost:3000'),
  },
})



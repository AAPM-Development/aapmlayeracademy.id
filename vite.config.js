import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // When the browser drops a request (APPI's Stop), drop it upstream too,
        // so the API sees the closed connection as it does in production.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, _req, res) => {
            res.on('close', () => {
              if (!res.writableEnded) proxyReq.destroy();
            });
          });
        },
      },
    },
  },
});

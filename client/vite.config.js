import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy) => {
          proxy.on('error', (error, req, res) => {
            // The API restarts on file changes; during that short window the
            // proxy cannot reach it. Return a readable message instead of a
            // bare 500 so the client can retry gracefully.
            if (res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  message:
                    'The reservations service is restarting. Please try again in a moment.',
                })
              );
            } else if (res && typeof res.end === 'function' && !res.writableEnded) {
              res.end();
            } else {
              console.error('[proxy]', error.message);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

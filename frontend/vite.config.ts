import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// No "process" usage anywhere
export default defineConfig(({ mode }) => {
  // Use '.' for the project root to avoid Node's process types
  const env = loadEnv(mode, '.', ''); // loads VITE_* from .env files & CI repo variables

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      proxy: {
        // Primary: client should call /api/*
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },

        // Safety net: if any code calls these without /api, still proxy in dev
        '/auth': 'http://localhost:3000',
        '/me': 'http://localhost:3000',
        '/events': 'http://localhost:3000',

        // socket.io
        '/socket.io': { target: 'http://localhost:3000', ws: true },
      },
    },
  };
});

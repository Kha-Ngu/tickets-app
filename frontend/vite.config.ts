import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Robust: reads from .env files AND from process.env provided by GitHub Actions,
// but avoids TypeScript "process" typing by using globalThis.
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, '.', ''); // .env, .env.[mode]
  const runtimeEnv = ((globalThis as any).process?.env ?? {}) as Record<string, string>;
  const env = { ...fileEnv, ...runtimeEnv };

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        '/auth': 'http://localhost:3000',
        '/me': 'http://localhost:3000',
        '/events': 'http://localhost:3000',
        '/socket.io': { target: 'http://localhost:3000', ws: true },
      },
    },
  };
});

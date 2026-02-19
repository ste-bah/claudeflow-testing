import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parsePort(raw: string | undefined, name: string, fallback: number): number {
  if (!raw || raw.trim() === '') return fallback;
  const parsed = parseInt(raw.trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    console.warn(`[vite] Invalid ${name}="${raw}" — expected 1-65535, using ${fallback}`);
    return fallback;
  }
  return parsed;
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(__dirname, '..');
  const env = loadEnv(mode, envDir, '');
  const backendPort = parsePort(env.BACKEND_PORT, 'BACKEND_PORT', 8000);
  const frontendPort = parsePort(env.FRONTEND_PORT, 'FRONTEND_PORT', 3000);

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `http://localhost:${backendPort}`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});

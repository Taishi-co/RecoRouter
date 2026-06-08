import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const webRoot = path.resolve(projectRoot, 'web-admin');
const distRoot = path.resolve(projectRoot, 'dist-web');

export default defineConfig({
  root: webRoot,
  publicDir: false,
  plugins: [react()],
  define: {
    __PROJECT_DOMAIN__: JSON.stringify(process.env.PROJECT_DOMAIN ?? ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: distRoot,
    emptyOutDir: true,
    assetsDir: 'assets/web-admin',
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:34532',
        changeOrigin: true,
      },
    },
  },
});

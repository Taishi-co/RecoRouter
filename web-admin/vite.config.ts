import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs/promises';

const projectRoot = path.resolve(__dirname, '..');
const webRoot = path.resolve(projectRoot, 'web-admin');
const distRoot = path.resolve(projectRoot, 'dist-web');
const mallAssetsSource = path.resolve(projectRoot, 'src/assets/mall-products');
const mallAssetsTarget = path.resolve(distRoot, 'assets/mall-products');

function copyMallProductAssets() {
  return {
    name: 'copy-mall-product-assets',
    async closeBundle() {
      await fs.rm(mallAssetsTarget, { force: true, recursive: true });
      await fs.mkdir(path.dirname(mallAssetsTarget), { recursive: true });
      await fs.cp(mallAssetsSource, mallAssetsTarget, { recursive: true });
    },
  };
}

export default defineConfig({
  root: webRoot,
  publicDir: false,
  plugins: [react(), copyMallProductAssets()],
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
  },
});

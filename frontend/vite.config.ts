import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 部署到 datawhale.cn 子路径
// 假设子路径 = /activity/ （v1 实际可调整）
const DEPLOY_BASE = process.env.VITE_DEPLOY_BASE || '/activity/';

export default defineConfig({
  plugins: [react()],
  base: DEPLOY_BASE, // 关键：所有静态资源 / 路由都加 base
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
  },
});

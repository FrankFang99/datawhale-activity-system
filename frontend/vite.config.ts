import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 部署到 datawhale.cn 子路径
// dev 模式：base = '/'（直接 localhost:5173 访问，不记 /activity/）
// 生产 build：base = '/activity/'（部署到 datawhale.cn/activity/）
const DEPLOY_BASE = process.env.VITE_DEPLOY_BASE || '/activity/';
const isDev = process.env.NODE_ENV !== 'production' || process.env.VITE_DEV_BASE === '1';
const BASE = isDev ? '/' : DEPLOY_BASE;

export default defineConfig({
  plugins: [react()],
  base: BASE,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',  // dev 强制 IPv4（Windows 上 IPv6 经常导致 localhost 不通）
    strictPort: true,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Frank 27 12:50：本地图片存在后端 /uploads 路径，vite dev 代理过去
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
  },
});

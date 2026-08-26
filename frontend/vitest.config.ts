/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    // v1.2 修复：Windows 上 fork pool 启动超慢（worker timeout 60s），改用 threads pool
    // 原因：vitest 4 + jsdom 29 + Node 26 + Windows fork 兼容问题
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,  // 保持并行加速
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});

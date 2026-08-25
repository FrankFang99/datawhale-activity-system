/**
 * Vitest 测试环境配置（v7 · TDD）
 * 配 jest-dom matchers + 模拟 antd 需要的 matchMedia 等
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 模拟 antd 需要的 matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},  // deprecated
    removeListener: () => {},  // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// 模拟 localStorage 已在 jsdom 自带

afterEach(() => {
  cleanup();
});

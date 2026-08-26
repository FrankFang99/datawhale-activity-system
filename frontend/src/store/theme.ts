/**
 * 主题模式（v1.2 引入）
 *
 * - 'light' / 'dark' 持久化到 localStorage
 * - 同步 documentElement.dataset.theme，styles.css 据此切换 CSS 变量
 * - antdTheme 通过 antdThemeFor(mode) 动态生成
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { theme as antdTheme, ThemeConfig } from 'antd';
import { color } from '../styles/tokens';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const themeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      setMode: (mode) => {
        set({ mode });
        document.documentElement.dataset.theme = mode;
      },
      toggle: () => {
        const next: ThemeMode = get().mode === 'light' ? 'dark' : 'light';
        get().setMode(next);
      },
    }),
    {
      name: 'datawhale-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.dataset.theme = state.mode;
        }
      },
    }
  )
);

/**
 * 给 AntD ConfigProvider 的动态主题
 * 暗色下用 antd.darkAlgorithm，token 跟随 design.md §1 调整
 * 关键：cssVar: true 让 AntD 暴露 --ant-* CSS 变量，
 *       这样硬编码的 inline style 也能跟着暗色切。
 */
export function antdThemeFor(mode: ThemeMode): ThemeConfig {
  const isDark = mode === 'dark';
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: true,  // v1.2：暴露 --ant-* CSS 变量
    hashed: false, // 配合 cssVar 用，否则变量 key 带 hash
    token: {
      colorPrimary: color.primary,
      colorInfo: color.primary,
      colorSuccess: color.success,
      colorWarning: color.warning,
      colorError: color.error,
      colorBgLayout: isDark ? '#0F172A' : color.bgLayout,
      colorBgContainer: isDark ? '#1E293B' : color.bgContainer,
      colorBorder: isDark ? '#334155' : color.border,
      colorText: isDark ? '#F1F5F9' : color.textPrimary,
      colorTextSecondary: isDark ? '#94A3B8' : color.textSecondary,
      borderRadius: 10,
      fontFamily: '"PingFang SC","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif',
    },
    components: {
      Button: { controlHeight: 40, borderRadius: 10 },
      Input: { controlHeight: 40, borderRadius: 10 },
      Card: { borderRadiusLG: 16 },
      Layout: {
        headerBg: isDark ? '#1E293B' : '#FFFFFF',
        headerHeight: 64,
        bodyBg: isDark ? '#0F172A' : color.bgLayout,
      },
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: isDark ? 'rgba(51,112,255,0.18)' : color.primaryLight,
        itemSelectedColor: color.primary,
        itemHoverBg: isDark ? 'rgba(51,112,255,0.10)' : color.primaryLight,
      },
      Tag: { borderRadiusSM: 9999 },
    },
  };
}

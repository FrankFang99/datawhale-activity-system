/**
 * Datawhale 设计 Token 单一来源
 *
 * 严格对齐 design.md §1-9。任何颜色 / 间距 / 圆角 / 阴影都要从这里取，
 * 不要在组件里 hardcode hex。新增 token 必须先在 design.md 加一节再改这里。
 *
 * 约定：
 * - CSS 变量（在 styles.css `:root`）和 TS 常量同源
 * - AntD 主题（main.tsx ConfigProvider）也引用这份
 * - 修改后必须跑 `npm run typecheck` + `npm test`
 */

export const color = {
  // === §1.1 品牌主色 ===
  primary: '#3370FF',
  primaryHover: '#2860E0',
  primaryActive: '#1E50CC',
  primaryLight: '#EEF4FF',

  // === §1.2 辅助色 / 渐变 ===
  secondary: '#62D4C8',
  gradientStart: '#3370FF',
  gradientEnd: '#62D4C8',
  gradientHero: 'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
  gradientHeroSoft: 'linear-gradient(180deg, #EEF4FF 0%, #F5F8FF 100%)',
  gradientLanding: 'linear-gradient(135deg, #F0F7FF 0%, #FAFCFF 100%)',

  // === §1.3 功能色 ===
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  // === §1.4 强调色 ===
  accentGold:   '#F6C65B',
  accentPurple: '#A679FF',
  accentPink:   '#FF6B9D',

  // === §1.5 中性色 ===
  bgLayout:    '#F5F8FF',
  bgContainer: '#FFFFFF',
  border:      '#E8ECF1',
  borderSoft:  '#E5E7EB',
  textPrimary:   '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  textDisabled:  '#D1D5DB',
} as const;

export const fontSize = {
  display: '48px',
  h1: '36px',
  h2: '28px',
  h3: '20px',
  h4: '16px',
  body: '14px',
  caption: '12px',
  mini: '11px',
} as const;

export const radius = {
  sm:   6,
  md:   10,
  lg:   16,
  xl:   22,
  full: 9999,
} as const;

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s6: 24,
  s8: 32,
  s12: 48,
  s16: 64,
} as const;

export const shadow = {
  xs: '0 1px 2px rgba(0,0,0,0.04)',
  sm: '0 2px 8px rgba(51,112,255,0.08)',
  md: '0 4px 16px rgba(51,112,255,0.12)',
  lg: '0 8px 32px rgba(51,112,255,0.16)',
  xl: '0 16px 48px rgba(51,112,255,0.20)',
  card: '0 1px 2px rgba(0,0,0,0.05)',
} as const;

export const motion = {
  fast: '150ms',
  base: '200ms',
  slow: '250ms',
  ease: 'ease',
  easeOut: 'ease-out',
} as const;

/**
 * §6.3 标签配色（前景/背景对）
 * 用法：<span className="dw-tag dw-tag-success">已通过</span>
 */
export const tagPalette = {
  blue:   { bg: '#EEF4FF', fg: '#3370FF' },
  green:  { bg: '#D1FAE5', fg: '#059669' },
  orange: { bg: '#FEF3C7', fg: '#D97706' },
  red:    { bg: '#FEE2E2', fg: '#DC2626' },
  purple: { bg: '#EDE9FE', fg: '#7C3AED' },
  gold:   { bg: '#FEF3C7', fg: '#D97706' },
} as const;

/**
 * §2.2 角色 Tag 配色（与 tagPalette 对齐，role → palette key）
 * 统一从此处取，避免在 Layout.tsx 里 hardcode
 */
export const rolePalette: Record<string, keyof typeof tagPalette> = {
  ADMIN: 'red',
  OPERATOR: 'orange',
  VOLUNTEER: 'blue',
  ORGANIZER: 'green',
  PARTICIPANT: 'blue',
  ASSISTANT: 'purple',
};

export const roleLabel: Record<string, string> = {
  ADMIN: '管理员',
  OPERATOR: '运营',
  VOLUNTEER: '志愿者',
  ORGANIZER: '组织者',
  PARTICIPANT: '参与者',
  ASSISTANT: '助教',
};

export const fontFamily =
  '"PingFang SC","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif';

/**
 * 给 AntD ConfigProvider 用的主题映射
 * main.tsx 直接 import 这个，design.md §10 跟这里必须同步
 */
export const antdTheme = {
  token: {
    colorPrimary:   color.primary,
    colorInfo:      color.primary,
    colorSuccess:   color.success,
    colorWarning:   color.warning,
    colorError:     color.error,
    colorBgLayout:  color.bgLayout,
    colorBgContainer: color.bgContainer,
    colorBorder:    color.border,
    colorText:      color.textPrimary,
    colorTextSecondary: color.textSecondary,
    borderRadius:   radius.md,
    fontFamily:     fontFamily,
  },
  components: {
    Button:  { controlHeight: 40, borderRadius: radius.md },
    Input:   { controlHeight: 40, borderRadius: radius.md },
    Card:    { borderRadiusLG: radius.lg },
    Layout:  { headerBg: color.bgContainer, headerHeight: 64, bodyBg: color.bgLayout },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: color.primaryLight,
      itemSelectedColor: color.primary,
      itemHoverBg: color.primaryLight,
    },
    Tag:     { borderRadiusSM: radius.full },
  },
} as const;

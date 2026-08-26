/**
 * 登录/注册页品牌头部（v1.1 引入 · v1.2 暗色适配）
 *
 * 替代原本孤零零的"登录"Title + 副标题，加渐变品牌条 + 平台名
 * 不喧宾夺主：高度 80px、纯色 + 单层渐变
 *
 * 暗色适配：订阅 themeStore，inline style 实时切色
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { themeStore } from '../store/theme';

export interface AuthBrandProps {
  /** 大标题，如"登录" / "注册" */
  title: string;
  /** 副标题，如"Datawhale 高校活动智能管理系统" */
  subtitle?: string;
  /** 顶部小提示（可选） */
  hint?: ReactNode;
  /** 主体内容（表单） */
  children: ReactNode;
  /** 底部链接区（已有账号？/ 立即注册 →）*/
  footer?: ReactNode;
  /** 底部小提示条（如"想成为组织者？"） */
  tip?: ReactNode;
  /** 注册/登录切换链接（可选）*/
  altLink?: { text: string; to: string };
}

export default function AuthBrand({ title, subtitle = 'Datawhale 高校活动智能管理系统', hint, children, footer, tip, altLink }: AuthBrandProps) {
  const mode = themeStore((s) => s.mode);
  const isDark = mode === 'dark';

  // 暗色模式下的色板（参考 AntD darkAlgorithm 输出）
  const palette = isDark
    ? {
        cardBg: '#1E293B',
        cardBorder: '#334155',
        hintBg: 'rgba(51, 112, 255, 0.10)',
        hintText: '#93C5FD',
        secondary: '#94A3B8',
      }
    : {
        cardBg: '#FFFFFF',
        cardBorder: '#E8ECF1',
        hintBg: '#F0F7FF',
        hintText: '#1A1A2E',
        secondary: '#6B7280',
      };

  return (
    <div style={{ maxWidth: 440, margin: '32px auto' }}>
      {/* 渐变品牌头部（暗色下渐变不变，亮色更显眼）*/}
      <div
        style={{
          background: 'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
          borderRadius: '22px 22px 0 0',
          padding: '28px 24px',
          textAlign: 'center',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(51, 112, 255, 0.18)',
        }}
      >
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#fff' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.20)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            D
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>Datawhale</span>
        </Link>
        <h2 style={{ margin: '16px 0 4px', fontSize: 24, fontWeight: 600, lineHeight: 1.3, color: '#fff' }}>{title}</h2>
        <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.5, color: '#fff' }}>{subtitle}</div>
      </div>

      {/* 表单卡片：实时根据主题切色 */}
      <div
        style={{
          background: palette.cardBg,
          borderRadius: '0 0 22px 22px',
          padding: 24,
          boxShadow: '0 8px 32px rgba(51, 112, 255, 0.10)',
          marginTop: -1,
          border: `1px solid ${palette.cardBorder}`,
          borderTop: 'none',
        }}
      >
        {hint && (
          <div
            style={{
              fontSize: 12,
              color: palette.hintText,
              background: palette.hintBg,
              border: '1px solid rgba(51, 112, 255, 0.15)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 16,
              lineHeight: 1.6,
            }}
          >
            {hint}
          </div>
        )}
        {children}
        {footer && <div style={{ marginTop: 16, textAlign: 'center' }}>{footer}</div>}
        {altLink && (
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: palette.secondary }}>
            {altLink.text} <Link to={altLink.to} style={{ color: '#3370FF' }}>立即{altLink.to === '/login' ? '登录' : '注册'} →</Link>
          </div>
        )}
      </div>

      {tip && (
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
          {tip}
        </div>
      )}
    </div>
  );
}

/**
 * 渐变装饰球（§13.3 公共组件）
 *
 * 用法（在 Hero / 角色入口卡内）：
 *   <div className="dw-hero">
 *     <BlobBg variant="landing" />
 *     <div className="dw-hero__inner">...</div>
 *   </div>
 *
 * 设计原则：
 * - 不喧宾夺主：opacity 0.25-0.35，blur 40-60px
 * - 不引入新色：只用 design.md §1.1-1.4 已定义的蓝/绿/紫
 * - 装饰元素 pointer-events: none，不挡点击
 * - 不带动画（避免 AI 味道；用户没要求 motion）
 */
export interface BlobBgProps {
  /** 内置方案：landing（蓝绿紫 2 球） / hero（仅蓝绿 2 球）/ soft（1 球） */
  variant?: 'landing' | 'hero' | 'soft';
}

export default function BlobBg({ variant = 'landing' }: BlobBgProps) {
  if (variant === 'soft') {
    return <div className="dw-blob dw-blob--1" aria-hidden="true" />;
  }
  if (variant === 'hero') {
    return (
      <>
        <div className="dw-blob dw-blob--1" aria-hidden="true" />
      </>
    );
  }
  return (
    <>
      <div className="dw-blob dw-blob--1" aria-hidden="true" />
      <div className="dw-blob dw-blob--2" aria-hidden="true" />
    </>
  );
}

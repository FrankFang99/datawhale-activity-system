/**
 * 统一空状态（§13.1 公共组件）
 *
 * 用法：
 *   <EmptyState title="暂无活动" description="可以登记兴趣或申请成为组织者" />
 *   <EmptyState title="暂无申请" action={<Button>立即申请</Button>} />
 *
 * 设计原则：
 * - 不喧宾夺主（不放大字号、不加重动画）
 * - 跟 design.md §6.3 配色对齐（蓝主色 + 浅蓝底）
 * - 图标 / 文字 / 操作 三段式
 */
import { ReactNode } from 'react';
import { Empty, Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** 自定义类名（用 .dw-empty 样式） */
  className?: string;
}

export default function EmptyState({
  title = '暂无数据',
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`dw-empty${className ? ` ${className}` : ''}`}>
      <div className="dw-empty__icon">{icon ?? <InboxOutlined />}</div>
      <div className="dw-empty__title">{title}</div>
      {description && <div className="dw-empty__desc">{description}</div>}
      {action && <div>{action}</div>}
    </div>
  );
}

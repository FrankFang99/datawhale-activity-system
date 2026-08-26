/**
 * 统一错误状态（§13.4 公共组件）
 *
 * 用法：
 *   <ErrorState title="加载失败" description="网络异常，请稍后重试" onRetry={load} />
 *
 * 设计原则：
 * - 浅红底（#FEF2F2）+ 红文字（#991B1B），跟 design.md §1.3 错误色对齐
 * - 跟 EmptyState 风格统一（不夸张）
 */
import { ReactNode } from 'react';
import { Button } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export default function ErrorState({
  title = '加载失败',
  description = '请稍后重试，或联系管理员',
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div className="dw-error">
      <ExclamationCircleOutlined style={{ fontSize: 22, color: '#DC2626', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p className="dw-error__title">{title}</p>
        <p className="dw-error__desc">{description}</p>
        {(onRetry || action) && (
          <div style={{ marginTop: 8 }}>
            {action}
            {onRetry && (
              <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                重试
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 统一页面头（§13.2 公共组件）
 *
 * 用法：
 *   <PageHeader title="活动大厅" subtitle="浏览所有可参与的活动" />
 *   <PageHeader title="审批详情" subtitle="5 维评分 + 审计日志" onBack={() => navigate(-1)} action={<Button>通过</Button>} />
 *
 * 设计原则：
 * - 替代散落的 <Title> + <Text> 拼装
 * - 标题用 §2.2 h2（28px / 600），副标题 14px secondary
 * - 返回按钮在 title 上方，弱化处理
 * - 右侧 action 区（按钮组 / Tab）靠右
 */
import { ReactNode } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
  /** 装饰性元素（如角色入口卡的图标） */
  prefix?: ReactNode;
}

export default function PageHeader({ title, subtitle, onBack, action, prefix }: PageHeaderProps) {
  return (
    <div className="dw-page-header">
      <div style={{ flex: 1, minWidth: 0 }}>
        {onBack && (
          <div className="dw-page-header__back" onClick={onBack} role="button">
            <ArrowLeftOutlined /> 返回
          </div>
        )}
        <h1 className="dw-page-header__title">
          {prefix}
          {title}
        </h1>
        {subtitle && <p className="dw-page-header__subtitle">{subtitle}</p>}
      </div>
      {action && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

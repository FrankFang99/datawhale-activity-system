/**
 * 404 / 路由兜底（v1.2 引入）
 *
 * 行业前沿：
 * - 不强引导回首页（用户输入错路径时给他们点"找回去"按钮，而不是偷偷 redirect）
 * - 文案友好 + 视觉匹配 design.md（不用 AntD Result 默认样式）
 * - 列出 4 个常用入口 + 搜索框（让用户快速找到目标）
 */
import { useState } from 'react';
import { Result, Button, Input, Space, Typography } from 'antd';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined, AppstoreOutlined, HistoryOutlined, ScheduleOutlined,
  InboxOutlined, SearchOutlined,
} from '@ant-design/icons';
import { authStore } from '../store/auth';
import { themeStore } from '../store/theme';

const { Text } = Typography;

const QUICK_LINKS = [
  { to: '/', icon: <HomeOutlined />, label: '活动大厅' },
  { to: '/my-applications', icon: <HistoryOutlined />, label: '我的申请', roles: ['ORGANIZER', 'ASSISTANT'] },
  { to: '/my-registrations', icon: <ScheduleOutlined />, label: '我的报名', roles: ['PARTICIPANT'] },
  { to: '/admin/approvals', icon: <AppstoreOutlined />, label: '审批工作台', roles: ['ADMIN', 'OPERATOR'] },
  { to: '/volunteer/workbench', icon: <InboxOutlined />, label: '我对接的申请', roles: ['VOLUNTEER'] },
  { to: '/inbox', icon: <InboxOutlined />, label: '站内消息' },
];

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authStore((s) => s.user);
  const isDark = themeStore((s) => s.mode) === 'dark';
  const [keyword, setKeyword] = useState('');

  const availableLinks = QUICK_LINKS.filter(
    (l) => !l.roles || (user && l.roles.includes(user.role))
  );

  // 暗色色板（v1.2）
  const pal = isDark
    ? { cardBg: '#1E293B', cardBorder: '#334155', title: '#F1F5F9', desc: '#94A3B8', hover: '#283548' }
    : { cardBg: '#fff', cardBorder: '#E8ECF1', title: '#1A1A2E', desc: '#6B7280', hover: '#F8FAFF' };

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          letterSpacing: '-0.04em',
          background: 'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        404
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', color: pal.title }}>
        这页不在地球表面
      </h2>
      <Text type="secondary" style={{ fontSize: 14, marginBottom: 24, maxWidth: 480, color: pal.desc }}>
        路径 <Text code>{location.pathname}</Text> 不存在。可能链接已过期，或者输错了地址。
      </Text>

      {/* 搜索框（行业前沿：404 给用户出路）*/}
      <div style={{ maxWidth: 360, width: '100%', marginBottom: 24 }}>
        <Input
          size="large"
          placeholder="搜索活动 / 申请 / 通知..."
          prefix={<SearchOutlined style={{ color: isDark ? '#64748B' : '#9CA3AF' }} />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => {
            if (keyword.trim()) navigate(`/?keyword=${encodeURIComponent(keyword.trim())}`);
          }}
          allowClear
        />
      </div>

      <Space wrap style={{ marginBottom: 24 }}>
        <Button type="primary" size="large" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          回到活动大厅
        </Button>
        <Button size="large" onClick={() => navigate(-1)}>
          返回上一页
        </Button>
      </Space>

      <div style={{ width: '100%', maxWidth: 480 }}>
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
          常用入口
        </Text>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          {availableLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: pal.cardBg,
                border: `1px solid ${pal.cardBorder}`,
                borderRadius: 10,
                color: pal.title,
                textDecoration: 'none',
                fontSize: 13,
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3370FF';
                e.currentTarget.style.color = '#3370FF';
                e.currentTarget.style.background = pal.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = pal.cardBorder;
                e.currentTarget.style.color = pal.title;
                e.currentTarget.style.background = pal.cardBg;
              }}
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

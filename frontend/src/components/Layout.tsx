import { Layout, Menu, Avatar, Dropdown, Space, Tag, Badge } from 'antd';
import { UserOutlined, LogoutOutlined, HistoryOutlined, DashboardOutlined, AuditOutlined, TeamOutlined, ScheduleOutlined, AccountBookOutlined, ThunderboltOutlined, AppstoreOutlined, BellOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { authStore, Role } from '../store/auth';
import { messageApi } from '../services/api';
import AIAssistant from './AIAssistant';

const { Header, Content, Footer } = Layout;

// 角色配置：色 tag + 图标
const ROLE_CONFIG: Record<Role, { color: string; label: string }> = {
  ADMIN:       { color: 'red',    label: '管理员' },
  OPERATOR:    { color: 'orange', label: '运营' },
  VOLUNTEER:   { color: 'blue',   label: '志愿者' },
  ORGANIZER:   { color: 'green',  label: '组织者' },
  PARTICIPANT: { color: 'cyan',   label: '参与者' },
  ASSISTANT:   { color: 'purple', label: '助教' },
};

// 5 角色菜单配置（PRD §2.2 权限矩阵）
function getMenuByRole(role: Role | undefined) {
  if (!role) {
    return [
      { key: '/', label: <Link to="/">活动大厅</Link> },
    ];
  }
  const base = [{ key: '/', label: <Link to="/">活动大厅</Link> }];

  switch (role) {
    case 'ADMIN':
      return [
        ...base,
        { key: '/admin/dashboard', icon: <DashboardOutlined />, label: <Link to="/admin/dashboard">数据看板</Link> },
        { key: '/admin/approvals', icon: <AuditOutlined />, label: <Link to="/admin/approvals">审批工作台</Link> },
        { key: '/admin/activities', icon: <AppstoreOutlined />, label: <Link to="/admin/activities">活动管理</Link> },
        { key: '/reimbursements', icon: <AccountBookOutlined />, label: <Link to="/reimbursements">报销中心</Link> },
      ];
    case 'OPERATOR':
      return [
        ...base,
        { key: '/admin/approvals', icon: <AuditOutlined />, label: <Link to="/admin/approvals">审批工作台</Link> },
        { key: '/admin/activities', icon: <AppstoreOutlined />, label: <Link to="/admin/activities">活动管理</Link> },
        { key: '/reimbursements', icon: <AccountBookOutlined />, label: <Link to="/reimbursements">报销中心</Link> },
      ];
    case 'VOLUNTEER':
      return [
        ...base,
        { key: '/volunteer/workbench', icon: <TeamOutlined />, label: <Link to="/volunteer/workbench">我对接的申请</Link> },
      ];
    case 'ORGANIZER':
      return [
        ...base,
        { key: '/my-applications', icon: <HistoryOutlined />, label: <Link to="/my-applications">我的申请</Link> },
        { key: '/reimbursements', icon: <AccountBookOutlined />, label: <Link to="/reimbursements">报销中心</Link> },
      ];
    case 'PARTICIPANT':
      return [
        ...base,
        { key: '/my-registrations', icon: <ScheduleOutlined />, label: <Link to="/my-registrations">我的报名</Link> },
      ];
    case 'ASSISTANT':
      return [
        ...base,
        { key: '/my-applications', icon: <HistoryOutlined />, label: <Link to="/my-applications">我的申请</Link> },
      ];
    default:
      return base;
  }
}

// 5 角色用户下拉菜单
function getUserMenu(role: Role | undefined, navigate: (path: string) => void) {
  const items: any[] = [
    // Frank 2026-08-23 09:17 Comment 6：改名为「回到活动大厅」（消除"工作台"歧义）
    { key: 'home', icon: <ThunderboltOutlined />, label: '回到活动大厅', onClick: () => navigate('/') },
    { key: 'profile', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/profile') },
  ];
  if (role === 'ORGANIZER' || role === 'ASSISTANT') {
    items.push({ key: 'mine', icon: <HistoryOutlined />, label: '我的申请', onClick: () => navigate('/my-applications') });
  }
  if (role === 'PARTICIPANT') {
    items.push({ key: 'mine-reg', icon: <ScheduleOutlined />, label: '我的报名', onClick: () => navigate('/my-registrations') });
  }
  if (role === 'ADMIN' || role === 'OPERATOR') {
    items.push({ key: 'approvals', icon: <AuditOutlined />, label: '审批工作台', onClick: () => navigate('/admin/approvals') });
  }
  if (role === 'VOLUNTEER') {
    items.push({ key: 'workbench', icon: <TeamOutlined />, label: '我对接的申请', onClick: () => navigate('/volunteer/workbench') });
  }
  items.push(
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { authStore.getState().clearAuth(); navigate('/'); } }
  );
  return { items };
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = authStore();
  const [unreadCount, setUnreadCount] = useState(0);

  // v7: 轮询未读数（每 30s 拉一次，简单起见）
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await messageApi.unreadCount();
        if (!cancelled) setUnreadCount(r.count);
      } catch { /* */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user, location.pathname]);  // 路由变化时也刷新

  const isAuthPage = ['/login', '/register'].some((p) => location.pathname.endsWith(p));
  const menuItems = getMenuByRole(user?.role);
  const userMenu = getUserMenu(user?.role, navigate);
  const roleConfig = user ? ROLE_CONFIG[user.role] : null;

  return (
    <Layout style={{ minHeight: '100vh', background: '#F5F8FF' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            D
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1A1A2E' }}>Datawhale</span>
          <span style={{ fontSize: 14, color: '#6B7280' }}>高校活动</span>
        </Link>

        <Menu
          mode="horizontal"
          items={menuItems}
          selectedKeys={[location.pathname]}
          style={{ flex: 1, justifyContent: 'center', borderBottom: 'none', background: 'transparent' }}
        />

        <div>
          {user ? (
            <Space size="small">
              {roleConfig && <Tag color={roleConfig.color}>{roleConfig.label}</Tag>}
              {/* v7: 通知中心 Bell icon（带未读 Badge） */}
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <BellOutlined
                  style={{ fontSize: 18, color: '#1A1A2E', cursor: 'pointer', padding: 4 }}
                  onClick={() => navigate('/inbox')}
                />
              </Badge>
              <Dropdown menu={userMenu} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#3370FF' }} />
                  <span style={{ color: '#1A1A2E' }}>{user.name}</span>
                </Space>
              </Dropdown>
            </Space>
          ) : isAuthPage ? null : (
            <Space>
              <Link to="/login" style={{ color: '#3370FF' }}>登录</Link>
              <Link to="/register" style={{ color: '#3370FF' }}>注册</Link>
            </Space>
          )}
        </div>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center', background: 'transparent', color: '#9CA3AF' }}>
        Datawhale 高校活动智能管理系统 · v1.0.0
      </Footer>

      {user && <AIAssistant />}
    </Layout>
  );
}

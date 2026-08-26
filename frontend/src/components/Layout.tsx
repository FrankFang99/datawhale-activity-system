import { Layout, Menu, Avatar, Dropdown, Space, Badge } from 'antd';
import { UserOutlined, LogoutOutlined, HistoryOutlined, DashboardOutlined, AuditOutlined, TeamOutlined, ScheduleOutlined, AccountBookOutlined, ThunderboltOutlined, AppstoreOutlined, BellOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { authStore, Role } from '../store/auth';
import { messageApi } from '../services/api';
import { rolePalette, roleLabel } from '../styles/tokens';
import AIAssistant from './AIAssistant';
import ThemeToggle from './ThemeToggle';

const { Header, Content, Footer } = Layout;

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
  // v1.2 性能优化：5s 客户端缓存，避免路由切换时重复拉飞书（飞书单次 1-1.5s）
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    let cancelled = false;
    let lastFetchAt = 0;
    let cachedCount = 0;
    const CACHE_TTL_MS = 5000;
    const load = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetchAt < CACHE_TTL_MS) {
        setUnreadCount(cachedCount);
        return;
      }
      try {
        const r = await messageApi.unreadCount();
        if (!cancelled) {
          cachedCount = r.count;
          lastFetchAt = Date.now();
          setUnreadCount(cachedCount);
        }
      } catch { /* */ }
    };
    load(true);  // 首次强制拉
    const t = setInterval(() => load(true), 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);  // 路由变化时复用缓存，不重新拉

  const isAuthPage = ['/login', '/register'].some((p) => location.pathname.endsWith(p));
  const menuItems = getMenuByRole(user?.role);
  const userMenu = getUserMenu(user?.role, navigate);
  const roleKey = user ? rolePalette[user.role] : null;
  const roleText = user ? roleLabel[user.role] : null;

  return (
    <Layout className="dw-layout-root">
      <Header className="dw-header">
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
          <span className="dw-header__brand">Datawhale</span>
          <span className="dw-header__brand-sub">高校活动</span>
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
              {roleKey && roleText && (
                <span className={`dw-tag dw-tag-${roleKey}`}>{roleText}</span>
              )}
              {/* v1.2: 主题切换按钮（暗色模式） */}
              <ThemeToggle />
              {/* v7: 通知中心 Bell icon（带未读 Badge） */}
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <BellOutlined
                  className="dw-header__icon"
                  style={{ fontSize: 18, cursor: 'pointer', padding: 4 }}
                  onClick={() => navigate('/inbox')}
                />
              </Badge>
              <Dropdown menu={userMenu} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#3370FF' }} />
                  <span className="dw-header__user-name">{user.name}</span>
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

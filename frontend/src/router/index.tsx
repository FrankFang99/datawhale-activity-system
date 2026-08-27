/**
 * 路由表（基于 react-router-dom v6）
 * basename 用 import.meta.env.BASE_URL，自动用 vite.config.ts 的 base 配置
 * → 部署到 datawhale.cn/activity/ 子路径时自动生效
 *
 * 5 角色路由守卫（PRD §2.2）：
 * - /admin/*       → ADMIN / OPERATOR
 * - /my-applications  → ORGANIZER / ASSISTANT
 * - /volunteer/*   → VOLUNTEER
 * - /my-registrations  → PARTICIPANT
 * - /reimbursements    → ADMIN / OPERATOR / ORGANIZER
 */
import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Result, Button, Spin } from 'antd';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ActivityList from '../pages/ActivityList';
import ActivityDetail from '../pages/ActivityDetail';
import ApplicationForm from '../pages/ApplicationForm';
import ApplicationReview from '../pages/ApplicationReview';
import MyApplications from '../pages/MyApplications';
import ApprovalWorkbench from '../pages/admin/ApprovalWorkbench';
import AdminDashboard from '../pages/admin/Dashboard';
import ActivityManager from '../pages/admin/ActivityManager';
import StageBoard from '../pages/stages/StageBoard';
import ReimbursementCenter from '../pages/reimbursements/ReimbursementCenter';
import VolunteerWorkbench from '../pages/volunteer/Workbench';
import MyRegistrations from '../pages/participant/MyRegistrations';
import Profile from '../pages/user/Profile';
import Inbox from '../pages/message/Inbox';
import NotifLog from '../pages/admin/NotifLog';
import Materials from '../pages/admin/Materials';
import NotFound from '../pages/NotFound';
import { authStore, Role } from '../store/auth';

// 同步从 localStorage 读 auth 状态（避免 zustand persist hydration race）
function readAuth() {
  try {
    const raw = localStorage.getItem('datawhale-auth');
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw);
    return { token: parsed?.state?.token ?? null, user: parsed?.state?.user ?? null };
  } catch {
    return { token: null, user: null };
  }
}

function Protected({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState(readAuth());
  useEffect(() => {
    return authStore.subscribe((s) => setAuth({ token: s.token, user: s.user }));
  }, []);
  if (!auth.token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGuard({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const [auth, setAuth] = useState(readAuth());
  useEffect(() => {
    return authStore.subscribe((s) => setAuth({ token: s.token, user: s.user }));
  }, []);
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!allow.includes(auth.user.role)) {
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
            background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          403
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', color: '#1A1A2E' }}>
          当前角色无访问权限
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', maxWidth: 480 }}>
          该页面仅限 <strong style={{ color: '#1A1A2E' }}>{allow.join(' / ')}</strong> 角色访问；
          您当前是 <strong style={{ color: '#1A1A2E' }}>{auth.user.role}</strong>。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/">
            <Button type="primary" size="large">回到活动大厅</Button>
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <ActivityList /> },
        { path: 'login', element: <Login /> },
        { path: 'register', element: <Register /> },
        { path: 'activities/:id', element: <ActivityDetail /> },
        {
          path: 'apply/:activityId',
          element: (
            <Protected>
              {/* Frank 27 11:20 Comment 3：参与者或普通用户都应该能申请，不限角色（后端 findDuplicateApplication 防重复） */}
              <ApplicationForm />
            </Protected>
          ),
        },
        {
          path: 'my-applications',
          element: (
            <Protected>
              {/* Frank 27 15:37：所有已登录用户都能看自己的申请（不限角色）—— 申请提交后立即能看进度 */}
              <MyApplications />
            </Protected>
          ),
        },
        {
          path: 'my-registrations',
          element: (
            <Protected>
              <RoleGuard allow={['PARTICIPANT']}>
                <MyRegistrations />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'admin/dashboard',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR']}>
                <AdminDashboard />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'admin/approvals',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR']}>
                <ApprovalWorkbench />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'profile',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR', 'VOLUNTEER', 'ORGANIZER', 'PARTICIPANT', 'ASSISTANT']}>
                <Profile />
              </RoleGuard>
            </Protected>
          ),
        },        {
          path: 'inbox',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR', 'VOLUNTEER', 'ORGANIZER', 'PARTICIPANT', 'ASSISTANT']}>
                <Inbox />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'admin/activities',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR']}>
                <ActivityManager />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'admin/notif-log',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR']}>
                <NotifLog />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'admin/materials',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR']}>
                <Materials />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'volunteer/workbench',
          element: (
            <Protected>
              <RoleGuard allow={['VOLUNTEER']}>
                <VolunteerWorkbench />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          path: 'applications/:id/tasks',
          element: (
            <Protected>
              <RoleGuard allow={['ORGANIZER', 'VOLUNTEER', 'ADMIN', 'OPERATOR', 'ASSISTANT']}>
                <StageBoard />
              </RoleGuard>
            </Protected>
          ),
        },
        {
          // v12 申请详情页：所有登录角色可看（Frank 09:17 反馈）
          // 申请者看自己提交 / 志愿者看自己对接 / 运营/管理员看全部
          path: 'applications/:id',
          element: (
            <Protected>
              <ApplicationReview />
            </Protected>
          ),
        },
        {
          path: 'reimbursements',
          element: (
            <Protected>
              <RoleGuard allow={['ADMIN', 'OPERATOR', 'ORGANIZER']}>
                <ReimbursementCenter />
              </RoleGuard>
            </Protected>
          ),
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);

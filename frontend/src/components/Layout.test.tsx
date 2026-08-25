/**
 * Layout 菜单单测（v7 · TDD）
 * 验证 5 角色登录后顶部菜单不同（PRD §2.2 权限矩阵）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './Layout';
import { authStore } from '../store/auth';
import { Role } from '../store/auth';

function renderLayout(initialPath: string = '/', role?: Role) {
  if (role) {
    act(() => {
      authStore.getState().setAuth('jwt-test', {
        userId: 'U',
        email: 'a@b.cn',
        name: `${role}测试`,
        role,
      });
    });
  }
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppLayout />
    </MemoryRouter>
  );
}

describe('Layout · 5 角色菜单', () => {
  beforeEach(() => {
    authStore.setState({ token: null, user: null });
    localStorage.clear();
  });

  it('未登录：只显示"活动大厅"', () => {
    renderLayout('/');
    expect(screen.getByText('活动大厅')).toBeInTheDocument();
    expect(screen.queryByText('数据看板')).not.toBeInTheDocument();
    expect(screen.queryByText('审批工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('我对接的申请')).not.toBeInTheDocument();
    expect(screen.queryByText('我的报名')).not.toBeInTheDocument();
  });

  it('ADMIN：活动大厅 / 数据看板 / 审批工作台 / 活动管理 / 报销中心（5 项）', () => {
    renderLayout('/', 'ADMIN');
    expect(screen.getByText('活动大厅')).toBeInTheDocument();
    expect(screen.getByText('数据看板')).toBeInTheDocument();
    expect(screen.getByText('审批工作台')).toBeInTheDocument();
    expect(screen.getByText('活动管理')).toBeInTheDocument();
    expect(screen.getByText('报销中心')).toBeInTheDocument();
  });

  it('OPERATOR：活动大厅 / 审批工作台 / 活动管理 / 报销中心（4 项，无数据看板）', () => {
    renderLayout('/', 'OPERATOR');
    expect(screen.getByText('活动大厅')).toBeInTheDocument();
    expect(screen.getByText('审批工作台')).toBeInTheDocument();
    expect(screen.getByText('活动管理')).toBeInTheDocument();
    expect(screen.getByText('报销中心')).toBeInTheDocument();
    expect(screen.queryByText('数据看板')).not.toBeInTheDocument();
  });

  it('VOLUNTEER：活动大厅 / 我对接的申请（2 项，无审批/报销）', () => {
    renderLayout('/', 'VOLUNTEER');
    expect(screen.getByText('活动大厅')).toBeInTheDocument();
    expect(screen.getByText('我对接的申请')).toBeInTheDocument();
    expect(screen.queryByText('审批工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('报销中心')).not.toBeInTheDocument();
  });

  it('ORGANIZER：活动大厅 / 我的申请 / 报销中心（3 项，无审批）', () => {
    renderLayout('/', 'ORGANIZER');
    expect(screen.getByText('活动大厅')).toBeInTheDocument();
    expect(screen.getByText('我的申请')).toBeInTheDocument();
    expect(screen.getByText('报销中心')).toBeInTheDocument();
    expect(screen.queryByText('审批工作台')).not.toBeInTheDocument();
  });

  it('PARTICIPANT：活动大厅 / 我的报名（2 项，无组织者菜单）', () => {
    renderLayout('/', 'PARTICIPANT');
    expect(screen.getByText('活动大厅')).toBeInTheDocument();
    expect(screen.getByText('我的报名')).toBeInTheDocument();
    expect(screen.queryByText('我的申请')).not.toBeInTheDocument();
    expect(screen.queryByText('审批工作台')).not.toBeInTheDocument();
  });

  it('角色 tag 颜色：ADMIN 红色', () => {
    renderLayout('/', 'ADMIN');
    expect(screen.getByText('管理员')).toBeInTheDocument();
  });

  it('角色 tag 颜色：PARTICIPANT 青色', () => {
    renderLayout('/', 'PARTICIPANT');
    expect(screen.getByText('参与者')).toBeInTheDocument();
  });
});

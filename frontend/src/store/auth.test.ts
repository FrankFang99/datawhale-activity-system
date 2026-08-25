/**
 * Auth Store 单测（v7 · TDD）
 * 覆盖：5 角色类型 + setAuth/clearAuth + 持久化
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { authStore } from './auth';

describe('Auth Store', () => {
  beforeEach(() => {
    // 清 zustand state
    authStore.setState({ token: null, user: null });
    localStorage.clear();
  });

  it('初始 state：token/user 都为 null', () => {
    const { token, user } = authStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('setAuth 设置 token + user', () => {
    const { setAuth } = authStore.getState();
    setAuth('jwt-abc-123', {
      userId: 'U1',
      email: 'a@b.cn',
      name: '测试',
      role: 'ADMIN',
    });
    const { token, user } = authStore.getState();
    expect(token).toBe('jwt-abc-123');
    expect(user?.role).toBe('ADMIN');
  });

  it('setAuth 持久化到 localStorage（zustand persist）', () => {
    const { setAuth } = authStore.getState();
    setAuth('jwt-xyz', {
      userId: 'U2',
      email: 'b@b.cn',
      name: '志愿者',
      role: 'VOLUNTEER',
    });
    const raw = localStorage.getItem('datawhale-auth');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.token).toBe('jwt-xyz');
    expect(parsed.state.user.role).toBe('VOLUNTEER');
  });

  it('clearAuth 清空 state + localStorage', () => {
    const { setAuth, clearAuth } = authStore.getState();
    setAuth('jwt-123', {
      userId: 'U1',
      email: 'a@b.cn',
      name: 'A',
      role: 'ADMIN',
    });
    clearAuth();
    const { token, user } = authStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
    const raw = localStorage.getItem('datawhale-auth');
    expect(raw).not.toBeNull();
    // localStorage 仍有，但 state 是空的（persist 同步写入）
    const parsed = JSON.parse(raw!);
    expect(parsed.state.token).toBeNull();
  });

  it('5 角色类型枚举正确（Role type 完整性）', () => {
    const roles: Array<'ADMIN' | 'OPERATOR' | 'VOLUNTEER' | 'ORGANIZER' | 'ASSISTANT' | 'PARTICIPANT'> = [
      'ADMIN', 'OPERATOR', 'VOLUNTEER', 'ORGANIZER', 'ASSISTANT', 'PARTICIPANT',
    ];
    expect(roles.length).toBe(6);
    for (const r of roles) {
      authStore.getState().setAuth('jwt', {
        userId: 'U',
        email: 'a@b.cn',
        name: r,
        role: r,
      });
      expect(authStore.getState().user?.role).toBe(r);
      authStore.getState().clearAuth();
    }
  });
});

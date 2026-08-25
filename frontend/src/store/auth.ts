/**
 * Auth 状态管理（zustand）
 * token 持久化到 localStorage
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'ADMIN' | 'OPERATOR' | 'VOLUNTEER' | 'ORGANIZER' | 'ASSISTANT' | 'PARTICIPANT';

export interface User {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const authStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'datawhale-auth' }
  )
);

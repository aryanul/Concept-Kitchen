import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'FINANCE';

export type AuthUser = {
  id: string;
  /** Display name. Null on accounts created before names existed. */
  name?: string | null;
  email: string;
  role: Role;
  employeeId: string | null;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'ck-nest-auth' }
  )
);

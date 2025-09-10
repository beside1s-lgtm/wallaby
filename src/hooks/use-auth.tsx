'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Student } from '@/lib/types';
import { initializeData } from '@/lib/store';

type User = Student | { name: string };
type Role = 'teacher' | 'student' | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  login: (role: 'teacher' | 'student', userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      initializeData();
      const storedRole = localStorage.getItem('userRole') as Role;
      if (storedRole) {
        let storedUser: User | null = null;
        if (storedRole === 'teacher') {
          storedUser = { name: '교사' };
        } else if (storedRole === 'student') {
          const studentInfo = localStorage.getItem('loggedInStudent');
          if (studentInfo) {
            storedUser = JSON.parse(studentInfo);
          }
        }

        if (storedUser) {
          setUser(storedUser);
          setRole(storedRole);
        } else {
          // Data inconsistency, clear auth state
          localStorage.removeItem('userRole');
          localStorage.removeItem('loggedInStudent');
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname === '/';
    if (!role && !isAuthPage) {
      router.push('/');
    }
    if (role === 'teacher' && !pathname.startsWith('/teacher')) {
        router.push('/teacher/dashboard');
    }
    if (role === 'student' && !pathname.startsWith('/student')) {
        router.push('/student/dashboard');
    }

  }, [role, pathname, router, isLoading]);

  const login = useCallback((role: 'teacher' | 'student', userData: User) => {
    localStorage.setItem('userRole', role);
    if (role === 'student') {
      localStorage.setItem('loggedInStudent', JSON.stringify(userData));
    }
    setUser(userData);
    setRole(role);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('loggedInStudent');
    localStorage.removeItem('welcomeShown');
    setUser(null);
    setRole(null);
    router.push('/');
  }, [router]);

  const value = {
    user,
    role,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

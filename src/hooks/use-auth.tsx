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

type User = (Student & { school: string }) | { name: string; school: string };
type Role = 'teacher' | 'student' | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  school: string | null;
  login: (role: 'teacher' | 'student', userData: User, school: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedRole = localStorage.getItem('userRole') as Role;
      const storedSchool = localStorage.getItem('userSchool');

      if (storedRole && storedSchool) {
        let storedUser: User | null = null;
        if (storedRole === 'teacher') {
          storedUser = { name: '교사', school: storedSchool };
        } else if (storedRole === 'student') {
          const studentInfo = localStorage.getItem('loggedInStudent');
          if (studentInfo) {
            storedUser = JSON.parse(studentInfo);
          }
        }

        if (storedUser) {
          setUser(storedUser);
          setRole(storedRole);
          setSchool(storedSchool);
        } else {
          // Data inconsistency, clear auth state
          localStorage.removeItem('userRole');
          localStorage.removeItem('loggedInStudent');
          localStorage.removeItem('userSchool');
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

    const isAuthPage = pathname === '/' || pathname === '/student-login';
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

  const login = useCallback((role: 'teacher' | 'student', userData: User, school: string) => {
    localStorage.setItem('userRole', role);
    localStorage.setItem('userSchool', school);
    if (role === 'student') {
      localStorage.setItem('loggedInStudent', JSON.stringify(userData));
    }
    setUser(userData);
    setRole(role);
    setSchool(school);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('loggedInStudent');
    localStorage.removeItem('userSchool');
    sessionStorage.removeItem('welcomeShown');
    setUser(null);
    setRole(null);
    setSchool(null);
    router.push('/');
  }, [router]);

  const value = {
    user,
    role,
    school,
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

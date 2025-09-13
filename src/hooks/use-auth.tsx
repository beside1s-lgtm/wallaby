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
    
    // User is logged in, but on an auth page, redirect them away
    if (role && isAuthPage) {
        if (role === 'teacher') {
            router.replace('/teacher/dashboard');
        } else if (role === 'student') {
            router.replace('/student/dashboard');
        }
        return;
    }
    
    // User is logged out, but not on an auth page, redirect them
    if (!role && !isAuthPage) {
        // A simple redirect to the main login page is sufficient
        router.replace('/');
        return;
    }

    // Additional checks for logged-in users on wrong dashboards
    if (role === 'teacher' && pathname.startsWith('/student')) {
      router.replace('/teacher/dashboard');
    }
    if (role === 'student' && pathname.startsWith('/teacher')) {
      router.replace('/student/dashboard');
    }

  }, [role, pathname, router, isLoading]);


  const login = useCallback((role: 'teacher' | 'student', userData: User, school: string) => {
    localStorage.setItem('userRole', role);
    localStorage.setItem('userSchool', school);
    if (role === 'student') {
      localStorage.setItem('loggedInStudent', JSON.stringify(userData));
    }
    setRole(role);
    setSchool(school);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    const currentRole = localStorage.getItem('userRole');
    localStorage.removeItem('userRole');
    localStorage.removeItem('loggedInStudent');
    localStorage.removeItem('userSchool');
    sessionStorage.removeItem('welcomeShown');
    
    setRole(null);
    setSchool(null);
    setUser(null);
    
    // Use window.location.href for a full page reload to avoid client-side routing issues.
    if (currentRole === 'student') {
      window.location.href = '/student-login';
    } else {
      window.location.href = '/';
    }
  }, []);

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

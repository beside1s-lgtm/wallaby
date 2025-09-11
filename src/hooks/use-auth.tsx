'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
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
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    previousPathnameRef.current = pathname;
  }, [pathname]);

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
    
    // User is logged out
    if (!role) {
        // And not on an auth page, redirect to appropriate login
        if (!isAuthPage) {
            if (previousPathnameRef.current?.startsWith('/student')) {
                router.replace('/student-login');
            } else {
                router.replace('/');
            }
        }
    } 
    // User is logged in
    else {
        if (role === 'teacher' && !pathname.startsWith('/teacher')) {
            router.replace('/teacher/dashboard');
        }
        if (role === 'student' && !pathname.startsWith('/student')) {
            router.replace('/student/dashboard');
        }
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
    localStorage.removeItem('userRole');
    localStorage.removeItem('loggedInStudent');
    localStorage.removeItem('userSchool');
    sessionStorage.removeItem('welcomeShown');
    
    setRole(null);
    setSchool(null);
    setUser(null);
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

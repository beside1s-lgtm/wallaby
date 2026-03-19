
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
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

type User = (Student & { school: string }) | { name: string; school: string };
type Role = 'teacher' | 'student' | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  school: string | null;
  login: (role: 'teacher' | 'student', userData: Omit<User, 'school'> & { school: string }) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth) {
        setIsLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // 사파리 개인정보 보호 모드 등에서 localStorage 접근 에러를 방지합니다.
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
            }
          }
        } catch (error) {
          console.warn('Failed to access localStorage (Safari compatibility):', error);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return; 

    const isAuthPage = pathname === '/' || pathname === '/student-login';
    
    if (role && isAuthPage) {
        if (role === 'teacher') {
            router.replace('/teacher/dashboard');
        } else if (role === 'student') {
            router.replace('/student/dashboard');
        }
        return;
    }
    
    if (!role && !isAuthPage && !pathname.startsWith('/admin')) {
        router.replace('/');
        return;
    }

    if (role === 'teacher' && pathname.startsWith('/student')) {
      router.replace('/teacher/dashboard');
    }
    if (role === 'student' && pathname.startsWith('/teacher')) {
      router.replace('/student/dashboard');
    }

  }, [role, pathname, router, isLoading]);


  const login = useCallback((role: 'teacher' | 'student', userData: Omit<User, 'school'> & { school: string }) => {
    try {
        localStorage.setItem('userRole', role);
        localStorage.setItem('userSchool', userData.school);
        if (role === 'student') {
          localStorage.setItem('loggedInStudent', JSON.stringify(userData));
        }
    } catch (e) {
        console.warn("Storage write failed (Safari Private Mode):", e);
    }
    setRole(role);
    setSchool(userData.school);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    const currentRole = localStorage.getItem('userRole');
    try {
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInStudent');
        localStorage.removeItem('userSchool');
        sessionStorage.removeItem('welcomeShown');
    } catch (e) {}
    
    setRole(null);
    setSchool(null);
    setUser(null);
    
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
    isAuthenticated: !!user && !!firebaseUser,
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

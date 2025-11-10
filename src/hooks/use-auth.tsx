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
  const [role, setRole] = useState<Role>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
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
              setRole(null);
              setSchool(null);
              setUser(null);
            }
          }
        } catch (error) {
          console.error('Failed to initialize auth state from storage:', error);
          // Clear potentially corrupted storage
           localStorage.removeItem('userRole');
           localStorage.removeItem('loggedInStudent');
           localStorage.removeItem('userSchool');
           setRole(null);
           setSchool(null);
           setUser(null);
        }
      } else {
        // No firebase user, ensure local state is cleared
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInStudent');
        localStorage.removeItem('userSchool');
        setRole(null);
        setSchool(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return; // Do not perform any routing logic while auth state is loading

    const isAuthPage = pathname === '/' || pathname === '/student-login' || pathname === '/teacher/register';
    
    if (role && isAuthPage) {
        if (role === 'teacher') {
            router.replace('/teacher/dashboard');
        } else if (role === 'student') {
            router.replace('/student/dashboard');
        }
        return;
    }
    
    if (!role && !isAuthPage) {
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
    localStorage.setItem('userRole', role);
    localStorage.setItem('userSchool', userData.school);
    if (role === 'student') {
      localStorage.setItem('loggedInStudent', JSON.stringify(userData));
    }
    setRole(role);
    setSchool(userData.school);
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
    
    // Using window.location.href ensures a full page reload, clearing all state.
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

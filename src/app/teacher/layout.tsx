'use client';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role !== 'teacher') {
      router.replace('/');
    }
  }, [role, isLoading, router]);

  if (isLoading || role !== 'teacher') {
    return (
        <div className="flex flex-col h-screen">
            <Skeleton className="h-16 w-full" />
            <div className="flex-1 p-6 space-y-4">
                <Skeleton className="h-10 w-1/4" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-transparent">
      <DashboardHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}

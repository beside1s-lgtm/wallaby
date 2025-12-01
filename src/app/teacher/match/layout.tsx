'use client';
import { DashboardHeader } from '@/components/DashboardHeader';

export default function MatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
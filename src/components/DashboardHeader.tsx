'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut, Rocket, UserCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTheme } from 'next-themes';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2">
        <Rocket className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-bold text-primary font-headline">체육 성장 기록 시스템</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
            <Label htmlFor="theme-switch">
                {theme === 'dark' ? '다크 모드' : '라이트 모드'}
            </Label>
            <Switch
                id="theme-switch"
                checked={theme === 'dark'}
                onCheckedChange={handleThemeChange}
            />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserCircle className="h-5 w-5" />
          <span>{user?.name}님</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </header>
  );
}

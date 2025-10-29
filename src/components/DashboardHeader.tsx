"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Rocket, UserCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";

export function DashboardHeaderContents() {
  const { school } = useAuth();
  return (
    <h1 className="text-2xl md:text-3xl font-bold mb-6 text-primary font-headline">
      {school} 교사 대시보드
    </h1>
  );
}

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/80 px-2 sm:px-6 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Rocket className="h-6 w-6 text-primary" />
        <h1 className="hidden sm:block text-lg font-bold text-primary font-headline">
          체육 성장 기록 시스템
        </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center space-x-2">
          <Label htmlFor="theme-switch" className="hidden sm:inline">
            {theme === "dark" ? "다크 모드" : "라이트 모드"}
          </Label>
          <Switch
            id="theme-switch"
            checked={theme === "dark"}
            onCheckedChange={handleThemeChange}
          />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserCircle className="h-5 w-5" />
          <span className="hidden md:inline">
            {user?.school} {user?.name}님
          </span>
          <span className="md:hidden">{user?.name}님</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="px-2">
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    </header>
  );
}

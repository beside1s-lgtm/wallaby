
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getStudents, getItems, getRecords, getTeamGroups, getSportsClubs } from "@/lib/store";
import type { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentManagement } from "./_components/student-management/StudentManagement";
import { DatabaseManagement } from "./_components/student-management/DatabaseManagement";
import MeasurementManagement from "./_components/measurement-management/MeasurementManagement";
import ClassAnalytics from "./_components/class-analytics/ClassAnalytics";
import RecordBrowser from "./_components/RecordBrowser";
import Ranking from "./_components/Ranking";
import RecordInput from "./_components/record-input/RecordInput";
import AiWelcome from "./_components/AiWelcome";
import TournamentManagement from "./_components/TournamentManagement";
import TeamBalancer from "./_components/TeamBalancer";
import SportsClubManagement from "./_components/SportsClubManagement";
import TheoryExamManagement from "./_components/TheoryExamManagement";
import {
  LineChart,
  BookOpen,
  Swords,
  Database,
  Bot,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function TeacherDashboardPage() {
  const { school, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<{
    students: Student[];
    items: MeasurementItem[];
    records: MeasurementRecord[];
    teams: TeamGroup[];
    clubs: SportsClub[];
  }>({ students: [], items: [], records: [], teams: [], clubs: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("measurement");

  const load = useCallback(async (silent = false) => {
    if (!school) return;
    if (!silent) setIsLoading(true);
    try {
      const [students, items, records, teams, clubs] = await Promise.all([
        getStudents(school), getItems(school), getRecords(school), getTeamGroups(school), getSportsClubs(school)
      ]);
      setData({ students, items, records, teams, clubs });
    } finally { setIsLoading(false); }
  }, [school]);

  useEffect(() => { load(); }, [load]);

  // URL 탭 파라미터 처리
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  if (isLoading || isAuthLoading) return (
    <div className="container mx-auto p-4 space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-6 pb-20">
      <DashboardHeader />
      
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Bot className="h-5 w-5" />
            AI 스마트 브리핑
          </CardTitle>
          <CardDescription>우리 학교 학생들의 체력 및 스포츠 활동 데이터를 AI가 분석합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <AiWelcome 
            title="학교 전체 분석 리포트 확인" 
            allStudents={data.students} 
            items={data.items} 
            records={data.records} 
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 h-12">
          <TabsTrigger value="measurement" className="text-sm sm:text-base font-bold px-1">
            <LineChart className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">측정 & 분석</span>
            <span className="sm:hidden">측정</span>
          </TabsTrigger>
          <TabsTrigger value="theory" className="text-sm sm:text-base font-bold px-1">
            <BookOpen className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">이론 평가</span>
            <span className="sm:hidden">이론</span>
          </TabsTrigger>
          <TabsTrigger value="competition" className="text-sm sm:text-base font-bold px-1">
            <Swords className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">대회 & 팀</span>
            <span className="sm:hidden">대회</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="text-sm sm:text-base font-bold px-1">
            <Database className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">데이터 관리</span>
            <span className="sm:hidden">데이터</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="measurement" className="space-y-6">
          <Tabs defaultValue="input">
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-muted/50 h-auto sm:h-10">
              <TabsTrigger value="input" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">기록 입력</span>
                <span className="sm:hidden">입력</span>
              </TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">학생 개별 분석</span>
                <span className="sm:hidden">분석</span>
              </TabsTrigger>
              <TabsTrigger value="browser" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">전체 기록 조회/추출</span>
                <span className="sm:hidden">조회</span>
              </TabsTrigger>
              <TabsTrigger value="ranking" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">순위 및 명예의 전당</span>
                <span className="sm:hidden">순위</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="input" className="animate-in fade-in-50 duration-300">
              <RecordInput 
                allStudents={data.students} 
                allItems={data.items} 
                onRecordUpdate={() => load(true)} 
                allTeamGroups={data.teams} 
                sportsClubs={data.clubs} 
              />
            </TabsContent>
            
            <TabsContent value="analysis" className="animate-in fade-in-50 duration-300">
              <ClassAnalytics 
                allStudents={data.students} 
                allItems={data.items} 
                allRecords={data.records} 
                onRecordUpdate={() => load(true)} 
                sportsClubs={data.clubs} 
              />
            </TabsContent>

            <TabsContent value="browser" className="animate-in fade-in-50 duration-300">
              <RecordBrowser 
                allStudents={data.students} 
                allItems={data.items} 
                allRecords={data.records} 
              />
            </TabsContent>

            <TabsContent value="ranking" className="animate-in fade-in-50 duration-300">
              <Ranking 
                allStudents={data.students} 
                allItems={data.items} 
                allRecords={data.records} 
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="theory" className="animate-in fade-in-50 duration-300">
          <TheoryExamManagement 
            allStudents={data.students} 
            sportsClubs={data.clubs} 
          />
        </TabsContent>

        <TabsContent value="competition" className="space-y-6">
          <Tabs defaultValue="tournament">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 h-auto sm:h-10">
              <TabsTrigger value="tournament" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">대회 및 대진표 관리</span>
                <span className="sm:hidden">대회 관리</span>
              </TabsTrigger>
              <TabsTrigger value="balancer" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">팀 자동 편성 (밸런스)</span>
                <span className="sm:hidden">팀 편성</span>
              </TabsTrigger>
              <TabsTrigger value="clubs" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">스포츠 클럽 관리</span>
                <span className="sm:hidden">클럽 관리</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="tournament" className="animate-in fade-in-50 duration-300">
              <TournamentManagement 
                onTournamentUpdate={() => load(true)} 
                allTeamGroups={data.teams} 
                allStudents={data.students} 
              />
            </TabsContent>
            
            <TabsContent value="balancer" className="animate-in fade-in-50 duration-300">
              <TeamBalancer 
                allStudents={data.students} 
                allItems={data.items} 
                allRecords={data.records} 
                teamGroups={data.teams} 
                onTeamGroupUpdate={(newGroup) => { load(true); }} 
                onTeamGroupDelete={(id) => { load(true); }} 
                sportsClubs={data.clubs} 
              />
            </TabsContent>

            <TabsContent value="clubs" className="animate-in fade-in-50 duration-300">
              <SportsClubManagement 
                allStudents={data.students} 
                sportsClubs={data.clubs} 
                onClubUpdate={() => load(true)} 
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Tabs defaultValue="students">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 h-auto sm:h-10">
              <TabsTrigger value="students" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">학생 명부 관리</span>
                <span className="sm:hidden">명부 관리</span>
              </TabsTrigger>
              <TabsTrigger value="items" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">측정 종목 관리</span>
                <span className="sm:hidden">종목 관리</span>
              </TabsTrigger>
              <TabsTrigger value="db" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">DB 유틸리티 (진급/백업)</span>
                <span className="sm:hidden">DB 관리</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="students" className="animate-in fade-in-50 duration-300">
              <StudentManagement 
                students={data.students} 
                onStudentsUpdate={() => load(true)} 
              />
            </TabsContent>
            
            <TabsContent value="items" className="animate-in fade-in-50 duration-300">
              <MeasurementManagement 
                items={data.items} 
                onItemsUpdate={(newItems) => setData(prev => ({...prev, items: newItems}))} 
              />
            </TabsContent>
            
            <TabsContent value="db" className="animate-in fade-in-50 duration-300">
              <DatabaseManagement 
                students={data.students} 
                records={data.records} 
                items={data.items} 
                onUpdate={() => load(true)} 
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

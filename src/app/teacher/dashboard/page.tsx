
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
  Users,
  BarChart3,
  Bot,
  Database,
  Edit,
  Swords,
  LineChart,
  Target,
  Users2,
  BookOpen,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function TeacherDashboardPage() {
  const { school, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<any>({ students: [], items: [], records: [], teams: [], clubs: [] });
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

  if (isLoading || isAuthLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <DashboardHeader />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bot />AI 브리핑</CardTitle></CardHeader>
        <CardContent><AiWelcome title="전체 브리핑" allStudents={data.students} items={data.items} records={data.records} /></CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="measurement"><LineChart className="mr-2 h-4 w-4" />측정 & 분석</TabsTrigger>
          <TabsTrigger value="competition"><Swords className="mr-2 h-4 w-4" />대회 & 팀</TabsTrigger>
          <TabsTrigger value="data"><Database className="mr-2 h-4 w-4" />데이터 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="measurement">
          <Tabs defaultValue="input">
            <TabsList className="mb-4"><TabsTrigger value="input">기록 입력</TabsTrigger><TabsTrigger value="analysis">학생 분석</TabsTrigger></TabsList>
            <TabsContent value="input"><RecordInput allStudents={data.students} allItems={data.items} onRecordUpdate={() => load(true)} allTeamGroups={data.teams} sportsClubs={data.clubs} /></TabsContent>
            <TabsContent value="analysis"><ClassAnalytics allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={() => load(true)} sportsClubs={data.clubs} /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="competition">
          <Tabs defaultValue="tournament">
            <TabsList className="mb-4"><TabsTrigger value="tournament">대회 관리</TabsTrigger><TabsTrigger value="balancer">팀 편성</TabsTrigger></TabsList>
            <TabsContent value="tournament"><TournamentManagement onTournamentUpdate={() => load(true)} allTeamGroups={data.teams} allStudents={data.students} /></TabsContent>
            <TabsContent value="balancer"><TeamBalancer allStudents={data.students} allItems={data.items} allRecords={data.records} teamGroups={data.teams} onTeamGroupUpdate={() => load(true)} onTeamGroupDelete={() => load(true)} sportsClubs={data.clubs} /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="data">
          <Tabs defaultValue="students">
            <TabsList className="mb-4"><TabsTrigger value="students">학생 관리</TabsTrigger><TabsTrigger value="items">종목 관리</TabsTrigger><TabsTrigger value="db">DB 유틸리티</TabsTrigger></TabsList>
            <TabsContent value="students"><StudentManagement students={data.students} onStudentsUpdate={() => load(true)} /></TabsContent>
            <TabsContent value="items"><MeasurementManagement items={data.items} onItemsUpdate={() => load(true)} /></TabsContent>
            <TabsContent value="db"><DatabaseManagement students={data.students} records={data.records} items={data.items} onUpdate={() => load(true)} /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getStudents, getItems, getRecords, getTeamGroups } from "@/lib/store";
import type { Student, MeasurementItem, MeasurementRecord, TeamGroup } from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentManagement, {
  DatabaseManagement,
} from "./_components/StudentManagement";
import MeasurementManagement from "./_components/MeasurementManagement";
import ClassAnalytics from "./_components/ClassAnalytics";
import Ranking from "./_components/Ranking";
import RecordInput from "./_components/RecordInput";
import AiWelcome from "./_components/AiWelcome";
import TournamentManagement from "./_components/TournamentManagement";
import {
  Users,
  ClipboardList,
  BarChart3,
  Bot,
  Trophy,
  Database,
  Edit,
  Swords,
} from "lucide-react";
import { DashboardHeaderContents } from "@/components/DashboardHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherDashboardPage() {
  const { school, isLoading: isAuthLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tournaments");

  const loadData = async () => {
    if (isAuthLoading || !school) return;
      setIsLoading(true);
      try {
        const [studentData, itemData, recordData, teamGroupData] = await Promise.all([
          getStudents(school),
          getItems(school),
          getRecords(school),
          getTeamGroups(school),
        ]);
        setStudents(studentData);
        setItems(itemData);
        setRecords(recordData);
        setTeamGroups(teamGroupData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
  }

  useEffect(() => {
    loadData();
  }, [school, isAuthLoading]);

  const forceUpdate = async () => {
    await loadData();
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <DashboardHeaderContents />
        <Skeleton className="h-48 w-full" />
        <div className="flex space-x-1">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-2 sm:p-4 md:p-6 lg:p-8">
        <DashboardHeaderContents />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot />
              AI 수업 브리핑
            </CardTitle>
            <CardDescription>
              PAPS 종목 또는 기타 종목의 전체 평균 데이터를 기반으로 AI가 생성한
              요약 및 조언을 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <AiWelcome
              itemType="paps"
              title="전체 AI 브리핑"
              allStudents={students}
              items={items}
              records={records}
            />
            <AiWelcome
              itemType="custom"
              title="기타 종목 브리핑"
              allStudents={students}
              items={items}
              records={records}
            />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="tournaments">
              <Swords className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">대회</span>
            </TabsTrigger>
            <TabsTrigger value="class-analytics">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">학급별 분석</span>
            </TabsTrigger>
            <TabsTrigger value="record-input">
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">기록 입력</span>
            </TabsTrigger>
            <TabsTrigger value="ranking">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">종목별 순위</span>
            </TabsTrigger>
            <TabsTrigger value="students">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">학생 명단</span>
            </TabsTrigger>
            <TabsTrigger value="measurements">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">측정 종목</span>
            </TabsTrigger>
            <TabsTrigger value="database-management">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">데이터 관리</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tournaments">
            <TournamentManagement
              onTournamentUpdate={forceUpdate}
            />
          </TabsContent>
          
          <TabsContent value="class-analytics">
            <ClassAnalytics
              allStudents={students}
              allItems={items}
              allRecords={records}
              onRecordUpdate={forceUpdate}
            />
          </TabsContent>

          <TabsContent value="record-input">
            <RecordInput
              allStudents={students}
              allItems={items}
              onRecordUpdate={forceUpdate}
            />
          </TabsContent>

          <TabsContent value="ranking">
            <Ranking
              allStudents={students}
              allItems={items}
              allRecords={records}
              teamGroups={teamGroups}
              onTeamGroupUpdate={forceUpdate}
            />
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement
              students={students}
              onStudentsUpdate={forceUpdate}
            />
          </TabsContent>

          <TabsContent value="measurements">
            <MeasurementManagement items={items} onItemsUpdate={forceUpdate} />
          </TabsContent>
          <TabsContent value="database-management">
            <DatabaseManagement
              students={students}
              records={records}
              items={items}
              onUpdate={forceUpdate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getStudents, getItems, getRecords, getTeamGroups } from "@/lib/store";
import type { Student, MeasurementItem, MeasurementRecord, TeamGroup } from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentManagement, DatabaseManagement } from "./_components/StudentManagement";
import MeasurementManagement from "./_components/MeasurementManagement";
import ClassAnalytics from "./_components/ClassAnalytics";
import RecordBrowser from "./_components/RecordBrowser";
import Ranking from "./_components/Ranking";
import RecordInput from "./_components/RecordInput";
import AiWelcome from "./_components/AiWelcome";
import TournamentManagement from "./_components/TournamentManagement";
import TeamBalancer from "./_components/TeamBalancer";
import {
  Users,
  ClipboardList,
  BarChart3,
  Bot,
  Trophy,
  Database,
  Edit,
  Swords,
  Shuffle,
  LineChart,
  Target,
  Wrench,
  Search,
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("measurement");

  const loadData = useCallback(async () => {
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
  }, [school, isAuthLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  useEffect(() => {
    const body = document.body;
    const originalClasses = body.className;
    const tabBackgrounds: { [key: string]: string } = {
        measurement: 'measurement-bg',
        competition: 'competition-bg',
        data: 'data-bg',
    };

    // Remove all possible background classes first
    Object.values(tabBackgrounds).forEach(bgClass => {
        body.classList.remove(bgClass);
    });
    body.classList.remove('watermark-bg');
    
    // Add the correct class
    const bgClass = tabBackgrounds[activeTab] || 'watermark-bg';
    body.classList.add(bgClass);

    return () => {
        // Cleanup on component unmount
        body.className = originalClasses;
    };
  }, [activeTab]);


  const handleDataUpdate = useCallback(async () => {
    await loadData();
  }, [loadData]);
  
  const handleItemsUpdate = useCallback((updatedItems: MeasurementItem[]) => {
      setItems(updatedItems);
  }, []);

  const updateLocalRecords = useCallback((updatedOrDeleted: MeasurementRecord[] | string, action: 'update' | 'delete') => {
    if (action === 'delete' && typeof updatedOrDeleted === 'string') {
      setRecords(prev => prev.filter(r => r.id !== updatedOrDeleted));
    } else if (action === 'update' && Array.isArray(updatedOrDeleted)) {
      setRecords(prev => {
        const updatedRecordMap = new Map(updatedOrDeleted.map(r => [r.id, r]));
        const newRecords = prev.filter(r => !updatedRecordMap.has(r.id));
        return [...newRecords, ...updatedOrDeleted];
      });
    }
  }, []);

  const handleTeamGroupAddedOrUpdated = useCallback((updatedGroup: TeamGroup) => {
    setTeamGroups(prev => {
      const index = prev.findIndex(g => g.id === updatedGroup.id);
      if (index > -1) {
        const newGroups = [...prev];
        newGroups[index] = updatedGroup;
        return newGroups;
      } else {
        return [updatedGroup, ...prev];
      }
    });
  }, []);
  
  const handleTeamGroupDeleted = useCallback((groupId: string) => {
    setTeamGroups(prev => prev.filter(g => g.id !== groupId));
  }, []);

  if (isLoading || isAuthLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-primary font-headline">
          {school} 교사 대시보드
        </h1>
        <Skeleton className="h-48 w-full" />
        <div className="flex space-x-1">
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
      <div className="container mx-auto p-2 sm:p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot />
              AI 수업 브리핑
            </CardTitle>
            <CardDescription>
              전체 학생들의 PAPS 및 기타 종목 평균 데이터를 기반으로 AI가 생성한 요약 및 조언을 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <AiWelcome
              title="전체 학생 AI 브리핑"
              allStudents={students}
              items={items}
              records={records}
            />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="grid w-full grid-cols-3 mb-6 bg-card/90 backdrop-blur-sm">
            <TabsTrigger value="measurement" className="text-base font-semibold">
              <LineChart className="h-5 w-5 mr-2" />
              측정 & 분석
            </TabsTrigger>
            <TabsTrigger value="competition" className="text-base font-semibold">
              <Swords className="h-5 w-5 mr-2" />
              대회 & 팀
            </TabsTrigger>
            <TabsTrigger value="data" className="text-base font-semibold">
              <Database className="h-5 w-5 mr-2" />
              데이터 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="measurement" className="bg-card/90 backdrop-blur-sm p-4 rounded-lg">
            <Tabs defaultValue="record-input">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="record-input"><Edit className="mr-2 h-4 w-4" />기록 입력</TabsTrigger>
                <TabsTrigger value="record-analysis"><Users className="mr-2 h-4 w-4" />학생별 분석</TabsTrigger>
                <TabsTrigger value="record-browser"><Search className="mr-2 h-4 w-4" />기록 조회</TabsTrigger>
                <TabsTrigger value="ranking"><Trophy className="mr-2 h-4 w-4" />종목별 순위</TabsTrigger>
              </TabsList>
              <TabsContent value="record-input">
                <RecordInput
                  allStudents={students}
                  allItems={items}
                  onRecordUpdate={updateLocalRecords}
                  allTeamGroups={teamGroups}
                />
              </TabsContent>
              <TabsContent value="record-analysis">
                <ClassAnalytics
                    allStudents={students}
                    allItems={items}
                    allRecords={records}
                    onRecordUpdate={updateLocalRecords}
                />
              </TabsContent>
              <TabsContent value="record-browser">
                <RecordBrowser 
                  allStudents={students}
                  allItems={items}
                  allRecords={records}
                />
              </TabsContent>
              <TabsContent value="ranking">
                <Ranking
                  allStudents={students}
                  allItems={items}
                  allRecords={records}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="competition" className="bg-card/90 backdrop-blur-sm p-4 rounded-lg">
             <Tabs defaultValue="tournament-management">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="tournament-management"><Swords className="mr-2 h-4 w-4" />대회 관리</TabsTrigger>
                    <TabsTrigger value="team-balancer"><Shuffle className="mr-2 h-4 w-4" />팀 자동 편성</TabsTrigger>
                </TabsList>
                <TabsContent value="tournament-management">
                    <TournamentManagement 
                      onTournamentUpdate={handleDataUpdate} 
                      allTeamGroups={teamGroups} 
                      allStudents={students}
                    />
                </TabsContent>
                <TabsContent value="team-balancer">
                    <TeamBalancer
                        allStudents={students}
                        allItems={items}
                        allRecords={records}
                        teamGroups={teamGroups}
                        onTeamGroupUpdate={handleTeamGroupAddedOrUpdated}
                        onTeamGroupDelete={handleTeamGroupDeleted}
                    />
                </TabsContent>
             </Tabs>
          </TabsContent>

          <TabsContent value="data" className="bg-card/90 backdrop-blur-sm p-4 rounded-lg">
             <Tabs defaultValue="student-management">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="student-management"><Users className="mr-2 h-4 w-4" />학생 관리</TabsTrigger>
                    <TabsTrigger value="item-management"><Target className="mr-2 h-4 w-4" />종목 관리</TabsTrigger>
                    <TabsTrigger value="database-management"><Wrench className="mr-2 h-4 w-4" />DB 유틸리티</TabsTrigger>
                </TabsList>
                <TabsContent value="student-management">
                   <StudentManagement
                      students={students}
                      onStudentsUpdate={handleDataUpdate}
                    />
                </TabsContent>
                 <TabsContent value="item-management">
                    <MeasurementManagement items={items} onItemsUpdate={handleItemsUpdate} />
                </TabsContent>
                <TabsContent value="database-management">
                    <DatabaseManagement
                      students={students}
                      records={records}
                      items={items}
                      onUpdate={handleDataUpdate}
                    />
                </TabsContent>
             </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

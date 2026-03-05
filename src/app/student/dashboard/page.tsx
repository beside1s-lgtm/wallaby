
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getItems, getRecordsByStudent, getStudentById, getLatestTournamentForStudent, getStudents, getTeamGroups, getSportsClubs, getQuizAssignments, getQuizResultsBySchool } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Printer } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GrowthRecordTab } from './_components/GrowthRecordTab';
import { MeasurementInputTab } from './_components/MeasurementInputTab';
import { CompetitionTab } from './_components/CompetitionTab';
import { KnowledgeTab } from './_components/KnowledgeTab';

export default function StudentDashboardPage() {
  const { user, school, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("growth-record");
  const [data, setData] = useState<any>({ items: [], records: [], student: null, tournament: null, teamGroup: null, quizzes: [], results: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user || !school) return;
      try {
        const [items, records, stud, allStuds, allTeams, allClubs, quizzes, results] = await Promise.all([
          getItems(school), getRecordsByStudent(school, user.id), getStudentById(school, user.id),
          getStudents(school), getTeamGroups(school), getSportsClubs(school), getQuizAssignments(school), getQuizResultsBySchool(school)
        ]);
        const tournament = await getLatestTournamentForStudent(school, user.id, allStuds, allTeams);
        setData({ items, records, student: stud, tournament, quizzes, results: results.filter(r => r.studentId === user.id) });
      } finally { setIsLoading(false); }
    }
    load();
  }, [user, school]);

  if (isLoading || isAuthLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-12 w-12" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16"><AvatarImage src={data.student?.photoUrl} /><AvatarFallback>{data.student?.name[0]}</AvatarFallback></Avatar>
          <div><h1 className="text-2xl font-bold">{data.student?.name} 학생</h1><p className="text-muted-foreground">{data.student?.grade}학년 {data.student?.classNum}반</p></div>
        </div>
        <Button asChild variant="outline"><Link href="/student/report" target="_blank"><Printer className="mr-2 h-4 w-4" />리포트 출력</Link></Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="growth-record">성장 기록</TabsTrigger>
          <TabsTrigger value="measurement-input">결과 입력</TabsTrigger>
          <TabsTrigger value="my-competition">나의 대회</TabsTrigger>
          <TabsTrigger value="physical-knowledge">체육 지식</TabsTrigger>
        </TabsList>
        <TabsContent value="growth-record"><GrowthRecordTab records={data.records} activeItems={data.items.filter((i:any)=>!i.isDeactivated)} hallOfFame={[]} /></TabsContent>
        <TabsContent value="measurement-input"><MeasurementInputTab items={data.items.filter((i:any)=>!i.isDeactivated)} student={data.student} /></TabsContent>
        <TabsContent value="my-competition"><CompetitionTab tournament={data.tournament} /></TabsContent>
        <TabsContent value="physical-knowledge"><KnowledgeTab quizzes={data.quizzes} results={data.results} /></TabsContent>
      </Tabs>
    </div>
  );
}

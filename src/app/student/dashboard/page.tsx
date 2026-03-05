
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getItems, getRecordsByStudent, getStudentById, getLatestTournamentForStudent, getStudents, getTeamGroups, getQuizAssignments, getQuizResultsBySchool, calculateRanks, getRecords } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Printer } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GrowthRecordTab } from './_components/GrowthRecordTab';
import { MeasurementInputTab } from './_components/MeasurementInputTab';
import { CompetitionTab } from './_components/CompetitionTab';
import { KnowledgeTab } from './_components/KnowledgeTab';
import { getStudentFeedback } from '@/ai/flows/student-ai-feedback';
import { useToast } from '@/hooks/use-toast';

export default function StudentDashboardPage() {
  const { user, school, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("growth-record");
  const [data, setData] = useState<any>({ 
    items: [], 
    records: [], 
    student: null, 
    tournament: null, 
    quizzes: [], 
    results: [],
    allStudents: [],
    allRecords: []
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // States for GrowthRecordTab
  const [itemFilter, setItemFilter] = useState('all');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user || !school) return;
      try {
        const [items, records, stud, allStuds, allTeams, quizzes, results, allRecords] = await Promise.all([
          getItems(school), 
          getRecordsByStudent(school, user.id), 
          getStudentById(school, user.id),
          getStudents(school), 
          getTeamGroups(school), 
          getQuizAssignments(school), 
          getQuizResultsBySchool(school),
          getRecords(school)
        ]);
        
        const tournament = await getLatestTournamentForStudent(school, user.id, allStuds, allTeams);
        
        setData({ 
          items, 
          records, 
          student: stud, 
          tournament, 
          quizzes, 
          results: results.filter(r => r.studentId === user.id),
          allStudents: allStuds,
          allRecords: allRecords
        });
      } finally { 
        setIsLoading(false); 
      }
    }
    load();
  }, [user, school]);

  const hallOfFame = useMemo(() => {
    if (!school || data.items.length === 0 || data.allStudents.length === 0) return [];
    
    const measurementWeekItems = data.items.filter((item: any) => item.isMeasurementWeek && !item.isArchived && !item.isDeactivated);
    if (measurementWeekItems.length === 0) return [];
    
    const allRanks = calculateRanks(school, data.items, data.allRecords, data.allStudents);
    const studentMap = new Map(data.allStudents.map((s: any) => [s.id, s]));

    return measurementWeekItems.map((item: any) => {
      const itemRanks = allRanks[item.name] || [];
      const topStudents = itemRanks.slice(0, 3).map(rankInfo => {
        const s = studentMap.get(rankInfo.studentId);
        return {
          rank: rankInfo.rank,
          name: s?.name || '알 수 없음',
          value: `${rankInfo.value}${item.unit}`
        };
      });
      return { itemName: item.name, topStudents };
    });
  }, [data.items, data.allRecords, data.allStudents, school]);

  const handleAiFeedback = async () => {
    if (!data.student || data.records.length === 0 || !school) return;
    
    setIsFeedbackLoading(true);
    try {
      const latestRecord = [...data.records].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const allItemRanks = calculateRanks(school, data.items, data.allRecords, data.allStudents, data.student.grade);
      const itemRanks = allItemRanks[latestRecord.item] || [];
      const rankInfo = itemRanks.find(r => r.studentId === data.student.id && r.value === latestRecord.value);
      const rankText = rankInfo ? `${itemRanks.length}명 중 ${rankInfo.rank}등` : '';

      const result = await getStudentFeedback({
        school,
        studentName: data.student.name,
        exerciseType: latestRecord.item,
        performanceResult: `${latestRecord.value}${data.items.find((i:any)=>i.name===latestRecord.item)?.unit || ''}`,
        grade: data.student.grade,
        classNumber: data.student.classNum,
        studentNumber: data.student.studentNum,
        gender: data.student.gender,
        rank: rankText
      });
      setAiFeedback(result.feedback);
    } catch (e) {
      toast({ variant: 'destructive', title: '분석 실패', description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  if (isLoading || isAuthLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card/50 p-6 rounded-2xl border backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20 border-4 border-primary/10 ring-4 ring-background">
            <AvatarImage src={data.student?.photoUrl} />
            <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black">{data.student?.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-primary">{data.student?.name}</h1>
                <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">학생용 대시보드</span>
            </div>
            <p className="text-muted-foreground font-medium">{data.student?.grade}학년 {data.student?.classNum}반 {data.student?.studentNum}번</p>
          </div>
        </div>
        <Button asChild variant="outline" className="shadow-sm font-bold hover:bg-primary/5 hover:text-primary transition-colors">
          <Link href="/student/report" target="_blank">
            <Printer className="mr-2 h-4 w-4" />
            성장 리포트 출력
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-14 bg-muted/50 p-1.5 rounded-xl border">
          <TabsTrigger value="growth-record" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">성장 기록</TabsTrigger>
          <TabsTrigger value="measurement-input" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">기록 입력</TabsTrigger>
          <TabsTrigger value="my-competition" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">나의 대회</TabsTrigger>
          <TabsTrigger value="physical-knowledge" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">체육 지식</TabsTrigger>
        </TabsList>
        
        <div className="mt-8 transition-all duration-500">
            <TabsContent value="growth-record" className="animate-in fade-in-50 duration-300">
              <GrowthRecordTab 
                records={data.records} 
                activeItems={data.items.filter((i:any)=>!i.isDeactivated && !i.isArchived)} 
                student={data.student}
                hallOfFame={hallOfFame}
                itemFilter={itemFilter}
                setItemFilter={setItemFilter}
                aiFeedback={aiFeedback}
                isFeedbackLoading={isFeedbackLoading}
                onAiFeedback={handleAiFeedback}
              />
            </TabsContent>
            
            <TabsContent value="measurement-input" className="animate-in fade-in-50 duration-300">
              <MeasurementInputTab 
                items={data.items.filter((i:any)=>!i.isDeactivated && !i.isArchived)} 
                student={data.student} 
              />
            </TabsContent>
            
            <TabsContent value="my-competition" className="animate-in fade-in-50 duration-300">
              <CompetitionTab tournament={data.tournament} />
            </TabsContent>
            
            <TabsContent value="physical-knowledge" className="animate-in fade-in-50 duration-300">
              <KnowledgeTab 
                quizzes={data.quizzes} 
                results={data.results} 
                student={data.student} 
              />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

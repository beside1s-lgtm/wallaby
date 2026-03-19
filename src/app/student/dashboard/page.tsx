
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
  getItems, 
  getRecordsByStudent, 
  getStudentById, 
  getLatestTournamentForStudent, 
  getStudents, 
  getTeamGroups, 
  getQuizAssignments, 
  getQuizResultsBySchool, 
  getSportsClubs,
  getSchoolByName,
  getStatistics
} from '@/lib/store';
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
import { cn } from '@/lib/utils';

export default function StudentDashboardPage() {
  const { user, school, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("growth-record");
  
  // 필수 데이터 (로그인 직후 즉시 로딩)
  const [essentialData, setEssentialData] = useState<any>({
    student: null,
    items: [],
    records: [],
    schoolInfo: null,
    quizzes: [],
    results: [],
    statistics: []
  });

  // 확장 데이터 (특정 탭 진입 시 로딩)
  const [extendedData, setExtendedData] = useState<any>({
    allStudents: [],
    tournament: null,
    isLoaded: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isExtendedLoading, setIsExtendedLoading] = useState(false);
  
  const [itemFilter, setItemFilter] = useState('all');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  // 1단계: 필수 데이터 로딩 (학생 본인 기록 + 사전 계산된 통계)
  const loadEssentialData = useCallback(async () => {
    if (!user || !school) return;
    try {
      const studentId = (user as any).id;
      // 병렬 요청으로 속도 극대화
      const [items, records, stud, quizzes, results, schoolInfo, sportsClubs, statistics] = await Promise.all([
        getItems(school), 
        getRecordsByStudent(school, studentId), 
        getStudentById(school, studentId),
        getQuizAssignments(school), 
        getQuizResultsBySchool(school),
        getSchoolByName(school),
        getSportsClubs(school),
        getStatistics(school)
      ]);
      
      const filteredQuizzes = quizzes.filter(q => {
        if (!stud) return false;
        if (q.targetType === 'school') return true;
        if (q.targetType === 'grade') return q.targetGrade === stud.grade;
        if (q.targetType === 'class') return q.targetGrade === stud.grade && q.targetClassNum === stud.classNum;
        if (q.targetType === 'club') {
          const club = sportsClubs.find(c => c.id === q.targetClubId);
          return club?.memberIds.includes(stud.id);
        }
        return false;
      });

      setEssentialData({ 
        items, 
        records, 
        student: stud, 
        quizzes: filteredQuizzes, 
        results: results.filter(r => r.studentId === studentId),
        schoolInfo,
        statistics
      });
      setIsLoading(false);
    } catch (e) {
      console.error("Essential data load failed", e);
      setIsLoading(false);
    }
  }, [user, school]);

  // 2단계: 무거운 데이터 로딩 (대회 및 팀 기능용 - 필요할 때만 호출)
  const loadExtendedData = useCallback(async () => {
    if (!school || !essentialData.student || extendedData.isLoaded) return;
    
    setIsExtendedLoading(true);
    try {
      const [allStuds, allTeams] = await Promise.all([
        getStudents(school),
        getTeamGroups(school)
      ]);

      const tournament = await getLatestTournamentForStudent(school, essentialData.student.id, allStuds, allTeams);

      setExtendedData({
        allStudents: allStuds,
        tournament,
        isLoaded: true
      });
    } catch (e) {
      console.error("Extended data load failed", e);
    } finally {
      setIsExtendedLoading(false);
    }
  }, [school, essentialData.student, extendedData.isLoaded]);

  useEffect(() => {
    loadEssentialData();
  }, [loadEssentialData]);

  // 대회 탭 진입 시 확장 데이터 로딩 시작
  useEffect(() => {
    if (activeTab === 'my-competition' && !extendedData.isLoaded) {
      loadExtendedData();
    }
  }, [activeTab, extendedData.isLoaded, loadExtendedData]);

  const handleAiFeedback = async () => {
    if (!essentialData.student || essentialData.records.length === 0 || !school) return;
    
    setIsFeedbackLoading(true);
    try {
      const latestRecord = [...essentialData.records].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const itemStats = essentialData.statistics.find((s: any) => s.id === latestRecord.item);
      let rankText = '';
      
      if (itemStats && itemStats.gradeStats[essentialData.student.grade]) {
        const gradeData = itemStats.gradeStats[essentialData.student.grade];
        const rankInfo = gradeData.allRanks.find((r: any) => r.studentId === essentialData.student.id);
        if (rankInfo) {
            rankText = `${gradeData.count}명 중 ${rankInfo.rank}등`;
        }
      }

      const result = await getStudentFeedback({
        school,
        studentName: essentialData.student.name,
        exerciseType: latestRecord.item,
        performanceResult: `${latestRecord.value}${essentialData.items.find((i:any)=>i.name===latestRecord.item)?.unit || ''}`,
        grade: essentialData.student.grade,
        classNumber: essentialData.student.classNum,
        studentNumber: essentialData.student.studentNum,
        gender: essentialData.student.gender,
        rank: rankText
      });
      setAiFeedback(result.feedback);
    } catch (e) {
      toast({ variant: 'destructive', title: '분석 실패', description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const isInputDisabled = !!essentialData.schoolInfo?.isStudentInputDisabled;

  if (isLoading || isAuthLoading) return (
    <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background">
      <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
      <p className="font-bold text-muted-foreground animate-pulse">안전하게 대시보드를 불러오는 중입니다...</p>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card/50 p-6 rounded-2xl border backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20 border-4 border-primary/10 ring-4 ring-background">
            <AvatarImage src={essentialData.student?.photoUrl} />
            <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black">{essentialData.student?.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-primary">{essentialData.student?.name}</h1>
                <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">학생용 대시보드</span>
            </div>
            <p className="text-muted-foreground font-medium">{essentialData.student?.grade}학년 {essentialData.student?.classNum}반 {essentialData.student?.studentNum}번</p>
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
        <TabsList className={cn(
          "grid w-full mb-8 h-14 bg-muted/50 p-1.5 rounded-xl border",
          isInputDisabled ? "grid-cols-3" : "grid-cols-4"
        )}>
          <TabsTrigger value="growth-record" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">성장 기록</TabsTrigger>
          {!isInputDisabled && (
            <TabsTrigger value="measurement-input" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">기록 입력</TabsTrigger>
          )}
          <TabsTrigger value="my-competition" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">
            나의 대회
            {isExtendedLoading && <Loader2 className="ml-2 h-3 w-3 animate-spin inline opacity-50" />}
          </TabsTrigger>
          <TabsTrigger value="physical-knowledge" className="text-sm sm:text-base font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg">체육 지식</TabsTrigger>
        </TabsList>
        
        <div className="mt-8">
            <TabsContent value="growth-record" className="animate-in fade-in-50 duration-300">
              <GrowthRecordTab 
                records={essentialData.records} 
                activeItems={essentialData.items.filter((i:any)=>!i.isDeactivated && !i.isArchived)} 
                allStudents={extendedData.allStudents}
                allRecords={[]} // 학생 뷰에서는 전체 기록을 참조하지 않고 통계 데이터만 사용
                statistics={essentialData.statistics}
                student={essentialData.student}
                itemFilter={itemFilter}
                setItemFilter={setItemFilter}
                aiFeedback={aiFeedback}
                isFeedbackLoading={isFeedbackLoading}
                onAiFeedback={handleAiFeedback}
              />
            </TabsContent>
            
            {!isInputDisabled && (
              <TabsContent value="measurement-input" className="animate-in fade-in-50 duration-300">
                <MeasurementInputTab 
                  items={essentialData.items.filter((i:any)=>!i.isDeactivated && !i.isArchived)} 
                  student={essentialData.student} 
                />
              </TabsContent>
            )}
            
            <TabsContent value="my-competition" className="animate-in fade-in-50 duration-300">
              {isExtendedLoading && !extendedData.isLoaded ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                  <p className="text-sm font-bold text-muted-foreground">우리 팀 대진표와 전력을 분석하는 중입니다...</p>
                </div>
              ) : (
                <CompetitionTab 
                  tournament={extendedData.tournament} 
                  student={essentialData.student}
                  allStudents={extendedData.allStudents}
                  allRecords={[]}
                  allItems={essentialData.items}
                  statistics={essentialData.statistics}
                />
              )}
            </TabsContent>
            
            <TabsContent value="physical-knowledge" className="animate-in fade-in-50 duration-300">
              <KnowledgeTab 
                quizzes={essentialData.quizzes} 
                results={essentialData.results} 
                student={essentialData.student}
                onRefresh={loadEssentialData}
              />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

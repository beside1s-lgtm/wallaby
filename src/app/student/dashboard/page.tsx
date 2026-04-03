'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Loader2, Printer, User, Award, BookOpen, PenTool, Sparkles } from 'lucide-react';
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

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

export default function StudentDashboardPage() {
  const { user, school, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("growth-record");
  
  const [essentialData, setEssentialData] = useState<any>({
    student: null,
    items: [],
    records: [],
    schoolInfo: null,
    quizzes: [],
    results: [],
    statistics: []
  });

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

  const loadEssentialData = useCallback(async () => {
    if (!user || !school) return;
    try {
      const studentId = (user as any).id;
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
      <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <Loader2 className="animate-spin h-16 w-16 text-primary relative z-10" />
      </div>
      <p className="font-black text-xl text-primary font-headline animate-pulse tracking-tight">지능형 학생 대시보드를 불러오는 중입니다...</p>
    </div>
  );

  return (
    <div className="min-h-screen watermark-bg flex flex-col">
      <div className="container mx-auto p-4 md:p-10 space-y-10 pb-32">
        {/* Header Section */}

        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row justify-between items-center gap-8 premium-card p-6 sm:p-10 backdrop-blur-2xl bg-card/60"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-center sm:text-left">
            <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:scale-125 transition-transform" />
                <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-[6px] border-background shadow-2xl relative">
                  <AvatarImage src={essentialData.student?.photoUrl} />
                  <AvatarFallback className="bg-primary/5 text-primary text-4xl font-black">{essentialData.student?.name[0]}</AvatarFallback>
                </Avatar>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                  <h1 className="text-3xl sm:text-4xl font-black text-primary font-headline tracking-tighter">{essentialData.student?.name}</h1>
                  <span className="text-[10px] sm:text-sm font-black bg-primary/10 text-primary px-3 sm:px-4 py-1 sm:py-1.5 rounded-2xl border border-primary/20 shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                     <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                     Student Portal
                  </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-muted-foreground/80 font-headline italic">
                {essentialData.student?.grade}학년 {essentialData.student?.classNum}반 {essentialData.student?.studentNum}번
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto h-12 sm:h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 font-black text-base sm:text-lg gap-2 hover:scale-105 active:scale-95 transition-all">
            <Link href="/student/report" target="_blank">
              <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
              나의 성장 리포트
            </Link>
          </Button>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex items-center justify-start overflow-x-auto hide-scrollbar w-full mb-8 h-14 sm:h-18 bg-muted/30 p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[2rem] border border-border/40 backdrop-blur-md shadow-inner gap-1.5 sm:gap-2">
            <TabsTrigger value="growth-record" className="flex-1 min-w-[100px] h-full rounded-[1rem] sm:rounded-[1.5rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl transition-all">
               <User className="w-4 h-4 sm:w-5 sm:h-5" />
               <span className="hidden xs:inline">나의</span> 성장
            </TabsTrigger>
            {!isInputDisabled && (
              <TabsTrigger value="measurement-input" className="flex-1 min-w-[100px] h-full rounded-[1rem] sm:rounded-[1.5rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl transition-all">
                <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
                기록 입력
              </TabsTrigger>
            )}
            <TabsTrigger value="my-competition" className="flex-1 min-w-[100px] h-full rounded-[1rem] sm:rounded-[1.5rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl transition-all">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              나의 대회
            </TabsTrigger>
            <TabsTrigger value="physical-knowledge" className="flex-1 min-w-[100px] h-full rounded-[1rem] sm:rounded-[1.5rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xl transition-all">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              체육 지식
            </TabsTrigger>
          </TabsList>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={tabVariants}
              className="mt-4"
            >
              <TabsContent value="growth-record" className="m-0 border-none p-0 outline-none">
                <GrowthRecordTab 
                  records={essentialData.records} 
                  activeItems={essentialData.items.filter((i:any)=>!i.isDeactivated && !i.isArchived)} 
                  allStudents={extendedData.allStudents}
                  allRecords={[]} 
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
                <TabsContent value="measurement-input" className="m-0 border-none p-0 outline-none">
                  <MeasurementInputTab 
                    items={essentialData.items.filter((i:any)=>!i.isDeactivated && !i.isArchived)} 
                    student={essentialData.student}
                    records={essentialData.records}
                  />
                </TabsContent>
              )}
              
              <TabsContent value="my-competition" className="m-0 border-none p-0 outline-none">
                {isExtendedLoading && !extendedData.isLoaded ? (
                  <div className="py-40 flex flex-col items-center gap-6">
                    <div className="p-6 bg-primary/5 rounded-full animate-bounce">
                        <Award className="w-12 h-12 text-primary/40" />
                    </div>
                    <p className="text-xl font-black text-muted-foreground font-headline tracking-tight">나의 대진표와 전력을 AI가 정밀 분석 중입니다...</p>
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
              
              <TabsContent value="physical-knowledge" className="m-0 border-none p-0 outline-none">
                <KnowledgeTab 
                  quizzes={essentialData.quizzes} 
                  results={essentialData.results} 
                  student={essentialData.student}
                  onRefresh={loadEssentialData}
                />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}

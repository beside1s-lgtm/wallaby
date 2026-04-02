'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { getTeacherDashboardBriefing } from '@/ai/flows/teacher-ai-dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, BarChart2, TrendingUp, Sparkles, AlertCircle, Bot, ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPapsGrade, normalizePapsRecord, normalizeCustomRecord } from '@/lib/paps';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { cn } from '@/lib/utils';

type BriefingData = {
  briefing: string;
  advice: string;
};

type AiWelcomeProps = {
    title: string;
    allStudents: Student[];
    classStudents?: Student[];
    items: MeasurementItem[];
    records: MeasurementRecord[];
}

const COLORS = [
  'oklch(0.646 0.222 41.116)', 
  'oklch(0.6 0.118 184.704)', 
  'oklch(0.398 0.07 227.392)', 
  'oklch(0.828 0.189 84.429)', 
  'oklch(0.769 0.188 70.08)'
];

export default function AiWelcome({ title, allStudents, classStudents, items, records }: AiWelcomeProps) {
  const { school } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);
  
  const isClassBriefing = !!classStudents;

  const { papsChartData, customChartData, analysisDataForAI, progressAnalysisData, hasData, dialogTitle } = useMemo(() => {
    if (!school) return { papsChartData: [], customChartData: [], analysisDataForAI: null, progressAnalysisData: null, hasData: false, dialogTitle: title };
    
    const studentMap = new Map(allStudents.map(s => [s.id, s]));
    const analysisTargetStudents = classStudents || allStudents;
    
    // --- Progress Analysis Logic ---
    const progressData: Record<string, { first: number[], last: number[] }> = {};
    const itemsWithMultipleRecords = items.filter(item => {
        const studentRecords = records.filter(r => r.item === item.name && analysisTargetStudents.some(s => s.id === r.studentId));
        const studentsWithRecords = new Set(studentRecords.map(r => r.studentId));
        
        for (const studentId of studentsWithRecords) {
            const count = studentRecords.filter(r => r.studentId === studentId).length;
            if (count > 1) return true;
        }
        return false;
    });

    itemsWithMultipleRecords.forEach(item => {
        const studentRecordsMap = new Map<string, MeasurementRecord[]>();
        records.filter(r => r.item === item.name && analysisTargetStudents.some(s => s.id === r.studentId)).forEach(r => {
            if (!studentRecordsMap.has(r.studentId)) studentRecordsMap.set(r.studentId, []);
            studentRecordsMap.get(r.studentId)!.push(r);
        });

        studentRecordsMap.forEach((studentRecords, studentId) => {
            if (studentRecords.length < 2) return;
            studentRecords.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const student = studentMap.get(studentId);
            if (!student) return;

            let firstAchievement: number | null = null;
            let lastAchievement: number | null = null;

            if(item.isPaps) {
                const firstGrade = getPapsGrade(item.name, student, studentRecords[0].value);
                const lastGrade = getPapsGrade(item.name, student, studentRecords[studentRecords.length-1].value);
                if (firstGrade) firstAchievement = normalizePapsRecord(firstGrade, studentRecords[0].value, item.name, student);
                if (lastGrade) lastAchievement = normalizePapsRecord(lastGrade, studentRecords[studentRecords.length-1].value, item.name, student);
            } else {
                firstAchievement = normalizeCustomRecord(item, studentRecords[0].value);
                lastAchievement = normalizeCustomRecord(item, studentRecords[studentRecords.length-1].value);
            }

            if (firstAchievement !== null && lastAchievement !== null) {
                if (!progressData[item.name]) progressData[item.name] = { first: [], last: [] };
                progressData[item.name].first.push(firstAchievement);
                progressData[item.name].last.push(lastAchievement);
            }
        });
    });

    const finalProgressData: Record<string, { change: number, past: number, present: number }> = {};
    Object.entries(progressData).forEach(([itemName, data]) => {
        if (data.first.length === 0) return;
        const avgFirst = parseFloat((data.first.reduce((a,b) => a+b, 0) / data.first.length).toFixed(2));
        const avgLast = parseFloat((data.last.reduce((a,b) => a+b, 0) / data.last.length).toFixed(2));
        const change = parseFloat((avgLast - avgFirst).toFixed(2));
        if (change > 0) {
            finalProgressData[itemName] = { change, past: avgFirst, present: avgLast };
        }
    });

    const topProgressItems = Object.entries(finalProgressData)
        .sort(([,a], [,b]) => b.change - a.change)
        .slice(0, 3)
        .map(([name, data]) => ({ name, ...data }));


    // --- PAPS Analysis Logic ---
    const getPapsAnalysis = (studentGroup: Student[]) => {
        if (studentGroup.length === 0) return null;
        const papsItems = items.filter(item => item.isPaps);
        const papsRecords = records.filter(record => papsItems.some(item => item.name === record.item) && studentGroup.some(s => s.id === record.studentId));

        if (papsRecords.length === 0 || papsItems.length === 0) return null;
        
        const allGrades: { grade: number; student: Student }[] = [];
        const itemGrades: Record<string, { grade: number; student: Student }[]> = {};

        papsItems.forEach(item => {
            itemGrades[item.name] = [];
            studentGroup.forEach(student => {
                const studentRecords = papsRecords.filter(r => r.studentId === student.id && r.item === item.name);
                if (studentRecords.length > 0) {
                    const latestRecord = studentRecords.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const grade = getPapsGrade(item.name, student, latestRecord.value);
                    if (grade !== null) {
                        allGrades.push({ grade, student });
                        itemGrades[item.name].push({ grade, student });
                    }
                }
            });
        });

        const getAnalysis = (gradeList: { grade: number; student: Student }[]) => {
            if (gradeList.length === 0) return null;
            const totalGrade = gradeList.reduce((acc, g) => acc + g.grade, 0);
            const averageGrade = parseFloat((totalGrade / gradeList.length).toFixed(2));
            const lowPerformingCount = gradeList.filter(g => g.grade >= 4).length;
            const lowPerformingPercentage = parseFloat(((lowPerformingCount / gradeList.length) * 100).toFixed(2));
            
            const distribution: Record<string, number> = { '1등급': 0, '2등급': 0, '3등급': 0, '4등급': 0, '5등급': 0 };
            gradeList.forEach(g => {
                distribution[`${g.grade}등급`] = (distribution[`${g.grade}등급`] || 0) + 1;
            });
            Object.keys(distribution).forEach(key => {
                distribution[key] = parseFloat(((distribution[key] / gradeList.length) * 100).toFixed(2));
            });
            return { averageGrade, lowPerformingPercentage, gradeDistribution: distribution };
        };

        const overallAnalysis = getAnalysis(allGrades);
        if (!overallAnalysis) return null;

        const byItem: Record<string, { averageGrade: number }> = {};
        Object.entries(itemGrades).forEach(([itemName, gradeList]) => {
          const analysis = getAnalysis(gradeList);
          if (analysis) {
            byItem[itemName] = { averageGrade: analysis.averageGrade };
          }
        });

        return { analysis: overallAnalysis, byItem };
    };

    let papsAnalysisData: any = null;
    let finalPapsChartData: {name: string, value: number}[] = [];

    if (isClassBriefing && classStudents && classStudents.length > 0) {
        const classGrade = classStudents[0].grade;
        const gradeStudents = allStudents.filter(s => s.grade === classGrade);

        const classPaps = getPapsAnalysis(classStudents);
        const gradePaps = getPapsAnalysis(gradeStudents);
        
        if (classPaps) {
          papsAnalysisData = {
              classInfo: { grade: classGrade, classNum: classStudents[0].classNum },
              paps: {
                  class: classPaps.analysis,
                  grade: gradePaps?.analysis,
                  byItem: classPaps.byItem,
              },
          };
          finalPapsChartData = Object.entries(classPaps.analysis.gradeDistribution).map(([name, value]) => ({ name, value }));
        }
    } else {
        const overallPapsAnalysis = getPapsAnalysis(allStudents);
        if (overallPapsAnalysis) {
            const byGradeLevel: Record<string, any> = {};
            const gradeLevels = [...new Set(allStudents.map(g => g.grade))];
            gradeLevels.forEach(grade => {
                const gradeLevelStudents = allStudents.filter(s => s.grade === grade);
                const gradeAnalysis = getPapsAnalysis(gradeLevelStudents);
                if (gradeAnalysis) {
                    byGradeLevel[grade] = gradeAnalysis.analysis;
                }
            });
            papsAnalysisData = {
                paps: {
                    overall: overallPapsAnalysis.analysis,
                    byGradeLevel,
                    byItem: overallPapsAnalysis.byItem,
                },
            };
            finalPapsChartData = Object.entries(overallPapsAnalysis.analysis.gradeDistribution).map(([name, value]) => ({ name, value }));
        }
    }


    // --- Custom Items Briefing Logic ---
    const customItems = items.filter(item => !item.isPaps && item.goal && item.recordType !== 'time');
    const customRecords = records.filter(record => customItems.some(item => item.name === record.item) && analysisTargetStudents.some(s => s.id === record.studentId));
    
    let finalCustomChartData : { name: string; value: number }[] = [];
    let customItemsForAI: any = null;
    
    if (customRecords.length > 0) {
        const customInsights: Record<string, { totalPercentage: number, count: number }> = {};
        const latestRecordsForAnalysis = analysisTargetStudents.map(student => {
            return customItems.map(item => {
                return records
                    .filter(r => r.studentId === student.id && r.item === item.name)
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            }).filter(Boolean);
        }).flat();

        for (const record of latestRecordsForAnalysis) {
            const itemInfo = customItems.find(i => i.name === record.item);
            if(!itemInfo || !itemInfo.goal) continue;
            
            if (!customInsights[record.item]) {
                customInsights[record.item] = { totalPercentage: 0, count: 0 };
            }
            const percentage = normalizeCustomRecord(itemInfo, record.value);
            customInsights[record.item].totalPercentage += percentage;
            customInsights[record.item].count++;
        }

        finalCustomChartData = Object.entries(customInsights).map(([name, data]) => ({
            name,
            value: parseFloat((data.totalPercentage / data.count).toFixed(2)),
        }));

        customItemsForAI = {};
        finalCustomChartData.forEach(item => {
            customItemsForAI[item.name] = { averageAchievement: item.value };
        });
    }

    const finalAnalysisDataForAI = {
        school,
        totalStudentCount: allStudents.length,
        ...papsAnalysisData,
        customItems: customItemsForAI,
        progress: topProgressItems.length > 0 ? topProgressItems.reduce((acc, item) => {
                    acc[item.name] = item.change;
                    return acc;
                }, {} as Record<string, number>) : undefined,
    };
    
    const currentDialogTitle = isClassBriefing && classStudents ? `${classStudents[0].grade}학년 ${classStudents[0].classNum}반 AI 브리핑` : title;

    return { 
        papsChartData: finalPapsChartData, 
        customChartData: finalCustomChartData,
        analysisDataForAI: finalAnalysisDataForAI, 
        progressAnalysisData: topProgressItems, 
        hasData: finalPapsChartData.length > 0 || finalCustomChartData.length > 0,
        dialogTitle: currentDialogTitle
    };

  }, [school, allStudents, classStudents, items, records, title, isClassBriefing]);

  const fetchBriefing = useCallback(async () => {
    if (!school || !hasData || !analysisDataForAI || isAiButtonDisabled) return;
    
    setIsLoading(true);
    setBriefingData(null);
    setIsAiButtonDisabled(true);
    setIsOpen(true);
    
    setTimeout(() => setIsAiButtonDisabled(false), 10000);
    try {
        const result = await getTeacherDashboardBriefing(analysisDataForAI);
        setBriefingData(result);
    } catch (error) {
      console.error('Failed to get AI briefing:', error);
      setBriefingData({
        briefing: 'AI 브리핑을 불러오는 데 실패했습니다.',
        advice: '네트워크 연결을 확인하거나 나중에 다시 시도해주세요.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [school, hasData, analysisDataForAI, isAiButtonDisabled]);
  
  useEffect(() => {
    if (!isOpen && !isLoading) {
        setBriefingData(null);
    }
  }, [isOpen, isLoading]);

  return (
    <>
      <Button 
        onClick={fetchBriefing} 
        disabled={!hasData || isLoading || isAiButtonDisabled} 
        variant="outline"
        className={cn(
          "relative overflow-hidden font-black transition-all group h-11 px-6 rounded-xl border-primary/20",
          isLoading ? "animate-pulse" : "hover:border-primary hover:bg-primary/5 shadow-sm"
        )}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span 
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
              AI 심층 분석 중...
            </motion.span>
          ) : (
            <motion.span 
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center"
            >
              <Sparkles className="mr-2 h-4 w-4 text-primary group-hover:animate-bounce" />
              {isAiButtonDisabled ? '시스템 준비 중' : title}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col premium-card border-none p-0 overflow-hidden rounded-xl sm:rounded-[2rem]">
          <DialogHeader className="p-5 sm:p-8 pb-4 bg-primary/[0.03] border-b border-border/50">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 text-primary">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <DialogTitle className="text-xl sm:text-3xl font-black font-headline tracking-tighter sm:tracking-tight">{school} {dialogTitle}</DialogTitle>
            </div>
            <DialogDescription className="text-sm sm:text-base font-bold opacity-70">
              실시간 데이터 기반의 지능형 맞춤 분석 리포트입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 sm:space-y-10 hide-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-primary/30" />
                </motion.div>
                <p className="text-base sm:text-xl font-bold animate-pulse text-muted-foreground font-headline tracking-tight text-center">데이터 패턴 수집 및 분석 리포트 생성 중...</p>
              </div>
            ) : briefingData ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 sm:space-y-10"
              >
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  {papsChartData.length > 0 && (
                    <Card className="premium-card bg-background/50 border-border/40 p-4 sm:p-6">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-primary">
                            <BarChart2 className="w-5 h-5" />
                            PAPS 등급 분포
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">전체 학생 등급 비율입니다.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={papsChartData}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
                              {papsChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                  
                  {customChartData.length > 0 && (
                    <Card className="premium-card bg-background/50 border-border/40 p-4 sm:p-6">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-blue-600">
                            <TrendingUp className="w-5 h-5" />
                            평균 목표 달성도
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">수업 목표 대비 수행 수준입니다.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={customChartData} layout="vertical" margin={{ left: -10 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                            />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20} fill="oklch(0.6 0.118 184.704)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Progress Summary */}
                {progressAnalysisData && progressAnalysisData.length > 0 && (
                  <Card className="premium-card border-l-4 border-l-green-500 bg-green-500/[0.02] p-5 sm:p-8">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-green-700">
                            <Sparkles className="w-5 h-5" />
                            최우수 성장 지표
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">높은 성취를 보인 3대 핵심 종목입니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 p-0 pt-2">
                        {progressAnalysisData.map((item, id) => (
                          <div key={id} className="p-4 rounded-xl bg-background shadow-premium border border-border/40 group hover:border-green-500/40 transition-all">
                            <p className="text-xs sm:text-sm font-bold text-muted-foreground mb-1.5 flex items-center justify-between">
                              {item.name}
                              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            <div className="flex items-end gap-1.5">
                              <span className="text-2xl sm:text-3xl font-black text-green-600 tracking-tighter">+{item.change}%</span>
                              <span className="text-[10px] text-muted-foreground pb-1 font-black">UP</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.present}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                                className="h-full bg-green-500" 
                              />
                            </div>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}

                {/* AI Briefing Content */}
                <div className="flex flex-col gap-6 sm:gap-8 pb-10">
                  <div className="bg-primary/[0.03] p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-primary/5 rounded-full blur-[60px] sm:blur-[80px] -mr-24 -mt-24 sm:-mr-32 sm:-mt-32" />
                    <div className="flex items-center gap-2 sm:gap-3 mb-6 relative">
                      <div className="p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl">
                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                      </div>
                      <h3 className="text-xl sm:text-3xl font-black font-headline tracking-tighter text-primary">지능형 종합 분석</h3>
                    </div>
                    <div className="relative">
                       <p className="text-base sm:text-xl leading-[1.8] sm:leading-[2.2] font-semibold text-foreground/80 whitespace-pre-wrap italic">
                         {briefingData.briefing}
                       </p>
                    </div>
                  </div>

                  <div className="bg-accent/[0.03] p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-accent/10 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-accent/5 rounded-full blur-[60px] sm:blur-[80px] -ml-24 -mb-24 sm:-ml-32 sm:-mb-32" />
                    <div className="flex items-center gap-2 sm:gap-3 mb-6 relative">
                      <div className="p-2 sm:p-3 bg-accent/10 rounded-xl sm:rounded-2xl">
                        <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
                      </div>
                      <h3 className="text-xl sm:text-3xl font-black font-headline tracking-tighter text-accent">전략적 교수-학습 제언</h3>
                    </div>
                    <div className="relative">
                       <p className="text-base sm:text-xl leading-[1.8] sm:leading-[2.2] font-semibold text-foreground/80 whitespace-pre-wrap">
                         {briefingData.advice}
                       </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-20">
                <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 opacity-20" />
                <p className="text-lg sm:text-2xl font-black opacity-30 text-center">표시할 분석 데이터가 부족합니다.</p>
              </div>
            )}
          </div>
          <div className="p-5 sm:p-8 bg-muted/20 border-t border-border/50 flex justify-center sm:justify-end">
            <Button onClick={() => setIsOpen(false)} size="lg" className="w-full sm:w-auto h-12 sm:h-14 sm:px-12 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl shadow-premium hover:scale-105 active:scale-95 transition-all">
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

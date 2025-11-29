
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getTeacherDashboardBriefing } from '@/ai/flows/teacher-ai-dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, BarChart2, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPapsGrade, normalizePapsRecord, normalizeCustomRecord } from '@/lib/paps';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';

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
    
    // --- Logic for Progress Analysis (based on the target student group) ---
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
            const firstRecord = studentRecords[0];
            const lastRecord = studentRecords[studentRecords.length - 1];
            const student = studentMap.get(studentId);
            if (!student) return;

            let firstAchievement: number | null = null;
            let lastAchievement: number | null = null;

            if(item.isPaps) {
                const firstGrade = getPapsGrade(item.name, student, firstRecord.value);
                const lastGrade = getPapsGrade(item.name, student, lastRecord.value);
                if (firstGrade) firstAchievement = normalizePapsRecord(firstGrade, firstRecord.value, item.name, student);
                if (lastGrade) lastAchievement = normalizePapsRecord(lastGrade, lastRecord.value, item.name, student);
            } else {
                firstAchievement = normalizeCustomRecord(item, firstRecord.value);
                lastAchievement = normalizeCustomRecord(item, lastRecord.value);
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
        if (change > 0) { // Only show improvements
            finalProgressData[itemName] = { change, past: avgFirst, present: avgLast };
        }
    });

    const topProgressItems = Object.entries(finalProgressData)
        .sort(([,a], [,b]) => b.change - a.change)
        .slice(0, 3)
        .map(([name, data]) => ({ name, ...data }));


    // --- Logic for Main Briefing ---
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
    } else { // Overall briefing
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


    // --- Logic for Custom Items Briefing ---
    const customItems = items.filter(item => !item.isPaps && item.goal && item.recordType !== 'time');
    const customRecords = records.filter(record => customItems.some(item => item.name === record.item) && analysisTargetStudents.some(s => s.id === record.studentId));
    
    let finalCustomChartData : { name: string; value: number }[] = [];
    let customItemsForAI: any = null;
    
    if (customRecords.length > 0) {
        const customInsights: Record<string, { totalPercentage: number, count: number }> = {};
        const latestRecordMap = new Map<string, string>(); // key: studentId-itemId, value: recordId

        analysisTargetStudents.forEach(student => {
            customItems.forEach(item => {
                const latest = records
                    .filter(r => r.studentId === student.id && r.item === item.name)
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                if (latest) {
                    latestRecordMap.set(`${student.id}-${item.name}`, latest.id);
                }
            });
        });

        for (const record of customRecords) {
            if (latestRecordMap.get(`${record.studentId}-${record.item}`) !== record.id) continue;

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

  const fetchBriefing = async () => {
    if (!school || !hasData || !analysisDataForAI || isAiButtonDisabled) return;
    
    setIsLoading(true);
    setBriefingData(null);
    setIsAiButtonDisabled(true);
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
  };
  
  useEffect(() => {
    if (!isOpen) {
        setBriefingData(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={fetchBriefing} disabled={!hasData || isLoading || isAiButtonDisabled} variant="outline">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
          {isLoading ? "분석 중..." : isAiButtonDisabled ? '10초 후에 다시 시도하세요' : title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-headline">{school} {dialogTitle}</DialogTitle>
           <DialogDescription>
            학생들의 PAPS 및 기타 종목 데이터를 종합 분석하여 생성된 AI 리포트입니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : briefingData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {papsChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-primary" />
                        PAPS 등급 분포 (%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={papsChartData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" stroke="hsl(var(--chart-1))" domain={[0, 100]} unit="%" />
                        <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                            formatter={(value) => [`${value}%`, '비율']}
                        />
                        <Bar yAxisId="left" dataKey="value" name="등급 비율" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              
              {customChartData.length > 0 && (
                 <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-accent" />
                        기타 종목 평균 목표 달성률 (%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={customChartData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" stroke="hsl(var(--chart-2))" domain={[0, 100]} unit="%" />
                        <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                            formatter={(value) => [`${value}%`, '평균 달성률']}
                        />
                        <Bar yAxisId="left" dataKey="value" name="목표 달성률" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              
              {progressAnalysisData && progressAnalysisData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            주요 성장 종목 (평균 성취도)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                           <BarChart data={progressAnalysisData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} unit="%" />
                                <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 12}} />
                                <Tooltip
                                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                                    formatter={(value, name) => [`${value}%`, name === 'past' ? '과거 성취도' : '현재 성취도']}
                                />
                                <Legend />
                                <Bar dataKey="past" name="과거" fill="hsl(var(--chart-4))" />
                                <Bar dataKey="present" name="현재" fill="hsl(var(--chart-2))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
              )}

              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    종합 브리핑
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{briefingData.briefing}</p>
                </CardContent>
                 <CardHeader>
                  <CardTitle className="flex items-center gap-2 pt-4 border-t">
                    <Lightbulb className="w-5 h-5 text-accent" />
                    수업 조언
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{briefingData.advice}</p>
                </CardContent>
              </Card>

            </div>
          ) : (
             <div className="flex items-center justify-center h-full">
                <p>표시할 데이터가 없습니다.</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setIsOpen(false)}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

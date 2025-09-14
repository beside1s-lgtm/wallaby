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
  LineChart,
  Line,
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
    itemType: 'paps' | 'custom';
    title: string;
    students: Student[];
    items: MeasurementItem[];
    records: MeasurementRecord[];
}

const progressChartConfig = {
  past: { label: "과거", color: "hsl(var(--chart-4))" },
  present: { label: "현재", color: "hsl(var(--chart-2))" },
};

export default function AiWelcome({ itemType, title, students, items, records }: AiWelcomeProps) {
  const { school } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);

  const { chartData, papsAnalysisData, progressAnalysisData, hasData } = useMemo(() => {
    if (!school) return { chartData: [], papsAnalysisData: null, progressAnalysisData: null, hasData: false };

    const studentMap = new Map(students.map(s => [s.id, s]));
    
    // --- Logic for Progress Analysis ---
    const progressData: Record<string, { first: number[], last: number[], count: number }> = {};
    const itemsWithMultipleRecords = items.filter(item => {
        const studentRecords = records.filter(r => r.item === item.name);
        const studentsWithMultiple = new Set(studentRecords.map(r => r.studentId)).size;
        // At least one student should have more than 1 record for this item
        return studentRecords.length > studentsWithMultiple;
    });

    itemsWithMultipleRecords.forEach(item => {
        const studentRecordsMap = new Map<string, MeasurementRecord[]>();
        records.filter(r => r.item === item.name).forEach(r => {
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
                if (!progressData[item.name]) progressData[item.name] = { first: [], last: [], count: 0 };
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


    // --- Logic for PAPS & Custom Briefing ---
    if (itemType === 'paps') {
        const papsItems = items.filter(item => item.isPaps);
        const papsRecords = records.filter(record => papsItems.some(item => item.name === record.item));

        if (papsRecords.length === 0 || papsItems.length === 0 || students.length === 0) {
            return { chartData: [], papsAnalysisData: null, progressAnalysisData: topProgressItems, hasData: false };
        }
        
        const allGrades: { grade: number; student: Student }[] = [];
        papsItems.forEach(item => {
            students.forEach(student => {
                const studentRecords = papsRecords.filter(r => r.studentId === student.id && r.item === item.name);
                if (studentRecords.length > 0) {
                    const latestRecord = studentRecords.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const grade = getPapsGrade(item.name, student, latestRecord.value);
                    if (grade !== null) {
                        allGrades.push({ grade, student });
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
        const byGradeLevel: Record<string, any> = {};
        const gradeLevels = [...new Set(allGrades.map(g => g.student.grade))];
        gradeLevels.forEach(grade => {
            const gradeLevelGrades = allGrades.filter(g => g.student.grade === grade);
            const analysis = getAnalysis(gradeLevelGrades);
            if (analysis) {
                byGradeLevel[grade] = analysis;
            }
        });
        
        if (!overallAnalysis) return { chartData: [], papsAnalysisData: null, progressAnalysisData: topProgressItems, hasData: false };

        const papsAnalysisDataForAI = {
            overall: overallAnalysis,
            byGradeLevel: byGradeLevel,
        };

        const chartDataForPaps = Object.entries(overallAnalysis.gradeDistribution).map(([name, value]) => ({
            name,
            paps: value,
        }));
        
        return { chartData: chartDataForPaps, papsAnalysisData: papsAnalysisDataForAI, progressAnalysisData: topProgressItems, hasData: true };
    }

    // --- Logic for Custom Items Briefing ---
    const customItems = items.filter(item => !item.isPaps && item.goal && item.recordType !== 'time');
    const customRecords = records.filter(record => customItems.some(item => item.name === record.item));
    if (customRecords.length === 0) {
        return { chartData: [], papsAnalysisData: null, progressAnalysisData: topProgressItems, hasData: false };
    }
    
    const customInsights: Record<string, { totalPercentage: number, count: number }> = {};
    for (const record of customRecords) {
        const itemInfo = customItems.find(i => i.name === record.item);
        if(!itemInfo || !itemInfo.goal) continue;
        
        const student = studentMap.get(record.studentId);
        if (!student) continue;

        // Take only the latest record for each student per item
        const latestRecord = records
            .filter(r => r.studentId === student.id && r.item === itemInfo.name)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        if (latestRecord.id === record.id) {
            if (!customInsights[record.item]) {
                customInsights[record.item] = { totalPercentage: 0, count: 0 };
            }
            const percentage = normalizeCustomRecord(itemInfo, record.value);
            customInsights[record.item].totalPercentage += percentage;
            customInsights[record.item].count++;
        }
    }

    const finalChartData = Object.entries(customInsights).map(([name, data]) => ({
        name,
        custom: parseFloat((data.totalPercentage / data.count).toFixed(2)),
    }));
    
    return { chartData: finalChartData, papsAnalysisData: null, progressAnalysisData: topProgressItems, hasData: finalChartData.length > 0 };

  }, [school, itemType, students, items, records]);

  const fetchBriefing = async () => {
    if (!school || !hasData) return;
    
    setIsLoading(true);
    try {
        if (itemType === 'paps' && papsAnalysisData) {
            const input: any = {
                school,
                totalStudentCount: students.length,
                paps: papsAnalysisData
            };
            if (progressAnalysisData && progressAnalysisData.length > 0) {
                input.progress = progressAnalysisData.reduce((acc, item) => {
                    acc[item.name] = item.change;
                    return acc;
                }, {} as Record<string, number>);
            }

            const result = await getTeacherDashboardBriefing(input);
            setBriefingData(result);
        } else {
             setBriefingData({
                briefing: '기타 종목에 대한 AI 브리핑은 현재 지원되지 않습니다. PAPS 종목 브리핑을 이용해주세요.',
                advice: '측정 종목 관리에서 PAPS 종목을 추가하여 분석을 받아보실 수 있습니다.',
             });
        }
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
    // Reset briefing data when dialog closes
    if (!isOpen) {
        setBriefingData(null);
    } else if (isOpen && !briefingData) {
        fetchBriefing();
    }
  }, [isOpen]);


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasData} variant="outline">{title}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-headline">{school} AI {title}</DialogTitle>
           <DialogDescription>
            {itemType === 'paps' 
                ? '학생들의 PAPS 등급 분포와 평균, 성장 추이를 기반으로 생성된 AI 분석입니다.' 
                : '기타 종목의 평균 목표 달성률을 표시합니다.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : briefingData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-primary" />
                        {itemType === 'paps' ? '전체 등급 분포 (%)' : '종목별 평균 달성률 (%)'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" stroke="hsl(var(--chart-1))" domain={[0, 100]} unit="%" />
                        <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                             formatter={(value, name, props) => {
                                const key = props.dataKey as 'paps' | 'custom';
                                return [`${value}%`, key === 'paps' ? '비율' : '평균 달성률'];
                            }}
                        />
                        <Legend />
                        {itemType === 'paps' && <Bar yAxisId="left" dataKey="paps" name="등급 비율" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />}
                        {itemType === 'custom' && <Bar yAxisId="left" dataKey="custom" name="목표 달성률" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                
                {itemType === 'paps' && progressAnalysisData && progressAnalysisData.length > 0 && (
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
                                    <YAxis type="category" dataKey="name" width={100} />
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

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-accent" />
                      종합 브리핑
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{briefingData.briefing}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-primary" />
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

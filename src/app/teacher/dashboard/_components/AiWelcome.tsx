'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getRecords, getStudents, getItems } from '@/lib/store';
import { getTeacherDashboardBriefing } from '@/ai/flows/teacher-ai-dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, BarChart2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPapsGrade, papsStandards } from '@/lib/paps';

type BriefingData = {
  briefing: string;
  advice: string;
};

export default function AiWelcome() {
  const { school } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);

  const { chartData, performanceInsights } = useMemo(() => {
    if (!school) return { chartData: [], performanceInsights: {} };

    const allRecords = getRecords(school);
    const allStudents = getStudents(school);
    const allItems = getItems(school);
    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    if (allRecords.length === 0) return { chartData: [], performanceInsights: {} };

    const insights: Record<string, { type: 'grade' | 'percentage'; value: number, count: number }> = {};
    const perfInsightsForAI: Record<string, { type: 'grade' | 'percentage'; value: number }> = {};

    for (const record of allRecords) {
      const itemInfo = allItems.find(i => i.name === record.item);
      const student = studentMap.get(record.studentId);
      if (!itemInfo || !student) continue;

      if (!insights[record.item]) {
        insights[record.item] = { type: 'grade', value: 0, count: 0 };
      }

      if (papsStandards[record.item]) {
        const grade = getPapsGrade(record.item, student.gender, record.value);
        if (grade !== null) {
          insights[record.item].type = 'grade';
          insights[record.item].value += grade;
          insights[record.item].count++;
        }
      } else if (itemInfo.goal && itemInfo.recordType !== 'time') {
        const percentage = Math.min(100, (record.value / itemInfo.goal) * 100);
        insights[record.item].type = 'percentage';
        insights[record.item].value += percentage;
        insights[record.item].count++;
      }
    }

    const finalChartData = Object.entries(insights)
      .filter(([, data]) => data.count > 0)
      .map(([name, data]) => {
        const average = parseFloat((data.value / data.count).toFixed(2));
        perfInsightsForAI[name] = { type: data.type, value: average };
        return {
          name,
          paps: data.type === 'grade' ? average : null,
          custom: data.type === 'percentage' ? average : null,
        };
      });

    return { chartData: finalChartData, performanceInsights: perfInsightsForAI };
  }, [school]);


  useEffect(() => {
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    if (!welcomeShown && school) {
      setIsOpen(true);
      sessionStorage.setItem('welcomeShown', 'true');

      const fetchBriefing = async () => {
        setIsLoading(true);
        try {
          const allStudents = getStudents(school);
          
          if (Object.keys(performanceInsights).length === 0) {
            setBriefingData({
              briefing: '기록된 데이터가 없습니다.',
              advice: '학생들의 기록을 입력하여 분석을 시작해보세요.',
            });
            return;
          }

          const result = await getTeacherDashboardBriefing({
            school,
            performanceInsights: performanceInsights,
            totalStudentCount: allStudents.length,
            studentRankings: {},
          });
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

      fetchBriefing();
    } else {
        setIsLoading(false);
    }
  }, [school, performanceInsights]);

  if (!isOpen || !school) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-headline">{school} AI 수업 브리핑</DialogTitle>
          <DialogDescription>
            전체 학생의 평균 데이터를 기반으로 AI가 생성한 요약 및 조언입니다.
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
                        종목별 평균 등급 / 달성률
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))" domain={[1, 5]} reversed={true} ticks={[1,2,3,4,5]} tickCount={5} />
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" domain={[0, 100]} unit="%" />
                        <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                            formatter={(value, name) => {
                                if (name === 'paps') return [`${value} 등급`, '평균 등급'];
                                if (name === 'custom') return [`${value} %`, '평균 달성률'];
                                return [value, name];
                            }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="paps" name="PAPS 등급" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="custom" name="목표 달성률" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                
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
          ) : null}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setIsOpen(false)}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
